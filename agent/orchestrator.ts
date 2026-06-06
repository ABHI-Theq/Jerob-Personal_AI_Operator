import { isCancel, text, confirm, select } from "@clack/prompts";
import chalk from "chalk";
import { defaultAgentConfig } from "./types";
import { ActionTracker } from "./action-tracker";
import { ToolExecutor } from "./tool-executor";
import path from "node:path";
import { stepCountIs, ToolLoopAgent } from "ai";
import { getAgentModel } from "../config/ai.config";
import { createAgentTools } from "./agent-tools";
import { renderHTMLMarkdown } from "../tui/terminal-render";
import { withSpinner } from "../tui/spinner";
import { runApprovalFlow } from "./approval";
import { withLLMRetry, printLLMError } from "../utils/llm-error";

export async function runAgentMode() {
  console.log(chalk.bold("\n🤖 Agent Mode\n"));

  const config = defaultAgentConfig();

  while (true) {
    const tracker = new ActionTracker();
    const executor = new ToolExecutor(tracker, config);
    const tools = createAgentTools(executor);
    const agent = new ToolLoopAgent({
      model: getAgentModel(),
      instructions: `
WorkDir: ${config.codebasePath}
You are a helpful AI coding agent. You MUST use the provided file tools to stage all workspace changes — never describe or print code as plain text.
Rules:
- Use create_file to create new files with their full content. NEVER print file contents in plain text.
- Use modify_file to update existing files with full new content. NEVER print file contents in plain text.
- Use create_folder to create directory structures.
- Use delete_file to delete files.
- Use read_file and list_files to inspect the workspace before writing.
- For project scaffolding (React, Vite, Next.js, etc.) use execute_shell to run scaffold commands (e.g. "npx create-react-app my-app", "bun create vite my-app", "npx create-next-app@latest").
- When using execute_shell for scaffolding, also stage key resulting files using create_file so the user can review them.
- New standalone projects go in a new subfolder. Enhancements to existing code stay in the current workspace root.
- Do not create a new top-level folder unless the user explicitly requests a new project.
- Always show file paths as tool calls, never only in plain text.
- Stage all changes pending user approval. Do not finalize anything before approval.
      `.trim(),
      tools,
      stopWhen: stepCountIs(30),
    });

    const goal = await text({
      message: "What would you like the agent to do?",
      placeholder: "Concrete task for this codebase…",
    });

    if (isCancel(goal) || !goal.trim()) break;

    let result;
    try {
      result = await withSpinner("Running agent…", async () =>
        withLLMRetry(
          () =>
            agent.generate({
              prompt: goal.trim(),
              onStepFinish: ({ toolCalls }) => {
                for (const tc of toolCalls) {
                  const preview = JSON.stringify(tc.input).slice(0, 160);
                  console.log(
                    chalk.green("  ✓"),
                    chalk.bold(String(tc.toolName)),
                    chalk.dim(preview + (preview.length >= 160 ? "..." : "")),
                  );
                }
              },
            }),
          { maxRetries: 3, context: "Agent" }
        ),
      );
    } catch (error) {
      printLLMError(error, "Agent");
      continue;
    }

    const pending = tracker.getPendingMutations();
    const pendingCount = pending.length;
    if (pendingCount === 0) {
      console.log(chalk.yellow("\nNo staged file or folder changes detected. The agent may have described a change without staging it."));
    } else {
      console.log(chalk.dim(`\nStaged changes: ${pendingCount}`));
      for (const p of pending) {
        const kind = p.type;
        const pathLabel = p.path || "(no path)";
        if (kind === "tool_execute") {
          console.log(chalk.cyan(`  • Shell queued: ${p.details.command ?? "(unknown)"}`));
        } else if (kind === "folder_create") {
          console.log(chalk.cyan(`  • Folder: ${pathLabel}`));
        } else if (kind === "file_create") {
          console.log(chalk.cyan(`  • New file staged: ${pathLabel}`));
        } else if (kind === "file_modify") {
          console.log(chalk.cyan(`  • Modify staged: ${pathLabel}`));
        } else if (kind === "file_delete") {
          console.log(chalk.cyan(`  • Delete staged: ${pathLabel}`));
        } else {
          console.log(chalk.cyan(`  • ${kind}: ${pathLabel}`));
        }
      }
    }

    if (result.text?.trim()) console.log("\n" + renderHTMLMarkdown(result.text) + "\n");

    const approved = await runApprovalFlow(tracker);
    if (!approved) {
      executor.clearStaging();
      console.log(chalk.yellow("No changes were applied.\n"));
    } else {
      const { errors, newFiles } = executor.applyApprovedFromTracker();
      executor.clearStaging();
      if (errors.length) {
        console.log(chalk.red("\nSome operations reported errors:\n"));
        for (const e of errors) console.log(chalk.red(`  • ${e}`));
      } else {
        console.log(chalk.green("\n✓ Applied.\n"));
      }
      // If scaffolding created new files, offer to run a follow-up coding pass
      if (newFiles && newFiles.length) {
        // identify top-level new folders
        const roots = new Set<string>();
        for (const f of newFiles) {
          const seg = f.split(/\//)[0];
          roots.add(seg || f);
        }
        if (roots.size === 1) {
          const folder = Array.from(roots)[0];
          const cont = await confirm({
            message: `Scaffold created folder '${folder}'. Run follow-up to implement: ${goal.trim()} ?`,
            initialValue: true,
          });
          if (!isCancel(cont) && cont) {
            // run follow-up coding inside the new folder
            const followGoal = `Implement the user's requested task: ${goal.trim()} inside this project. Write runnable code, use the project's conventions, and stage files with create_file or modify_file for approval.`;
            const followTracker = new ActionTracker();
            const followConfig = { ...config, codebasePath: path.join(config.codebasePath, folder as string) };
            const followExecutor = new ToolExecutor(followTracker, followConfig);
            const followTools = createAgentTools(followExecutor);
            const followAgent = new ToolLoopAgent({ model: getAgentModel(), instructions: `WorkDir: ${followConfig.codebasePath}
Use file tools to stage changes. Implement the feature fully.`, tools: followTools, stopWhen: stepCountIs(60) });

            let followResult;
            try {
              followResult = await withSpinner("Running follow-up agent…", async () =>
                withLLMRetry(
                  () => followAgent.generate({ prompt: followGoal }),
                  { maxRetries: 3, context: "Agent follow-up" }
                ),
              );
            } catch (err) {
              printLLMError(err, "Agent follow-up");
              continue;
            }

            if (followResult?.text?.trim()) console.log("\n" + renderHTMLMarkdown(followResult.text) + "\n");
            const ok2 = await runApprovalFlow(followTracker);
            if (ok2) {
              const { errors: e2 } = followExecutor.applyApprovedFromTracker();
              followExecutor.clearStaging();
              if (e2.length) {
                console.log(chalk.red("\nFollow-up reported errors:\n"));
                for (const ee of e2) console.log(chalk.red(`  • ${ee}`));
              } else {
                console.log(chalk.green("\n✓ Follow-up applied.\n"));
              }
            } else {
              followExecutor.clearStaging();
              console.log(chalk.yellow("Follow-up canceled.\n"));
            }
          }
        }
      }
    }

    const next = await select({
      message: "What next?",
      options: [
        { value: "continue", label: "Ask next task" },
        { value: "exit", label: "Exit Agent Mode" },
      ],
    });

    if (isCancel(next) || next === "exit") break;
  }
}