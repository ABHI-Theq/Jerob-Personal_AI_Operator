import chalk from "chalk";

export interface LLMError {
  type: "rate_limit" | "quota" | "auth" | "network" | "refusal" | "timeout" | "unknown";
  message: string;
  retryable: boolean;
  retryAfterMs?: number;
}

/**
 * Parse any LLM/API error into a structured, user-friendly form.
 */
export function parseLLMError(err: unknown): LLMError {
  const raw = err instanceof Error ? err.message : String(err);
  // Log the raw provider error so we can see exactly what the API returned
  console.error(chalk.dim(`[LLM raw error] ${raw}`));
  const lower = raw.toLowerCase();

  // Rate limit / quota
  if (
    lower.includes("rate limit") ||
    lower.includes("ratelimit") ||
    lower.includes("rate_limit") ||
    lower.includes("429") ||
    lower.includes("too many requests")
  ) {
    // Try to extract retry-after seconds from message
    const retryMatch = raw.match(/retry after (\d+)/i) || raw.match(/(\d+)\s*second/i);
    const retryAfterMs = retryMatch ? parseInt(retryMatch[1]!) * 1000 : 10_000;
    return {
      type: "rate_limit",
      message: "Rate limit reached. The model is temporarily throttled.",
      retryable: true,
      retryAfterMs,
    };
  }

  // Quota exceeded
  if (
    lower.includes("quota") ||
    lower.includes("insufficient_quota") ||
    lower.includes("billing") ||
    lower.includes("credits") ||
    lower.includes("402")
  ) {
    return {
      type: "quota",
      message: "API quota or credits exhausted. Check your billing at openrouter.ai or groq.com.",
      retryable: false,
    };
  }

  // Auth
  if (
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("unauthorized") ||
    lower.includes("invalid api key") ||
    lower.includes("invalid_api_key") ||
    lower.includes("authentication")
  ) {
    return {
      type: "auth",
      message: "Invalid or missing API key. Run `jimmy set-key` to update it.",
      retryable: false,
    };
  }

  // Timeout / network
  if (
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("econnrefused") ||
    lower.includes("enotfound") ||
    lower.includes("network") ||
    lower.includes("fetch failed") ||
    lower.includes("504") ||
    lower.includes("503") ||
    lower.includes("502")
  ) {
    return {
      type: "timeout",
      message: "Network or server timeout. Check your internet connection and try again.",
      retryable: true,
      retryAfterMs: 3_000,
    };
  }

  // Model refusal / content policy
  if (
    lower.includes("content policy") ||
    lower.includes("safety") ||
    lower.includes("i'm sorry") ||
    lower.includes("i cannot") ||
    lower.includes("i can't help") ||
    lower.includes("cannot assist")
  ) {
    return {
      type: "refusal",
      message: "The model refused this request due to content policy. Try rephrasing your prompt.",
      retryable: false,
    };
  }

  return {
    type: "unknown",
    message: raw.slice(0, 300),
    retryable: false,
  };
}

/**
 * Print a formatted, user-friendly LLM error to the console.
 */
export function printLLMError(err: unknown, context?: string): void {
  const parsed = parseLLMError(err);

  const prefix = context ? chalk.dim(`[${context}] `) : "";

  switch (parsed.type) {
    case "rate_limit":
      console.log(chalk.yellow(`\n${prefix}⏱  Rate limited — ${parsed.message}`));
      if (parsed.retryAfterMs) {
        console.log(chalk.dim(`   Retry in ~${Math.ceil(parsed.retryAfterMs / 1000)}s`));
      }
      break;
    case "quota":
      console.log(chalk.red(`\n${prefix}💳 Quota exceeded — ${parsed.message}`));
      break;
    case "auth":
      console.log(chalk.red(`\n${prefix}🔑 Auth error — ${parsed.message}`));
      break;
    case "timeout":
      console.log(chalk.yellow(`\n${prefix}🌐 Network error — ${parsed.message}`));
      break;
    case "refusal":
      console.log(chalk.yellow(`\n${prefix}🚫 Model refusal — ${parsed.message}`));
      break;
    default:
      console.log(chalk.red(`\n${prefix}❌ LLM error — ${parsed.message}`));
  }
}

/**
 * Retry an LLM operation with exponential backoff.
 * Stops immediately on non-retryable errors (auth, quota, refusal).
 */
export async function withLLMRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelayMs?: number;
    context?: string;
  } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1_500, context } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      const parsed = parseLLMError(err);

      if (!parsed.retryable) {
        printLLMError(err, context);
        throw err;
      }

      if (attempt === maxRetries) break;

      const delay = parsed.retryAfterMs ?? baseDelayMs * Math.pow(2, attempt);
      console.log(
        chalk.dim(
          `  ${context ? `[${context}] ` : ""}Retrying in ${Math.ceil(delay / 1000)}s (attempt ${attempt + 1}/${maxRetries})…`
        )
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  printLLMError(lastError, context);
  throw lastError;
}
