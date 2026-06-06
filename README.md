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
# Windows
powershell -c "irm bun.sh/install.ps1 | iex"
# macOS/Linux
curl -fsSL https://bun.sh/install | bash

# 2. Clone and install
git clone <repo-url>
cd jerob
bun install

# 3. Run the interactive setup wizard
jerob jet
```

No `.env` file needed – the wizard encrypts your keys and creates it automatically.

---

## Installation Details (Added)

- **Node version**: Not required; Bun is the recommended runtime.
- **Supported OS**: Windows, macOS, Linux.
- **Global CLI**: After `bun link` you can run `jerob` from any directory.
- **Version check**: `jerob --version` shows the current package version.

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

## Modes (Brief Overview)

### 🤖 Agent Mode
*Describe a goal → AI plans, stages, and asks for approval before writing files.*

### 🧭 Plan Mode
*Generates a step‑by‑step plan you can review and optionally hand off to Agent Mode.*

### 🌐 Browser Agent Mode
*Runs Playwright‑based automation using Gemini for DOM understanding. Works with your existing Brave/Chrome profile.*

### ❓ Ask Mode
*Chat with the AI, ask about code, web, or email. Read‑only, uses workspace tools and optional web search.*

### ⏰ Scheduler Mode
*Define recurring tasks that run in Supabase Edge Functions (no local machine needed).*

---

## Email Operations (16 Functions)

*(see `SETUP.md` for Gmail OAuth setup)*

---

## AI Providers & Models

| Provider | Used for | Default model |
|----------|----------|---------------|
| OpenRouter (free) | Agent, Plan, Ask | `openrouter/free` |
| OpenRouter (paid) | Agent, Plan, Ask | `anthropic/claude-3.5-sonnet` |
| Google Gemini | Browser Agent (required), Agent fallback | `gemini-2.0-flash` |
| Anthropic Claude | Agent, Plan, Ask fallback | `claude-3-5-sonnet-20241022` |
| OpenAI | Agent, Plan, Ask fallback | `gpt-4o-mini` |
| Groq | Scheduler planner, fast fallback | `llama-3.3-70b-versatile` |

---

## Security (Added)

- API keys are AES‑256 encrypted with a password you set during first‑time setup.
- Password hash stored with bcrypt – never plaintext.
- `.env` is regenerated on each login; never committed to git.
- Gmail refresh token stored in `~/.cccontrol/googleAuth/` with strict permissions.
- Supabase `user_config` table is RLS‑protected – only the service role can read/write.

---

## Project Structure

*(unchanged – see repository for full tree)*

---

## Dependencies

*(unchanged – see repository for full list)*

---

## Runtime

Requires **Bun** – Node works but performance is lower.

```bash
bun install
jerob jet
```

---

## Contributing

We welcome contributions! Fork the repo, make your changes, and open a PR. Please run `bun test` (if tests exist) and ensure the lint passes.

---

## License

MIT License – see `LICENSE` file for details.
