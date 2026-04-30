# Setmana 2 — MCP Tools Implementation Plan

**Created:** 2026-04-30 (Thursday, day 4 of Setmana 2)
**Deadline:** 2026-05-03 (Sunday)
**Author:** Sergi
**Status:** approved, in execution

---

## Goal

Tancar la Setmana 2 (`docs/tfg/extend.md` línies 506–522) lliurant:

- 5 MCP tools nous: `get_note`, `create_note`, `update_note`, `tag_notes`, `summarise_notes`
- NotesService expandit
- 2 MCP resources: `notes://recent`, `notes://tag/{tag}`
- 1 MCP prompt: `daily-review`
- Tests unitaris ≥15 (actualment 11)
- Memoir §9.1 (C4 Context + Containers) i §9.3 (MCP design + tool table)

**Criteris de sortida** (de l'extend.md): 6 eines callable des de MCP Inspector i Claude Desktop, RLS s'activa a cada crida, 15+ tests verds.

## Pre-implementation analysis

### Existing patterns confirmed

- **Tool**: `src/lib/mcp/tools/search-notes.ts` és el template canònic. Factory `createXxxHandler(client)` retorna closure + objecte `xxxToolDefinition` amb `description` + Zod `inputSchema`. Handler retorna `{ content: [{ type: 'text', text: JSON.stringify(...) }] }`.
- **Service**: `src/services/notes.service.ts` — factory + classe privada + `SupabaseClient` injectat (sense generic typing per ara, mantenir consistència).
- **Test**: `src/services/notes.service.test.ts` — `vi.mock('server-only', () => ({}))` + mock manual del `rpc`/`from` chain.
- **Server registration**: `server.registerTool(name, definition, handler)` ja viu per a 3 tools (`search_notes` + 2 graph). Bump `0.2.0 → 0.3.0`.

### MCP SDK surface (a verificar al codi)

- `server.registerResource(name, uri, metadata, readCallback)` per URIs estàtiques
- `server.registerResource(name, template, metadata, readCallback)` amb `ResourceTemplate` per URIs templated com `notes://tag/{tag}`
- `server.registerPrompt(name, definition, handler)` — handler retorna `{ messages: [...] }`

### Decisions del decision log que apliquen

- **D2** (UX d'aprovació): híbrid — read-only auto, escriptura amb concessió per sessió, `create_note` confirmació sempre. Aquesta setmana **NO** implementem `needsApproval` al servidor MCP — la confirmació la fa el host (Claude Desktop). Memoir ho documenta com a defensa en capes.
- **D3** (filtre de sortida `summarise_notes`): LLM-as-judge amb Haiku 4.5, **diferit a Setmana 5 §11**. Aquesta setmana ship sense filtre amb comentari + memoir note.

## Risks

| Severity | Risk | Mitigation |
|---|---|---|
| HIGH | `summarise_notes` és el vector Lethal Trifecta i ship sense filtre. Un red-team podria provar exfil abans que el filtre arribi. | (1) Tool corre com l'usuari autenticat → RLS limita la visibilitat; (2) prompt template constret a "summarise"; (3) output és text retornat al caller — sense efectes side automàtics tret que el caller faci chain a `create_note` (gated pel host). Documentat al memoir com a question oberta per §11.3. |
| MEDIUM | `update_note` partial-update semantics. | Mirror `updateNote` server action: `undefined = don't touch`. Zod amb `.optional()`. Embedding regenera només si canvia title/content. |
| MEDIUM | `tag_notes` API shape. | `{ note_ids: number[], add?: string[], remove?: string[] }`. Idempotent. |
| MEDIUM | URI scheme i completion per `notes://tag/{tag}`. | `ResourceTemplate` SDK amb `complete: { tag: () => availableTags }`. |
| LOW | Type drift — service untyped `SupabaseClient`. | Out of scope, anotat al backlog. |

## Phases

### Phase 1 — NotesService expansion + tests (≈1.5h)

Mètodes nous a `src/services/notes.service.ts`:

```ts
getNote(id: number): Promise<Note>
createNote(input: { title?: string|null; content: string; tags?: string[] }): Promise<Note>
updateNote(id: number, patch: { title?: string|null; content?: string; tags?: string[] }): Promise<Note>
applyTagOps(noteIds: number[], add?: string[], remove?: string[]): Promise<{ updated: number }>
summariseNotes(input: { noteIds?: number[]; tag?: string; style?: 'bullets'|'paragraph' }): Promise<string>
getRecentNotes(limit?: number): Promise<Note[]>
getNotesByTag(tag: string, limit?: number): Promise<Note[]>
```

Tests: 1 happy + 1 error per mètode = ~14 tests nous, fàcilment supera 15.

### Phase 2 — Read/write tool handlers + register (≈2h)

Quatre fitxers a `src/lib/mcp/tools/`, tots seguint el template `search-notes.ts`:

- `get-note.ts` — Zod `{ id }` → `service.getNote`
- `create-note.ts` — Zod `{ title?, content, tags? }` → `service.createNote`
- `update-note.ts` — Zod `{ id, title?, content?, tags? }` → `service.updateNote`
- `tag-notes.ts` — Zod `{ note_ids[], add?, remove? }` → `service.applyTagOps`

Registre a `server.ts` + bump version `0.2.0 → 0.3.0`.

### Phase 3 — `summarise_notes` (≈1h)

`src/lib/mcp/tools/summarise-notes.ts` — Zod `{ note_ids?, tag?, style? }`. Service crida `generateText({ model: anthropic('claude-haiku-4-5'), prompt: ... })` amb system prompt restrictiu. Retorna `{ content: [{ type: 'text', text }] }`.

Header amb comentari de 5 línies referenciant `00-decision-log.md` D3 i `§11.3` per al filtre futur.

### Phase 4 — MCP resources (≈30min)

Nova directori `src/lib/mcp/resources/`:

- `recent-notes.ts` — uri `notes://recent` → `service.getRecentNotes`
- `notes-by-tag.ts` — uri template `notes://tag/{tag}` amb completion → `service.getNotesByTag`

Registre via `server.registerResource()`. Tests: 1 happy per resource.

### Phase 5 — MCP prompt `daily-review` (≈30min)

`src/lib/mcp/prompts/daily-review.ts` — `argsSchema: { date? }`. Retorna `{ messages: [{ role: 'user', content: { type: 'text', text } }] }` amb template que pulla notes recents i demana resum + action items.

Registre via `server.registerPrompt()`. 1 test.

### Phase 6 — Memoir §9.1 + §9.3 (≈2h)

- **§9.1**: C4 Context + Containers (draw.io o Mermaid → SVG a `tfg/figures/`).
- **§9.3**: Sequence OAuth + first call, mòduls table, tool table (8 tools amb input schema + RLS surface + approval policy + sensitivity).

### Phase 7 — Verify, commit, deploy (≈1h)

1. `pnpm test` — verds, count ≥15
2. `pnpm typecheck && pnpm lint`
3. MCP Inspector smoke localhost
4. Commit `feat(mcp): 6 tools with rls passthrough + resources + daily-review prompt`
5. `vercel --prod --yes`
6. Update `docs/tfg/extend.md` Setmana 2 checklist → 100%

## Dependencies

- `@ai-sdk/anthropic` — installed
- `@modelcontextprotocol/sdk` — installed
- `vitest` — installed
- LaTeX + draw.io / Mermaid — installed

## Estimated complexity: MEDIUM

Total: **8.5h**, ~2h/day Thursday→Sunday.

## Out of scope this week

- `needsApproval` semantics al servidor MCP (host-side suffices per D2)
- D3 output filter on `summarise_notes` (Setmana 5)
- Typed `SupabaseClient<Database>` retrofit (backlog)
- Promptfoo red-team suite (Setmana 5)
