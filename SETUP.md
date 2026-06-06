# Jerob — Complete Setup Guide

Everything a new user needs to get Jerob fully working, from zero to all five modes running.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Installation](#2-installation)
3. [First Run — Setup Wizard](#3-first-run--setup-wizard)
4. [Agent Mode](#4-agent-mode)
5. [Plan Mode](#5-plan-mode)
6. [Ask Mode](#6-ask-mode)
7. [Browser Agent Mode](#7-browser-agent-mode)
8. [Gmail / Email Setup](#8-gmail--email-setup)
9. [Scheduler Mode](#9-scheduler-mode)
10. [Telegram Bot Setup](#10-telegram-bot-setup)
11. [Managing Keys & Models](#11-managing-keys--models)
12. [CLI Reference](#12-cli-reference)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Prerequisites

| Tool | Required for | Install |
|------|-------------|---------|
| **Bun** runtime | Everything | https://bun.sh |
| **Git** | Installation | https://git-scm.com |
| **Supabase CLI** | Scheduler (Edge Function deploy) | `npm i -g supabase` |
| Brave or Chrome | Browser Agent | https://brave.com |
| Supabase account | Scheduler | https://supabase.com (free tier works) |

---

## 2. Installation

```bash
git clone https://github.com/your-username/jerob
cd jerob
bun install
bun link
```

`bun link` installs `jerob` as a global command so you can run it from anywhere.

If you skip `bun link`, use `bun run index.ts` instead of `jerob` in all commands below.

---

## 3. First Run — Setup Wizard

```bash
jerob jet
```

The first time you run this, the setup wizard starts automatically. It walks you through everything in one session.

### Step 1 — Create your account

```
Create username:   your-name
Create password:   (min 6 chars — this encrypts ALL your API keys)
Confirm password:
```

Your password is never stored. It's used to AES-256 encrypt your keys. If you forget it, run `jerob reset-auth` and re-enter everything.

### Step 2 — API Keys

Keys are asked in sections. **Press Enter to skip** anything you don't have yet — you can add keys later with `jerob set-key`.

**Required for any AI feature:**

| Key | Where to get it |
|-----|----------------|
| OpenRouter API key | https://openrouter.ai/keys — `sk-or-v1-...` |
| Groq API key | https://console.groq.com — free, `gsk_...` |

**Integrations (optional):**

| Key | Where to get it |
|-----|----------------|
| Telegram Bot Token | `@BotFather` on Telegram |
| Telegram Owner Chat ID | See [Section 10](#10-telegram-bot-setup) |

**Supabase (required for Scheduler):**

| Key | Where to get it |
|-----|----------------|
| Supabase project URL | Supabase Dashboard → Settings → API → Project URL |
| Supabase service role key | Supabase Dashboard → Settings → API → service_role (secret) |
| Supabase personal access token | https://supabase.com/dashboard/account/tokens → New token |

The personal access token is used **once** to auto-deploy the scheduler. You won't be asked for it again after setup.

**Gmail OAuth (required for email features):**

| Key | Where to get it |
|-----|----------------|
| Google OAuth Client ID | Google Cloud Console — see [Section 8](#8-gmail--email-setup) |
| Google OAuth Client Secret | Google Cloud Console — see [Section 8](#8-gmail--email-setup) |

**Web / Browser Agent (optional):**

| Key | Where to get it |
|-----|----------------|
| Firecrawl API key | https://firecrawl.dev — `fc-...` |
| Apify API key | https://apify.com |
| Browserbase API key | https://browserbase.com |
| Browserbase Project ID | https://browserbase.com |

### Step 3 — Model configuration

First, choose your OpenRouter tier:
```
● Paid  — access claude-3.5-sonnet, gpt-4o, etc.
○ Free  — openrouter/free (no credits needed)
○ Skip  — don't use OpenRouter
```

Then pick your **primary model provider** (used for Agent, Plan, Ask, Browser Agent):
```
● Anthropic Claude  (default: claude-3-5-sonnet-20241022)
○ OpenAI            (default: gpt-4o-mini)
○ Google Gemini     (default: gemini-2.5-flash)
○ Skip
```

You'll be asked for that provider's API key, then optionally choose a custom model ID.

Then pick **optional fallback providers** from the remaining two — these activate if the primary fails.

Groq is always included as the last-resort fallback (uses the key you entered in Step 2).

### What happens after setup

- All keys encrypted → `~/.cccontrol/config.json`
- `.env` written at the project root with all keys
- If Supabase credentials + personal access token were provided:
  - Tables created automatically (`scheduler_tasks`, `scheduler_runs`, `user_config`)
  - Edge Function deployed to Supabase
  - pg_cron scheduled to fire every minute
  - API keys synced to Supabase `user_config`
- Every subsequent `jerob jet` just asks for username + password

---

## 4. Agent Mode

Works immediately once you have any LLM key.

```
jerob jet → CLI → Agent Mode
```

Describe your goal in plain English:

```
Create a REST API with Express, TypeScript, and CRUD endpoints for a users table
Refactor the auth module to use JWT instead of sessions
Add input validation to all route handlers
```

The agent plans each step, stages the changes, shows you a diff, and asks for approval before writing anything. You can approve, reject, or abort at any step.

**No additional setup needed.**

---

## 5. Plan Mode

Same requirements as Agent Mode.

```
jerob jet → CLI → Plan Mode
```

Enter your goal → optionally scan your workspace → review the generated plan → toggle individual steps → optionally hand off to Agent Mode for execution.

**No additional setup needed.**

---

## 6. Ask Mode

Needs an LLM key. Web search/crawl requires Firecrawl. Email tools require Gmail OAuth.

```
jerob jet → CLI → Ask Mode
```

Examples:
```
What does the auth module do?
Search the web for the latest Claude API pricing
Read my last 5 emails and summarize them
```

Session history is maintained within a single run.

**No additional setup beyond LLM + optional Firecrawl/Gmail.**

---

## 7. Browser Agent Mode

Requires a **Google Gemini API key** — Stagehand uses Gemini for DOM understanding.

### Step 1 — Gemini API key

1. Go to https://aistudio.google.com
2. Click "Get API key" → Create API key
3. Add it: `jerob set-key` → select Gemini → enter key

### Step 2 — Set your browser path

Open `plan/browser-agent/executor.ts` and set your browser's executable path:

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

Replace `YOUR_USERNAME` with your OS username. Using your real browser profile means you're already signed into sites — no credentials needed in the automation.

### Step 3 — Use it

```
jerob jet → CLI → Browser Agent Mode
```

Type your goal and watch the browser work.

---

## 8. Gmail / Email Setup

Gmail uses OAuth2. You need a Google Cloud project with the Gmail API enabled.

### Step 1 — Create a Google Cloud project

1. Go to https://console.cloud.google.com
2. "New Project" → name it → Create

### Step 2 — Enable Gmail API

1. APIs & Services → Library
2. Search "Gmail API" → Enable

### Step 3 — Create OAuth credentials

1. APIs & Services → Credentials
2. "Create Credentials" → "OAuth client ID"
3. Application type: **Desktop app**
4. Copy the **Client ID** and **Client Secret**

### Step 4 — Configure OAuth consent screen

1. OAuth consent screen → User Type: **External**
2. App name + your email
3. Scopes: add `https://mail.google.com/`
4. Test users: add your Gmail address

### Step 5 — Add credentials to Jerob

During initial setup, or later:
```bash
jerob set-key
# Choose: Google OAuth credentials
```

Enter:
```
Google OAuth Client ID     → xxxx.apps.googleusercontent.com
Google OAuth Client Secret → GOCSPX-...
```

`PORT=8787` is automatically set in your `.env` — the OAuth callback server uses this port.

### Step 6 — First Gmail authentication

The first time any email operation runs:
1. Browser opens to `http://localhost:8787/auth/google`
2. Sign in with Google → grant permissions
3. Window closes — authenticated

The refresh token is stored in `~/.cccontrol/googleAuth/` and automatically synced to Supabase.

> If you're in **Google Cloud testing mode** (unverified app), tokens expire every 7 days. Push your app to production in the OAuth consent screen to get non-expiring tokens.

---

## 9. Scheduler Mode

The scheduler runs 24/7 in Supabase. Tasks execute every minute via `pg_cron` + Edge Functions — your machine doesn't need to be on.

### Step 1 — Create a Supabase project

1. https://supabase.com → New project
2. Settings → API → copy:
   - **Project URL** (`https://xxxx.supabase.co`)
   - **service_role** key (secret)
3. Settings → account tokens → create a **Personal Access Token**

### Step 2 — Enable required extensions

Supabase Dashboard → Database → Extensions:
- Enable **pg_cron**
- Enable **pg_net**

> `pg_net` is required. Without it, the cron job runs but `net.http_post()` silently does nothing.

### Step 3 — Auto-setup (recommended)

If you provided all three Supabase credentials during `jerob jet` setup (URL + service role key + personal access token), **everything below was done automatically**:

- Tables created
- RLS policies applied
- Edge Function deployed
- Secrets set on the Edge Function
- pg_cron scheduled

Skip to Step 6 to verify.

If you skipped the personal access token during setup, run:

```bash
jerob setup-db
```

You'll be prompted for the token once. It handles everything.

### Step 4 — Manual setup (if auto-setup failed)

Install and link the Supabase CLI:

```bash
npm i -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

Run the SQL manually:
1. Open Supabase Dashboard → SQL Editor
2. Open `scheduler/SETUP-READY.sql`
3. Replace `YOUR_PROJECT_REF` and `YOUR_SERVICE_ROLE_KEY` placeholders at the bottom
4. Paste and click **RUN**

Deploy the Edge Function:
```bash
supabase functions deploy scheduler-tick --no-verify-jwt
supabase secrets set SUPABASE_URL=https://xxxx.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Step 5 — Sync API keys to Supabase

API keys are synced automatically every time you run `jerob jet`. To force a sync:

```bash
jerob sync-credentials
```

Run this any time you update a key that the scheduler needs (OpenRouter, Groq, Gemini, Firecrawl, Gmail).

### Step 6 — Verify everything

```bash
jerob scheduler-debug
```

Expected output:
```
✓ Supabase connected
✓ Credentials in user_config
✓ Edge Function responds: { ran: 0, message: "No tasks due" }
```

### Step 7 — Create your first task

```
jerob jet → CLI → Scheduler → Add new task
```

Describe in plain English:
```
Every morning at 9am, search for the top AI news and email me a summary at me@gmail.com
```

The AI plans the steps and suggests a cron. You can edit the schedule — type a time like `9:00am` and it converts to UTC automatically.

### Task time reference (IST example)

| You type | Stored (UTC) | Fires at |
|----------|-------------|----------|
| `9:00am` | `30 3 * * *` | 9:00 AM IST |
| `8:30pm` | `0 15 * * *` | 8:30 PM IST |
| `11:00pm` | `30 17 * * *` | 11:00 PM IST |

Formula: `your local time - local UTC offset = UTC`

### View task run history + errors

```
jerob jet → CLI → Scheduler → Manage → View run history
```

Failed runs show the error category and a fix hint:
- **LLM API Key Error** → run `jerob set-key` then `jerob sync-credentials`
- **No LLM Keys Configured** → run `jerob sync-credentials`
- **Gmail Auth Error** → re-authenticate via any email operation in Ask Mode
- **Rate Limit / Quota** → switch provider or wait

### Debug SQL (run in Supabase SQL Editor)

```sql
-- Check cron job exists
SELECT jobname, schedule, active FROM cron.job;

-- Check task schedule
SELECT name, cron, next_run_at, last_run_at, enabled FROM scheduler_tasks;

-- Check recent runs
SELECT task_id, status, error, started_at
FROM scheduler_runs
ORDER BY started_at DESC LIMIT 10;
```

---

## 10. Telegram Bot Setup

Control Jerob from your phone.

### Step 1 — Create a bot

1. Open Telegram → `@BotFather` → `/newbot`
2. Follow prompts → get a token: `123456:ABC-DEF...`

### Step 2 — Get your chat ID

1. Send any message to your new bot
2. Open: `https://api.telegram.org/bot<TOKEN>/getUpdates`
3. Find `"chat":{"id":XXXXXXX}` — that's your owner ID

### Step 3 — Add to Jerob

During setup or via `jerob set-key`:
```
Telegram Bot Token      → 123456:ABC-...
Telegram Owner Chat ID  → 1234567890
```

### Step 4 — Start Telegram mode

```
jerob jet → Telegram
```

From your phone:
```
/agent <goal>    — run Agent Mode
/ask <question>  — chat with AI
/plan <goal>     — generate a plan
/email <op>      — email operations
```

Only your owner ID can send commands — all other users are ignored.

---

## 11. Managing Keys & Models

### Update any API key

```bash
jerob set-key
```

### Switch active model for a provider

```bash
jerob switch-model
```

Shows the current model per provider. Reset to default or enter a custom model ID.

**Available models:**

| Provider | Default | Examples |
|----------|---------|---------|
| OpenRouter (paid) | `anthropic/claude-3.5-sonnet` | `openai/gpt-4o`, `google/gemini-pro-1.5` |
| OpenRouter (free) | `openrouter/free` | `meta-llama/llama-3.1-8b-instruct:free` |
| Gemini | `gemini-2.5-flash` | `gemini-1.5-pro`, `gemini-2.0-flash` |
| Claude | `claude-3-5-sonnet-20241022` | `claude-3-haiku-20240307` |
| OpenAI | `gpt-4o-mini` | `gpt-4o`, `o1-mini` |
| Groq | `llama-3.3-70b-versatile` | `mixtral-8x7b-32768`, `gemma2-9b-it` |

### Reset everything

```bash
jerob reset-auth
```

Wipes `~/.cccontrol/config.json`. Next `jerob jet` starts fresh.

---

## 12. CLI Reference

| Command | Description |
|---------|-------------|
| `jerob jet` | Launch Jerob — login or setup on first run |
| `jerob set-key` | Update any stored API key |
| `jerob switch-model` | Switch the active model for any provider |
| `jerob reset-auth` | Wipe all credentials and start fresh |
| `jerob sync-credentials` | Force-push API keys to Supabase `user_config` |
| `jerob setup-db` | Re-run Supabase schema + Edge Function deploy |
| `jerob scheduler-debug` | Diagnose scheduler connectivity and credentials |

---

## 13. Troubleshooting

### "No AI model available"

No LLM key is configured or the key format is wrong. Run `jerob set-key` and add at least one provider (Groq is free and a good starting point).

### "Failed to decrypt keys — wrong password?"

Wrong password at login. Run `jerob reset-auth` and re-enter all keys from scratch.

### `.env` file is missing

Expected — `.env` is never committed to git. Run `jerob jet` and complete setup. `.env` is written automatically.

### Scheduler tasks don't run automatically

Check in order:
1. `pg_net` enabled → Supabase Dashboard → Database → Extensions
2. Cron job URL is correct → `SELECT jobname, command FROM cron.job;` in SQL Editor
3. API keys in `user_config` → run `jerob sync-credentials`
4. Edge Function deployed → `jerob scheduler-debug`

### "All LLM providers failed"

Keys are not in Supabase. Run `jerob sync-credentials`. Then check `user_config` table has entries.

### "Gmail token refresh failed" / Gmail Auth Error

Refresh token revoked or expired. Re-authenticate: use any email operation in Ask Mode — the OAuth flow opens automatically.

If you're in Google Cloud **testing mode**, tokens expire every 7 days. Fix: OAuth consent screen → publish the app to production.

### Browser Agent doesn't open

Gemini API key missing, or browser path wrong. Check `plan/browser-agent/executor.ts` has your correct browser executable path.

### Port 8787 in use (OAuth fails)

Something else is using port 8787. Stop it, or change `PORT=8787` in `.env` and update `email_ops/email_server.ts` to match.

### "Supabase is not configured"

`SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` missing from `.env`. Run `jerob set-key` to add them, then restart with `jerob jet`.

### Auto-setup failed during first run

Run `jerob setup-db` — it will prompt for your personal access token and retry the full setup. Or set up manually following [Section 9 Step 4](#step-4--manual-setup-if-auto-setup-failed).
