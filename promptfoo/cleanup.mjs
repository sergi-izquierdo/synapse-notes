// Bulk-delete probe notes left behind by the Promptfoo suite.
//
// Usage:
//   node --env-file=.env.local promptfoo/cleanup.mjs           # dry-run
//   node --env-file=.env.local promptfoo/cleanup.mjs --confirm # actually delete
//
// Uses the service role key from .env.local because (a) the MCP
// server does not expose a delete_note tool, and (b) we want a
// transactional bulk delete by tag rather than N round-trips. Bypasses
// RLS intentionally and only filters by tag (`promptfoo-eval`) and by
// the allowlisted user id baked in below so we never touch other
// users' rows even with the service role.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TARGET_USER_ID = process.env.PROMPTFOO_USER_ID
    ?? "d8303657-49fc-49d4-8a10-f73c31ef5010";
const PROBE_TAG = "promptfoo-eval";

if (!url || !serviceKey) {
    console.error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Run with `node --env-file=.env.local promptfoo/cleanup.mjs`.",
    );
    process.exit(1);
}

const confirm = process.argv.includes("--confirm");
const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

const { data: matching, error: selectErr } = await admin
    .from("notes")
    .select("id, title, tags, created_at")
    .eq("user_id", TARGET_USER_ID)
    .contains("tags", [PROBE_TAG]);

if (selectErr) {
    console.error("select failed:", selectErr.message);
    process.exit(1);
}

console.log(
    `Found ${matching.length} probe notes for user ${TARGET_USER_ID} tagged ${PROBE_TAG}.`,
);
for (const n of matching) {
    console.log(
        `  - ${n.id} ${n.created_at}  "${(n.title ?? "").slice(0, 60)}"`,
    );
}

if (!confirm) {
    console.log(
        "\nDry-run. Add --confirm to actually delete these notes.",
    );
    process.exit(0);
}

if (matching.length === 0) {
    console.log("Nothing to delete.");
    process.exit(0);
}

const ids = matching.map((n) => n.id);
const { error: deleteErr, count } = await admin
    .from("notes")
    .delete({ count: "exact" })
    .in("id", ids)
    .eq("user_id", TARGET_USER_ID);

if (deleteErr) {
    console.error("delete failed:", deleteErr.message);
    process.exit(1);
}

console.log(`Deleted ${count ?? ids.length} probe notes.`);
