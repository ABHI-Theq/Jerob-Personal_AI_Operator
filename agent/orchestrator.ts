import { isCancel, text, confirm, select } from "@clack/prompts";
import chalk from "chalk";
import { defaultAgentConfig } from "./types";
import { ActionTracker } from "./action-tracker";
import { ToolExecutor } from "./tool-executor";
import { stepCountIs, ToolLoopAgent } from "ai";
import { getAgentModel } from "../config/ai.config";
import { createAgentTools } from "./agent-tools";
import { renderHTMLMarkdown } from "../tui/terminal-render";
import { withSpinner } from "../tui/spinner";
import { runApprovalFlow } from "./approval";

async function withRetries<T>(operation: () => Promise<T>, retries = 2, delayMs = 1200): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      const message = error instanceof Error ? error.message : String(error);
      console.log(chalk.yellow(`\nAI request failed (${attempt + 1}/${retries + 1}): ${message}. Retrying...`));
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

export async function runAgentMode() {
  console.log(chalk.bold("\n🤖 Agent Mode\n"));

  const config = defaultAgentConfig();
  const tracker = new ActionTracker();
  const executor = new ToolExecutor(tracker, config);
  const tools = createAgentTools(executor);
  const agent = new ToolLoopAgent({
    model: getAgentModel(),
    instructions: `
    WorkDir: ${config.codebasePath}
    You are a helpful AI assistant to perform different tasks based on the query
    Keep All changes in staged until Approval 
    If the user asks to create a new project, scaffold it inside a new subfolder under the current workspace.
    If the user asks for changes in the current directory, make changes in the current workspace only.
    Create new File or Folder based on the user input on each step you have to ask user wether to save this in new file or existing file based on query or not
    
    Show File location(s) where edits are done
    `,
    tools,
    stopWhen: stepCountIs(30),
  });

  while (true) {
    const goal = await text({
      message: "What would you like the agent to do?",
      placeholder: "Concrete task for this codebase…",
    });

    if (isCancel(goal) || !goal.trim()) break;

    let result;
    try {
      result = await withSpinner("Running agent…", async () =>
        withRetries(() =>
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
        ),
      );
    } catch (error) {
      console.log(chalk.red("\nAgent request failed after retries."));
      console.log(chalk.red(error instanceof Error ? error.message : String(error)));
      continue;
    }

    if (result.text?.trim()) console.log("\n" + renderHTMLMarkdown(result.text) + "\n");

    const approve = await confirm({
      message: "Approve these changes?",
      initialValue: true,
    });

    if (isCancel(approve)) break;

    if (approve) {
      const { errors } = executor.applyApprovedFromTracker();
      if (errors.length) {
        console.log(chalk.red("\nSome operations reported errors:\n"));
        for (const e of errors) console.log(chalk.red(`  • ${e}`));
      } else {
        console.log(chalk.green("\n✓ Applied.\n"));
      }
    } else {
      executor.clearStaging();
      console.log(chalk.yellow("Changes discarded.\n"));
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