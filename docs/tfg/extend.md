# Extend. Pla executable del TFG amb checkboxes

> **Protocol de revisió (obligatori per l'assistent d'IA i per Sergi):**
> 1. **Abans** de començar qualsevol feina del TFG, llegir aquest fitxer i el mirall `C:/SecondBrain/tfg-extend.md` per conèixer l'estat real.
> 2. **Després** de completar la feina, marcar les caselles `[x]` corresponents, afegir una fila al `Progress Log` amb data, fase i una frase curta (quan i com), i propagar els canvis al mirall.
> 3. Si una casella queda pendent o bloquejada, deixar-la `[ ]` amb una nota breu al costat.
>
> Document viu. Marca cada casella a mesura que la tasca es completa.
> Última actualització: 2026-04-19.
> Finestra total: 47 dies (avui fins al 2026-06-05).
> Format: una checklist per setmana amb "Codi", "Memòria" i "Administració".
> Criteri de "fet": la casella només es marca quan la tasca és verificable (test verd, PR fusionat, secció escrita).

---

## Decisions pendents per tancar a la setmana 1

- [ ] **D1. Objectiu de desplegament del MCP.** Route handler de Next.js vs Edge Function de Supabase. Tendència actual: Next.js route handler. Tancar abans del 2026-04-26.
- [ ] **D2. UX d'aprovació d'eines destructives.** Confirmació per crida vs concessió per sessió. Tendència: per sessió, amb confirmació a `create_note` via MCP.
- [ ] **D3. Filtre de sortida de `summarise_notes`.** Passada secundària amb Haiku 4.5 vs regex. Tendència: Haiku 4.5.

---

## Pròxims passos immediats (avui i demà)

- [x] Commit a `main` dels 8 fitxers de `docs/tfg/` (aquest document inclòs). _2026-04-19, commit `d1ab994`._
- [ ] Enviar correu curt a Marc Sánchez: "ampliació d'abast del TFG, enllaç al repo, no cal aprovació formal".
- [x] Crear les carpetes `/mcp` (a `src/app/api/mcp`), `/supabase/functions`, `/tests/security`, `/tests/rls` i `src/lib/mcp` amb `.gitkeep`. _2026-04-19._
- [x] `ANTHROPIC_API_KEY` afegida a `.env.local`. _2026-04-19._
- [ ] Obrir compte a Supabase per al projecte de desenvolupament (o reutilitzar-ne un).

---

## Setmana 1. Fonaments (2026-04-19 a 2026-04-26)

### Codi

- [x] `npm install @ai-sdk/anthropic`. Mantenir `@ai-sdk/google` (embeddings). _2026-04-19, `^3.0.71`._
- [x] Afegir `ANTHROPIC_API_KEY` a `.env.local`. Pendent Vercel (dev). _2026-04-19._
- [x] `src/app/api/chat/route.ts`: canviar `google("gemini-2.5-flash")` per `anthropic("claude-haiku-4-5")`. _2026-04-19._
- [x] `src/app/api/chat/route.ts`: canviar `google("gemini-2.0-flash-lite")` per `anthropic("claude-haiku-4-5")`. _2026-04-19._
- [ ] Provar manualment que el xat encara funciona i el tool `getNotesByTag` es dispara bé. _**Pendent Sergi: `npm run dev` i provar.**_
- [x] `npm install @modelcontextprotocol/sdk` (Zod ja present via `ai`). _2026-04-19, `^1.29.0`._
- [x] `npm install -D promptfoo` (vitest ja instal·lat). _2026-04-19._
- [x] Crear migració `supabase/migrations/20260419120000_mcp_tfg.sql` amb taules `agent_events` i `tag_suggestions` més polítiques RLS i índex HNSW. _2026-04-19._
- [x] Aplicar la migració al Supabase de desenvolupament. _2026-04-19, via MCP remot (OAuth) al projecte `ilcajfngpxehmwkqjqwt`. Correcció en calent: `tag_suggestions.note_id` de `uuid` a `bigint` (PK de `notes` és bigint)._
- [x] Índex compost `notes_user_embedding_idx` inclòs a la mateixa migració. _2026-04-19._
- [x] Regenerar types. _2026-04-19. Decisió: **no** substituïm `src/types/database.ts` pels auto-generats encara — el codi actual usa interfaces hand-written i no hi ha consumidors de `agent_events`/`tag_suggestions`. Afegirem types quan l'MCP PoC o els agents els necessitin._
- [x] PoC de servidor MCP: una sola eina `search_notes` a `src/app/api/mcp/route.ts` amb token cablejat. _2026-04-19. Streamable HTTP stateless amb `@modelcontextprotocol/sdk` (`WebStandardStreamableHTTPServerTransport`); auth via `Authorization: Bearer ${MCP_POC_TOKEN}`; client admin (service-role) amb filtre d'ownership en segon query (`notes.user_id = MCP_POC_USER_ID`) fins que Phase 2 faci JWT passthrough + RLS. Nou key `SUPABASE_SERVICE_ROLE_KEY` afegit a `.env.example`._
- [x] Provar el PoC amb MCP Inspector (`npx @modelcontextprotocol/inspector`). _2026-04-19. 3 queries validades contra 5 notes reals del user: "lidl"→top-1 lista compra similarity 0.73, "note"→cerca semàntica difusa, gibberish→retorna igualment 5 resultats amb similarity 0.46-0.58. **Finding per al cap. 11 (Avaluació):** `match_threshold: 0.1` és massa permissiu per a Gemini embedding-001 — soroll aleatori projecta a ~0.4-0.5 contra qualsevol text perquè l'espai d'embeddings no té un "zero semàntic" fort. Mitigació: threshold 0.55-0.65 o re-ranker. User scoping OK (només IDs propis del MCP_POC_USER_ID)._
- [ ] Commit: "feat(mcp): poc server with search_notes tool".

### Memòria

- [ ] Obrir document al gestor d'escriptura (Typst, LaTeX o Docs).
- [ ] Muntar l'estructura amb les 17 seccions buides i títols finals.
- [ ] Portada completa (plantilla URV).
- [ ] Paraules clau fixades (6-8 en CA, ES, EN).
- [ ] Resum trilingüe. Primera versió (100 paraules per llengua).
- [ ] Secció 4 (Introducció) amb citacions de `02-research-mcp-agents-2026.md`.
- [ ] Secció 6 (Objectius): llista definitiva de O1 a O8 amb mètriques.
- [ ] Secció 7 (Planificació) amb el Gantt exportat com a imatge.
- [ ] Secció 8 (Requisits): 15 casos d'ús UML amb descripció textual.
- [ ] Configurar Zotero amb estil APA 7 i importar les 15 fonts del document de recerca.

### Administració

- [ ] Enviar correu a Marc Sánchez (vegeu "Pròxims passos immediats").
- [ ] Confirmar tribunal del TFG (ha de sortir publicat abans del juny; estar atent a l'avís de la secretaria).
- [ ] Reservar sala d'estudi / espai de treball per a les setmanes 2 a 6.
- [ ] Sincronitzar calendari amb els exàmens de 2n quadrimestre per detectar col·lisions.

### Criteris de sortida setmana 1

- [ ] La PoC MCP funciona extrem a extrem en local amb MCP Inspector.
- [ ] El xat segueix funcionant amb Haiku 4.5.
- [ ] Les seccions 1 a 8 de la memòria tenen primer esborrany.
- [ ] L'abast queda congelat. Qualsevol canvi posterior va a `00-decision-log.md`.

---

## Setmana 2. Nucli del servidor MCP (2026-04-27 a 2026-05-03)

### Codi

- [ ] `src/lib/mcp/server.ts`: extracció del servidor MCP amb factory `createMcpServer(supabase)`.
- [ ] `src/lib/mcp/auth.ts`: verificació del JWT de Supabase (extret del header `Authorization: Bearer ...`).
- [ ] `src/lib/mcp/tools/search-notes.ts`: handler amb schema Zod, cerca híbrida.
- [ ] `src/lib/mcp/tools/get-note.ts`.
- [ ] `src/lib/mcp/tools/create-note.ts`.
- [ ] `src/lib/mcp/tools/update-note.ts`.
- [ ] `src/lib/mcp/tools/tag-notes.ts`.
- [ ] `src/lib/mcp/tools/summarise-notes.ts` (sense filtre de seguretat encara).
- [ ] Servei `NotesService` amb factory i client injectat. Les eines el consumeixen.
- [ ] Recursos MCP: `notes://recent`, `notes://tag/{tag}`.
- [ ] Prompt MCP: `daily-review`.
- [ ] Tests unitaris per a cada eina amb mock de Supabase (≥ 15 tests).
- [ ] Desplegament a Vercel preview. Provar amb Claude Desktop com a client MCP remot.
- [ ] Commit: "feat(mcp): 6 tools with oauth and rls passthrough".

### Memòria

- [ ] Secció 9.1 (Arquitectura general): diagrames C4 Context i Containers.
- [ ] Secció 9.3 (Disseny del servidor MCP): diagrama de seqüència OAuth + primera crida.
- [ ] Secció 9.3: classe/mòduls del servidor, taula d'eines amb schemes JSON.

### Administració

- [ ] Revisar si ha arribat resposta de Marc Sánchez (no bloqueja).
- [ ] Verificar que Vercel preview deployments hagi superat els builds sense errors.

### Criteris de sortida setmana 2

- [ ] Les 6 eines funcionen des de MCP Inspector i des de Claude Desktop.
- [ ] La RLS es dispara a cada crida (verificable amb logs de Supabase).
- [ ] 15+ tests unitaris verds.

---

## Setmana 3. Polit del MCP i primera seguretat (2026-05-04 a 2026-05-10)

### Codi

- [ ] `tests/rls/isolation.test.ts` amb 15 escenaris (A→B, anònim, token caducat, service role no scoped).
- [ ] Benchmark de cerca amb i sense `notes_user_embedding_idx` (guardar resultats a `docs/tfg/benchmarks.md`).
- [ ] `summarise_notes`: etiquetatge de procedència dels chunks (`<untrusted>...</untrusted>`).
- [ ] `summarise_notes`: passada secundària amb Haiku 4.5 sense eines per filtrar la sortida.
- [ ] `promptfoo.config.yaml` inicial amb 5 casos d'injecció indirecta.
- [ ] Executar Promptfoo i guardar l'informe a `tests/security/reports/week3.json`.
- [ ] Commit: "test(mcp): rls isolation + first promptfoo pass".

### Memòria

- [ ] Secció 9.2 (BD): ER diagram complet, taula de polítiques RLS.
- [ ] Secció 9.4 (Seguretat): introducció Lethal Trifecta + taula per eina.
- [ ] Secció 9.4: arbre d'atacs de `summarise_notes`.

### Criteris de sortida setmana 3

- [ ] 15/15 tests d'aïllament RLS en verd.
- [ ] 5/5 casos inicials de Promptfoo mitigats.
- [ ] Benchmarks registrats.

---

## Setmana 4. Agents en segon pla (2026-05-11 a 2026-05-17)

### Codi

- [ ] `supabase/functions/agent-embedding-backfill/index.ts` amb `pg_cron` cada 15 min.
- [ ] `supabase/functions/agent-auto-tag/index.ts` hora a hora, escriu a `tag_suggestions`.
- [ ] `supabase/functions/agent-weekly-digest/index.ts` setmanal diumenge.
- [ ] Registre a `agent_events` des de cada Edge Function (acció + payload).
- [ ] `src/components/agents/activity-drawer.tsx`: "calaix" d'activitat amb events recents.
- [ ] `src/app/dashboard/_components/tag-suggestion-card.tsx` amb botons accept/reject.
- [ ] Server actions per acceptar/rebutjar suggeriments amb Zod validation.
- [ ] Tests d'integració: verificar que cada agent només veu les files del seu tenant.
- [ ] Commit: "feat(agents): 3 background agents + activity drawer".

### Memòria

- [ ] Secció 10 (Implementació): decisions tecnològiques, fragments, problemes trobats.
- [ ] Secció 9.3 actualitzada amb arquitectura d'agents.

### Criteris de sortida setmana 4

- [ ] Els 3 agents s'executen segons programació al Supabase dev.
- [ ] La UI permet veure i acceptar/rebutjar suggeriments.
- [ ] `agent_events` es va omplint i té RLS activa.

---

## Setmana 5. Enduriment i càrrega (2026-05-18 a 2026-05-24)

### Codi

- [ ] Ampliar Promptfoo a 15+ casos: fuga entre tenants, injecció via contingut, exfiltració via summariser, confusió d'etiquetes.
- [ ] Iterar mitigacions fins a 80% de pass rate.
- [ ] Segregació de capacitats: fitxers separats `read-only-agent.ts` i `write-agent.ts`.
- [ ] Aprovació humana a `create_note` via MCP (AI SDK 6 approval tool).
- [ ] Prova de càrrega amb `k6` o `artillery`: 100 tenants concurrents, 30 min de prova.
- [ ] Guardar latències p50, p95, p99 a `docs/tfg/benchmarks.md`.
- [ ] Gravació de la demo extrem a extrem amb Claude Desktop (mp4, 2-3 min).
- [ ] Commit: "test(security): full promptfoo suite + load test".

### Memòria

- [ ] Secció 11 (Avaluació) completa (11.1 a 11.5 amb taules i gràfics).
- [ ] Secció 12 (Costos) primer esborrany. Recalcular amb Haiku 4.5.

### Criteris de sortida setmana 5

- [ ] Promptfoo >= 80% pass.
- [ ] Informe de càrrega inserit a la memòria.
- [ ] ≥ 30 tests automatitzats verds al CI.
- [ ] Demo gravada i pujada al disc.

---

## Setmana 6. Empenta memòria + legal (2026-05-25 a 2026-05-31)

### Codi

- [ ] Codi **congelat**. Només correcció de bugs crítics. Branca `release/tfg-1a-conv`.

### Memòria

- [ ] Secció 13 (Legislació): RGPD, LOPDGDD, LSSI amb articles concrets.
- [ ] Secció 14 (Ètica, igualtat, medi ambient).
- [ ] Secció 15 (Valoració personal).
- [ ] Secció 16 (Bibliografia) amb Zotero: ≥ 25 fonts en APA 7.
- [ ] Secció 17 (Annexos): installation guide, usage manual, tool schemas, promptfoo YAML, enllaços.
- [ ] Revisar coherència terminològica (glossari al final si cal).
- [ ] Exportar tots els diagrames a PNG i SVG.

### Administració

- [ ] Verificar que el repositori és públic-ready (sense secrets, README polit).
- [ ] Pujar vídeo de demo a YouTube (privat, link a l'annex).

### Criteris de sortida setmana 6

- [ ] Primer esborrany complet de totes les 17 seccions.
- [ ] Bibliografia completa i formatada.

---

## Setmana 7. Polit final i entrega (2026-06-01 a 2026-06-05)

- [ ] **Dilluns 01.** Relectura completa, typos, coherència, un sol estil.
- [ ] **Dimarts 02.** Revisió de qualitat dels diagrames, APA 7 validat amb eina.
- [ ] **Dimecres 03.** Enviar esborrany a 1 o 2 revisors (Marc Sánchez si disponible). Rebre feedback.
- [ ] **Dijous 04.** Edició final amb feedback. Exportar PDF. Revisar la checklist de submissió URV.
- [ ] **Divendres 05.** **ENTREGA via el portal URV abans del tancament oficial.**

### Criteris de sortida setmana 7

- [ ] PDF entregat.
- [ ] Commit tag `v1.0-tfg-entrega` al repo.
- [ ] Confirmació de recepció de la URV.

---

## Post-entrega. Preparació de defensa (2026-06-06 a 2026-06-14)

- [ ] Slides (15 min, estructura del bloc F de `05-defense-points.md`).
- [ ] Guió detallat de la demo en viu amb Claude Desktop.
- [ ] Vídeo de demo de respatller en cas de fallada.
- [ ] Assaig 1 (dia 1). Cronometrar.
- [ ] Assaig 2 (dia 3). Polir transicions.
- [ ] Assaig 3 (dia 5). Assaig general davant company o tutor.
- [ ] Preparar respostes memoritzades del bloc A, B, C de `05-defense-points.md`.
- [ ] Comprovar l'aula de defensa i verificar hardware un dia abans.
- [ ] **DEFENSA del 15 al 30 de juny de 2026.**

---

## Pla B. Si alguna cosa falla

- **Si la setmana 5 Promptfoo no arriba al 80%:** reduir l'objectiu mesurable a "reducció del 50% respecte a baseline" i documentar-ho a la memòria com a limitació honesta (no és un fracàs).
- **Si no arribem al 2026-06-05:** presentar a la 2a convocatòria (2026-09-02). No implica penalització a l'ETSE.
- **Si un component es complica (p. ex. OAuth MCP):** degradar a autenticació per API key documentada com a MVP, amb OAuth a "treball futur".

---

## Registre de progrés

A l'inici de cada setmana, Sergi actualitza aquí una línia amb el % real vs planificat.

| Setmana | Planificat | Real | Comentari |
|---|---|---|---|
| 1 | 100% | ~90% | 2026-04-19: commit docs TFG (d1ab994), carpetes creades, deps instal·lades (`@ai-sdk/anthropic`, `@modelcontextprotocol/sdk`, `promptfoo`), xat migrat a `claude-haiku-4-5`, migració SQL aplicada al Supabase dev via MCP remot (correcció `note_id` bigint). Detectats 3 advisors de seguretat pre-existents (search_path de `match_notes`, vector extension al public schema, HaveIBeenPwned off). PoC MCP a `src/app/api/mcp/route.ts` validat extrem-a-extrem amb MCP Inspector: 3 queries contra 5 notes reals del user, user scoping correcte, similarity coherent ("lidl"→0.73). **Finding per al cap. 11:** `match_threshold: 0.1` de Gemini embedding-001 és massa permissiu — gibberish retorna matches a ~0.46-0.58. Mitigació a documentar. Falta prova manual del xat (Haiku 4.5) i commit del PoC. |
| 2 | 100% | — | — |
| 3 | 100% | — | — |
| 4 | 100% | — | — |
| 5 | 100% | — | — |
| 6 | 100% | — | — |
| 7 | 100% | — | — |
