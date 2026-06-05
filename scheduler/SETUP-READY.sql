-- ════════════════════════════════════════════════════════════════════════════════
-- Jimmy Scheduler — One-Time Setup SQL
-- 1. Go to your Supabase project → SQL Editor
-- 2. Paste this entire file and click RUN
-- ════════════════════════════════════════════════════════════════════════════════

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
GRANT USAGE ON SCHEMA cron TO postgres;

-- 2. scheduler_tasks table
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
);

-- 3. scheduler_runs table
CREATE TABLE IF NOT EXISTS scheduler_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      UUID NOT NULL REFERENCES scheduler_tasks(id) ON DELETE CASCADE,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at  TIMESTAMPTZ,
  status       TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','failed')),
  output       TEXT,
  error        TEXT,
  step_results JSONB NOT NULL DEFAULT '[]'
);

-- 4. user_config table (stores API keys synced from your machine)
CREATE TABLE IF NOT EXISTS user_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Row Level Security — service role only (your app uses service role key)
ALTER TABLE scheduler_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduler_runs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_config     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON scheduler_tasks;
DROP POLICY IF EXISTS "Service role full access" ON scheduler_runs;
DROP POLICY IF EXISTS "Service role full access" ON user_config;

CREATE POLICY "Service role full access" ON scheduler_tasks FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON scheduler_runs  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON user_config     FOR ALL USING (auth.role() = 'service_role');

-- 6. Schedule the Edge Function to fire every minute
--    Replace YOUR_PROJECT_REF and YOUR_SERVICE_ROLE_KEY below before running.
--    Get them from: Supabase Dashboard → Settings → API
SELECT cron.unschedule('jimmy-scheduler-tick') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'jimmy-scheduler-tick'
);

SELECT cron.schedule(
  'jimmy-scheduler-tick',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/scheduler-tick',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- ════════════════════════════════════════════════════════════════════════════════
-- Done! Verify setup:
SELECT jobid, jobname, schedule, active FROM cron.job;
-- ════════════════════════════════════════════════════════════════════════════════
