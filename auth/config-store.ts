import fs from "node:fs";
import path from "node:path";
import { homedir } from "node:os";

const CONFIG_DIR = path.join(homedir(), ".cccontrol");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export interface StoredConfig {
  username: string;
  passwordHash: string;
  // encrypted keys
  apiKey: string;          // OpenRouter
  apiKeyGemini: string;    // Google Gemini
  groqKey?: string;
  claudeKey?: string;      // Anthropic Claude
  openaiKey?: string;      // OpenAI
  telegramBotToken?: string;
  telegramOwnerId?: string;
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  supabaseAccessToken?: string;   // personal access token for Management API (setup only)
  googleClientId?: string;
  googleClientSecret?: string;
  firecrawlKey?: string;
  apifyKey?: string;
  browserbaseApiKey?: string;
  browserbaseProjectId?: string;
  // model preferences
  openrouterTier?: "free" | "paid";           // which OpenRouter tier to use
  preferredProviders?: string[];               // ordered list: gemini, claude, openai, groq
  // per-provider model overrides (encrypted)
  modelOverrides?: {
    openrouter_paid?: string;   // e.g. "openai/gpt-4o"
    gemini?: string;            // e.g. "gemini-1.5-pro"
    claude?: string;            // e.g. "claude-3-opus-20240229"
    openai?: string;            // e.g. "gpt-4o"
    groq?: string;              // e.g. "mixtral-8x7b-32768"
  };
  lastLogin: number;
}

export function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadConfig(): StoredConfig | null {
  ensureConfigDir();
  if (!fs.existsSync(CONFIG_FILE)) return null;
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf8");
    return JSON.parse(raw) as StoredConfig;
  } catch {
    return null;
  }
}

export function saveConfig(config: StoredConfig): void {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf8");
  fs.chmodSync(CONFIG_FILE, 0o600);
}

export function isConfigured(): boolean {
  return loadConfig() !== null;
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export function removeConfig(): void {
  if (fs.existsSync(CONFIG_FILE)) {
    fs.unlinkSync(CONFIG_FILE);
  }
}
