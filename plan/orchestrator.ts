import chalk from 'chalk';
import { confirm, isCancel, text } from '@clack/prompts';
import fs from 'node:fs';
import path from 'node:path';
import { ToolLoopAgent, stepCountIs } from 'ai';
import { ActionTracker } from '../agent/action-tracker.ts';
import { ToolExecutor } from '../agent/tool-executor.ts';
import { createAgentTools } from '../agent/agent-tools.ts';
import { defaultAgentConfig } from '../agent/types.ts';
import { runApprovalFlow } from '../agent/approval.ts';
import { generatePlan } from './planner';
import { printPlan, selectSteps } from './selection';
import { createWebTools } from './web-tools';
import type { PlanStep } from './types';
import { renderHTMLMarkdown } from '../tui/terminal-render.ts';
import { getAgentModel } from '../config/ai.config.ts';
import { withSpinner } from '../tui/spinner';
import { withLLMRetry, printLLMError } from '../utils/llm-error';

function stepPrompt(goal: string, step: PlanStep, projectDir?: string): string {
  const parts = [`Overall Goal: ${goal}`, `Current Step: ${step.title}`, step.description];
  if (projectDir) {
    parts.push(`\nIMPORTANT: The project already exists at: ${projectDir}\nAll file operations MUST be inside this folder. Do NOT create a new project folder.`);
  }
  return parts.join('\n');
}

/** After each step, detect which project folder was created/modified */
function detectProjectDir(codebasePath: string, knownDir?: string): string | undefined {
  if (knownDir) return knownDir;
  // Look for folders that contain a package.json — likely the project root
  try {
    const entries = fs.readdirSync(codebasePath, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (['node_modules', '.git', 'dist', 'build'].includes(e.name)) continue;
      const pkgPath = path.join(codebasePath, e.name, 'package.json');
      if (fs.existsSync(pkgPath)) return e.name;
    }
  } catch {}
  return undefined;
}

export async function runPlanMode(): Promise<void> {
  console.log(chalk.bold('\n🧭 Plan Mode\n'));

  const goal = await text({ message: 'What is your goal?' });
  if (isCancel(goal) || !goal.trim()) return;
  const includeWorkspace = await confirm({
    message: 'Include workspace research (scan repository)?',
    initialValue: true,
  });

  const spinnerLabel = includeWorkspace ? 'Researching & drafting a plan…' : 'Drafting plan…';
  let plan;
  try {
    plan = await withSpinner(spinnerLabel, async () =>
      generatePlan(goal.trim(), { useWorkspace: includeWorkspace as boolean }),
    );
  } catch (err) {
    printLLMError(err, "Plan");
    return;
  }
  printPlan(plan);

  const wantsSave = await confirm({
    message: 'Save this plan to a .md file?',
    initialValue: true,
  });

  let savedPath: string | undefined;
  if (wantsSave) {
    const filename = await text({ message: 'Filename', initialValue: 'plan.md', validate: (v) => {
      const s = (v ?? '').trim();
      if (!s) return 'Required';
      if (s.includes('..') || s.includes('/') || s.includes('\\')) return 'No paths';
      if (!s.toLowerCase().endsWith('.md')) return 'Must end with .md';
    } });
    if (!isCancel(filename)) {
      const outPath = path.resolve(process.cwd(), filename.trim());
      const md = [`# Plan: ${plan.goal}`, '', '```json', JSON.stringify({ goal: plan.goal, researchSummary: plan.researchSummary, steps: plan.steps }, null, 2), '```', ''].join('\n');
      fs.writeFileSync(outPath, md, 'utf8');
      savedPath = outPath;
      console.log(chalk.green(`Saved plan to ${outPath}`));
    }
  }

  const selected = await selectSteps(plan);
  if (selected.length === 0) return;

  const executeNow = await confirm({ message: `Execute ${selected.length} step(s) via Agent Mode?`, initialValue: false });
  if (!isCancel(executeNow) && executeNow) {
    // Ensure plan is stored in an .md file to drive execution
    if (!savedPath) {
      const mustSave = await confirm({ message: 'Execution requires a saved plan .md file. Save now?', initialValue: true });
      if (isCancel(mustSave) || !mustSave) {
        console.log(chalk.yellow('Execution cancelled (plan not saved).'));
        return;
      }
      const filename = await text({ message: 'Filename', initialValue: 'plan.md', validate: (v) => {
        const s = (v ?? '').trim();
        if (!s) return 'Required';
        if (s.includes('..') || s.includes('/') || s.includes('\\')) return 'No paths';
        if (!s.toLowerCase().endsWith('.md')) return 'Must end with .md';
      } });
      if (isCancel(filename)) return;
      const outPath = path.resolve(process.cwd(), filename.trim());
      const md = [`# Plan: ${plan.goal}`, '', '```json', JSON.stringify({ goal: plan.goal, researchSummary: plan.researchSummary, steps: plan.steps }, null, 2), '```', ''].join('\n');
      fs.writeFileSync(outPath, md, 'utf8');
      savedPath = outPath;
      console.log(chalk.green(`Saved plan to ${outPath}`));
    }

    // Read plan from savedPath and parse JSON block
    let planObj: { goal: string; researchSummary?: string; steps: PlanStep[] } | null= null;
    try {
      const raw = fs.readFileSync(savedPath!, 'utf8');
      const m = raw.match(/```json\s*([\s\S]*?)\s*```/i);
      if (m && m[1]) {
        planObj = JSON.parse(m[1]);
      } else {
        throw new Error('No JSON block found in plan file');
      }
    } catch (err) {
      console.log(chalk.red('Failed to parse saved plan .md; aborting execution.')); 
      console.error(err);
      return;
    }

    const config = defaultAgentConfig();
    // Single tracker accumulates all step actions for the final review log
    const tracker = new ActionTracker();
    const executor = new ToolExecutor(tracker, config);

    const tools = {
      ...createAgentTools(executor),
      ...(process.env.FIRECRAWL_API_KEY ? createWebTools(tracker) : {}),
    };

    let projectDir: string | undefined;
    const totalSteps = planObj!.steps.length;
    const allErrors: string[] = [];

    for (let stepIdx = 0; stepIdx < planObj!.steps.length; stepIdx++) {
      const step = planObj!.steps[stepIdx]!;
      console.log(chalk.bold(`\n🔧 [${stepIdx + 1}/${totalSteps}] ${step.title}\n`));

      // Detect project folder from real disk (visible after previous step was applied)
      projectDir = detectProjectDir(config.codebasePath, projectDir);

      const agent = new ToolLoopAgent({
        model: getAgentModel(),
        stopWhen: stepCountIs(30),
        tools,
        instructions: `
WorkDir: ${config.codebasePath}
You are an AI coding agent executing ONE step of a multi-step plan.

CRITICAL RULES:
1. This is step ${stepIdx + 1} of ${totalSteps}. Do ONLY what this step describes — no more, no less.
2. ${projectDir
  ? `The project already exists at "${projectDir}/" (relative to WorkDir). ALL files MUST go inside "${projectDir}/". NEVER create a new top-level folder.`
  : `If this step scaffolds a new project, choose ONE folder name. Every subsequent step will use that same folder.`}
3. ALWAYS call list_files first to see what already exists on disk. Use modify_file for existing files, create_file only for genuinely new ones.
4. NEVER create a duplicate or alternate project folder. There is exactly ONE project folder.
5. Use create_file / modify_file / create_folder tools only — never print code as plain text.
        `.trim(),
      });

      let r;
      try {
        r = await withLLMRetry(
          () => agent.generate({
            prompt: stepPrompt(planObj!.goal, step, projectDir),
            onStepFinish: ({ toolCalls }) => {
              for (const tc of toolCalls) {
                const preview = JSON.stringify(tc?.input).slice(0, 160);
                console.log(chalk.green('  ✓'), chalk.bold(String(tc?.toolName)), chalk.dim(preview + (preview.length >= 160 ? '...' : '')));
              }
            },
          }),
          { maxRetries: 3, context: `Step: ${step.title}` }
        );
      } catch (err) {
        printLLMError(err, `Step: ${step.title}`);
        continue;
      }
      if (r.text?.trim()) console.log(renderHTMLMarkdown(r.text));

      // Auto-approve and apply this step's staged changes immediately to disk
      // so the next step's list_files sees the real files
      const pending = tracker.getPendingMutations();
      for (const a of pending) tracker.updateStatus(a.id, 'approved', true);
      const { errors } = executor.applyApprovedFromTracker();
      executor.clearStaging();
      if (errors.length) {
        allErrors.push(...errors.map(e => `[${step.title}] ${e}`));
        console.log(chalk.yellow(`  ⚠ ${errors.length} error(s) applying step — continuing`));
      } else {
        console.log(chalk.green(`  ✓ Step ${stepIdx + 1} applied to disk\n`));
      }

      // Re-detect project dir now that files are on disk
      projectDir = detectProjectDir(config.codebasePath, projectDir);
    }

    if (allErrors.length) {
      console.log(chalk.red('\nErrors during execution:'));
      for (const e of allErrors) console.log(chalk.red(`  • ${e}`));
    } else {
      console.log(chalk.green('\n✓ All steps applied.\n'));
    }
  }
}