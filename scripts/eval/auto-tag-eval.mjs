// Evaluates the auto-tag agent against the ground-truth set produced
// by dump-ground-truth.mjs. Reports precision, recall, F1, accuracy,
// per-tag error categories, positional recall, and new-tag rate.
//
// Two modes:
//   --mode closed (default)  — LLM sees the full tag library including
//                              the target tags; tests pick-from-list.
//   --mode open              — LLM sees the library MINUS each note's
//                              true tags; tests open-vocabulary
//                              suggestion (newTag generation).
//
// Usage:
//   node --env-file=.env.local scripts/eval/auto-tag-eval.mjs [--mode closed|open]
//
// Output: scripts/eval/results-<mode>-<timestamp>.json with per-note
// predictions and aggregate metrics.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(name);
  if (i === -1) return fallback;
  return args[i + 1] ?? fallback;
}

const mode = arg("--mode", "closed");
if (mode !== "closed" && mode !== "open") {
  console.error("--mode must be 'closed' or 'open'");
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const gtPath = resolve(here, "ground-truth.json");
const gt = JSON.parse(readFileSync(gtPath, "utf8"));

console.log(
  `Loaded ground truth: ${gt.notes.length} notes, ${gt.availableTags.length} tags, mode=${mode}`,
);

const SuggestionSchema = z.object({
  existing: z.array(z.string()),
  newTag: z.string().nullable(),
});

async function propose(note, availableTags) {
  const tagList =
    availableTags.length > 0
      ? availableTags.map((t) => `- ${t}`).join("\n")
      : "(the user has no tags yet)";
  const text = [note.title, note.content].filter(Boolean).join("\n\n");

  const { object } = await generateObject({
    model: anthropic("claude-haiku-4-5"),
    schema: SuggestionSchema,
    prompt: `You classify short personal notes into tags.

The user has these existing tags (pick only from this list when possible):
${tagList}

The note content is:
"""
${text.slice(0, 8000)}
"""

Rules:
- Return up to 3 "existing" tags from the list above that genuinely apply.
- If the note clearly introduces a topic NOT covered by any existing tag, suggest ONE new tag as "newTag" (lowercase kebab-case, one to three words).
- If nothing fits cleanly, return { "existing": [], "newTag": null }.
- Never return more than 3 existing tags. Never invent existing tags not in the list.`,
  });

  const existing = object.existing
    .map((t) => t.trim())
    .filter((t) => availableTags.includes(t))
    .slice(0, 3);

  const normalizedNew =
    object.newTag && object.newTag.trim()
      ? object.newTag
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "")
      : null;

  const newTag =
    normalizedNew &&
    !availableTags.some((t) => t.toLowerCase() === normalizedNew) &&
    !existing.some((t) => t.toLowerCase() === normalizedNew)
      ? normalizedNew
      : null;

  return { existing, newTag };
}

function setEquals(a, b) {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

const perNote = [];
let tp = 0;
let fp = 0;
let fn = 0;
let exactMatches = 0;
const positionsOfFirstHit = [];
let newTagsProposed = 0;

for (let i = 0; i < gt.notes.length; i++) {
  const note = gt.notes[i];
  const trueTags = new Set(note.tags);
  const availableTags =
    mode === "closed"
      ? gt.availableTags
      : gt.availableTags.filter((t) => !trueTags.has(t));

  process.stdout.write(`[${i + 1}/${gt.notes.length}] note ${note.id} ... `);
  let proposal;
  try {
    proposal = await propose(note, availableTags);
  } catch (err) {
    console.log(`ERROR: ${err.message ?? err}`);
    perNote.push({ noteId: note.id, error: String(err.message ?? err) });
    continue;
  }

  const predicted = new Set(proposal.existing);
  const truePositives = [...predicted].filter((t) => trueTags.has(t));
  const falsePositives = [...predicted].filter((t) => !trueTags.has(t));
  const falseNegatives = [...trueTags].filter((t) => !predicted.has(t));

  tp += truePositives.length;
  fp += falsePositives.length;
  fn += falseNegatives.length;
  if (setEquals(predicted, trueTags)) exactMatches += 1;

  // positional recall: index of the first true tag in the predicted
  // (ordered) list. -1 if no hit. Mean over notes that have hits.
  const firstHitIdx = proposal.existing.findIndex((t) => trueTags.has(t));
  if (firstHitIdx !== -1) positionsOfFirstHit.push(firstHitIdx);

  if (proposal.newTag) newTagsProposed += 1;

  console.log(
    `pred=[${proposal.existing.join(",")}]${proposal.newTag ? " +" + proposal.newTag : ""} | true=[${[...trueTags].join(",")}] | TP=${truePositives.length} FP=${falsePositives.length} FN=${falseNegatives.length}`,
  );

  perNote.push({
    noteId: note.id,
    title: note.title,
    trueTags: [...trueTags],
    predicted: proposal.existing,
    newTag: proposal.newTag,
    truePositives,
    falsePositives,
    falseNegatives,
    firstHitIdx,
  });
}

const total = perNote.filter((p) => !p.error).length;
const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
const accuracy = total === 0 ? 0 : exactMatches / total;
const positionalRecall =
  positionsOfFirstHit.length === 0
    ? null
    : positionsOfFirstHit.reduce((s, x) => s + x, 0) / positionsOfFirstHit.length;
const recallAtAnyPosition = total === 0 ? 0 : positionsOfFirstHit.length / total;

const aggregate = {
  mode,
  total,
  truePositives: tp,
  falsePositives: fp,
  falseNegatives: fn,
  precision,
  recall,
  f1,
  accuracy,
  exactMatches,
  meanPositionOfFirstHit: positionalRecall,
  recallAtAnyPosition,
  newTagsProposed,
  newTagRate: total === 0 ? 0 : newTagsProposed / total,
};

console.log("\n=== Aggregate ===");
console.log(JSON.stringify(aggregate, null, 2));

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outPath = resolve(here, `results-${mode}-${timestamp}.json`);
writeFileSync(
  outPath,
  JSON.stringify({ aggregate, perNote }, null, 2),
  "utf8",
);
console.log(`\nWrote detailed results to ${outPath}`);
