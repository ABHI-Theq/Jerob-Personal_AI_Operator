import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Lazy init — don't crash at import time if env vars are missing.
// getDb() is called at the first actual DB operation, giving .env time to load.
let _db: SupabaseClient | null = null;

export function getDb(): SupabaseClient {
  if (_db) return _db;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to your .env file."
    );
  }
  _db = createClient(url, key);
  return _db;
}

// ── Types mirroring the DB schema ─────────────────────────────────────────────

export interface SchedulerTask {
  id: string;
  name: string;
  description: string;
  cron: string;
  enabled: boolean;
  steps: TaskStep[];
  summary_email: string | null;
  created_at: string;
  updated_at: string;
  last_run_at: string | null;
  next_run_at: string | null;
  run_count: number;
}

export interface TaskStep {
  order: number;
  type: "web_search" | "web_crawl" | "email_send" | "custom";
  instruction: string;
}

export interface SchedulerRun {
  id: string;
  task_id: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "success" | "failed";
  output: string | null;
  error: string | null;
  step_results: StepResult[];
}

export interface StepResult {
  order: number;
  instruction: string;
  output: string;
  success: boolean;
}

// Convenience typed query builder — avoids repeating `as any` everywhere.
// The untyped Supabase client infers `never` for table columns without a
// generated schema, so we go through `any` at the `.from()` boundary only.
function table(name: string) {
  return getDb().from(name) as any;
}

// ── DB helpers ────────────────────────────────────────────────────────────────

export async function createTask(
  data: Omit<SchedulerTask, "id" | "created_at" | "updated_at" | "last_run_at" | "run_count">
): Promise<SchedulerTask> {
  const { data: row, error } = await table("scheduler_tasks")
    .insert({ ...data, next_run_at: data.next_run_at ?? null })
    .select()
    .single();
  if (error) throw new Error(`Failed to create task: ${error.message}`);
  return row as SchedulerTask;
}

export async function getAllTasks(): Promise<SchedulerTask[]> {
  const { data, error } = await table("scheduler_tasks")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to fetch tasks: ${error.message}`);
  return (data ?? []) as SchedulerTask[];
}

export async function getTaskById(id: string): Promise<SchedulerTask | null> {
  const { data, error } = await table("scheduler_tasks")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data as SchedulerTask;
}

export async function updateTask(
  id: string,
  patch: Partial<Omit<SchedulerTask, "id" | "created_at">>
): Promise<SchedulerTask> {
  const { data, error } = await table("scheduler_tasks")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`Failed to update task: ${error.message}`);
  return data as SchedulerTask;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await table("scheduler_tasks").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete task: ${error.message}`);
}

export async function getEnabledDueTasks(): Promise<SchedulerTask[]> {
  const now = new Date().toISOString();
  const { data, error } = await table("scheduler_tasks")
    .select("*")
    .eq("enabled", true)
    .lte("next_run_at", now);
  if (error) throw new Error(`Failed to fetch due tasks: ${error.message}`);
  return (data ?? []) as SchedulerTask[];
}

export async function createRun(taskId: string): Promise<SchedulerRun> {
  const { data, error } = await table("scheduler_runs")
    .insert({ task_id: taskId, status: "running", step_results: [] })
    .select()
    .single();
  if (error) throw new Error(`Failed to create run record: ${error.message}`);
  return data as SchedulerRun;
}

export async function finishRun(
  runId: string,
  status: "success" | "failed",
  output: string,
  stepResults: StepResult[],
  errorMsg?: string
): Promise<void> {
  const { error } = await table("scheduler_runs")
    .update({
      status,
      output,
      error: errorMsg ?? null,
      step_results: stepResults,
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId);
  if (error) throw new Error(`Failed to finish run record: ${error.message}`);
}

export async function getRunsForTask(taskId: string, limit = 10): Promise<SchedulerRun[]> {
  const { data, error } = await table("scheduler_runs")
    .select("*")
    .eq("task_id", taskId)
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to fetch runs: ${error.message}`);
  return (data ?? []) as SchedulerRun[];
}
