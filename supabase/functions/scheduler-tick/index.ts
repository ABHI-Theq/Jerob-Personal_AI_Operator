/**
 * Jimmy Scheduler – Supabase Edge Function
 * Runs every minute via pg_cron, executes due tasks, writes results.
 * Credentials loaded from user_config table (auto-synced on re-auth).
 *
 * LLM priority: Google Gemini → OpenRouter → Groq
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

interface Credentials {
  openrouter_key: string;
  openrouter_model: string;
  groq_api_key: string;
  google_api_key: string;        // Google Generative AI key
  firecrawl_key: string;
  google_client_id: string;
  google_client_secret: string;
  google_refresh_token: string;
}

interface TaskStep {
  order: number;
  type: "web_search" | "web_crawl" | "email_send" | "custom";
  instruction: string;
}

interface SchedulerTask {
  id: string;
  name: string;
  description: string;
  cron: string;
  steps: TaskStep[];
  summary_email: string | null;
  run_count: number;
}

interface StepResult {
  order: number;
  instruction: string;
  output: string;
  success: boolean;
}

// ── Credentials ───────────────────────────────────────────────────────────────

async function loadCredentials(): Promise<Credentials> {
  const { data, error } = await db.from("user_config").select("key,value");
  if (error) throw new Error(`Credential load failed: ${error.message}`);
  const m: Record<string, string> = {};
  for (const r of data ?? []) m[(r as any).key] = (r as any).value;
  return {
    openrouter_key:    m["openrouter_key"]    ?? "",
    openrouter_model:  m["openrouter_model"]  ?? "openrouter/free",
    groq_api_key:      m["groq_api_key"]      ?? "",
    google_api_key:    m["google_api_key"]    ?? m["google_generative_ai_api_key"] ?? "",
    firecrawl_key:     m["firecrawl_key"]     ?? "",
    google_client_id:  m["google_client_id"]  ?? "",
    google_client_secret: m["google_client_secret"] ?? "",
    google_refresh_token: m["google_refresh_token"] ?? "",
  };
}

// ── LLM with per-provider error details ──────────────────────────────────────

interface LLMAttempt {
  provider: string;
  error: string;
}

async function llm(prompt: string, sys: string, creds: Credentials): Promise<string> {
  const attempts: LLMAttempt[] = [];

  // 1. Google Gemini (gemini-3.1-flash-lite-preview or gemini-2.0-flash)
  if (creds.google_api_key) {
    try {
      const model = "gemini-2.5-flash";
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${creds.google_api_key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: sys }] },
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) return text;
        attempts.push({ provider: "Gemini", error: `Empty response. Raw: ${JSON.stringify(data).slice(0, 200)}` });
      } else {
        const body = await res.text();
        attempts.push({ provider: "Gemini", error: `HTTP ${res.status}: ${body.slice(0, 200)}` });
      }
    } catch (e) {
      attempts.push({ provider: "Gemini", error: String(e) });
    }
  }

  // 2. OpenRouter
  if (creds.openrouter_key) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${creds.openrouter_key}`,
        },
        body: JSON.stringify({
          model: creds.openrouter_model,
          messages: [{ role: "system", content: sys }, { role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 2048,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content?.trim();
        const isRefusal = (s: string) =>
          s.toLowerCase().startsWith("user safety") ||
          s.includes("i'm sorry") ||
          s.includes("i cannot");
        if (text && !isRefusal(text)) return text;
        attempts.push({ provider: "OpenRouter", error: text ? `Model refused: ${text.slice(0, 100)}` : "Empty response" });
      } else {
        const body = await res.text();
        attempts.push({ provider: "OpenRouter", error: `HTTP ${res.status}: ${body.slice(0, 200)}` });
      }
    } catch (e) {
      attempts.push({ provider: "OpenRouter", error: String(e) });
    }
  }

  // 3. Groq
  if (creds.groq_api_key) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${creds.groq_api_key}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "system", content: sys }, { role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 2048,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content?.trim();
        if (text) return text;
        attempts.push({ provider: "Groq", error: "Empty response" });
      } else {
        const body = await res.text();
        attempts.push({ provider: "Groq", error: `HTTP ${res.status}: ${body.slice(0, 200)}` });
      }
    } catch (e) {
      attempts.push({ provider: "Groq", error: String(e) });
    }
  }

  if (attempts.length === 0) {
    throw new Error("No LLM keys configured. Run `jimmy sync-credentials` to push your API keys to Supabase.");
  }

  // Surface all individual errors so you know exactly what failed
  const detail = attempts.map((a) => `${a.provider}: ${a.error}`).join(" | ");
  throw new Error(`All LLM providers failed — ${detail}`);
}

// ── cron next-run calculator ──────────────────────────────────────────────────

function computeNextRun(cron: string): string {
  const now = new Date();
  now.setSeconds(0, 0);
  const [min, hour, dom, month, dow] = cron.trim().split(/\s+/);

  const match = (v: number, f: string) => {
    if (f === "*") return true;
    if (f.includes("/")) {
      const [base, step] = f.split("/");
      const start = base === "*" ? 0 : parseInt(base, 10);
      return (v - start) % parseInt(step!, 10) === 0 && v >= start;
    }
    if (f.includes(",")) return f.split(",").map(Number).includes(v);
    if (f.includes("-")) {
      const [lo, hi] = f.split("-").map(Number);
      return v >= lo! && v <= hi!;
    }
    return parseInt(f, 10) === v;
  };

  for (let offset = 1; offset <= 10080; offset++) {
    const c = new Date(now.getTime() + offset * 60000);
    if (
      match(c.getUTCMinutes(), min!) &&
      match(c.getUTCHours(), hour!) &&
      match(c.getUTCDate(), dom!) &&
      match(c.getUTCMonth() + 1, month!) &&
      match(c.getUTCDay(), dow!)
    ) return c.toISOString();
  }
  return new Date(now.getTime() + 3600000).toISOString();
}

// ── Web tools ─────────────────────────────────────────────────────────────────

async function webSearch(query: string, creds: Credentials): Promise<string> {
  if (!creds.firecrawl_key) return "(web search unavailable — no FIRECRAWL_KEY)";
  const res = await fetch("https://api.firecrawl.dev/v1/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${creds.firecrawl_key}` },
    body: JSON.stringify({ query, limit: 5 }),
  });
  if (!res.ok) return `Search failed: HTTP ${res.status}`;
  const data = await res.json();
  const items: any[] = data?.data ?? data?.results ?? data?.web ?? [];
  return items
    .slice(0, 5)
    .map((d: any, i: number) => `${i + 1}. ${d.title ?? ""}\n   ${d.url ?? ""}\n   ${d.description ?? d.snippet ?? ""}`)
    .join("\n\n") || "(no results)";
}

async function webCrawl(url: string, creds: Credentials): Promise<string> {
  if (!creds.firecrawl_key) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      const text = await res.text();
      return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 6000);
    } catch (e) {
      return `Direct fetch failed: ${e}`;
    }
  }
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${creds.firecrawl_key}` },
    body: JSON.stringify({ url, formats: ["markdown"] }),
  });
  if (!res.ok) return `Crawl failed: HTTP ${res.status}`;
  const data = await res.json();
  return (data?.data?.markdown ?? data?.markdown ?? "").slice(0, 6000) || "(empty)";
}

// ── Gmail ─────────────────────────────────────────────────────────────────────

async function getGmailToken(creds: Credentials): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.google_client_id,
      client_secret: creds.google_client_secret,
      refresh_token: creds.google_refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Gmail token refresh failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  if (!data.access_token) throw new Error(`Gmail token refresh returned no access_token: ${JSON.stringify(data)}`);
  return data.access_token;
}

function encodeEmail(to: string, subject: string, body: string): string {
  const raw = [`To: ${to}`, `Subject: ${subject}`, "Content-Type: text/plain; charset=utf-8", "", body].join("\n");
  return btoa(unescape(encodeURIComponent(raw))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sendEmail(to: string, subject: string, body: string, creds: Credentials): Promise<void> {
  const token = await getGmailToken(creds);
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ raw: encodeEmail(to, subject, body) }),
  });
  if (!res.ok) throw new Error(`Gmail send failed (${res.status}): ${await res.text()}`);
}

// ── Step executor ─────────────────────────────────────────────────────────────

async function executeStep(step: TaskStep, prevOutputs: string[], creds: Credentials): Promise<StepResult> {
  const ctx = prevOutputs.length > 0 ? `\n\nPrevious results:\n${prevOutputs.join("\n---\n")}` : "";
  try {
    if (step.type === "web_search") {
      const query = await llm(`Extract a concise search query (max 10 words) for: "${step.instruction}"${ctx}`, "You extract search queries. Reply with only the query.", creds);
      const raw = await webSearch(query.trim(), creds);
      const output = await llm(`Summarize these search results in 3-5 bullets for: "${step.instruction}"\n\n${raw}`, "You are a research assistant.", creds);
      return { order: step.order, instruction: step.instruction, output, success: true };
    }

    if (step.type === "web_crawl") {
      const urlMatch = step.instruction.match(/https?:\/\/[^\s]+/);
      const url = urlMatch
        ? urlMatch[0]
        : await llm(`What URL should I crawl for: "${step.instruction}"? Reply with only the URL.`, "You extract URLs.", creds);
      const content = await webCrawl(url.trim(), creds);
      const output = await llm(`Extract key info from this page for: "${step.instruction}"\n\n${content.slice(0, 4000)}`, "You are a research assistant.", creds);
      return { order: step.order, instruction: step.instruction, output, success: true };
    }

    if (step.type === "custom") {
      const output = await llm(`${step.instruction}${ctx}`, "You are a helpful automation assistant.", creds);
      return { order: step.order, instruction: step.instruction, output, success: true };
    }

    if (step.type === "email_send") {
      const paramsJson = await llm(
        `Extract email parameters from this instruction and return ONLY valid JSON:
{
  "to": ["email@example.com"],
  "subject": "subject line",
  "body": "email body using previous step results"
}

Instruction: ${step.instruction}${ctx}

Rules:
- "to" must be an array of valid email addresses found in the instruction
- If no email found, set "to" to []
- Body should summarize the previous results nicely`,
        "You extract email parameters as JSON. Return only valid JSON, no explanation.",
        creds
      );

      const jsonMatch = paramsJson.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error(`Could not extract JSON from LLM response: ${paramsJson.slice(0, 200)}`);
      const params = JSON.parse(jsonMatch[0]);

      let recipients: string[] = [];
      if (Array.isArray(params.to)) {
        recipients = params.to.map((e: string) => e.trim()).filter((e: string) => e.includes("@"));
      } else if (typeof params.to === "string") {
        recipients = params.to.split(/[,;\s]+/).map((e: string) => e.trim()).filter((e: string) => e.includes("@"));
      }
      recipients = recipients.filter((e) => !e.includes("example.com") && e !== "USER_EMAIL" && e.includes("."));

      if (recipients.length === 0) {
        return { order: step.order, instruction: step.instruction, output: "Email skipped: no valid recipient in instruction", success: false };
      }

      const sent: string[] = [];
      for (const to of recipients) {
        await sendEmail(to, params.subject, params.body, creds);
        sent.push(to);
      }
      return { order: step.order, instruction: step.instruction, output: `Email sent to: ${sent.join(", ")}`, success: true };
    }

    throw new Error(`Unknown step type: ${(step as any).type}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { order: step.order, instruction: step.instruction, output: `ERROR: ${msg}`, success: false };
  }
}

// ── Task runner ───────────────────────────────────────────────────────────────

async function runTask(task: SchedulerTask, creds: Credentials): Promise<{ stepResults: StepResult[]; summary: string; success: boolean }> {
  const outputs: string[] = [];
  const stepResults: StepResult[] = [];

  for (const step of task.steps.sort((a, b) => a.order - b.order)) {
    const result = await executeStep(step, outputs, creds);
    stepResults.push(result);
    outputs.push(`Step ${step.order} [${step.type}]: ${result.output}`);
  }

  const allSuccess = stepResults.every((s) => s.success);
  const summary = await llm(
    `Summarize results in 3-5 bullets.\n\nTask: ${task.description}\n\nResults:\n${outputs.join("\n")}`,
    "You are a concise summarizer.",
    creds
  );

  if (task.summary_email) {
    try {
      await sendEmail(
        task.summary_email,
        `[Jimmy Scheduler] ${task.name} — ${allSuccess ? "Done" : "Partial"}`,
        `Task: ${task.description}\nRan at: ${new Date().toISOString()}\n\n${summary}\n\n---\n${outputs.join("\n")}`,
        creds
      );
    } catch (e) {
      console.error(`[email summary error] ${e}`);
    }
  }

  return { stepResults, summary, success: allSuccess };
}

// ── Entry point ───────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let creds: Credentials;
  try {
    creds = await loadCredentials();
  } catch (e) {
    return new Response(JSON.stringify({ error: `Credentials load failed: ${e}` }), { status: 500 });
  }

  const now = new Date().toISOString();
  const { data: dueTasks, error } = await db
    .from("scheduler_tasks")
    .select("*")
    .eq("enabled", true)
    .lte("next_run_at", now);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const tasks: SchedulerTask[] = dueTasks ?? [];
  if (tasks.length === 0) return new Response(JSON.stringify({ ran: 0, message: "No tasks due" }), { status: 200 });

  const results: { taskId: string; name: string; status: string; error?: string }[] = [];

  await Promise.allSettled(
    tasks.map(async (task) => {
      // Immediately advance next_run_at so concurrent ticks don't double-execute
      await db
        .from("scheduler_tasks")
        .update({ next_run_at: computeNextRun(task.cron), updated_at: now })
        .eq("id", task.id);

      const { data: runRow } = await db
        .from("scheduler_runs")
        .insert({ task_id: task.id, status: "running", step_results: [] })
        .select()
        .single();
      const runId: string = (runRow as any)?.id;

      try {
        const { stepResults, summary, success } = await runTask(task, creds);
        await db.from("scheduler_runs").update({
          status: success ? "success" : "failed",
          output: summary,
          step_results: stepResults,
          finished_at: now,
        }).eq("id", runId);
        await db.from("scheduler_tasks").update({
          last_run_at: now,
          run_count: task.run_count + 1,
          next_run_at: computeNextRun(task.cron),
          updated_at: now,
        }).eq("id", task.id);
        results.push({ taskId: task.id, name: task.name, status: success ? "success" : "partial" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (runId) {
          await db.from("scheduler_runs").update({
            status: "failed",
            error: msg,
            output: "",
            step_results: [],
            finished_at: now,
          }).eq("id", runId);
        }
        await db.from("scheduler_tasks").update({
          last_run_at: now,
          next_run_at: computeNextRun(task.cron),
          updated_at: now,
        }).eq("id", task.id);
        results.push({ taskId: task.id, name: task.name, status: "failed", error: msg });
      }
    })
  );

  return new Response(
    JSON.stringify({ ran: results.length, results }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
