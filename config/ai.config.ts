import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createGroq } from "@ai-sdk/groq";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

// ── Hardcoded defaults — used when no override is set ─────────────────────────
export const DEFAULT_MODELS = {
  openrouter_free: "openrouter/free",           // OpenRouter free tier router
  openrouter_paid: "anthropic/claude-3.5-sonnet", // best model on OpenRouter paid
  gemini:  "gemini-2.0-flash",
  claude:  "claude-3-5-sonnet-20241022",
  openai:  "gpt-4o-mini",
  groq:    "llama-3.3-70b-versatile",
} as const;

// ── Active model per provider ─────────────────────────────────────────────────
// MODEL_* env vars are written by auth/env-writer.ts from the stored modelOverrides.
// If the user set a custom model via `jimmy set-key → switch`, it appears here.
function activeModel(provider: keyof typeof DEFAULT_MODELS): string {
  const overrideKey = `MODEL_${provider.toUpperCase().replace("-", "_")}`;
  return process.env[overrideKey]?.trim() || DEFAULT_MODELS[provider];
}

// ── Provider builders ─────────────────────────────────────────────────────────

function openrouterModel(modelId: string): LanguageModel | null {
  const key = process.env.OPENROUTER_KEY?.trim();
  // OpenRouter keys start with sk-or-v1- — skip if key looks invalid
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

function preferredProviders(): string[] {
  const raw = process.env.PREFERRED_PROVIDERS;
  if (raw) return raw.split(",").map((s) => s.trim()).filter(Boolean);
  return ["groq"]; // safe always-free default
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
    `Run \`jimmy set-key\` to add API keys or switch models.`
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Primary model — Agent, Plan, Ask modes.
 *
 * OpenRouter decision:
 *   OPENROUTER_KEY present?
 *     OPENROUTER_TIER=paid → uses MODEL_OPENROUTER_PAID (default: claude-3.5-sonnet)
 *                            User can customise via `jimmy set-key → switch model`
 *     OPENROUTER_TIER=free → always uses "openrouter/free" (no custom model for free)
 *     no key               → skips OpenRouter entirely
 *
 * Then falls through to PREFERRED_PROVIDERS in user-chosen order.
 */
export function getAgentModel(): LanguageModel {
  const tier   = process.env.OPENROUTER_TIER ?? "free";
  const orKey  = process.env.OPENROUTER_KEY?.trim();

  const candidates: Array<() => LanguageModel | null> = [];

  if (orKey) {
    if (tier === "paid") {
      // Paid: use user's chosen model or the default paid model
      const model = activeModel("openrouter_paid");
      candidates.push(() => openrouterModel(model));
    } else {
      // Free: always openrouter/free — no user customisation, it's a routing slug
      candidates.push(() => openrouterModel(DEFAULT_MODELS.openrouter_free));
    }
  }

  for (const p of preferredProviders()) {
    candidates.push(() => modelForProvider(p));
  }

  return firstAvailable(candidates, "Agent");
}

/**
 * Secondary model — Scheduler planner, Browser Agent evaluator.
 * Does NOT use OpenRouter to avoid content refusals on structured prompts.
 * Tries preferred providers → Groq as last resort.
 */
export function getAgentModel2(): LanguageModel {
  const candidates = preferredProviders().map((p) => () => modelForProvider(p));
  candidates.push(() => groqModel()); // groq always last resort
  return firstAvailable(candidates, "Model2");
}

/**
 * Fallback model — when primary refuses or hits rate limits.
 * OpenRouter free → Groq → Gemini flash.
 */
export function getAgentModel2Fallback(): LanguageModel {
  return firstAvailable(
    [
      () => openrouterModel(DEFAULT_MODELS.openrouter_free),
      () => groqModel(),
      () => geminiModel("gemini-2.5-flash"),
    ],
    "Fallback"
  );
}

/**
 * Explicit named model — for Stagehand/browser executor.
 */
export function getNamedModel(
  provider: "gemini" | "claude" | "openai" | "groq"
): LanguageModel {
  return firstAvailable([() => modelForProvider(provider)], provider);
}
