/**
 * Writes/updates the project .env file from decrypted keys stored in ~/.cccontrol/config.json.
 * Called after login so no user ever needs to manually create a .env file.
 * Keys that are empty are omitted. Existing .env entries NOT in our key set are preserved.
 */

import fs from "node:fs";
import path from "node:path";

const ENV_PATH = path.resolve(process.cwd(), ".env");

// Keys we own and manage — any other lines in .env are left untouched
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

/**
 * Merge keys into .env.
 * - Creates the file if it doesn't exist.
 * - Updates managed keys in-place (preserving line order).
 * - Appends newly added managed keys at the bottom.
 * - Never touches unmanaged lines (comments, user-added vars).
 */
export function writeEnvFile(keys: Record<string, string>): void {
  // Read existing lines
  let existingLines: string[] = [];
  if (fs.existsSync(ENV_PATH)) {
    existingLines = fs.readFileSync(ENV_PATH, "utf8").split("\n");
  }

  const written = new Set<string>();

  // Update existing managed lines in-place
  const updatedLines = existingLines.map((line) => {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=/);
    if (!match) return line; // comment, blank line, or unmanaged — keep as-is
    const key = match[1]!;
    if (!MANAGED_KEYS.has(key)) return line; // not our key — keep as-is
    const value = keys[key];
    if (!value) return line; // empty value — keep existing line unchanged
    written.add(key);
    return `${key}=${value}`;
  });

  // Append any managed keys that weren't already in the file
  const newLines: string[] = [];
  for (const [key, value] of Object.entries(keys)) {
    if (value && MANAGED_KEYS.has(key) && !written.has(key)) {
      newLines.push(`${key}=${value}`);
    }
  }

  // Ensure PORT is always set (needed by Gmail OAuth server)
  if (!written.has("PORT") && !keys["PORT"]) {
    newLines.push("PORT=8787");
  }

  const final = [...updatedLines, ...newLines].join("\n").trimEnd() + "\n";
  fs.writeFileSync(ENV_PATH, final, "utf8");
}
