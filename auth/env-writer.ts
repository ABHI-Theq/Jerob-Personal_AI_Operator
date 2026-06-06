/**
 * Writes/updates the project .env file from decrypted keys.
 * Called after login — no user ever needs to manually create a .env file.
 * Keys that are empty are omitted. Existing .env entries NOT in our key set are preserved.
 */

import fs from "node:fs";
import path from "node:path";

const ENV_PATH = path.resolve(process.cwd(), ".env");

const MANAGED_KEYS = new Set([
  "OPENROUTER_KEY",
  "OPENROUTER_MODEL",
  "OPENROUTER_TIER",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GROQ_API_KEY",
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_OWNER_ID",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ACCESS_TOKEN",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "FIRECRAWL_KEY",
  "APIFY_API_KEY",
  "BROWSERBASE_API_KEY",
  "BROWSERBASE_PRODUCT_ID",
  "PREFERRED_PROVIDERS",
  "MODEL_OPENROUTER_PAID",
  "MODEL_GEMINI",
  "MODEL_CLAUDE",
  "MODEL_OPENAI",
  "MODEL_GROQ",
  "PORT",
]);

export function writeEnvFile(keys: Record<string, string>): void {
  // PORT is always 8787
  keys["PORT"] = "8787";

  let existingLines: string[] = [];
  if (fs.existsSync(ENV_PATH)) {
    existingLines = fs.readFileSync(ENV_PATH, "utf8").split("\n");
  }

  const written = new Set<string>();
  const seenKeys = new Set<string>();

  const updatedLines = existingLines
    .map((line) => {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=/);
      if (!match) return line; // comment or blank — keep as-is
      const key = match[1]!;

      // Drop duplicate occurrences of the same key
      if (seenKeys.has(key)) return null;
      seenKeys.add(key);

      if (!MANAGED_KEYS.has(key)) return line; // not ours — keep as-is

      written.add(key);
      const value = keys[key];
      // Always write a value for PORT; omit blank non-PORT managed keys
      if (!value) return key === "PORT" ? `PORT=8787` : `${key}=`;
      return `${key}=${value}`;
    })
    .filter((line): line is string => line !== null);

  // Append managed keys not yet in the file
  const newLines: string[] = [];
  for (const [key, value] of Object.entries(keys)) {
    if (MANAGED_KEYS.has(key) && !written.has(key) && value) {
      newLines.push(`${key}=${value}`);
    }
  }

  const final = [...updatedLines, ...newLines].join("\n").trimEnd() + "\n";
  fs.writeFileSync(ENV_PATH, final, "utf8");
}
