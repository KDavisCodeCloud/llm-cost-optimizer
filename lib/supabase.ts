import { createClient } from "@supabase/supabase-js";

// Server-side only, service-role key -- same pattern as the sibling
// Agent Governance Scorecard repo. No visitor auth on this public tool.
export function getSupabaseServerClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not configured");
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}
