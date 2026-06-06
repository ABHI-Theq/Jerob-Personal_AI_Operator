import { homedir } from "node:os";
import path from "node:path";
import fs from "node:fs";

const GOOGLE_CONFIG_DIR = path.join(homedir(), ".cccontrol", "/googleAuth");
const GOOGLE_CONFIG_FILE = path.join(GOOGLE_CONFIG_DIR, "google_config.json");

export type GoogleConfig = {
  access_token?: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  /** Access token expiry as ms epoch timestamp (from Google's expiry_date field) */
  expiry_date?: number;
  createdAt: number;
};

export function ensureConfigDir(): void {
  if (!fs.existsSync(GOOGLE_CONFIG_DIR)) {
    fs.mkdirSync(GOOGLE_CONFIG_DIR, { recursive: true });
  }
}

export function saveConfig(config: GoogleConfig): void {
  ensureConfigDir();
  fs.writeFileSync(GOOGLE_CONFIG_FILE, JSON.stringify(config, null, 2), "utf8");
  fs.chmodSync(GOOGLE_CONFIG_FILE, 0o600);
}

export function loadConfig(): GoogleConfig | null {
  ensureConfigDir();
  if (!fs.existsSync(GOOGLE_CONFIG_FILE)) return null;
  try {
    const raw = fs.readFileSync(GOOGLE_CONFIG_FILE, "utf8");
    return JSON.parse(raw) as GoogleConfig;
  } catch {
    return null;
  }
}

/** Returns the refresh token if auth looks valid, null if re-auth is needed. */
export const isAuth = (): string | null => {
  const config = loadConfig();
  if (!config?.refresh_token) return null;
  // Standard prod: Google doesn't expose refresh token expiry — rely on invalid_grant at use time
  return config.refresh_token;
};

/** Returns true if the stored access token is still valid (saves a network call). */
export const isAccessTokenFresh = (): boolean => {
  const config = loadConfig();
  if (!config?.access_token || !config.expiry_date) return false;
  // Give a 60s buffer before actual expiry
  return config.expiry_date > Date.now() + 60_000;
};

export function removeConfig(): void {
  if (fs.existsSync(GOOGLE_CONFIG_FILE)) {
    fs.unlinkSync(GOOGLE_CONFIG_FILE);
  }
}
