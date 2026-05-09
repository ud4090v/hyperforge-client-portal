-- ============================================================
-- HyperForge Client Portal — Initial Schema
-- Migration: 001_initial.sql
-- ============================================================

-- ─── Extensions ──────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ─── Tables ──────────────────────────────────────────────────

-- Customer identity, linked to Supabase auth.users
CREATE TABLE IF NOT EXISTS customers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id     UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  email       TEXT NOT NULL,
  name        TEXT,
  tier        TEXT NOT NULL DEFAULT 'none'
                CHECK (tier IN ('none', 'template', 'consult', 'retainer', 'hosted')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Customer ↔ Plane project mapping
CREATE TABLE IF NOT EXISTS customer_projects (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  plane_project_id    TEXT NOT NULL,
  plane_project_slug  TEXT,
  template_slug       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tier 2 consult sessions
CREATE TABLE IF NOT EXISTS consult_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'scheduled'
                CHECK (status IN ('scheduled', 'active', 'warned', 'ended')),
  started_at  TIMESTAMPTZ,
  warned_at   TIMESTAMPTZ,
  ended_at    TIMESTAMPTZ,
  summary     TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Immutable audit log — every Plane data access
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  project_id  TEXT,
  endpoint    TEXT NOT NULL,
  action      TEXT NOT NULL,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Solution templates catalog
CREATE TABLE IF NOT EXISTS templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  complexity  TEXT CHECK (complexity IN ('low', 'medium', 'high')),
  active      BOOLEAN NOT NULL DEFAULT true,
  sort_order  INT NOT NULL DEFAULT 0
);

-- ─── Indexes ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_customers_auth_id ON customers(auth_id);
CREATE INDEX IF NOT EXISTS idx_customer_projects_customer_id ON customer_projects(customer_id);
CREATE INDEX IF NOT EXISTS idx_consult_sessions_customer_id ON consult_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_consult_sessions_status ON consult_sessions(status);
CREATE INDEX IF NOT EXISTS idx_audit_log_customer_id ON audit_log(customer_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_templates_slug ON templates(slug);
CREATE INDEX IF NOT EXISTS idx_templates_active ON templates(active);

-- ─── Row Level Security ───────────────────────────────────────

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE consult_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- Customers: can read only their own row
CREATE POLICY "customers_select_own"
  ON customers FOR SELECT
  USING (auth_id = auth.uid());

-- Customers: can update their own non-sensitive fields
CREATE POLICY "customers_update_own"
  ON customers FOR UPDATE
  USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

-- Customer projects: customers can read their own rows only
CREATE POLICY "customer_projects_select_own"
  ON customer_projects FOR SELECT
  USING (
    customer_id IN (
      SELECT id FROM customers WHERE auth_id = auth.uid()
    )
  );

-- Consult sessions: customers can read their own rows only
CREATE POLICY "consult_sessions_select_own"
  ON consult_sessions FOR SELECT
  USING (
    customer_id IN (
      SELECT id FROM customers WHERE auth_id = auth.uid()
    )
  );

-- Consult sessions: customers can insert their own
CREATE POLICY "consult_sessions_insert_own"
  ON consult_sessions FOR INSERT
  WITH CHECK (
    customer_id IN (
      SELECT id FROM customers WHERE auth_id = auth.uid()
    )
  );

-- Audit log: no direct customer access (service role only)
-- No policies = no access for authenticated users via RLS

-- Templates: public read access (catalog is public)
CREATE POLICY "templates_select_active"
  ON templates FOR SELECT
  USING (active = true);

-- ─── Seed Data ───────────────────────────────────────────────

INSERT INTO templates (slug, name, description, complexity, active, sort_order)
VALUES
  (
    'ai-intake',
    'AI-Powered Client Onboarding',
    'Intelligent intake portal that uses AI to qualify leads, generate project briefs, and automatically provision your Plane workspace. Reduces onboarding time from days to minutes.',
    'medium',
    true,
    1
  ),
  (
    'quote-engine',
    'Dynamic Quote & Proposal Engine',
    'Configurable pricing engine with dynamic proposal generation. Supports line items, discounts, approval workflows, and PDF export. Fastest path from prospect to signed contract.',
    'low',
    true,
    2
  ),
  (
    'reporting-console',
    'Automated Reporting & BI Console',
    'Real-time reporting dashboard with automated scheduling, multi-source data connectors, and role-based access. Turn your operational data into actionable client insights.',
    'high',
    true,
    3
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  complexity = EXCLUDED.complexity,
  sort_order = EXCLUDED.sort_order;

-- ─── pg_cron: session timer (every minute) ───────────────────
-- Note: pg_cron job is registered separately via Supabase dashboard
-- or via the session-timer edge function bootstrap.
-- The schedule below is for reference:
--
-- SELECT cron.schedule(
--   'session-timer',
--   '* * * * *',
--   $$SELECT net.http_post(
--     url := current_setting('app.supabase_url') || '/functions/v1/session-timer',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer ' || current_setting('app.service_key'),
--       'Content-Type', 'application/json'
--     ),
--     body := '{}'::jsonb
--   )$$
-- );

COMMENT ON TABLE customers IS 'Customer identity records linked to Supabase Auth users';
COMMENT ON TABLE customer_projects IS 'Maps customers to their Plane project IDs';
COMMENT ON TABLE consult_sessions IS 'Tier 2 consultation session tracking with 60-min enforcement';
COMMENT ON TABLE audit_log IS 'Immutable log of all Plane API access by customers';
COMMENT ON TABLE templates IS 'Solution template catalog — seeded with 3 MVP templates';
