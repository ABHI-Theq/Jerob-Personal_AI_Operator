# Jerob — Personal AI Assistant CLI

A terminal-first personal AI agent framework. Jerob runs in your terminal and gives you five distinct modes: autonomous file/code agent, structured planning, browser automation, conversational Q&A, and a serverless task scheduler that runs 24/7 in Supabase even when your machine is off.

---

## What Jerob Can Do

| Mode | What it does |
|------|-------------|
| 🤖 Agent | Autonomous file and code operations with approval flow |
| 🧭 Plan | AI-generated multi-step plan for any goal, with optional execution |
| 🌐 Browser Agent | Autonomous browser automation with iterative refinement |
| ❓ Ask | Conversational Q&A with workspace access, web search, and email |
| ⏰ Scheduler | Serverless recurring tasks (search + email + crawl) running in Supabase |

---

## Quick Start

```bash
# 1. Install Bun (https://bun.sh)
powershell -c "irm bun.sh/install.ps1 | iex"   # Windows
curl -fsSL https://bun.sh/install | bash         # macOS/Linux

# 2. Clone and install
git clone <repo-url>
cd jerob
bun install

# 3. First run — interactive setup wizard handles everything
jerob jet
```

No `.env` file needed. The setup wizard collects your API keys, encrypts them, and writes `.env` automatically.

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `jerob jet` | Launch Jerob (main entry point) |
| `jerob set-key` | Update any stored API key |
| `jerob switch-model` | Switch the active model for any provider |
| `jerob reset-auth` | Wipe all stored credentials and start fresh |
| `jerob sync-credentials` | Push API keys to Supabase for the scheduler |
| `jerob scheduler-debug` | Diagnose scheduler issues |

---

## Modes

### 🤖 Agent Mode

Give Jerob any coding or filesystem goal in plain English. It autonomously plans, uses tools, and stages all changes — nothing touches disk until you approve.

**Flow:**
1. Describe a goal
2. Agent calls tools (up to 30 steps): read, create, modify, delete files, run shell commands
3. All mutations are staged in memory
4. You see a diff and choose: approve, reject, or view
5. On approval everything is written at once
6. If scaffolding created a new project folder, you're offered a follow-up coding pass inside it

**Tools available to the agent:**
- `read_file`, `list_files`, `search_files`, `analyze_codebase` — workspace reads
- `create_file`, `modify_file`, `delete_file`, `create_folder` — staged mutations
- `execute_shell` — run commands (bun, npx, git, etc.)
- `grep_search`, `file_search` — codebase search

**Example prompts:**
```
Build a REST API in TypeScript with Express and Zod validation
Refactor all class components in /src to use React hooks
Create a new Next.js app with Tailwind CSS in a folder called landing
Add error boundaries to every route in this project
```

**Required:** At least one LLM provider configured (OpenRouter, Gemini, Claude, OpenAI, or Groq)

---

### 🧭 Plan Mode

Generates a structured multi-step plan before touching any code. Good for large features where you want to review the approach first.

**Flow:**
1. Describe your goal
2. Choose whether to scan your workspace for context
3. Jerob generates a plan: numbered steps with titles, descriptions, and complexity hints
4. Toggle individual steps on/off
5. Optionally save to a `.md` file
6. Optionally hand off selected steps to Agent Mode for execution

**When to use it:**
- You want to understand what the AI will do before it does it
- Planning a large feature across multiple files
- Generating a project roadmap

**Required:** At least one LLM provider

---

### 🌐 Browser Agent Mode

Autonomous browser automation using Stagehand (Playwright under the hood). Runs a Plan → Execute → Evaluate loop up to 5 times, refining its approach based on what it observes.

**Flow:**
1. Enter what you want the browser to do
2. Planner generates a step-by-step browser plan
3. Executor runs Stagehand's `agent()` in DOM mode — navigates, clicks, types, extracts
4. Evaluator scores the result 0–100 for completeness and accuracy
5. If score < 80, the feedback is fed back and the loop retries
6. Stops when satisfied (≥80) or after 5 iterations, returns best result
7. Optional: save results as JSON or Markdown report, send via email

**Uses your existing browser session** — point it at your Brave/Chrome profile and it reuses cookies (LinkedIn, Twitter, Gmail, etc. — no re-login needed).

**Browser setup** (`plan/browser-agent/executor.ts`):
```ts
executablePath: "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
args: [
  '--user-data-dir=C:\\Users\\YOUR_USERNAME\\AppData\\Local\\BraveSoftware\\Brave-Browser\\User Data',
  '--profile-directory=Default',
]
```

**Example queries:**
```
Find the top 5 AI engineering jobs on LinkedIn and extract full descriptions
Get the transcript of this YouTube video: https://youtube.com/watch?v=...
Compare iPhone 15 prices across Amazon, Flipkart, and Croma
Fill out the contact form on https://example.com with my details
```

**Required:** `GOOGLE_GENERATIVE_AI_API_KEY` (Stagehand uses Gemini for DOM understanding)

---

### ❓ Ask Mode

Conversational AI with access to your workspace, the web, and your Gmail. Read-only — cannot modify files. Maintains session history for follow-up questions.

**Tools available:**
- `read_file`, `list_files`, `search_files`, `analyze_codebase` — read your project
- `web_search`, `web_scrape` — search or scrape via Firecrawl
- All 16 Gmail operations (search, summarize, send, classify, digest, etc.)

**Flow:**
1. Ask anything
2. Jerob answers using whatever tools it needs
3. After each answer: continue, send answer to email, or save session summary
4. Session summary is LLM-generated and saved to a `.md` file

**Example questions:**
```
What does the auth system in this project do?
Search for recent papers on RAG and summarize the top 3
What unread emails do I have from last week?
Explain the scheduler architecture to me
```

**Required:** At least one LLM provider
**Optional:** `FIRECRAWL_KEY` for web tools, Gmail credentials for email tools

---

### ⏰ Scheduler Mode

Serverless recurring task scheduler. Tasks run in Supabase Edge Functions via `pg_cron` — your machine can be completely off. Describe tasks in plain English; Jerob's AI plans the steps and cron schedule automatically.

**How it works:**
1. Describe a recurring task (e.g. "Every morning search top AI news and email me a summary")
2. AI breaks it into typed steps and suggests a cron schedule
3. Task saved to Supabase `scheduler_tasks` table
4. `pg_cron` calls the `scheduler-tick` Edge Function every minute
5. Edge Function picks up due tasks, executes them, writes results to `scheduler_runs`
6. Optional summary email sent after each run

**Step types:**
| Type | What the Edge Function does |
|------|----------------------------|
| `web_search` | Firecrawl search → LLM summary |
| `web_crawl` | Firecrawl scrape URL → LLM extraction |
| `custom` | Pure LLM task with accumulated context |
| `email_send` | Gmail API send using OAuth refresh token |

**LLM priority in Edge Function:** Gemini → OpenRouter → Groq (uses whichever key is in `user_config`)

**Managing tasks:**
- Add, list, enable/disable, edit schedule, view run history, trigger manually, delete
- Schedule input: type `8:30pm` (auto-converted to UTC cron) or full cron like `0 9 * * 1`

**All times are stored in UTC.** Jerob automatically converts your local time to UTC when you enter a schedule. India (IST = UTC+5:30): `8:30pm` → `15:00 UTC`.

**Required for scheduler:** Supabase project with `pg_net` + `pg_cron` extensions enabled, Edge Function deployed

---

## 📧 Email Operations (16 Functions)

Available from Ask Mode and Scheduler Mode. First use triggers a Gmail OAuth flow in your browser.

| Function | Description |
|----------|-------------|
| `email_send` | Send email with CC/BCC support |
| `email_read` | Read a message by ID |
| `email_search` | Gmail query syntax search |
| `email_summarize` | AI 2-3 sentence summary |
| `email_reply` | Reply keeping thread intact |
| `email_draft` | Save draft without sending |
| `email_delete` | Permanently delete |
| `email_archive` | Remove from inbox |
| `email_label` | Add/remove labels |
| `email_classify` | Auto-categorize (work/personal/newsletter/spam/etc.) |
| `email_extract_tasks` | Pull action items with AI |
| `email_bulk_action` | Batch delete/archive/label/read |
| `email_digest` | AI digest of recent/filtered emails |
| `email_schedule_send` | Save draft + note scheduled time |
| `email_send_draft` | Send a saved draft by ID |
| `email_thread` | Get all messages in a thread |

---

## AI Providers & Models

Jerob supports 5 providers. You choose which ones to use during setup, and in what priority order.

| Provider | Used for | Default model |
|----------|----------|---------------|
| OpenRouter (free) | Agent, Plan, Ask | `openrouter/free` |
| OpenRouter (paid) | Agent, Plan, Ask | `anthropic/claude-3.5-sonnet` |
| Google Gemini | Browser Agent (required), Agent fallback | `gemini-2.0-flash` |
| Anthropic Claude | Agent, Plan, Ask fallback | `claude-3-5-sonnet-20241022` |
| OpenAI | Agent, Plan, Ask fallback | `gpt-4o-mini` |
| Groq | Scheduler planner, fast fallback | `llama-3.3-70b-versatile` |

**Priority logic:**
- `getAgentModel()` — tries OpenRouter first (paid or free based on your tier), then preferred providers in your chosen order
- `getAgentModel2()` — skips OpenRouter (avoids content refusals on structured output), tries preferred providers → Groq
- Edge Function (scheduler) — tries Gemini → OpenRouter → Groq

Switch models anytime: `jerob switch-model`

---

## Security

- All API keys are AES-256 encrypted with your password before being stored in `~/.cccontrol/config.json`
- Your password is stored as a bcrypt hash — never plaintext
- `.env` is auto-generated from encrypted config on each login — never needs to be committed
- Gmail refresh token stored in `~/.cccontrol/googleAuth/` with `600` permissions
- Supabase `user_config` table stores API keys for the Edge Function — protected by RLS (service role only)
- `.gitignore` excludes `.env`, `~/.cccontrol/`, and all credential files

---

## Project Structure

```
jerob/
├── index.ts                   # CLI entry point (commander)
├── CLI/cli.ts                 # Mode selector loop
│
├── agent/                     # Agent Mode
│   ├── orchestrator.ts        # Main agent loop + approval flow
│   ├── agent-tools.ts         # File/shell tool definitions
│   ├── tool-executor.ts       # Applies staged mutations
│   ├── action-tracker.ts      # Tracks pending changes
│   ├── approval.ts            # Approve/reject prompt
│   ├── diff-view.ts           # Diff renderer
│   └── types.ts
│
├── ask/
│   └── orchestrator.ts        # Ask mode loop
│
├── plan/
│   ├── orchestrator.ts        # Plan mode loop
│   ├── planner.ts             # LLM plan generation
│   ├── selection.ts           # Step toggle UI
│   ├── web-tools.ts           # Firecrawl integration
│   ├── types.ts
│   └── browser-agent/         # Browser Agent Mode
│       ├── orchestrator.ts    # Iteration loop
│       ├── planner.ts         # Browser plan generation
│       ├── executor.ts        # Stagehand execution
│       ├── evaluator.ts       # LLM scoring + feedback
│       └── types.ts
│
├── email_ops/
│   ├── email_functions.ts     # 16 Gmail functions
│   ├── email-tools.ts         # AI SDK tool wrappers
│   ├── email_init.ts          # OAuth browser flow
│   ├── email_server.ts        # Express OAuth callback server
│   ├── email_pass_store.ts    # Refresh token storage
│   └── types.ts
│
├── scheduler/
│   ├── orchestrator.ts        # Scheduler CLI interface
│   ├── planner.ts             # AI task step planning
│   ├── db.ts                  # Supabase client + query helpers
│   ├── config-sync.ts         # Push keys to user_config table
│   ├── debug.ts               # jerob scheduler-debug tool
│   ├── update-task-email.ts   # CLI utility to fix task emails
│   ├── SETUP-READY.sql        # Run once in Supabase SQL Editor
│   └── check-status.sql       # Diagnostic SQL queries
│
├── supabase/
│   ├── functions/
│   │   └── scheduler-tick/    # Deno Edge Function
│   │       └── index.ts       # Task executor (Gemini→OpenRouter→Groq)
│   └── deploy.ps1             # Deploy script
│
├── auth/
│   ├── auth.ts                # Login, setup, key update, model switch
│   ├── config-store.ts        # Read/write ~/.cccontrol/config.json
│   ├── crypto.ts              # AES encrypt/decrypt + password hash
│   └── env-writer.ts          # Auto-write .env from decrypted config
│
├── config/
│   └── ai.config.ts           # Provider builders + model selection logic
│
├── utils/
│   ├── llm-error.ts           # LLM error classification + retry logic
│   └── model-validator.ts     # Model ID validation per provider
│
└── tui/
    ├── spinner.ts             # withSpinner helper
    ├── spinup.ts              # Top-level mode selector UI
    └── terminal-render.ts     # Markdown → terminal renderer
```

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `@browserbasehq/stagehand` | Browser automation (Playwright + AI) |
| `ai` | Vercel AI SDK core |
| `@openrouter/ai-sdk-provider` | OpenRouter provider |
| `@ai-sdk/groq` | Groq provider |
| `@ai-sdk/google` | Google Gemini provider |
| `@ai-sdk/anthropic` | Anthropic Claude provider |
| `@ai-sdk/openai` | OpenAI provider |
| `@supabase/supabase-js` | Supabase client |
| `telegraf` | Telegram bot framework |
| `@clack/prompts` | Beautiful interactive CLI prompts |
| `@mendable/firecrawl-js` | Web scraping and search |
| `googleapis` | Gmail API |
| `commander` | CLI command parsing |
| `chalk` | Terminal colors |
| `zod` | Schema validation |
| `marked` + `marked-terminal` | Markdown → terminal rendering |
| `express` | OAuth callback server |
| `diff` | Diff generation for approval flow |
| `dotenv` | `.env` loading |
| `figlet` | ASCII art banner |
| `open` | Open browser for OAuth |

---

## Runtime

Requires [Bun](https://bun.sh) — Node.js works but Bun is significantly faster for this project.

```bash
bun install
jerob jet
```
