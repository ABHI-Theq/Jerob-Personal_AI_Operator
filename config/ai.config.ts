import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createGroq } from "@ai-sdk/groq";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

// ── Defaults — used when no MODEL_* override is set ──────────────────────────
export const DEFAULT_MODELS = {
  openrouter_free: "openrouter/free",
  openrouter_paid: "anthropic/claude-3.5-sonnet",
  gemini:  "gemini-3.1-flash-lite-preview",
  claude:  "claude-3-5-sonnet-20241022",
  openai:  "gpt-4o-mini",
  groq:    "llama-3.3-70b-versatile",
} as const;

// ── Active model per provider ─────────────────────────────────────────────────
// MODEL_* env vars are written by auth/env-writer.ts from stored modelOverrides.
function activeModel(provider: keyof typeof DEFAULT_MODELS): string {
  const key = `MODEL_${provider.toUpperCase().replace("-", "_")}`;
  return process.env[key]?.trim() || DEFAULT_MODELS[provider];
}

// ── Provider builders ─────────────────────────────────────────────────────────

function openrouterModel(modelId: string): LanguageModel | null {
  const key = process.env.OPENROUTER_KEY?.trim();
  if (!key || !key.startsWith("sk-or-v1-")) return null;
  return createOpenRouter({ apiKey: key })(modelId);
}

function geminiModel(modelId?: string): LanguageModel | null {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (!key) return null;
  return createGoogleGenerativeAI({ apiKey: key })(modelId ?? activeModel("gemini"));
}

function claudeModel(modelId?: string): LanguageModel | null {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return null;
  return createAnthropic({ apiKey: key })(modelId ?? activeModel("claude"));
}

function openaiModel(modelId?: string): LanguageModel | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  return createOpenAI({ apiKey: key })(modelId ?? activeModel("openai"));
}

function groqModel(modelId?: string): LanguageModel | null {
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) return null;
  return createGroq({ apiKey: key })(modelId ?? activeModel("groq"));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns providers in the exact order the user chose during setup:
 * [primary, ...optionalFallbacks, groq]
 * Written to PREFERRED_PROVIDERS by auth/env-writer.ts.
 */
function preferredProviders(): string[] {
  const raw = process.env.PREFERRED_PROVIDERS;
  if (raw) return raw.split(",").map((s) => s.trim()).filter(Boolean);
  return ["groq"];
}

function modelForProvider(provider: string): LanguageModel | null {
  switch (provider) {
    case "gemini": return geminiModel();
    case "claude": return claudeModel();
    case "openai": return openaiModel();
    case "groq":   return groqModel();
    default:       return null;
  }
}

function firstAvailable(
  candidates: Array<() => LanguageModel | null>,
  name: string
): LanguageModel {
  for (const build of candidates) {
    const m = build();
    if (m) return m;
  }
  throw new Error(
    `No AI model available for ${name}. ` +
    `Run \`jerob set-key\` to add API keys or switch models.`
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Primary model — Agent, Plan, Ask modes.
 *
 * Order:
 *   1. OpenRouter (paid model or free slug, if key present)
 *   2. User's chosen providers in their selected order (PREFERRED_PROVIDERS)
 *      — primary first, optional fallbacks after, groq always last
 */
export function getAgentModel(): LanguageModel {
  const tier  = process.env.OPENROUTER_TIER ?? "free";
  const orKey = process.env.OPENROUTER_KEY?.trim();

  const candidates: Array<() => LanguageModel | null> = [];

  if (orKey) {
    candidates.push(
      tier === "paid"
        ? () => openrouterModel(activeModel("openrouter_paid"))
        : () => openrouterModel(DEFAULT_MODELS.openrouter_free)
    );
  }

  // Respect user's chosen order exactly
  for (const p of preferredProviders()) {
    candidates.push(() => modelForProvider(p));
  }

  return firstAvailable(candidates, "Agent");
}

/**
 * Secondary model — Scheduler planner, Browser Agent evaluator.
 * Skips OpenRouter to avoid content refusals on structured prompts.
 * Uses the same user-defined provider order as the primary model.
 */
export function getAgentModel2(): LanguageModel {
  const providers = preferredProviders();
  const candidates = providers.map((p) => () => modelForProvider(p));
  // Groq is already last in preferredProviders from setup, but ensure it's there
  if (!providers.includes("groq")) {
    candidates.push(() => groqModel());
  }
  return firstAvailable(candidates, "Model2");
}

/**
 * Fallback model — when primary refuses or hits rate limits.
 * Uses user's provider order, then falls back to openrouter/free → groq.
 */
export function getAgentModel2Fallback(): LanguageModel {
  const providers = preferredProviders();
  const candidates: Array<() => LanguageModel | null> = providers.map(
    (p) => () => modelForProvider(p)
  );
  // Final safety nets
  candidates.push(() => openrouterModel(DEFAULT_MODELS.openrouter_free));
  if (!providers.includes("groq")) candidates.push(() => groqModel());
  return firstAvailable(candidates, "Fallback");
}

/**
 * Explicit named model — for Stagehand/browser executor.
 */
export function getNamedModel(
  provider: "gemini" | "claude" | "openai" | "groq"
): LanguageModel {
  return firstAvailable([() => modelForProvider(provider)], provider);
}
