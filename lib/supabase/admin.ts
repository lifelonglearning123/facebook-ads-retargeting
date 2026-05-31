import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for server-only, cross-tenant operations
 * (webhook handlers, cron dispatch, post-call ingestion). RLS does not
 * apply. Never expose this on the browser.
 */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase URL or service role key missing");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
