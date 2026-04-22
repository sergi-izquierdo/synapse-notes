# Synapse Notes

[![CI](https://github.com/sergi-izquierdo/synapse-notes/actions/workflows/ci.yml/badge.svg)](https://github.com/sergi-izquierdo/synapse-notes/actions/workflows/ci.yml)

A multi-tenant "second brain" SaaS for personal notes, with built-in RAG chat and — from April 2026 — an MCP server that lets external AI agents (Claude Desktop, Cursor, custom agents) operate on the same knowledge base under OAuth 2.1.

This repository is also the codebase for the author's bachelor's thesis (TFG) at the Universitat Rovira i Virgili (ETSE, Computer Engineering), targeted for June 2026.

> **Status (April 2026):** Part A (platform) feature-complete and deployed. Part B (MCP server and security evaluation) in active development until 5 June 2026.

---

## What's here

**Part A — Platform (Oct 2025 → Apr 2026).** A production-ready SaaS:

- Multi-tenant notes with rich editor, tags and OAuth sign-in (Google + GitHub)
- RAG chat over your own notes via pgvector similarity + Vercel AI SDK streaming with tool calling
- Internationalised UI (Catalan, Spanish, English) with dark mode and command palette
- Row-Level Security on every user-facing table
- Continuous deployment to Vercel

**Part B — MCP extension & security research (Apr → Jun 2026).** Active work:

- An MCP (Model Context Protocol) server exposing 6 tools over Streamable HTTP: `search_notes`, `get_note`, `create_note`, `update_note`, `tag_notes`, `summarise_notes`
- Multi-tenant OAuth 2.1 flow grafted onto Supabase Auth, with per-tenant JWTs and RLS passthrough
- Three background agents on Supabase Edge Functions + `pg_cron`: embedding backfill, auto-tagging, weekly digest
- Formal threat model built on the "Lethal Trifecta" framework (Willison, 2025), applied tool by tool
- Empirical evaluation: RLS isolation suite (≥15 cross-tenant tests) and Promptfoo red-team (≥15 indirect-prompt-injection scenarios)

## Stack

| Layer      | Choice                                                              |
| ---------- | ------------------------------------------------------------------- |
| Frontend   | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4        |
| UI         | Shadcn/UI · Framer Motion · Lucide icons                            |
| Backend    | Supabase (Postgres + pgvector + Auth)                               |
| AI         | Claude Haiku 4.5 (chat) · Google Gemini `embedding-001` (embeddings)|
| Transport  | Vercel AI SDK 6 · Model Context Protocol SDK                        |
| Testing    | Vitest · Promptfoo                                                  |
| Deployment | Vercel                                                              |

## Getting started

**Requirements:** Node.js 24+ (the CI pins Node 24; earlier versions use an older npm resolver that rejects the lockfile). `npm install` will warn you if your version is below the `engines` field in `package.json`.

1. **Clone and install:**

   ```bash
   git clone https://github.com/sergi-izquierdo/synapse-notes.git
   cd synapse-notes
   npm install
   ```

2. **Configure environment variables.** Copy `.env.example` to `.env.local` and fill in credentials for:

   - A Supabase project (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
   - Anthropic API key (`ANTHROPIC_API_KEY`)
   - Google AI Studio key (`GOOGLE_GENERATIVE_AI_API_KEY`)

3. **Apply database migrations** to your Supabase project:

   ```bash
   supabase db push
   ```

4. **Run the dev server:**

   ```bash
   npm run dev
   ```

   The app is available at <http://localhost:3000>.

## Repository layout

```
src/
  app/              Next.js 16 App Router routes (UI + API + MCP endpoint)
  components/       React components (feature folders + Shadcn/UI primitives)
  lib/              Supabase clients, AI provider config, i18n
supabase/
  migrations/       SQL migrations (multi-tenant schema, RLS, pgvector, HNSW)
tests/              Vitest unit tests, RLS isolation suite, Promptfoo red-team
tfg/                Bachelor's thesis source (LaTeX memoir, in Catalan)
docs/               Engineering notes and planning
```

## Thesis

The engineering memoir is written in Catalan following the URV ADA standard (17 chapters, APA 7 bibliography). A polished PDF will be published here once it reaches its final revision. The research question that drives Part B is:

> _How can an MCP server exposing a personal knowledge base be designed, implemented and empirically evaluated so that autonomous agents can operate on it without breaching tenant isolation or falling for indirect prompt injection?_

## License

To be decided before public release.

## Author

**Sergi Izquierdo Segarra** — B.Sc. Computer Engineering, Universitat Rovira i Virgili.
[GitHub](https://github.com/sergi-izquierdo)
