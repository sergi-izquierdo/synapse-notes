// Probe: Time-to-First-Token (TTFT) and token throughput for the two
// LLM surfaces of Synapse Notes, measured directly against the Anthropic
// API (model-level) with representative payloads. This isolates the model
// latency that dominates the user experience; the production round-trip
// adds the network hop quantified in the memoir's benchmark section.
//
// Run: node --env-file=.env.local scripts/probe-ttft.mjs
//
// Cost: ~12 + 12 Haiku 4.5 calls, well under 0.10 EUR.

import { anthropic } from "@ai-sdk/anthropic";
import { streamText, generateObject } from "ai";
import { z } from "zod";

const MODEL = "claude-haiku-4-5";
const RUNS = 12;

function pct(sorted, p) {
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i];
}
function stats(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return { mean, p50: pct(s, 50), p95: pct(s, 95), min: s[0], max: s[s.length - 1] };
}
function fmt(o) {
  return `mean ${o.mean.toFixed(0)} | p50 ${o.p50.toFixed(0)} | p95 ${o.p95.toFixed(0)} | min ${o.min.toFixed(0)} | max ${o.max.toFixed(0)}`;
}

// Representative RAG chat payload: a 50-note title inventory + 5 full
// note bodies as "memory" + a user question. Mirrors the production
// system-prompt shape in src/app/api/chat/route.ts.
function buildChatPayload() {
  const titles = Array.from({ length: 50 }, (_, i) =>
    `[id=${i + 1}] ${["Llista de la compra", "Idees TFG", "Configuració del router", "Notes de seguretat", "Recepta de pa", "Reunió tutoria", "Backup Supabase", "Auriculars nous"][i % 8]} ${i + 1}`,
  ).join("\n");
  const memory = Array.from({ length: 5 }, (_, i) =>
    `NOTE CONTENT: Nota ${i + 1}. ${"Aquest és el contingut de prova d'una nota personal amb prou text per ser representatiu del que un usuari escriu habitualment al seu segon cervell. ".repeat(4)}`,
  ).join("\n\n");
  const system = `You are a helpful assistant for a "Second Brain" app.
EVERY NOTE (title-level inventory):
${titles}
MEMORY (full content of the most semantically relevant notes):
${memory}
AVAILABLE TAGS: [compra, idees, home-security, todo]
INSTRUCTIONS: Answer concisely in the user's language, citing notes by [id=N]. Use MEMORY first, then the INVENTORY.`;
  return { system, question: "Quines notes tinc sobre seguretat i què hi diuen?" };
}

async function getUsage(result) {
  try {
    const u = await result.usage;
    const input = u.inputTokens ?? u.promptTokens ?? 0;
    const output = u.outputTokens ?? u.completionTokens ?? 0;
    return { input, output, total: u.totalTokens ?? input + output };
  } catch {
    return { input: 0, output: 0, total: 0 };
  }
}

async function probeChat() {
  const { system, question } = buildChatPayload();
  const ttft = [], totalLatency = [], inTok = [], outTok = [], tps = [];
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now();
    const result = streamText({
      model: anthropic(MODEL),
      system,
      messages: [{ role: "user", content: question }],
    });
    let first = null;
    for await (const _ of result.textStream) {
      if (first === null) first = performance.now();
    }
    const end = performance.now();
    const u = await getUsage(result);
    ttft.push(first - t0);
    totalLatency.push(end - t0);
    inTok.push(u.input);
    outTok.push(u.output);
    if (u.output > 0) tps.push(u.output / ((end - first) / 1000));
    process.stdout.write(`  chat run ${i + 1}/${RUNS}: TTFT ${(first - t0).toFixed(0)}ms, out ${u.output} tok\r`);
  }
  console.log("\n--- CHAT (RAG, streamText) ---");
  console.log("TTFT (ms):       ", fmt(stats(ttft)));
  console.log("Total latency:   ", fmt(stats(totalLatency)));
  console.log(`Input tokens:    mean ${(inTok.reduce((a,b)=>a+b,0)/RUNS).toFixed(0)}`);
  console.log(`Output tokens:   mean ${(outTok.reduce((a,b)=>a+b,0)/RUNS).toFixed(0)}`);
  console.log("Output tok/s:    ", fmt(stats(tps)));
}

async function probeAutoTag() {
  const schema = z.object({
    existing: z.array(z.string()),
    newTag: z.string().nullable(),
  });
  const tagList = ["compra", "idees", "home-security", "todo"].map((t) => `- ${t}`).join("\n");
  const note = "Comprar bateria externa nova i revisar el router wifi de casa, canviar la contrasenya del 2.4GHz.";
  const lat = [], inTok = [], outTok = [];
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now();
    const r = await generateObject({
      model: anthropic(MODEL),
      schema,
      prompt: `You classify short personal notes into tags.\nThe user has these existing tags:\n${tagList}\nThe note content is:\n"""\n${note}\n"""\nReturn up to 3 existing tags and optionally one new kebab-case tag.`,
    });
    const end = performance.now();
    const u = r.usage ?? {};
    lat.push(end - t0);
    inTok.push(u.inputTokens ?? u.promptTokens ?? 0);
    outTok.push(u.outputTokens ?? u.completionTokens ?? 0);
    process.stdout.write(`  auto-tag run ${i + 1}/${RUNS}: ${(end - t0).toFixed(0)}ms\r`);
  }
  console.log("\n--- AUTO-TAG (generateObject, non-streamed) ---");
  console.log("Latency (ms):    ", fmt(stats(lat)));
  console.log(`Input tokens:    mean ${(inTok.reduce((a,b)=>a+b,0)/RUNS).toFixed(0)}`);
  console.log(`Output tokens:   mean ${(outTok.reduce((a,b)=>a+b,0)/RUNS).toFixed(0)}`);
}

console.log(`Probing ${MODEL}, ${RUNS} runs each, direct Anthropic API...\n`);
await probeChat();
await probeAutoTag();
console.log("\nDone.");
