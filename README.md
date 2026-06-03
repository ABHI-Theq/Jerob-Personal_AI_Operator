# Jimmy — Personal AI Assistant CLI

A modular, terminal-first AI agent framework. Run it from your terminal as `jimmy jet` and choose between Agent, Plan, Browser Agent, Ask, and Telegram modes — all powered by LLMs via OpenRouter and Groq.

---

## Quick Start

```bash
# Install dependencies
bun install

# First run — will prompt for username, password, and OpenRouter API key
jimmy jet
```

After first-time setup, `jimmy jet` goes straight to login then drops you into the mode selector.

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `jimmy jet` | Launch the assistant (login + mode select) |
| `jimmy set-key` | Update your stored OpenRouter API key |
| `jimmy reset-auth` | Wipe stored credentials and config |

---

## Modes

### Agent Mode
Full agentic loop with file system tools. Give it a goal and it plans, writes, modifies, and deletes files — then stages everything for your approval before applying.

- Up to 30 tool steps per task
- Supports scaffolding via shell commands (`bun create vite`, `npx create-next-app`, etc.)
- Diff viewer before applying changes
- Follow-up pass for newly scaffolded projects

### Plan Mode
LLM generates a structured multi-step plan for a goal. You review, toggle steps on/off, then optionally execute selected steps via Agent Mode.

- Optional workspace scan for context-aware planning
- Save plan to `.md` file
- Step-by-step execution with per-step agent

### Browser Agent Mode
Autonomous browser automation using Stagehand. Iterative Plan → Execute → Evaluate loop (up to 5 cycles) using your local Brave browser.

- Uses Brave with persistent profile — stays logged in to LinkedIn, etc.
- DOM-mode Stagehand agent handles all navigation autonomously
- Evaluator scores each attempt (0–100), retries with feedback until threshold (80/100) is met
- Optional JSON + Markdown report save after completion

See [`plan/browser-agent/README.md`](plan/browser-agent/README.md) for full details.

### Ask Mode
Conversational Q&A with read-only workspace access and web search. Can save a summary to a `.md` file at the end of the session.

- Reads files, lists directories, searches codebase
- Web tools via Firecrawl
- Multi-turn conversation with history

### Telegram Mode
Full bot interface for the same Agent / Ask / Plan capabilities over Telegram — owner-only, authenticated by chat ID.

- `/agent <goal>` — runs Agent Mode
- `/ask <question>` — runs Ask Mode
- `/plan <goal>` — generates plan with inline keyboard (toggle steps, proceed)
- Inline approval flow (accept/reject/diff) via Telegram buttons

---

## Project Structure

```
jimmy/
├── index.ts                  # CLI entry point (commander)
├── CLI/cli.ts                # Mode selector loop
│
├── agent/
│   ├── orchestrator.ts       # Agent mode loop + approval flow
│   ├── agent-tools.ts        # File/folder/shell tools for the agent
│   ├── tool-executor.ts      # Executes staged actions
│   ├── action-tracker.ts     # Tracks pending mutations
│   ├── approval.ts           # CLI approval prompt
│   ├── diff-view.ts          # Diff renderer
│   └── types.ts              # AgentConfig, ActionLog types
│
├── ask/
│   └── orchestrator.ts       # Ask mode loop with web + file tools
│
├── plan/
│   ├── orchestrator.ts       # Plan mode loop
│   ├── planner.ts            # LLM plan generation
│   ├── selection.ts          # Step selection UI
│   ├── web-tools.ts          # Firecrawl + HTTP tools
│   ├── browser-tool.ts       # Standalone Stagehand agent runner
│   ├── types.ts              # Plan, PlanStep types
│   └── browser-agent/
│       ├── orchestrator.ts   # Browser agent iteration loop
│       ├── planner.ts        # Browser plan generation
│       ├── executor.ts       # Stagehand execution + message parsing
│       ├── evaluator.ts      # LLM-based scoring + feedback
│       ├── types.ts          # Browser agent types
│       └── index.ts          # Public exports
│
├── Telegram/
│   ├── index.ts              # Bot setup + launch
│   ├── handlers.ts           # All command + callback handlers
│   ├── agent-run.ts          # Telegram-adapted agent/ask/plan runners
│   ├── approval-session.ts   # Inline keyboard approval sessions
│   ├── plan-session.ts       # Inline keyboard plan sessions
│   ├── auth.ts               # Owner ID check
│   ├── constants.ts          # Welcome message etc.
│   └── text.ts               # Text utilities
│
├── auth/
│   ├── auth.ts               # Login / setup / update-key flows
│   ├── config-store.ts       # Persist config to disk
│   └── crypto.ts             # Password hash + AES encrypt/decrypt
│
├── config/
│   └── ai.config.ts          # Model providers (OpenRouter, Groq)
│
└── tui/
    ├── spinner.ts            # withSpinner helper
    ├── spinup.ts             # Main TUI entry (mode selector)
    └── terminal-render.ts    # Markdown → terminal renderer
```

---

## Auth & Security

On first run, `jimmy jet` prompts for a username and password. Your OpenRouter API key is AES-encrypted with your password and stored locally — never in plaintext. Password is stored as a hash only.

To change your key later: `jimmy set-key`
To wipe everything: `jimmy reset-auth`

---

## Models

| Model | Used for |
|-------|----------|
| OpenRouter (configurable) | Agent Mode, Plan Mode, Ask Mode |
| Groq `llama-3.3-70b-versatile` | Browser Agent planner + evaluator |
| OpenRouter free (fallback) | Browser Agent fallback if Groq fails |
| `google/gemini-3.1-flash-lite-preview` | Stagehand browser execution |

Set your model via env or `jimmy set-key`:
```
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
```

---

## Environment Variables

Create a `.env` in the project root:

```env
# Required
OPENROUTER_KEY=sk-or-v1-...
OPENROUTER_MODEL=openrouter/free

# Browser Agent
GROQ_API_KEY=gsk_...
GOOGLE_GENERATIVE_AI_API_KEY=...

# Telegram
TELEGRAM_BOT_TOKEN=...
TELEGRAM_OWNER_ID=...

# Optional
FIRECRAWL_KEY=fc-...
BROWSERBASE_API_KEY=...
```

---

## Browser Agent — Brave Profile Setup

To use sites that require login (LinkedIn, etc.), point Stagehand at your existing Brave profile:

```ts
// in plan/browser-agent/executor.ts
localBrowserLaunchOptions: {
  executablePath: "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
  args: [
    '--user-data-dir=C:\\Users\\YOUR_USERNAME\\AppData\\Local\\BraveSoftware\\Brave-Browser\\User Data',
    '--profile-directory=Default',
  ],
  headless: false,
}
```

No credentials needed — it reuses your browser's existing cookies.

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `@browserbasehq/stagehand` | Browser automation |
| `ai` + `@openrouter/ai-sdk-provider` | LLM calls via AI SDK |
| `@ai-sdk/groq` | Groq model provider |
| `telegraf` | Telegram bot |
| `@clack/prompts` | Interactive CLI prompts |
| `@mendable/firecrawl-js` | Web scraping / search |
| `commander` | CLI command parsing |
| `chalk` | Terminal colors |
| `zod` | Schema validation |
| `marked` + `marked-terminal` | Markdown rendering |

---

## Runtime

Requires [Bun](https://bun.sh). Uses `bun.lock` for reproducible installs.

```bash
bun install
jimmy jet
```
