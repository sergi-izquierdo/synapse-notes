# Synapse Notes — Honest technical audit for Hablo interview

**Date:** 2026-05-12 (eve of interview 2026-05-13)
**Commit audited:** `5358501` (live on `https://synapse-notes.vercel.app`)
**Purpose:** Tell the truth in the interview. Anything below labelled FALSE / ASPIRATIONAL should not leave my mouth as if implemented.

---

## 1. Stack reality check

| Layer | Implementation |
|---|---|
| Framework | Next.js **16.1.6** (App Router) |
| Runtime | React 19.2.1, Node 24, TypeScript 5 |
| Styling | Tailwind 4, shadcn/ui (Radix primitives), framer-motion 12 |
| Deployment | Vercel (manual `vercel --prod --yes`, GitHub auto-deploy broken, noted) |
| Auth | Supabase OAuth: Google + GitHub (confirmed `app_metadata.provider` in JWT) |
| DB | Supabase PostgreSQL with **pgvector** extension, in-house (no external vector store) |
| AI SDK | Vercel AI SDK 6.0.103 |
| Providers | `@ai-sdk/anthropic` 3.0.71, `@ai-sdk/google` 3.0.33 |
| MCP | `@modelcontextprotocol/sdk` 1.29 |
| Forms | `react-hook-form` not in deps (custom forms with `useState`); `zod` validation through AI SDK only |
| State | Plain React 19 + `useOptimistic` + Server Actions. No Redux/Zustand/TanStack Query. |

Notable tables in `supabase/migrations/`:

- `notes` (id, user_id, title, content, tags[], embedding `vector(768)`, starred, archived_at, position, created_at, updated_at) — base table predates this migrations folder; only column-add migrations live in the repo.
- `agent_events` (audit trail, but **no agent actually writes to it yet**)
- `tag_suggestions` (queue table for human-in-the-loop, **created in migration but never inserted to from code** — confirmed by grep)
- `note_links` (directional `[[N]]` backlinks)
- `chats`, `messages` (chat persistence)

**Auto-generated DB types**: NOT generated via `supabase gen types`. Types are hand-maintained in `src/types/database.ts`. Drift risk exists.

---

## 2. RAG pipeline — actual implementation

### Ingestion
- **Source**: text typed directly into the web UI (`src/components/notes/compose-zone.tsx`) or via MCP `create_note` tool.
- **Formats**: plain text + Markdown.
- **No file upload, no PDF parser, no OCR, no web scraping.** None of those exist in the codebase.

### Chunking
- **There is no chunking.**
- Each note row stores ONE embedding for the entire `${title}\n\n${content}` blob (`src/services/notes.service.ts:115` and `src/actions/notes.ts:73`).
- No `langchain`, no `langchain-text-splitters`, no custom splitter — confirmed by `grep` on the whole `src/` tree.
- Notes are typically short (paragraph-to-page range), so this works for the current corpus but does not generalise to long-form documents.

### Embedding
- **Model**: Google Gemini `gemini-embedding-001`, 768 dimensions, set via `providerOptions: { google: { outputDimensionality: 768 } }` (`src/lib/ai.ts:18`).
- **Library**: Vercel AI SDK `embed()` from the `ai` package.
- **Single-call only**: one embedding per `embed()` invocation. No batching, no `embedMany`.
- **Cost-awareness**: an embedding is regenerated on note update ONLY when `title` or `content` actually changes (`src/services/notes.service.ts:151`). Tag-only updates skip the Gemini call. This is the closest thing to a documented cost optimisation.
- **Graceful degradation**: if `generateEmbedding` throws, `tryGenerateEmbedding` returns null and the note saves with `embedding = null`. The HNSW index is partial (`WHERE embedding IS NOT NULL`) so a null row is structurally fine but invisible to RAG/graph until backfilled. **The backfill agent does NOT exist yet** despite being mentioned in `agent_events.agent` enum-like docstring.

### Indexing
- **Index**: pgvector HNSW (`USING hnsw (embedding vector_cosine_ops)`), partial, defined in `supabase/migrations/20260419120000_mcp_tfg.sql:63-66`.
- **Distance metric**: cosine.
- **Index parameters**: default (`m`, `ef_construction` not overridden in the migration — pgvector defaults).

### Retrieval
- **RPC name**: `match_notes(query_embedding, match_threshold, match_count)`. This RPC is **not in the repo migrations** — it predates the migrations folder. I cannot show you its source from the code alone (it lives only in the Supabase project).
- **Chat retrieval** (`src/app/api/chat/route.ts:123-127`): `match_threshold = 0.05`, `match_count = 20`.
- **Service default** (`src/services/notes.service.ts:69`): `match_threshold = 0.1`, `match_count = 5`.
- **Two different thresholds in two code paths** (chat is more permissive than service). This is intentional but undocumented as a discipline.
- **No rerank step.** No Cohere, no cross-encoder. Confirmed by grep on `rerank|bm25|cohere|hybrid` returning empty.
- **No hybrid (BM25 + vector) search.** Just pgvector ANN.

### Context injection
- **Dual approach in the chat route, not pure RAG.** The system prompt receives TWO sections (`route.ts:132-198`):
  1. `EVERY NOTE` — full inventory of titles + tags for every non-archived note belonging to the user, one line per note.
  2. `MEMORY` — full content of the top 20 RAG hits.
- **Rationale (documented in source comments)**: pure RAG would silently drop a relevant note that doesn't make the top-N. The title inventory acts as a lexical safety net so the model never claims a note doesn't exist when it's in the user's library.
- **Context window**: not capped explicitly. With a small corpus (Sergi has ~20 notes) the full inventory + 20 RAG hits fits comfortably under Haiku's window. **At scale (say 1000+ notes) this would break.** The inventory injection is a small-corpus shortcut, not a production-grade pattern.

### Generation
- **Chat**: `streamText({ model: anthropic("claude-haiku-4-5") })` with `stopWhen: stepCountIs(5)` (cap iterations). Three tools registered:
  - `getNotesByTag(tag)` — bulk-load notes by tag.
  - `graph_neighbors(noteId, depth, limit)` — call into `GraphService.neighbours()` BFS.
  - `graph_shortest_path(fromId, toId, maxHops)` — BFS bridge.
- **Chat title generator**: separate `generateText` call with Haiku 4.5 (`route.ts:306-309`), one-shot, runs after `onFinish` of the main stream, async fire-and-forget with `.catch`.
- **Tag suggestion** (separate endpoint `/api/suggest-tags`): `generateObject` with Haiku 4.5 + Zod schema.
- **Summarise tool**: `generateText` with Haiku 4.5, plain system prompt (no tools), output goes through D3 LLM-as-judge filter BEFORE the summariser sees it.
- **Multi-provider routing**: Anthropic for chat/summarise/title/tag-suggest/judge; Google ONLY for embeddings. No load-based or quality-based routing logic.

---

## 3. Optimization decisions found in code

### Cost
- Skip embedding regen on tag-only updates (`notes.service.ts:160`). Single most concrete cost decision.
- D3 judge blocks at the MCP layer = saves the summariser call when content is malicious (memoir §8.4 quantifies: 29/30 attacks blocked at judge, summariser call avoided). Saves ~$0.003 per blocked attack.
- D4 allowlist (`AI_ALLOWLIST_ONLY=true`) caps which user IDs can spend Anthropic/Google quota at all.
- Provider-level hard caps: 5€ Gemini, 10€ Anthropic console (set manually outside code).

### Latency
- `streamText` for the chat reply (token streaming to UI).
- `useOptimistic` on note star/archive/delete (`NoteGrid`) hides the embedding-regen latency from the user.
- Per-request graph service with lazy RPC cache (`route.ts:208`) — back-to-back graph tool calls in the same chat turn don't re-query Postgres.
- Suspense around `Today's Brain` card on the dashboard (`src/app/(dashboard)/page.tsx`) — Haiku weekly summary doesn't block the notes grid.

### Quality
- Title + content concatenation for embedding (`${title}\n\n${content}`) so RAG can locate a note by topic name even when body is sparse. Documented in `notes.service.ts:111-114`.
- `match_threshold=0.05` + `match_count=20` + title inventory = recall-first strategy. The §10 decision log calls this out explicitly.
- D3 LLM-as-judge filter on `summarise_notes` (the only Lethal Trifecta surface). 96.7% detection rate on the 30-variant attack suite, 0% false-positive on 6 legit variants, 0 real exfiltrations in either ON or OFF runs (D2 system prompt catches what D3 misses).

---

## 4. Measurement / observability

- **No PostHog.** No `posthog` in `package.json`, no calls in `src/`.
- **No Sentry.** No `@sentry/*` deps, no DSN configured.
- **No Vercel Analytics.** No `@vercel/analytics` import.
- **No custom logger.** All logging uses raw `console.log`/`console.warn`/`console.error`. Visible via `vercel logs --source serverless`.
- **No retrieval quality tests.** None of the 7 test files measure top-K precision/recall, MRR, or hallucination rate.
- **Promptfoo D3 suite IS in the repo** (`promptfoo/variants.yaml`, 36 variants), but it measures prompt-injection detection (security), not retrieval quality or hallucination.
- **No before/after benchmarks in commit messages or code comments.** `git log --oneline` and `grep -rn "benchmark\|measured\|p50\|p95"` return only the §8.4 Promptfoo numbers (already published in the memoir).

---

## 5. Branch state

- `main`: ahead by recent commits, deployed to production.
- `feat/ui-refresh` (remote-only): old UI work, **already merged into main as commit `addbc50`**. The remote branch is a stale leftover, can be deleted.
- **There is no `posthog-trial` branch.** Not local, not remote. Not in any commit message. Not in `docs/`. If you mentioned this branch in the cover letter, it does not exist.

Recent commits on `main` (chronological):

```
5358501 feat(dashboard,graph): Today's Brain card + 3D graph toggle
c692831 feat(tfg): Promptfoo red-team suite + §8.4 with empirical numbers
ae498e3 docs(tfg): document D3 + D4 implementation, obstacles, and verification
19c47a7 fix(security): drop number/string constraints on judge schema for Anthropic
44e54c5 feat(security): add D3 LLM-as-judge filter on summarise_notes
0b3ff5a feat(security): add AI cost-safety guards (kill-switch + allowlist)
```

---

## 6. Cover-letter claim verification

### "1024-token chunks with 128 overlap → switched to 512/64 saved ~3x bill"
**ASPIRATIONAL / FALSE.** There is no chunking. Notes are embedded whole. No 1024 vs 512 experiment exists in git history or code. **Do not say this in the interview.**

**Honest reframing** if the topic comes up:
> "I haven't had to chunk yet because the unit of storage is a personal note (typically short). For Hablo's transcripts or longer documents I'd start with [pick: token-aware splitter like `langchain` `RecursiveCharacterTextSplitter` or `tiktoken`-based] and tune chunk size against retrieval quality on a held-out eval set. I'd expect 256-512 tokens with 10-20% overlap as a starting point but would calibrate empirically."

### "Top-K + rerank with cheaper model = -40% hallucinations at +12% latency"
**ASPIRATIONAL / FALSE.** Top-K=20 exists. **There is no rerank step.** No Cohere call, no cross-encoder, no second LLM rerank pass. The 40%/12% numbers don't come from any measurement in this codebase.

**Honest reframing**:
> "I push recall hard with top-K=20 and a permissive 0.05 cosine threshold, then I do something a bit different — I inject a title-level inventory of every note into the system prompt alongside the RAG context. That way if RAG drops a note that the user expects me to know about, the model still sees its title and can fetch the body via a tag-filtered tool call. It's a small-corpus pattern and wouldn't scale to thousands of documents, but it's measurably reduced 'I don't have that note' false negatives in my own use. For a bigger corpus I'd add a real rerank step — Cohere `rerank-3` or a Mixtral/Haiku-based scoring pass — and measure latency vs hit rate to find the budget."

### "Embedding burst at onboarding → batch + idle-time backfill"
**ASPIRATIONAL / FALSE.** Embeddings are generated synchronously on note save, one call at a time. No batching, no queue, no backfill agent. The `embedding-backfill` string appears in the `agent_events.agent` column docstring (migration `20260419120000_mcp_tfg.sql:13`) as a PLANNED agent, but the agent itself has not been built. Setmana 4 of the TFG plan is when this would land.

**Honest reframing**:
> "The graceful-degradation path is wired up — `tryGenerateEmbedding` returns null on Gemini failure or quota block, the note saves anyway, and the HNSW index is partial on non-null embeddings so the row is just invisible to RAG until re-embedded. The backfill agent that picks up those nulls in idle time is on my Setmana 4 plan but not built. If Hablo had a use case where onboarding imports a large library, I'd queue embeddings via Supabase Edge Functions or Vercel Queues, batch via the AI SDK's `embedMany`, and prioritise the most-recent or most-tagged notes first."

---

## 7. Things I should NOT claim

- "We do chunking" — false, there is none.
- "We rerank" — false.
- "We batch embeddings" — false, synchronous one-at-a-time only.
- "We have observability/analytics" — none of it. No PostHog, Sentry, Vercel Analytics, custom logger.
- "We have eval suites for retrieval quality" — false. Only the D3 security suite (Promptfoo, 36 variants, attacks-vs-legit) exists.
- "We have a hallucination rate measured" — false. Zero hallucination metrics in the repo.
- "The MCP server is consumed by Claude Desktop in my daily workflow" — only verified manually 1-2 times via MCP Inspector and via browser-console fetch. Not a daily-driver integration.
- "Multi-tenant" — TECHNICALLY yes (RLS scopes everything by `user_id`), but the production allowlist has exactly 1 user (`AI_ALLOWLIST_USER_IDS=d8303657-49fc-49d4-8a10-f73c31ef5010`). Calling it "multi-tenant" oversells; "RLS-scoped from day one so multi-tenant comes for free when the allowlist opens" is honest.
- "Background agents" — none exist yet. The schema (`agent_events`) is ready, no agent code writes to it. Don't claim agents.
- "Scale numbers" — the corpus is ~20-50 notes (Sergi's own). Don't quote QPS or latency at scale; you don't have data.

---

## 8. Production reality

- **URL**: `https://synapse-notes.vercel.app` — public, returns 200 on `GET /` (login page when unauth).
- **Auth gate**: `/api/mcp` returns 401 without `Authorization: Bearer <jwt>`. `/api/chat` returns 401 too (added explicitly in commit `0b3ff5a`).
- **Allowlist active**: `AI_ALLOWLIST_ONLY=true` with one user ID. Any other authenticated user gets 403 from AI endpoints. Notes can still be created/read/updated/deleted without AI (graceful degradation).
- **Real users**: 1 (Sergi). The allowlist gate means no third-party traffic has touched the AI surfaces.
- **Provider caps in place**: 5€ Gemini, 10€ Anthropic, set manually outside the codebase.
- **Demo currently live**: Today's Brain card on the dashboard (Haiku weekly summary) + 3D graph toggle on `/graph`. Both shipped today (2026-05-12).
- **Known issues**:
  - GitHub → Vercel auto-deploy broken. Manual `vercel --prod --yes` after every commit. Mention this only if asked about deployment hygiene.
  - 3D graph view pegs GPU at ~70% on a desktop (was 99% before `antialias: false`). Acceptable for desktop demo, would need RAF throttling for a production-grade view.

---

## Honest one-line for the interview opener

If they ask "what is Synapse Notes?":

> "It's a 'second brain' for personal notes — Next.js + Supabase + pgvector + Anthropic Haiku — that I built as a portfolio piece and as my undergraduate thesis. The thesis side pushed me to think about agent security (MCP server with 8 tools, LLM-as-judge filter on the one tool that matches Simon Willison's Lethal Trifecta) more than I'd have otherwise. It's small-corpus (one user, ~20-50 notes) but the engineering decisions around RAG recall, cost safety, and prompt-injection defense are documented and measured."

If they ask about RAG specifically, lead with what's true: title-inventory + top-20 + permissive threshold, AND admit there's no rerank or chunking yet. Then talk about WHERE you'd add them for Hablo's domain.
