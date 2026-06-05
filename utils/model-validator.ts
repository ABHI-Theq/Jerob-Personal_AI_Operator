/**
 * Model ID validation for all supported providers.
 *
 * Strategy:
 * - Each provider has a curated list of known-valid models.
 * - If the input matches a known model → valid.
 * - If the input passes the provider's format rules → warn but allow (future models).
 * - If neither → error with suggestions.
 *
 * No live API calls are made — this is intentional to keep setup fast and offline-capable.
 */

export type Provider = "openrouter" | "gemini" | "claude" | "openai" | "groq";

// ── Known valid models per provider ──────────────────────────────────────────

export const KNOWN_MODELS: Record<Provider, string[]> = {
  openrouter: [
    // Anthropic via OpenRouter
    "anthropic/claude-3.5-sonnet",
    "anthropic/claude-3.5-haiku",
    "anthropic/claude-3-opus",
    "anthropic/claude-3-haiku",
    // OpenAI via OpenRouter
    "openai/gpt-4o",
    "openai/gpt-4o-mini",
    "openai/gpt-4-turbo",
    "openai/o1-preview",
    "openai/o1-mini",
    // Google via OpenRouter
    "google/gemini-pro-1.5",
    "google/gemini-flash-1.5",
    "google/gemini-2.0-flash-exp:free",
    // Meta via OpenRouter
    "meta-llama/llama-3.1-8b-instruct:free",
    "meta-llama/llama-3.1-70b-instruct",
    "meta-llama/llama-3.3-70b-instruct",
    // Mistral via OpenRouter
    "mistralai/mistral-7b-instruct:free",
    "mistralai/mistral-large",
    "mistralai/mixtral-8x7b-instruct",
    // Qwen
    "qwen/qwen-2.5-72b-instruct",
    "qwen/qwen-2.5-7b-instruct:free",
    // Free routing
    "openrouter/free",
  ],

  gemini: [
    "gemini-2.0-flash",
    "gemini-2.0-flash-exp",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-1.0-pro",
    "gemini-pro",
    "gemini-3.1-flash-lite-preview",
    "gemini-2.0-flash-thinking-exp",
  ],

  claude: [
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
    "claude-3-opus-20240229",
    "claude-3-sonnet-20240229",
    "claude-3-haiku-20240307",
    "claude-2.1",
    "claude-instant-1.2",
  ],

  openai: [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "gpt-4-turbo-preview",
    "gpt-4",
    "gpt-3.5-turbo",
    "gpt-3.5-turbo-16k",
    "o1-preview",
    "o1-mini",
    "o3-mini",
  ],

  groq: [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "llama-3.1-70b-versatile",
    "llama3-8b-8192",
    "llama3-70b-8192",
    "mixtral-8x7b-32768",
    "gemma2-9b-it",
    "gemma-7b-it",
    "whisper-large-v3",
  ],
};

// ── Format rules per provider ─────────────────────────────────────────────────

const FORMAT_RULES: Record<Provider, { pattern: RegExp; hint: string }> = {
  openrouter: {
    pattern: /^[a-z0-9_-]+\/[a-z0-9._:-]+$/i,
    hint:    "Must be in format provider/model-name (e.g. openai/gpt-4o, meta-llama/llama-3.1-8b-instruct:free)",
  },
  gemini: {
    pattern: /^gemini[-\w.]+$/i,
    hint:    "Must start with 'gemini' (e.g. gemini-2.0-flash, gemini-1.5-pro)",
  },
  claude: {
    pattern: /^claude[-\w.]+$/i,
    hint:    "Must start with 'claude' (e.g. claude-3-5-sonnet-20241022)",
  },
  openai: {
    pattern: /^(gpt|o[0-9])[-\w.]+$/i,
    hint:    "Must start with 'gpt-' or 'o1/'o3' (e.g. gpt-4o, o1-mini)",
  },
  groq: {
    pattern: /^[a-z0-9][-\w.]+$/i,
    hint:    "e.g. llama-3.3-70b-versatile, mixtral-8x7b-32768",
  },
};

// ── Public validator ──────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  error?: string;     // hard error — don't allow
  warning?: string;   // soft warning — allow but inform
  suggestions?: string[]; // closest known models
}

/**
 * Validates a model ID for a given provider.
 * Returns { valid: true } if known, { valid: true, warning } if format-valid but unknown,
 * { valid: false, error } if format is wrong.
 */
export function validateModel(provider: Provider, modelId: string): ValidationResult {
  const s = modelId.trim();

  if (!s) {
    return { valid: false, error: "Model ID cannot be empty" };
  }

  if (s.length > 150) {
    return { valid: false, error: "Model ID is too long (max 150 characters)" };
  }

  // Check known list first
  const known = KNOWN_MODELS[provider];
  if (known.includes(s)) {
    return { valid: true };
  }

  // Check format
  const rule = FORMAT_RULES[provider];
  if (!rule.pattern.test(s)) {
    const suggestions = closestMatches(s, known);
    return {
      valid: false,
      error: `Invalid format for ${provider}. ${rule.hint}`,
      suggestions,
    };
  }

  // Format valid but not in known list — allow with warning
  const suggestions = closestMatches(s, known);
  return {
    valid: true,
    warning: `"${s}" is not in the known model list for ${provider}. It may work if it's a new model.`,
    suggestions,
  };
}

/** Find up to 3 closest known models by string similarity */
function closestMatches(input: string, known: string[]): string[] {
  const lower = input.toLowerCase();
  return known
    .map((k) => ({ k, score: similarity(lower, k.toLowerCase()) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .filter((x) => x.score > 0.2)
    .map((x) => x.k);
}

/** Simple bigram similarity (Sørensen–Dice coefficient) */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigrams = (s: string) => {
    const set = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2);
      set.set(bg, (set.get(bg) ?? 0) + 1);
    }
    return set;
  };

  const aGrams = bigrams(a);
  const bGrams = bigrams(b);
  let intersection = 0;

  for (const [bg, count] of aGrams) {
    const bCount = bGrams.get(bg) ?? 0;
    intersection += Math.min(count, bCount);
  }

  return (2 * intersection) / (a.length - 1 + (b.length - 1));
}

/**
 * Returns a validate function compatible with @clack/prompts `text.validate`.
 * Shows hard errors, shows warnings inline, allows the user to proceed.
 */
export function clackModelValidator(
  provider: Provider
): (value: string | undefined) => string | undefined {
  return (value) => {
    const v = value?.trim() ?? "";
    if (!v) return "Model ID required";
    const result = validateModel(provider, v);
    if (!result.valid) {
      const base = result.error!;
      const hint = result.suggestions?.length
        ? `\n  Did you mean: ${result.suggestions.join(", ")}?`
        : "";
      return base + hint;
    }
    // warnings are shown after the prompt, not as validation errors
    return undefined;
  };
}

/**
 * Print a validation warning to the console (called after text() resolves).
 */
export function printModelWarning(provider: Provider, modelId: string): void {
  const result = validateModel(provider, modelId.trim());
  if (result.warning) {
    console.log(chalk.yellow(`  ⚠  ${result.warning}`));
    if (result.suggestions?.length) {
      console.log(chalk.dim(`     Known models: ${result.suggestions.join(", ")}`));
    }
  }
}

// chalk is used only in printModelWarning — import it here to avoid circular deps
import chalk from "chalk";
