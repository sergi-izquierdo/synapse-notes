# Synapse Notes

## Project Context
- **What:** "Second Brain" SaaS - AI-powered note management with RAG chat
- **Dual purpose:** Portfolio MVP + TFG (Treball de Fi de Grau) at URV (ETSE, Eng. Informàtica)
- **Author:** Sergi (Catalan speaker, comfortable with React/Next.js/Supabase)
- **TFG Coordinator:** Montse García (montse.garcia@urv.cat)
- **TFG Deadline:** First convocatoria 5/June/2026, defense 15-30 June 2026

## Stack
- **Frontend:** Next.js 15 (App Router) + React 19 + TypeScript + Tailwind 4
- **UI:** Shadcn/UI (New York style) + Framer Motion + Lucide icons
- **Backend:** Supabase (Auth + PostgreSQL + pgvector) - no Prisma, SDK directly
- **AI:** Vercel AI SDK + Google Gemini 2.5 Flash (chat) + Gemini Embedding 001 (768-dim vectors)
- **Deployment:** Vercel

## Architecture
- Server Components for initial data fetching
- Server Actions (`src/actions/`) for mutations (notes CRUD)
- API Route (`src/app/api/chat/route.ts`) for streaming AI chat
- RAG: pgvector similarity search via `match_notes` RPC + tool calling (`getNotesByTag`)
- i18n: Custom LanguageProvider (EN/ES/CA) with localStorage persistence
- Auth: Supabase OAuth (Google + GitHub)

## Code Conventions
- Comments in English (some legacy Catalan comments exist)
- Shadcn/UI components in `src/components/ui/`
- Feature components in `src/components/{feature}/`
- Supabase clients in `src/lib/supabase/` (server.ts + client.ts)
- Types in `src/types/`
- Translations in `src/lib/translations.ts`

## TFG Memoir Requirements (ADA Standard)
The memoir must follow this structure:
1. Portada (URV template)
2. Resum (CA/ES/EN ~100 words each)
3. Index
4. Introducció (context, needs, expected use)
5. Paraules clau
6. Objectius + justificació formativa
7. Planificació (Gantt)
8. Requisits funcionals (use cases) + no funcionals
9. Disseny (architecture, UML, DB, UI design)
10. Implementació (tech justification, NOT raw code)
11. Avaluació (test cases + results)
12. Costos (personnel + material)
13. Legislació (RGPD/data protection)
14. Implicacions ètiques, igualtat, medi ambient
15. Valoració personal (reflexive)
16. Bibliografia (APA7)
17. Annexos (installation, usage docs)
+ Demo video required

## Key Guidelines
- Technical engineering memoir - high detail, no filler text, no marketing language
- Use standard CS diagrams (UML, architecture)
- Must reflect problems/difficulties encountered
- Conclusions must be reflexive and personal
