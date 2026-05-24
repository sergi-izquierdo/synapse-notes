// Exports notes that the user has manually tagged into a JSON file,
// to serve as ground truth for the auto-tag evaluation (TFG §10 new
// subsection requested by Marc 2026-05-21).
//
// Usage:
//   node --env-file=.env.local scripts/eval/dump-ground-truth.mjs [--user UUID] [--min-tags 1] [--limit 60]
//
// Output: scripts/eval/ground-truth.json
//   {
//     "exportedAt": "2026-05-24T...",
//     "userId": "...",
//     "availableTags": ["..."],
//     "notes": [
//       { "id": 14, "title": "...", "content": "...", "tags": ["work", "ideas"] }
//     ]
//   }
//
// The exported `tags` are the manual gold standard the LLM will be
// compared against. The script intentionally over-collects: pick from
// this file with --limit to choose the final ground-truth set used
// in the eval (and freeze it in version control).

import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(name);
  if (i === -1) return fallback;
  return args[i + 1] ?? fallback;
}

const minTags = Number(arg("--min-tags", "1"));
const limit = Number(arg("--limit", "60"));
const explicitUser = arg("--user", null);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const allowlist = (process.env.AI_ALLOWLIST_USER_IDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env",
  );
  process.exit(1);
}

const userId = explicitUser ?? allowlist[0];
if (!userId) {
  console.error(
    "No user id: pass --user UUID or set AI_ALLOWLIST_USER_IDS in .env.local",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

const { data: rows, error } = await supabase
  .from("notes")
  .select("id, title, content, tags, updated_at")
  .eq("user_id", userId)
  .is("archived_at", null)
  .order("updated_at", { ascending: false, nullsFirst: false });

if (error) {
  console.error("Query failed:", error);
  process.exit(1);
}

const tagged = (rows ?? [])
  .filter((r) => Array.isArray(r.tags) && r.tags.length >= minTags)
  .slice(0, limit)
  .map((r) => ({
    id: r.id,
    title: r.title ?? null,
    content: r.content ?? "",
    tags: r.tags,
  }));

const allTags = new Set();
for (const r of rows ?? []) {
  for (const t of r.tags ?? []) {
    if (t) allTags.add(t);
  }
}

const out = {
  exportedAt: new Date().toISOString(),
  userId,
  availableTags: [...allTags].sort(),
  notes: tagged,
};

const here = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(here, "ground-truth.json");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");

console.log(
  `Wrote ${tagged.length} tagged notes (out of ${rows?.length ?? 0} total) to ${outPath}`,
);
console.log(`Tag library size: ${out.availableTags.length}`);
