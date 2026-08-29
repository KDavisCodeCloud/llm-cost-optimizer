-- LLM Cost Optimizer schema. Public lead-gen tool, same convention as
-- the sibling Agent Governance Scorecard repo -- service-role-only RLS,
-- no visitor auth, every write goes through the service-role key from a
-- Next.js API route.

CREATE TABLE IF NOT EXISTS optimizer_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT NOT NULL,
    inputs          JSONB NOT NULL,
    monthly_savings NUMERIC NOT NULL,
    annual_savings  NUMERIC NOT NULL,
    savings_pct     NUMERIC NOT NULL,
    utm_source      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE optimizer_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all ON optimizer_sessions
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_optimizer_sessions_created_at ON optimizer_sessions (created_at);
