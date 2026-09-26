import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./config";

// Service-role client: bypasses RLS. Only for server code that scopes every
// query to FAMILY_ID itself (the Claude connector). Never import in the browser.
export function createAdminClient() {
  const url = SUPABASE_URL;
  // The Vercel ↔ Supabase integration provides SUPABASE_SECRET_KEY; either works.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY must be set");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
