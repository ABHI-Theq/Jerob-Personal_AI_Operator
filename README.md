# Jerob — Personal AI Agent CLI

A terminal-first AI agent with five modes: autonomous code agent, structured planner, browser automation, conversational Q&A, and a serverless scheduler that runs 24/7 in Supabase — even when your machine is off.

[![npm version](https://img.shields.io/npm/v/jerob)](https://www.npmjs.com/package/jerob)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Bun](https://img.shields.io/badge/runtime-Bun-orange)](https://bun.sh)

---

## Demo

[Watch on LinkedIn](https://www.linkedin.com/posts/abhishek-sharma-one_buildinpublic-aiagents-agenticai-ugcPost-7468770330895896576-4Rcf/?utm_source=share&utm_medium=member_desktop&rcm=ACoAAEPD8bwBiNXjv2quMd_V_U85lj38fK4tiIw)

---

## Table of Contents

- [Modes](#modes)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Requirements](#requirements)
- [CLI Reference](#cli-reference)
- [AI Providers](#ai-providers)
- [Agent Mode](#agent-mode)
- [Plan Mode](#plan-mode)
- [Ask Mode](#ask-mode)
- [Browser Agent Mode](#browser-agent-mode)
- [Scheduler Mode](#scheduler-mode)
- [Telegram Bot](#telegram-bot)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Full Setup Guide](#full-setup-guide)

---

## Modes

| Mode | What it does |
|------|-------------|
| 🤖 **Agent** | Autonomous file/code operations with diff review and approval |
| 🧭 **Plan** | AI-generated multi-step plan — review, edit, then execute |
| 🌐 **Browser Agent** | Playwright browser automation driven by Gemini |
| ❓ **Ask** | Chat with AI — workspace context, web search, and Gmail access |
| ⏰ **Scheduler** | Serverless recurring tasks running in Supabase Edge Functions |

---

## Installation

**Via npm (recommended):**

```bash
# 1. Install Bun runtime
# Windows:
powershell -c "irm bun.sh/install.ps1 | iex"
# macOS/Linux:
curl -fsSL https://bun.sh/install | bash

# 2. Install jerob globally
npm install -g jerob

# 3. Launch — setup wizard runs automatically on first use
jerob jet
```

**Via Git (contributors / latest source):**

```bash
git clone https://github.com/ABHI-Theq/Jerob-Personal_AI_Operator
cd Jerob-Personal_AI_Operator
bun install
bun link
jerob jet
```

No `.env` file needed — the setup wizard encrypts your keys and creates it automatically.

---

## Quick Start

```bash
jerob jet
```

On first run, the setup wizard guides you through creating a username + password and entering your API keys. After setup, the same command logs you in directly.

The minimum you need to get started is a **Groq API key** (free) or an **OpenRouter API key** (free tier available). Everything else is optional.

---

## Requirements

**Runtime:**

| Tool | Required for | Install |
|------|-------------|---------|
| Bun ≥ 1.0 | Everything | https://bun.sh |
| Node.js ≥ 18 | npm install | https://nodejs.org |

**API Keys:**

| Key | Required for | Cost |
|-----|-------------|------|
| [OpenRouter](https://openrouter.ai/keys) | Agent, Plan, Ask | Free tier available |
| [Groq](https://console.groq.com) | Agent fallback, Scheduler | Free |
| [Google Gemini](https://aistudio.google.com) | Browser Agent | Free tier available |
| [Anthropic Claude](https://console.anthropic.com) | Agent, Plan, Ask | Paid |
| [OpenAI](https://platform.openai.com) | Agent, Plan, Ask | Paid |
| [Firecrawl](https://firecrawl.dev) | Web search in Ask mode | Free tier available |
| Google OAuth credentials | Gmail features | Free |
| [Supabase](https://supabase.com) project | Scheduler | Free tier works |
| Telegram Bot Token | Telegram control | Free |

---

## CLI Reference

| Command | Description |
|---------|-------------|
| `jerob jet` | Launch Jerob — login or first-time setup |
| `jerob set-key` | Update any stored API key |
| `jerob switch-model` | Change the active model for any provider |
| `jerob reset-auth` | Wipe all credentials and start fresh |
| `jerob sync-credentials` | Push API keys to Supabase for the scheduler |
| `jerob setup-db` | Re-run Supabase schema + Edge Function deploy |
| `jerob scheduler-debug` | Diagnose scheduler connectivity and credentials |

---

## AI Providers

Jerob supports multiple providers with automatic fallback. During setup you choose a primary provider and optional fallbacks. Groq is always the last-resort fallback.

| Provider | Default model | Used for |
|----------|--------------|---------|
| OpenRouter (free) | `openrouter/free` | Agent, Plan, Ask |
| OpenRouter (paid) | `anthropic/claude-3.5-sonnet` | Agent, Plan, Ask |
| Google Gemini | `gemini-2.5-flash` | Browser Agent, fallback |
| Anthropic Claude | `claude-3-5-sonnet-20241022` | Agent, Plan, Ask |
| OpenAI | `gpt-4o-mini` | Agent, Plan, Ask |
| Groq | `llama-3.3-70b-versatile` | Scheduler, fast fallback |

Switch models at any time:

```bash
jerob switch-model
```

---

## Agent Mode

Describe a goal in plain English. The agent plans each step, stages all file changes, shows you a diff, and waits for your approval before writing anything.

```
jerob jet → Agent Mode
```

**Example prompts:**

```
Create a REST API with Express, TypeScript, and CRUD endpoints for a users table
Refactor the auth module to use JWT instead of sessions
Add input validation to all route handlers in src/routes/
```

**How it works:**

1. You describe the goal
2. Agent plans and executes steps using file tools (read, create, modify, delete, shell)
3. All changes are staged — nothing is written to disk yet
4. Jerob shows a diff of every staged change
5. You approve, reject individual files, or abort
6. Only approved changes are written

For scaffolding new projects (React, Vite, Next.js), the agent runs the scaffold command and then offers a follow-up pass to implement your requested feature inside the new project.

---

## Plan Mode

Generates a structured multi-step plan for any goal. Review and toggle individual steps, then optionally hand off to Agent Mode for execution.

```
jerob jet → Plan Mode
```

**Example:**

```
Build a glassmorphism todo app with HTML, CSS, and JavaScript
```

Jerob generates a plan like:

```
Step 1 — Set up project structure
Step 2 — Define HTML structure
Step 3 — Style with glassmorphism CSS
Step 4 — Add hover transitions
Step 5 — Implement JS functionality
Step 6 — Test manually
```

You can disable individual steps before handing off to the agent.

---

## Ask Mode

Conversational AI with access to your workspace files, web search (via Firecrawl), and Gmail. Read-only — it never modifies files.

```
jerob jet → Ask Mode
```

**Example queries:**

```
What does the auth module do?
Search the web for the latest Claude API pricing
Read my last 5 emails and summarize them
What files are in the scheduler folder and what do they do?
```

Session history is maintained within a single run. Requires at minimum one LLM key. Web search requires Firecrawl. Email tools require Gmail OAuth.

---

## Browser Agent Mode

Playwright-based browser automation using Gemini for DOM understanding. Uses your existing Brave/Chrome profile so you're already signed into sites — no credentials needed in the automation.

```
jerob jet → Browser Agent Mode
```

**Requirements:**

- Google Gemini API key
- Brave or Chrome browser

**One-time browser path setup** — open `plan/browser-agent/executor.ts` and set your browser's executable path:

```ts
// Windows (Brave)
executablePath: "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
args: [
  '--user-data-dir=C:\\Users\\YOUR_USERNAME\\AppData\\Local\\BraveSoftware\\Brave-Browser\\User Data',
  '--profile-directory=Default',
],

// macOS (Brave)
executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
args: [
  '--user-data-dir=/Users/YOUR_USERNAME/Library/Application Support/BraveSoftware/Brave-Browser',
  '--profile-directory=Default',
],
```

Replace `YOUR_USERNAME` with your OS username.

---

## Scheduler Mode

Define recurring tasks in plain English. Jerob plans the steps, you set a time, and they run every minute in Supabase Edge Functions — your machine doesn't need to be on.

```
jerob jet → Scheduler → Add new task
```

**Example tasks:**

```
Every morning at 9am, search for top AI news and email me a summary
Every Monday, crawl my competitor's pricing page and send me the changes
```

### How it works

1. Describe the task in plain English
2. Jerob's AI plans the steps (web search, crawl, email send)
3. You review and set a schedule (type `9:00am` — Jerob converts to UTC automatically)
4. Task is saved to Supabase and runs via `pg_cron` + Edge Functions every minute

### First-time setup

If you provided Supabase credentials (URL + service role key + personal access token) during `jerob jet`, setup is fully automatic:

- Tables created (`scheduler_tasks`, `scheduler_runs`, `user_config`)
- Edge Function deployed
- `pg_cron` scheduled
- API keys synced to Supabase

If you skipped the token during setup, run:

```bash
jerob setup-db
```

### Time reference (IST example)

| You type | Stored (UTC) | Fires at |
|----------|-------------|----------|
| `9:00am` | `30 3 * * *` | 9:00 AM IST |
| `8:30pm` | `0 15 * * *` | 8:30 PM IST |
| `11:00pm` | `30 17 * * *` | 11:00 PM IST |

### Debugging

```bash
jerob scheduler-debug
```

Expected output:

```
✓ Supabase connected
✓ Credentials in user_config
✓ Edge Function responds: { ran: 0, message: "No tasks due" }
```

View run history and errors:

```
jerob jet → Scheduler → Manage → View run history
```

---

## Telegram Bot

Control Jerob from your phone via Telegram.

### Setup

1. Open Telegram → `@BotFather` → `/newbot` → copy token
2. Get your chat ID: send a message to your bot, then open `https://api.telegram.org/bot<TOKEN>/getUpdates` and find `"chat":{"id":XXXXXXX}`
3. Add both via `jerob set-key`

### Start Telegram mode

```
jerob jet → Telegram
```

### Commands

```
/agent <goal>    — run Agent Mode
/ask <question>  — chat with AI
/plan <goal>     — generate a plan
/email <op>      — email operations
```

Only your owner chat ID can send commands — all other users are ignored.

---

## Security

- All API keys encrypted with **AES-256** using your password
- Password verified with **bcrypt** — never stored anywhere
- `.env` is regenerated on each login from the encrypted store — never committed to git
- Gmail refresh token stored in `~/.cccontrol/googleAuth/` on your local machine
- Supabase `user_config` table protected with **Row Level Security** (service role only)
- If you forget your password, run `jerob reset-auth` and re-enter all keys

---

## Troubleshooting

**"No AI model available"**
No LLM key configured or the key format is wrong. Run `jerob set-key` and add at least one provider (Groq is free and a solid starting point).

**"Failed to decrypt keys — wrong password?"**
Wrong password at login. Run `jerob reset-auth` and re-enter all keys.

**`.env` file is missing**
Expected — `.env` is never committed. Run `jerob jet` and complete setup; it's written automatically.

**Scheduler tasks don't run**

Check in order:
1. `pg_net` extension enabled in Supabase Dashboard → Database → Extensions
2. Cron job URL is correct: `SELECT jobname, command FROM cron.job;` in SQL Editor
3. API keys synced: run `jerob sync-credentials`
4. Edge Function deployed: run `jerob scheduler-debug`

**"All LLM providers failed"**
Keys not synced to Supabase. Run `jerob sync-credentials`, then check `user_config` table.

**"Gmail token refresh failed"**
Refresh token revoked or expired. Use any email operation in Ask Mode — the OAuth flow reopens automatically. If you're in Google Cloud testing mode, tokens expire every 7 days; publish the app to production in the OAuth consent screen to fix this.

**Browser Agent doesn't open**
Gemini API key missing, or browser path is wrong in `plan/browser-agent/executor.ts`.

**Port 8787 in use (OAuth callback fails)**
Stop whatever is using port 8787, or change `PORT=8787` in `.env` and update `email_ops/email_server.ts` to match.

---

## Full Setup Guide

See **[SETUP.md](SETUP.md)** for complete step-by-step instructions for every mode, including Gmail OAuth, Supabase manual setup, and Telegram configuration.

---

## License

MIT — see [LICENSE](LICENSE)
