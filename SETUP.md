# Jerob — Complete Setup Guide

This guide walks you through every step needed to get all modes working from a fresh clone.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Installation](#2-installation)
3. [First Run — Auth Setup](#3-first-run--auth-setup)
4. [Agent Mode Setup](#4-agent-mode-setup)
5. [Plan Mode Setup](#5-plan-mode-setup)
6. [Ask Mode Setup](#6-ask-mode-setup)
7. [Browser Agent Mode Setup](#7-browser-agent-mode-setup)
8. [Gmail / Email Setup](#8-gmail--email-setup)
9. [Scheduler Mode Setup](#9-scheduler-mode-setup)
10. [Telegram Bot Setup](#10-telegram-bot-setup)
11. [Managing API Keys & Models](#11-managing-api-keys--models)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Prerequisites

| Tool | Required | Install |
|------|----------|---------|
| Bun runtime | Yes | https://bun.sh |
| Git | Yes | https://git-scm.com |
| Brave Browser | For Browser Agent | https://brave.com |
| Supabase account | For Scheduler | https://supabase.com (free tier works) |
| Supabase CLI | For Scheduler | `npm i -g supabase` |

---

## 2. Installation

```bash
git clone <repo-url>
cd jerob
bun install
```

After `bun install`, make the CLI available globally:

```bash
# Option A — link globally with Bun
bun link

# Option B — run directly without linking
bun run index.ts jet
```

If using Option A, you can run `jerob jet` anywhere. If using Option B, run `bun run index.ts jet` from the project root.

---

## 3. First Run — Auth Setup

Run `jerob jet` for the first time. You'll go through a one-time setup wizard.

### Step 1 — Create your account

```
Create username:  your-username
Create password:  (min 6 chars — this encrypts all your API keys)
Confirm password:
```

Your password is never stored in plaintext. All API keys are AES-encrypted with it.

### Step 2 — Enter API keys

The wizard asks for each key one by one. **Press Enter to skip** any key you don't have yet — you can add them later with `jerob set-key`.

```
OpenRouter API Key        → sk-or-v1-...     (openrouter.ai/keys)
Google Gemini API key     → AIza...          (aistudio.google.com)
Telegram Bot Token        → (skip if unused)
Telegram Owner Chat ID    → (skip if unused)
Supabase project URL      → https://xxxx.supabase.co
Supabase service role key → eyJ...
Google OAuth Client ID    → (for Gmail, skip if unused)
Google OAuth Client Secret→ (for Gmail, skip if unused)
Firecrawl API key         → fc-...           (firecrawl.dev)
Apify API key             → (skip if unused)
Browserbase API key       → (skip if unused)
Browserbase Project ID    → (skip if unused)
```

### Step 3 — Model configuration

```
OpenRouter subscription tier:
  ● Paid  — claude-3.5-sonnet, gpt-4o, etc.
  ○ Free  — openrouter/free (no credits needed)
  ○ Skip

Select additional AI providers (multi-select, sets fallback order):
  ◉ Google Gemini
  ○ Anthropic Claude
  ○ OpenAI
  ◉ Groq
```

For each selected provider you can pick default model or enter a custom model ID.

### What happens after setup

- All keys are encrypted and saved to `~/.cccontrol/config.json`
- `.env` is automatically written at the project root
- Future `jerob jet` runs go straight to login (just username + password)

---

## 4. Agent Mode Setup

Agent Mode works as soon as you have at least one LLM key configured.

**Minimum requirement:** One of — OpenRouter key, Gemini key, Claude key, OpenAI key, or Groq key.

**How to use:**
```
jerob jet → CLI → Agent Mode
```

Type your goal in plain English. Examples:
```
Create a TypeScript Express server with CRUD endpoints for users
Add Tailwind CSS to this project
Refactor the database module to use connection pooling
```

The agent stages all changes. You review the diff and approve or reject before anything is written.

**No additional setup needed for Agent Mode.**

---

## 5. Plan Mode Setup

Same requirements as Agent Mode — just needs an LLM provider.

```
jerob jet → CLI → Plan Mode
```

Enter your goal → optionally scan workspace → review the generated plan → toggle steps → optionally execute.

**No additional setup needed for Plan Mode.**

---

## 6. Ask Mode Setup

Needs an LLM provider. Web tools require Firecrawl. Email tools require Gmail OAuth (see Section 8).

```
jerob jet → CLI → Ask Mode
```

Ask questions about your codebase, the web, or your emails. Session history is maintained within a single run.

To enable web search/scrape:
1. Get a Firecrawl key at https://firecrawl.dev
2. Run `jerob set-key` → select Firecrawl → enter key

**No additional setup beyond LLM + optional Firecrawl.**

---

## 7. Browser Agent Mode Setup

Requires Google Gemini API key (Stagehand uses Gemini for DOM understanding).

### Step 1 — Get a Gemini API key

1. Go to https://aistudio.google.com
2. Click "Get API key" → Create API key
3. Run `jerob set-key` → select "Google Gemini" → enter key

### Step 2 — Configure your browser path

Open `plan/browser-agent/executor.ts` and update the browser path:

**Windows (Brave):**
```ts
executablePath: "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
args: [
  '--user-data-dir=C:\\Users\\YOUR_USERNAME\\AppData\\Local\\BraveSoftware\\Brave-Browser\\User Data',
  '--profile-directory=Default',
],
```

**macOS (Brave):**
```ts
executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
args: [
  '--user-data-dir=/Users/YOUR_USERNAME/Library/Application Support/BraveSoftware/Brave-Browser',
  '--profile-directory=Default',
],
```

Replace `YOUR_USERNAME` with your actual OS username.

**Why Brave?** Reusing your existing browser profile means you're already logged into LinkedIn, Gmail, Twitter, etc. — no credentials needed in the automation.

### Step 3 — Use it

```
jerob jet → CLI → Browser Agent Mode
```

Enter your query. The browser window will open and you'll see it working in real time.

---

## 8. Gmail / Email Setup

Gmail uses OAuth2. You need a Google Cloud project with the Gmail API enabled.

### Step 1 — Create a Google Cloud project

1. Go to https://console.cloud.google.com
2. Click "New Project" → give it a name → Create

### Step 2 — Enable Gmail API

1. In the project, go to "APIs & Services" → "Library"
2. Search "Gmail API" → Click → Enable

### Step 3 — Create OAuth credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Application type: **Desktop app**
4. Name it anything → Create
5. Copy the **Client ID** and **Client Secret**

### Step 4 — Configure OAuth consent screen

1. Go to "OAuth consent screen"
2. User type: **External** (unless you have Google Workspace)
3. Fill in app name and your email
4. Add scope: `https://mail.google.com/`
5. Add your Gmail address as a test user

### Step 5 — Add credentials to Jerob

```bash
jerob set-key
# Select "Google Gemini" → skip (just press Enter)
# ... then run again for OAuth credentials
```

Or during setup, enter them when prompted:
```
Google OAuth Client ID     → xxxx.apps.googleusercontent.com
Google OAuth Client Secret → GOCSPX-...
```

Make sure `PORT=8787` is in your `.env` (the OAuth callback server runs on this port).

### Step 6 — Authenticate Gmail

The first time you use any email operation in Ask Mode or Scheduler:
1. A browser window opens automatically to `http://localhost:8787/auth/google`
2. Sign in with your Google account
3. Grant the requested permissions
4. Window closes — you're authenticated

The refresh token is stored in `~/.cccontrol/googleAuth/` and auto-synced to Supabase.

---

## 9. Scheduler Mode Setup

The scheduler runs serverless in Supabase. Tasks execute every minute via `pg_cron` + Edge Functions — your machine does not need to be on.

### Step 1 — Create a Supabase project

1. Go to https://supabase.com → New project
2. Choose a region close to you
3. From **Settings → API**, copy:
   - **Project URL** → this is your `SUPABASE_URL`
   - **service_role** key (secret) → this is your `SUPABASE_SERVICE_ROLE_KEY`
4. Add both to Jerob: `jerob set-key` or enter during initial setup

### Step 2 — Enable required extensions

In Supabase Dashboard → **Database → Extensions**:

- Search `pg_cron` → Enable
- Search `pg_net` → Enable

> **pg_net is critical.** Without it, pg_cron creates the job but `net.http_post()` silently fails. Tasks will never auto-run.

### Step 3 — Run the setup SQL

1. Open Supabase Dashboard → **SQL Editor**
2. Open `scheduler/SETUP-READY.sql` from this project
3. At the bottom of the file, find these two placeholders and replace them:
   ```sql
   url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/scheduler-tick',
   'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
   ```
   - `YOUR_PROJECT_REF` = the part before `.supabase.co` in your project URL
   - `YOUR_SERVICE_ROLE_KEY` = the service_role key from Settings → API
4. Paste the entire file into SQL Editor → click **RUN**

This creates:
- `scheduler_tasks` table
- `scheduler_runs` table
- `user_config` table
- RLS policies
- `pg_cron` job that fires every minute

Verify it worked:
```sql
SELECT jobid, jobname, schedule, active FROM cron.job;
-- Should show: jimmy-scheduler-tick | * * * * * | true
```

### Step 4 — Install Supabase CLI and link project

```bash
npm i -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

### Step 5 — Deploy the Edge Function

```powershell
# Windows
.\supabase\deploy.ps1
```

This script:
1. Deploys the `scheduler-tick` Edge Function to Supabase
2. Sets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as Edge Function secrets
3. Runs `jerob sync-credentials` to push all API keys to `user_config`

### Step 6 — Sync your API keys

```bash
jerob sync-credentials
```

This pushes your local API keys to the `user_config` table in Supabase so the Edge Function can use them at runtime. Run this any time you update a key.

### Step 7 — Verify everything

```bash
jerob scheduler-debug
```

You should see:
- ✓ Credentials in user_config
- ✓ Tasks listed
- ✓ Edge Function responds with `{ ran: 0, message: "No tasks due" }`

### Step 8 — Create your first task

```
jerob jet → CLI → Scheduler → Add new task
```

Describe the task in plain English:
```
Every morning at 9am, search for top AI news and email me a summary at me@gmail.com
```

Jerob's AI plans the steps and suggests a cron schedule. You can edit the schedule — just type a time like `9:00am` and it converts to UTC automatically.

### Understanding task times (India / IST)

All times are stored in UTC in Supabase. Jerob converts automatically.

| You enter | UTC stored | Fires at (IST) |
|-----------|-----------|----------------|
| `9:00am` | `3 30 * * *` | 9:00 AM IST |
| `8:30pm` | `0 15 * * *` | 8:30 PM IST |
| `11:00pm` | `30 17 * * *` | 11:00 PM IST |

Formula: `IST time - 5:30 = UTC time`

### Debugging if tasks don't run

Run these in Supabase SQL Editor:

```sql
-- 1. Check cron job exists and URL is correct
SELECT jobname, command FROM cron.job;

-- 2. Check pg_net is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_net';

-- 3. Check task next_run_at
SELECT name, cron, next_run_at, last_run_at, enabled FROM scheduler_tasks;

-- 4. Check recent run results
SELECT task_id, status, error, started_at FROM scheduler_runs ORDER BY started_at DESC LIMIT 10;
```

Common issues:
- **pg_net not enabled** → Dashboard → Database → Extensions → enable pg_net
- **URL has YOUR_PROJECT_REF** → Re-run SETUP-READY.sql with real values
- **next_run_at is tomorrow** → Update manually: `UPDATE scheduler_tasks SET next_run_at = NOW() - INTERVAL '1 minute' WHERE name = 'task name';`
- **"All LLM providers failed"** → Run `jerob sync-credentials` to push keys, check `user_config` table has entries

---

## 10. Telegram Bot Setup

Telegram lets you control Jerob from your phone.

### Step 1 — Create a bot

1. Open Telegram → search `@BotFather`
2. Send `/newbot`
3. Follow prompts → you get a token like `123456:ABC-DEF...`

### Step 2 — Get your chat ID

1. Send any message to your bot
2. Visit: `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
3. Find `"chat":{"id":XXXXXXX}` — that number is your owner ID

### Step 3 — Add to Jerob

During setup or via `jerob set-key`:
```
Telegram Bot Token    → 123456:ABC-...
Telegram Owner Chat ID → 1234567890
```

### Step 4 — Start the Telegram mode

```
jerob jet → Telegram
```

The bot is now active. From Telegram:
```
/start          — welcome message
/agent <goal>   — run Agent Mode
/ask <question> — run Ask Mode
/plan <goal>    — generate a plan
/email <op>     — email operations
```

The bot only responds to messages from your Owner Chat ID — anyone else is ignored.

---

## 11. Managing API Keys & Models

### Update any API key

```bash
jerob set-key
```

Options: OpenRouter, Gemini, Claude, OpenAI, Groq, model preferences, or switch active model.

### Switch active model for a provider

```bash
jerob switch-model
```

Shows current model per provider. Choose one → reset to default or enter a custom model ID. The validator checks format and warns if the model isn't in the known list.

**Known model examples:**

OpenRouter (paid): `anthropic/claude-3.5-sonnet`, `openai/gpt-4o`, `google/gemini-pro-1.5`
OpenRouter (free): `meta-llama/llama-3.1-8b-instruct:free`, `qwen/qwen-2.5-7b-instruct:free`
Gemini: `gemini-2.0-flash`, `gemini-1.5-pro`, `gemini-1.5-flash`
Claude: `claude-3-5-sonnet-20241022`, `claude-3-haiku-20240307`
OpenAI: `gpt-4o`, `gpt-4o-mini`, `o1-mini`
Groq: `llama-3.3-70b-versatile`, `mixtral-8x7b-32768`, `gemma2-9b-it`

### Reset everything

```bash
jerob reset-auth
```

Wipes `~/.cccontrol/config.json`. Next `jerob jet` starts fresh setup.

### After changing keys — re-sync to Supabase

```bash
jerob sync-credentials
```

Always run this after updating any key that the scheduler uses (OpenRouter, Groq, Gemini, Firecrawl, Gmail).

---

## 12. Troubleshooting

### "No AI model available"

You haven't configured any LLM key, or the key is wrong. Run `jerob set-key` and add at least one provider.

### "Supabase is not configured"

`SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is missing. Add them via `jerob set-key` → model preferences, or run setup again.

### Scheduler tasks don't auto-run but manual trigger works

The Edge Function is healthy. The issue is `pg_cron` not firing it. Check:
1. `pg_net` extension is enabled (Supabase Dashboard → Database → Extensions)
2. The cron job URL has your real project ref (not `YOUR_PROJECT_REF`)

### "All LLM providers failed — Gemini: HTTP 403"

Your Gemini API key is invalid or the API isn't enabled. Verify at https://aistudio.google.com.

### "Gmail token refresh failed"

Your Gmail refresh token expired or was revoked. Re-authenticate: use any email tool in Ask Mode, it will open the OAuth flow again automatically.

### Agent makes changes but diff shows nothing

The agent described changes in text but didn't actually call the file tools. Try rephrasing your goal to be more specific, e.g. "use create_file to create X" or just be more direct: "Create a file called server.ts with...".

### Browser doesn't open for OAuth

Port 8787 might be in use. Change `PORT=8787` in `.env` to another port (e.g. `8788`) and also update `email_server.ts`.

### "Failed to decrypt keys — wrong password?"

You entered the wrong password at login. Run `jerob reset-auth` to wipe config and set up fresh. You'll need to re-enter all API keys.

### `.env` file is missing after fresh clone

That's expected and by design. Run `jerob jet`, complete the setup wizard, and `.env` will be created automatically from your encrypted config.
