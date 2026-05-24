import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Admin client (service role) — bypasses RLS. Use ONLY in trusted
// server-side contexts where the caller has already been validated
// out-of-band: cron routes guarded by CRON_SECRET, OAuth callbacks
// validated via signed state, or scripts running outside the request
// lifecycle (eval, migrations).
//
// NEVER expose this client to user-driven request paths — RLS is the
// single source of authorization in this app.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
