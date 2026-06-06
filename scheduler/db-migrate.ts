/**
 * Runs the one-time Supabase schema setup automatically.
 *
 * SQL migrations + Edge Function deployment use the Supabase Management API
 * which requires a PERSONAL ACCESS TOKEN (not the service role key).
 * Get one at: https://supabase.com/dashboard/account/tokens
 *
 * The service role key is only used at runtime (stored in user_config / Edge Function secrets).
 */

import chalk from "chalk";

// ─── SQL Migrations ───────────────────────────────────────────────────────────

const MIGRATIONS: { label: string; sql: string }[] = [
  {
    label: "Enable pg_cron extension",
    sql: `CREATE EXTENSION IF NOT EXISTS pg_cron; GRANT USAGE ON SCHEMA cron TO postgres;`,
  },
  {
    label: "Create scheduler_tasks table",
    sql: `
      CREATE TABLE IF NOT EXISTS scheduler_tasks (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name          TEXT NOT NULL,
        description   TEXT NOT NULL DEFAULT '',
        cron          TEXT NOT NULL,
        enabled       BOOLEAN NOT NULL DEFAULT true,
        steps         JSONB NOT NULL DEFAULT '[]',
        summary_email TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_run_at   TIMESTAMPTZ,
        next_run_at   TIMESTAMPTZ,
        run_count     INTEGER NOT NULL DEFAULT 0
      );`,
  },
  {
    label: "Create scheduler_runs table",
    sql: `
      CREATE TABLE IF NOT EXISTS scheduler_runs (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id      UUID NOT NULL REFERENCES scheduler_tasks(id) ON DELETE CASCADE,
        started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        finished_at  TIMESTAMPTZ,
        status       TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','failed')),
        output       TEXT,
        error        TEXT,
        step_results JSONB NOT NULL DEFAULT '[]'
      );`,
  },
  {
    label: "Create user_config table",
    sql: `
      CREATE TABLE IF NOT EXISTS user_config (
        key        TEXT PRIMARY KEY,
        value      TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );`,
  },
  {
    label: "Enable Row Level Security",
    sql: `
      ALTER TABLE scheduler_tasks ENABLE ROW LEVEL SECURITY;
      ALTER TABLE scheduler_runs  ENABLE ROW LEVEL SECURITY;
      ALTER TABLE user_config     ENABLE ROW LEVEL SECURITY;`,
  },
  {
    label: "Create RLS policies",
    sql: `
      DROP POLICY IF EXISTS "Service role full access" ON scheduler_tasks;
      DROP POLICY IF EXISTS "Service role full access" ON scheduler_runs;
      DROP POLICY IF EXISTS "Service role full access" ON user_config;
      CREATE POLICY "Service role full access" ON scheduler_tasks FOR ALL USING (auth.role() = 'service_role');
      CREATE POLICY "Service role full access" ON scheduler_runs  FOR ALL USING (auth.role() = 'service_role');
      CREATE POLICY "Service role full access" ON user_config     FOR ALL USING (auth.role() = 'service_role');`,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** "https://abcdefgh.supabase.co" → "abcdefgh" */
function extractProjectRef(supabaseUrl: string): string | null {
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match?.[1] ?? null;
}

/** Execute raw SQL via the Supabase Management API (requires personal access token). */
async function execSql(projectRef: string, accessToken: string, sql: string): Promise<void> {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SQL failed (${res.status}): ${body}`);
  }
}

// ─── pg_cron ──────────────────────────────────────────────────────────────────

async function runCronSchedule(
  projectRef: string,
  accessToken: string,
  serviceRoleKey: string
): Promise<void> {
  const sql = `
    SELECT cron.unschedule('jerob-scheduler-tick')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'jerob-scheduler-tick');

    SELECT cron.schedule(
      'jerob-scheduler-tick',
      '* * * * *',
      $sql$
      SELECT net.http_post(
        url     := 'https://${projectRef}.supabase.co/functions/v1/scheduler-tick',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ${serviceRoleKey}'
        ),
        body    := '{}'::jsonb
      );
      $sql$
    );
  `;
  await execSql(projectRef, accessToken, sql);
}

// ─── Edge Function deployment ─────────────────────────────────────────────────

/**
 * Deploys the Edge Function using the Supabase CLI if installed.
 * The Management REST API cannot bundle Deno TypeScript — only the CLI can.
 */
async function deployEdgeFunction(projectRef: string, accessToken: string): Promise<void> {
  // Check if supabase CLI is available
  const { execSync } = await import("node:child_process");

  try {
    execSync("supabase --version", { stdio: "ignore" });
  } catch {
    throw new Error(
      "Supabase CLI not installed. Install it from https://supabase.com/docs/guides/cli then run `jerob setup-db` again, or deploy manually with: supabase functions deploy scheduler-tick"
    );
  }

  // Login with access token non-interactively, then link project, then deploy
  try {
    execSync(`supabase login --token ${accessToken}`, { stdio: "pipe" });
  } catch {
    // login may fail if already logged in — continue
  }

  try {
    execSync(`supabase link --project-ref ${projectRef}`, { stdio: "pipe" });
  } catch {
    // link may fail if already linked — continue
  }

  // Deploy — throws if it fails
  execSync("supabase functions deploy scheduler-tick --no-verify-jwt", {
    stdio: "pipe",
    cwd: process.cwd(),
  });
}

/**
 * Sets secrets on the Edge Function.
 * NOTE: Supabase blocks the "SUPABASE_" prefix — use APP_ prefix instead.
 * The Edge Function reads APP_DB_URL and APP_SERVICE_KEY.
 */
async function setEdgeFunctionSecrets(
  projectRef: string,
  accessToken: string,
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<void> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/secrets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify([
      { name: "APP_DB_URL", value: supabaseUrl },
      { name: "APP_SERVICE_KEY", value: serviceRoleKey },
    ]),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Secret upload failed (${res.status}): ${body}`);
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * @param supabaseUrl    https://xxx.supabase.co
 * @param serviceRoleKey Runtime service role key (stored in secrets/user_config)
 * @param accessToken    Personal access token for Management API (setup only)
 */
export async function runDbMigrations(
  supabaseUrl: string,
  serviceRoleKey: string,
  accessToken: string
): Promise<void> {
  const projectRef = extractProjectRef(supabaseUrl);
  if (!projectRef) {
    console.log(chalk.yellow("⚠ Could not parse project ref from Supabase URL — skipping."));
    console.log(chalk.dim("  Expected format: https://YOUR_REF.supabase.co"));
    return;
  }

  console.log(chalk.bold("\n🗄  Setting up Supabase...\n"));

  // 1. SQL migrations
  for (const migration of MIGRATIONS) {
    process.stdout.write(chalk.dim(`  ${migration.label}... `));
    try {
      await execSql(projectRef, accessToken, migration.sql);
      console.log(chalk.green("✓"));
    } catch (err: any) {
      const msg: string = err?.message ?? String(err);
      if (msg.includes("already exists")) {
        console.log(chalk.dim("already exists, skipped"));
      } else {
        console.log(chalk.red(`✗ ${msg}`));
        console.log(chalk.yellow("  Run scheduler/SETUP-READY.sql manually if needed."));
      }
    }
  }

  // 2. Deploy Edge Function
  process.stdout.write(chalk.dim(`  Deploy scheduler-tick Edge Function... `));
  try {
    await deployEdgeFunction(projectRef, accessToken);
    console.log(chalk.green("✓"));
  } catch (err: any) {
    console.log(chalk.yellow(`⚠ ${err?.message ?? err}`));
    console.log(chalk.dim("  Deploy manually: supabase functions deploy scheduler-tick"));
  }

  // 3. Set Edge Function secrets
  process.stdout.write(chalk.dim(`  Set Edge Function secrets... `));
  try {
    await setEdgeFunctionSecrets(projectRef, accessToken, supabaseUrl, serviceRoleKey);
    console.log(chalk.green("✓"));
  } catch (err: any) {
    console.log(chalk.yellow(`⚠ ${err?.message ?? err}`));
  }

  // 4. pg_cron schedule
  process.stdout.write(chalk.dim(`  Schedule Edge Function via pg_cron... `));
  try {
    await runCronSchedule(projectRef, accessToken, serviceRoleKey);
    console.log(chalk.green("✓"));
  } catch (err: any) {
    console.log(chalk.yellow(`⚠ pg_cron: ${err?.message ?? err}`));
    console.log(chalk.dim("  Enable pg_cron: Supabase Dashboard → Database → Extensions"));
  }

  console.log(chalk.green.bold("\n✅ Supabase fully set up — scheduler is live!\n"));
}
