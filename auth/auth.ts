import chalk from "chalk";
import { password, text, isCancel, multiselect, select } from "@clack/prompts";
import { hashPassword, verifyPassword, encrypt, decrypt } from "./crypto";
import { loadConfig, saveConfig, isConfigured, removeConfig } from "./config-store";
import type { StoredConfig } from "./config-store";
import { clackModelValidator, printModelWarning, type Provider } from "../utils/model-validator";

export interface AuthResult {
  config: StoredConfig;
  password: string;
}

// ── Default model IDs per provider ───────────────────────────────────────────
export const DEFAULT_MODELS = {
  openrouter_free: "openrouter/free",
  openrouter_paid: "anthropic/claude-3.5-sonnet",
  gemini:  "gemini-3.1-flash-lite-preview",
  claude:  "claude-3-5-sonnet-20241022",
  openai:  "gpt-4o-mini",
  groq:    "llama-3.3-70b-versatile",
} as const;

// ── Model preference setup ────────────────────────────────────────────────────

export async function runModelSetup(
  config: StoredConfig,
  pwd: string
): Promise<StoredConfig> {
  console.log(chalk.bold("\n🤖 Model Configuration\n"));

  const enc = (v: unknown) =>
    v && String(v).trim() ? encrypt(String(v), pwd) : undefined;

  if (!config.modelOverrides) config.modelOverrides = {};

  // ── OpenRouter tier (key already collected upfront) ───────────────────────
  const orTier = await select({
    message: "OpenRouter subscription tier:",
    options: [
      { value: "paid", label: "Paid  — access claude-3.5-sonnet, gpt-4o, etc." },
      { value: "free", label: "Free  — openrouter/free (no credits needed)" },
      { value: "none", label: "Skip  — I don't use OpenRouter" },
    ],
  });
  if (isCancel(orTier)) throw new Error("Setup cancelled");

  if (orTier === "paid") {
    const modelChoice = await select({
      message: "Paid model to use via OpenRouter:",
      options: [
        { value: "default", label: `Default — ${DEFAULT_MODELS.openrouter_paid}` },
        { value: "custom",  label: "Custom  — I'll enter a model ID" },
      ],
    });
    if (isCancel(modelChoice)) throw new Error("Setup cancelled");
    if (modelChoice === "custom") {
      const customModel = await text({
        message: "Enter OpenRouter model ID (e.g. openai/gpt-4o):",
        placeholder: "provider/model-name",
        validate: clackModelValidator("openrouter"),
      });
      if (isCancel(customModel)) throw new Error("Setup cancelled");
      const trimmed = (customModel as string).trim();
      printModelWarning("openrouter", trimmed);
      config.modelOverrides.openrouter_paid = trimmed;
    }
  }

  config.openrouterTier = orTier === "none" ? undefined : (orTier as "free" | "paid");

  // ── Primary model provider (for Agent, Plan, Ask, Browser Agent) ──────────
  console.log(chalk.dim("\n  Choose your primary AI model for agent tasks (claude, openai, or gemini).\n"));

  const primaryProvider = await select({
    message: "Primary model provider:",
    options: [
      { value: "claude", label: `Anthropic Claude  (default: ${DEFAULT_MODELS.claude})` },
      { value: "openai", label: `OpenAI  (default: ${DEFAULT_MODELS.openai})` },
      { value: "gemini", label: `Google Gemini  (default: ${DEFAULT_MODELS.gemini})` },
      { value: "none",   label: "Skip — use OpenRouter / Groq only" },
    ],
  });
  if (isCancel(primaryProvider)) throw new Error("Setup cancelled");

  const primaryKeyFields: Record<string, keyof StoredConfig> = {
    claude: "claudeKey", openai: "openaiKey", gemini: "apiKeyGemini",
  };
  const primaryPlaceholders: Record<string, string> = {
    claude: "sk-ant-...", openai: "sk-...", gemini: "AIza...",
  };
  const primarySources: Record<string, string> = {
    claude: "anthropic.com", openai: "platform.openai.com", gemini: "aistudio.google.com",
  };

  let primaryProviders: string[] = [];

  if (primaryProvider !== "none") {
    const p = primaryProvider as string;
    // Ask for key if not stored
    if (!config[primaryKeyFields[p]!]) {
      const k = await text({
        message: `${p} API key (${primarySources[p]}):`,
        placeholder: primaryPlaceholders[p],
        validate: (v) => { if (!v?.trim()) return `${p} API key required`; },
      });
      if (isCancel(k)) throw new Error("Setup cancelled");
      (config as any)[primaryKeyFields[p]!] = enc(k);
    }

    // Custom model for primary
    const defaultModel = DEFAULT_MODELS[p as keyof typeof DEFAULT_MODELS] as string;
    const mChoice = await select({
      message: `Model for ${p}:`,
      options: [
        { value: "default", label: `Default — ${defaultModel}` },
        { value: "custom",  label: "Custom  — I'll enter a model ID" },
      ],
    });
    if (isCancel(mChoice)) throw new Error("Setup cancelled");
    if (mChoice === "custom") {
      const customM = await text({
        message: `Enter ${p} model ID:`,
        placeholder: defaultModel,
        validate: clackModelValidator(p as Provider),
      });
      if (isCancel(customM)) throw new Error("Setup cancelled");
      const trimmed = (customM as string).trim();
      printModelWarning(p as Provider, trimmed);
      (config.modelOverrides as any)[p] = trimmed;
    }
    primaryProviders = [p];
  }

  // ── Fallback providers (optional — pick from the remaining 2) ────────────
  const remaining = (["claude", "openai", "gemini"] as const).filter(
    (p) => p !== primaryProvider
  );

  const fallbackProviders = await multiselect({
    message: "Optional fallback providers (used if primary fails):",
    options: remaining.map((p) => ({
      value: p,
      label: `${p === "claude" ? "Anthropic Claude" : p === "openai" ? "OpenAI" : "Google Gemini"}  (default: ${DEFAULT_MODELS[p]})`,
    })),
    required: false,
  }) as string[];
  if (isCancel(fallbackProviders)) throw new Error("Setup cancelled");

  for (const p of fallbackProviders) {
    if (!config[primaryKeyFields[p]!]) {
      const k = await text({
        message: `${p} API key (${primarySources[p]}) — fallback:`,
        placeholder: primaryPlaceholders[p],
      });
      if (isCancel(k)) throw new Error("Setup cancelled");
      if (k && String(k).trim()) {
        (config as any)[primaryKeyFields[p]!] = enc(k);
      }
    }

    const defaultModel = DEFAULT_MODELS[p as keyof typeof DEFAULT_MODELS] as string;
    const mChoice = await select({
      message: `Model for ${p} (fallback):`,
      options: [
        { value: "default", label: `Default — ${defaultModel}` },
        { value: "custom",  label: "Custom  — I'll enter a model ID" },
      ],
    });
    if (isCancel(mChoice)) throw new Error("Setup cancelled");
    if (mChoice === "custom") {
      const customM = await text({
        message: `Enter ${p} model ID:`,
        placeholder: defaultModel,
        validate: clackModelValidator(p as Provider),
      });
      if (isCancel(customM)) throw new Error("Setup cancelled");
      const trimmed = (customM as string).trim();
      printModelWarning(p as Provider, trimmed);
      (config.modelOverrides as any)[p] = trimmed;
    }
  }

  // Groq is always included as last-resort fallback (key collected upfront)
  config.preferredProviders = [...primaryProviders, ...fallbackProviders, "groq"];
  return config;
}

// ── Setup ─────────────────────────────────────────────────────────────────────

export async function setupAuth(): Promise<AuthResult> {
  console.log(chalk.bold("\n🔐 Initial Setup\n"));

  const username = await text({
    message: "Create username",
    placeholder: "your-username",
    validate: (v) => {
      if (!v?.trim()) return "Username required";
      if (v.length < 3) return "Min 3 characters";
      if (!/^[a-zA-Z0-9_-]+$/.test(v)) return "Alphanumeric + - _ only";
    },
  });
  if (isCancel(username)) throw new Error("Setup cancelled");

  const pwd = await password({
    message: "Create password",
    validate: (v) => { if (!v || v.length < 6) return "Min 6 characters"; },
  });
  if (isCancel(pwd)) throw new Error("Setup cancelled");

  const pwdConfirm = await password({ message: "Confirm password" });
  if (isCancel(pwdConfirm)) throw new Error("Setup cancelled");

  if (pwd !== pwdConfirm) {
    console.log(chalk.red("❌ Passwords don't match\n"));
    return setupAuth();
  }

  const enc = (v: unknown) =>
    v && String(v).trim() ? encrypt(String(v), pwd as string) : undefined;

  console.log(chalk.dim("\n── API Keys ────────────────────────────────────────\n"));

  // Always required: OpenRouter
  const apiKey = await text({
    message: "OpenRouter API key (openrouter.ai) — press Enter to skip",
    placeholder: "sk-or-v1-...",
  });
  if (isCancel(apiKey)) throw new Error("Setup cancelled");

  // Always required: Groq (free, used as fallback/scheduler)
  const groqKey = await text({
    message: "Groq API key (console.groq.com — free) — press Enter to skip",
    placeholder: "gsk_...",
  });
  if (isCancel(groqKey)) throw new Error("Setup cancelled");

  console.log(chalk.dim("\n── Integrations ────────────────────────────────────\n"));

  const telegramBotToken = await text({
    message: "Telegram Bot Token — press Enter to skip",
    placeholder: "123456:ABC-...",
  });
  if (isCancel(telegramBotToken)) throw new Error("Setup cancelled");

  const telegramOwnerId = await text({
    message: "Telegram Owner Chat ID — press Enter to skip",
    placeholder: "123456789",
  });
  if (isCancel(telegramOwnerId)) throw new Error("Setup cancelled");

  console.log(chalk.dim("\n── Supabase (for Scheduler) ────────────────────────\n"));

  const supabaseUrl = await text({
    message: "Supabase project URL — press Enter to skip",
    placeholder: "https://xxxx.supabase.co",
  });
  if (isCancel(supabaseUrl)) throw new Error("Setup cancelled");

  const supabaseServiceRoleKey = await text({
    message: "Supabase service role key — press Enter to skip",
    placeholder: "eyJ...",
  });
  if (isCancel(supabaseServiceRoleKey)) throw new Error("Setup cancelled");

  const supabaseAccessToken = supabaseUrl && String(supabaseUrl).trim()
    ? await text({
        message: "Supabase personal access token (supabase.com/dashboard/account/tokens) — press Enter to skip",
        placeholder: "sbp_...",
      })
    : undefined;
  if (isCancel(supabaseAccessToken)) throw new Error("Setup cancelled");

  console.log(chalk.dim("\n── Gmail OAuth ─────────────────────────────────────\n"));

  const googleClientId = await text({
    message: "Google OAuth Client ID — press Enter to skip",
    placeholder: "xxxx.apps.googleusercontent.com",
  });
  if (isCancel(googleClientId)) throw new Error("Setup cancelled");

  const googleClientSecret = await text({
    message: "Google OAuth Client Secret — press Enter to skip",
    placeholder: "GOCSPX-...",
  });
  if (isCancel(googleClientSecret)) throw new Error("Setup cancelled");

  console.log(chalk.dim("\n── Web / Browser ───────────────────────────────────\n"));

  const firecrawlKey = await text({
    message: "Firecrawl API key — press Enter to skip",
    placeholder: "fc-...",
  });
  if (isCancel(firecrawlKey)) throw new Error("Setup cancelled");

  const apifyKey = await text({
    message: "Apify API key — press Enter to skip",
    placeholder: "apify_api_...",
  });
  if (isCancel(apifyKey)) throw new Error("Setup cancelled");

  const browserbaseApiKey = await text({
    message: "Browserbase API key — press Enter to skip",
    placeholder: "bb_live_...",
  });
  if (isCancel(browserbaseApiKey)) throw new Error("Setup cancelled");

  const browserbaseProjectId = await text({
    message: "Browserbase Project ID — press Enter to skip",
    placeholder: "xxxxxxxx-...",
  });
  if (isCancel(browserbaseProjectId)) throw new Error("Setup cancelled");

  let config: StoredConfig = {
    username: username as string,
    passwordHash: hashPassword(pwd as string),
    apiKey: enc(apiKey) ?? "",
    apiKeyGemini: "",           // collected in model setup if gemini selected
    groqKey: enc(groqKey),
    telegramBotToken: enc(telegramBotToken),
    telegramOwnerId: enc(telegramOwnerId),
    supabaseUrl: enc(supabaseUrl),
    supabaseServiceRoleKey: enc(supabaseServiceRoleKey),
    supabaseAccessToken: enc(supabaseAccessToken),
    googleClientId: enc(googleClientId),
    googleClientSecret: enc(googleClientSecret),
    firecrawlKey: enc(firecrawlKey),
    apifyKey: enc(apifyKey),
    browserbaseApiKey: enc(browserbaseApiKey),
    browserbaseProjectId: enc(browserbaseProjectId),
    lastLogin: Date.now(),
  };

  // Model selection
  config = await runModelSetup(config, pwd as string);

  saveConfig(config);
  console.log(chalk.green("\n✓ Setup complete!\n"));

  // Auto-migrate Supabase schema
  const rawUrl = supabaseUrl ? String(supabaseUrl).trim() : "";
  const rawKey = supabaseServiceRoleKey ? String(supabaseServiceRoleKey).trim() : "";
  const rawToken = supabaseAccessToken ? String(supabaseAccessToken).trim() : "";
  if (rawUrl && rawKey && rawToken) {
    try {
      const { runDbMigrations } = await import("../scheduler/db-migrate");
      await runDbMigrations(rawUrl, rawKey, rawToken);
    } catch (err) {
      console.log(chalk.yellow(`⚠ Auto-migration failed: ${err instanceof Error ? err.message : String(err)}`));
      console.log(chalk.dim("  Run scheduler/SETUP-READY.sql manually or `jerob setup-db` later.\n"));
    }
  } else if (rawUrl && rawKey && !rawToken) {
    console.log(chalk.dim("\n  Skipping auto-setup (no personal access token provided)."));
    console.log(chalk.dim("  Run `jerob setup-db` after adding your token.\n"));
  }

  return { config, password: pwd as string };
}

// ── Login ─────────────────────────────────────────────────────────────────────

export async function loginAuth(): Promise<AuthResult> {
  const config = loadConfig();
  if (!config) return setupAuth();

  console.log(chalk.bold(`\n🔑 Login\n`));

  const enteredUsername = await text({
    message: "Username",
    placeholder: config.username,
  });
  if (isCancel(enteredUsername)) throw new Error("Login cancelled");

  if (enteredUsername !== config.username) {
    console.log(chalk.red("❌ Username mismatch\n"));
    return loginAuth();
  }

  const enteredPassword = await password({ message: "Password" });
  if (isCancel(enteredPassword)) throw new Error("Login cancelled");

  if (!verifyPassword(enteredPassword as string, config.passwordHash)) {
    console.log(chalk.red("❌ Wrong password\n"));
    return loginAuth();
  }

  config.lastLogin = Date.now();
  saveConfig(config);
  console.log(chalk.green(`\n✓ Welcome back, ${config.username}!\n`));
  return { config, password: enteredPassword as string };
}

// ── Key decryption ────────────────────────────────────────────────────────────

export function getAllKeys(config: StoredConfig, pwd: string): Record<string, string> {
  const dec = (v: string | undefined) => (v ? decrypt(v, pwd) : "");
  try {
    const keys: Record<string, string> = {
      OPENROUTER_KEY:               dec(config.apiKey),
      GOOGLE_GENERATIVE_AI_API_KEY: dec(config.apiKeyGemini),
      GROQ_API_KEY:                 dec(config.groqKey),
      ANTHROPIC_API_KEY:            dec(config.claudeKey),
      OPENAI_API_KEY:               dec(config.openaiKey),
      TELEGRAM_BOT_TOKEN:           dec(config.telegramBotToken),
      TELEGRAM_OWNER_ID:            dec(config.telegramOwnerId),
      SUPABASE_URL:                 dec(config.supabaseUrl),
      SUPABASE_SERVICE_ROLE_KEY:    dec(config.supabaseServiceRoleKey),
      SUPABASE_ACCESS_TOKEN:        dec(config.supabaseAccessToken),
      GOOGLE_CLIENT_ID:             dec(config.googleClientId),
      GOOGLE_CLIENT_SECRET:         dec(config.googleClientSecret),
      FIRECRAWL_KEY:                dec(config.firecrawlKey),
      APIFY_API_KEY:                dec(config.apifyKey),
      BROWSERBASE_API_KEY:          dec(config.browserbaseApiKey),
      BROWSERBASE_PRODUCT_ID:       dec(config.browserbaseProjectId),
      OPENROUTER_TIER:              config.openrouterTier ?? "free",
      PREFERRED_PROVIDERS:          (config.preferredProviders ?? ["groq"]).join(","),
      PORT:                         "8787",
    };

    const ov = config.modelOverrides ?? {};
    if (ov.openrouter_paid) keys["MODEL_OPENROUTER_PAID"] = ov.openrouter_paid;
    if (ov.gemini)          keys["MODEL_GEMINI"]          = ov.gemini;
    if (ov.claude)          keys["MODEL_CLAUDE"]          = ov.claude;
    if (ov.openai)          keys["MODEL_OPENAI"]          = ov.openai;
    if (ov.groq)            keys["MODEL_GROQ"]            = ov.groq;

    return keys;
  } catch {
    throw new Error("Failed to decrypt keys — wrong password?");
  }
}

/** @deprecated use getAllKeys */
export function getApiKey(config: StoredConfig, pwd: string): string[] {
  const keys = getAllKeys(config, pwd);
  return [keys.OPENROUTER_KEY!, keys.GOOGLE_GENERATIVE_AI_API_KEY!];
}

// ── Switch model flow ─────────────────────────────────────────────────────────

export async function switchModelFlow(config: StoredConfig, pwd: string): Promise<void> {
  if (!config.modelOverrides) config.modelOverrides = {};

  const provider = await select({
    message: "Which provider's model do you want to switch?",
    options: [
      { value: "openrouter_paid", label: `OpenRouter (paid)  — current: ${config.modelOverrides.openrouter_paid ?? DEFAULT_MODELS.openrouter_paid}` },
      { value: "gemini",          label: `Google Gemini      — current: ${config.modelOverrides.gemini ?? DEFAULT_MODELS.gemini}` },
      { value: "claude",          label: `Anthropic Claude   — current: ${config.modelOverrides.claude ?? DEFAULT_MODELS.claude}` },
      { value: "openai",          label: `OpenAI             — current: ${config.modelOverrides.openai ?? DEFAULT_MODELS.openai}` },
      { value: "groq",            label: `Groq               — current: ${config.modelOverrides.groq ?? DEFAULT_MODELS.groq}` },
    ],
  });
  if (isCancel(provider)) throw new Error("Switch cancelled");

  const p = provider as string;
  const defaultId = DEFAULT_MODELS[p as keyof typeof DEFAULT_MODELS] as string;

  const choice = await select({
    message: `Model for ${p}:`,
    options: [
      { value: "default", label: `Reset to default — ${defaultId}` },
      { value: "custom",  label: "Enter a custom model ID" },
    ],
  });
  if (isCancel(choice)) throw new Error("Switch cancelled");

  if (choice === "default") {
    delete (config.modelOverrides as any)[p];
    saveConfig(config);
    console.log(chalk.green(`\n✓ ${p} reset to default: ${defaultId}\n`));
    return;
  }

  const validatorProvider = (p === "openrouter_paid" ? "openrouter" : p) as Provider;
  const newModel = await text({
    message: `Enter model ID for ${p}:`,
    placeholder: defaultId,
    validate: clackModelValidator(validatorProvider),
  });
  if (isCancel(newModel)) throw new Error("Switch cancelled");

  const trimmed = (newModel as string).trim();
  printModelWarning(validatorProvider, trimmed);
  (config.modelOverrides as any)[p] = trimmed;
  saveConfig(config);
  console.log(chalk.green(`\n✓ ${p} switched to: ${trimmed}\n`));
  console.log(chalk.dim("Run `jerob jet` to apply.\n"));
}

// ── Update flows ──────────────────────────────────────────────────────────────

export async function updateApiKey(): Promise<void> {
  const config = loadConfig();
  if (!config) { await setupAuth(); return; }

  console.log(chalk.bold("\n🔄 Update API Keys\n"));

  const enteredUsername = await text({ message: "Username", placeholder: config.username });
  if (isCancel(enteredUsername)) throw new Error("Update cancelled");
  if (enteredUsername !== config.username) {
    console.log(chalk.red("❌ Username mismatch\n"));
    return updateApiKey();
  }

  const enteredPassword = await password({ message: "Password" });
  if (isCancel(enteredPassword)) throw new Error("Update cancelled");
  if (!verifyPassword(enteredPassword as string, config.passwordHash)) {
    console.log(chalk.red("❌ Wrong password\n"));
    return updateApiKey();
  }

  const which = await select({
    message: "What to update?",
    options: [
      { value: "openrouter", label: "OpenRouter API key" },
      { value: "groq",       label: "Groq API key" },
      { value: "gemini",     label: "Google Gemini API key" },
      { value: "claude",     label: "Anthropic Claude API key" },
      { value: "openai",     label: "OpenAI API key" },
      { value: "models",     label: "Model preferences + provider order" },
      { value: "switch",     label: "Switch active model for a provider" },
    ],
  });
  if (isCancel(which)) throw new Error("Update cancelled");

  const enc = (v: string) => encrypt(v, enteredPassword as string);

  if (which === "models") {
    const updated = await runModelSetup(config, enteredPassword as string);
    saveConfig(updated);
    console.log(chalk.green("\n✓ Model preferences updated!\n"));
    return;
  }

  if (which === "switch") {
    await switchModelFlow(config, enteredPassword as string);
    return;
  }

  const placeholders: Record<string, string> = {
    openrouter: "sk-or-v1-...", gemini: "AIza...",
    claude: "sk-ant-...", openai: "sk-...", groq: "gsk_...",
  };

  const newKey = await text({
    message: `New ${which} API key:`,
    placeholder: placeholders[which as string] ?? "...",
    validate: (v) => { if (!v?.trim()) return "Key required"; },
  });
  if (isCancel(newKey)) throw new Error("Update cancelled");

  const keyMap: Record<string, keyof typeof config> = {
    openrouter: "apiKey", gemini: "apiKeyGemini",
    claude: "claudeKey", openai: "openaiKey", groq: "groqKey",
  };

  (config as any)[keyMap[which as string]!] = enc(newKey as string);
  config.lastLogin = Date.now();
  saveConfig(config);
  console.log(chalk.green(`\n✓ ${which} key updated!\n`));
}

export function resetAuth(): void { removeConfig(); }

export async function authenticate(): Promise<AuthResult> {
  return isConfigured() ? await loginAuth() : await setupAuth();
}
