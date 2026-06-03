# Browser Agent

Autonomous browser automation using Stagehand's agent API with an iterative Plan → Execute → Evaluate loop (up to 5 cycles).

## Architecture

```
User Query
    │
    ▼
┌─────────────────────────────────────┐
│  ITERATION LOOP (max 5)             │
│                                     │
│  1. PLANNER                         │
│     LLM generates automation plan  │
│     (with feedback on retry)        │
│             │                       │
│             ▼                       │
│  2. EXECUTOR                        │
│     Stagehand agent() runs the task │
│     autonomously via DOM mode       │
│             │                       │
│             ▼                       │
│  3. EVALUATOR                       │
│     Scores result 0-100             │
│     Checks completeness & accuracy  │
│             │                       │
│             ▼                       │
│  4. DECISION                        │
│     score ≥ 80  → done              │
│     max iters   → return best       │
│     otherwise   → feedback → retry  │
└─────────────────────────────────────┘
    │
    ▼
Final Result (console + optional JSON/MD save)
```

## Files

| File | Role |
|------|------|
| `orchestrator.ts` | Entry point, manages iteration loop, renders report |
| `planner.ts` | LLM generates a `BrowserPlan` (steps + goal + reasoning) |
| `executor.ts` | Runs plan via Stagehand `agent()` in DOM mode, parses messages |
| `evaluator.ts` | Scores execution, extracts feedback for next iteration |
| `types.ts` | Shared TypeScript types |
| `index.ts` | Re-exports all public API |

## Browser Setup

Uses Brave browser with a persistent profile for sites that require login (e.g. LinkedIn):

```ts
localBrowserLaunchOptions: {
  executablePath: "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
  args: [
    '--user-data-dir=C:\\Users\\YOUR_USERNAME\\AppData\\Local\\BraveSoftware\\Brave-Browser\\User Data',
    '--profile-directory=Default',
  ],
  headless: false,
}
```

## Configuration

In `orchestrator.ts`:

```ts
{
  maxIterations: 5,
  timeout: 120000,
  model: "google/gemini-3.1-flash-lite-preview",
  evaluationThreshold: 80   // score out of 100 to mark as satisfied
}
```

## Environment Variables

```
GOOGLE_GENERATIVE_AI_API_KEY=...
```

## Usage

```bash
jimmy jet
# Select "Browser Agent" from the menu
# Enter your query
```

Example queries:
```
Find top 5 AI jobs on LinkedIn with full descriptions
Get transcript of a YouTube video
Extract product prices from a homepage
Search flights NYC to LA under $300
```

## Supported Step Actions (Planner)

`navigate` · `click` · `type` · `extract` · `observe` · `wait` · `scroll`

> The executor doesn't run these step-by-step — it passes the plan goal directly to Stagehand's `agent()` which handles navigation autonomously.

## Output

After each run you can optionally save:
- JSON file with full iteration log + extracted data
- Markdown report with scores and agent output

## Dependencies

- `@browserbasehq/stagehand` — browser automation
- `ai` + `@openrouter/ai-sdk-provider` — LLM calls
- `@clack/prompts` — CLI prompts
- `chalk` — terminal colors
- `zod` — schema validation
