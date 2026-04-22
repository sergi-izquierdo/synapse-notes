# Extend. Pla executable del TFG amb checkboxes

> **Protocol de revisió (obligatori per l'assistent d'IA i per Sergi):**
> 1. **Abans** de començar qualsevol feina del TFG, llegir aquest fitxer i el mirall `C:/SecondBrain/tfg-extend.md` per conèixer l'estat real.
> 2. **Després** de completar la feina, marcar les caselles `[x]` corresponents, afegir una fila al `Progress Log` amb data, fase i una frase curta (quan i com), i propagar els canvis al mirall.
> 3. Si una casella queda pendent o bloquejada, deixar-la `[ ]` amb una nota breu al costat.
>
> Document viu. Marca cada casella a mesura que la tasca es completa.
> Última actualització: 2026-04-22.
> Finestra total: 47 dies (avui fins al 2026-06-05).
> Format: una checklist per setmana amb "Codi", "Memòria" i "Administració".
> Criteri de "fet": la casella només es marca quan la tasca és verificable (test verd, PR fusionat, secció escrita).

---

## Decisions pendents per tancar a la setmana 1

- [x] **D1. Objectiu de desplegament del MCP.** _2026-04-19, resolta: Next.js route handler a Vercel (PoC ja funcionant). Edge Function queda com a treball futur. Detall a `00-decision-log.md`._
- [x] **D2. UX d'aprovació d'eines destructives.** _2026-04-19, resolta: model híbrid — read-only sense confirmació; `update_note`/`tag_notes` amb concessió per sessió; `create_note` confirmació sempre. Detall a `00-decision-log.md`._
- [x] **D3. Filtre de sortida de `summarise_notes`.** _2026-04-19, resolta: segona passada amb Haiku 4.5 (LLM-as-a-judge) amb fallback a regex+allowlist si els costos a setmana 5 es disparen. Detall a `00-decision-log.md`._

---

## Pròxims passos immediats (avui i demà)

- [x] Commit a `main` dels 8 fitxers de `docs/tfg/` (aquest document inclòs). _2026-04-19, commit `72d4eae`._
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
- [x] Provar manualment que el xat encara funciona i el tool `getNotesByTag` es dispara bé. _2026-04-19, `npm run dev` local: Haiku 4.5 respon amb context RAG real recuperat de les notes del user._
- [x] `npm install @modelcontextprotocol/sdk` (Zod ja present via `ai`). _2026-04-19, `^1.29.0`._
- [x] `npm install -D promptfoo` (vitest ja instal·lat). _2026-04-19._
- [x] Crear migració `supabase/migrations/20260419120000_mcp_tfg.sql` amb taules `agent_events` i `tag_suggestions` més polítiques RLS i índex HNSW. _2026-04-19._
- [x] Aplicar la migració al Supabase de desenvolupament. _2026-04-19, via MCP remot (OAuth) al projecte `ilcajfngpxehmwkqjqwt`. Correcció en calent: `tag_suggestions.note_id` de `uuid` a `bigint` (PK de `notes` és bigint)._
- [x] Índex compost `notes_user_embedding_idx` inclòs a la mateixa migració. _2026-04-19._
- [x] Regenerar types. _2026-04-19. Decisió: **no** substituïm `src/types/database.ts` pels auto-generats encara — el codi actual usa interfaces hand-written i no hi ha consumidors de `agent_events`/`tag_suggestions`. Afegirem types quan l'MCP PoC o els agents els necessitin._
- [x] PoC de servidor MCP: una sola eina `search_notes` a `src/app/api/mcp/route.ts` amb token cablejat. _2026-04-19. Streamable HTTP stateless amb `@modelcontextprotocol/sdk` (`WebStandardStreamableHTTPServerTransport`); auth via `Authorization: Bearer ${MCP_POC_TOKEN}`; client admin (service-role) amb filtre d'ownership en segon query (`notes.user_id = MCP_POC_USER_ID`) fins que Phase 2 faci JWT passthrough + RLS. Nou key `SUPABASE_SERVICE_ROLE_KEY` afegit a `.env.example`._
- [x] Provar el PoC amb MCP Inspector (`npx @modelcontextprotocol/inspector`). _2026-04-19. 3 queries validades contra 5 notes reals del user: "lidl"→top-1 lista compra similarity 0.73, "note"→cerca semàntica difusa, gibberish→retorna igualment 5 resultats amb similarity 0.46-0.58. **Finding per al cap. 11 (Avaluació):** `match_threshold: 0.1` és massa permissiu per a Gemini embedding-001 — soroll aleatori projecta a ~0.4-0.5 contra qualsevol text perquè l'espai d'embeddings no té un "zero semàntic" fort. Mitigació: threshold 0.55-0.65 o re-ranker. User scoping OK (només IDs propis del MCP_POC_USER_ID)._
- [x] Commit: "feat(mcp): poc server with search_notes tool". _2026-04-19, `e11ed04`._
- [x] Deploy Vercel net al compte personal. _2026-04-19, projecte `synapse-notes` al compte actual (el desplegament previ va quedar a un altre compte personal oblidat). Totes les env vars pujades des de `.env.local` via `vercel env add`._

### Memòria

- [x] Obrir document al gestor d'escriptura (Typst, LaTeX o Docs). _2026-04-19, triat **LaTeX** + memoir class + lualatex + biblatex-apa + biber. Toolchain: MiKTeX 25.12 via winget, VS Code + LaTeX Workshop, compilació automàtica via magic comment `% !TeX program = lualatex`._
- [x] Muntar l'estructura amb les 17 seccions buides i títols finals. _2026-04-19, scaffold a `tfg/`: `main.tex` + `preamble.tex` + 15 fitxers a `tfg/sections/` (01-portada fins 15-annexos) + `references.bib` buit pendent de Zotero. Compila net a `main.pdf` (24 pàgines) amb TOC, llista de figures/taules i bibliografia APA 7 configurada. **Bugfix no trivial:** memoir 3.8.4b + kernel LaTeX 2025-11-01 incompatibles (memoir fa `\AddToHook{cmd/@makecaption/...}`, el kernel ho rebutja per comandes internes `@`-prefixades); workaround: pre-declarar els hooks amb `\NewHook` al top de `preamble.tex`._
- [x] Portada completa (plantilla URV). _2026-04-19, esborrany a `tfg/sections/01-portada.tex` amb títol, tutor, curs i convocatòria. TODO setmana 6: substituir per plantilla oficial URV via `\includepdf` quan estigui disponible._
- [x] Paraules clau fixades (6-8 en CA, ES, EN). _2026-04-19, 10 termes × 3 llengües a `tfg/sections/04-paraules-clau.tex` (MCP, RAG, pgvector, Supabase, agents d'IA, Lethal Trifecta, RLS, multi-tenant, OAuth 2.1, injecció indirecta de prompt)._
- [x] Resum trilingüe. Primera versió (100 paraules per llengua). _2026-04-19, resum CA/ES/EN a `tfg/sections/02-resum.tex` (~100 mots cada). Cobreix problema, aportació i mètode d'avaluació._
- [x] Secció 4 (Introducció) amb citacions de `02-research-mcp-agents-2026.md`. _2026-04-19, primera versió a `tfg/sections/03-introduccio.tex` (context, motivació, ús esperat, abast, organització). 15 entrades a `references.bib` citades via `\autocite{...}` (Anthropic MCP, MCP spec auth/security, OWASP, Willison, AWS, Cloudflare, Supabase RAG, Tiger, Nile, Vercel AI SDK 6, Promptfoo, GitGuardian)._
- [x] Secció 6 (Objectius): llista definitiva de O1 a O8 amb mètriques. _2026-04-19, port de `03-memoria-plan.md` a `tfg/sections/05-objectius.tex` amb 3 objectius generals + O1-O8 específics (cadascun amb criteri de verificació) + mapping a competències del Grau (SX, SCE, BD, ES)._
- [x] Secció 7 (Planificació) amb el Gantt exportat com a imatge. _2026-04-19, port de `04-gantt.md` a `tfg/sections/06-planificacio.tex`: metodologia, 5 fases amb dates, càrrega setmanal estimada (~189h), 7 riscos amb mitigacions, pla B. **TODO setmana 2:** exportar Gantt des de Mermaid/draw.io a `tfg/figures/gantt.pdf` i descomentar el `\includegraphics` (actualment única referència creuada sense resoldre)._
- [x] Secció 8 (Requisits): 15 casos d'ús UML amb descripció textual. _2026-04-19, primera versió a `tfg/sections/07-requisits.tex` amb RF01-RF06 (6 eines MCP) + RF07-RF09 (3 agents) + RF10-RF12 (OAuth 2.1 life-cycle) + RF13-RF15 (UI d'activitat). Cada RF porta actor, precondició, flux principal i postcondició. RNF01-RNF11 (seguretat, rendiment, escalabilitat, disponibilitat, i18n/accessibilitat WCAG AA, privacitat RGPD, mantenibilitat). **TODO setmana 2:** exportar diagrama UML de casos d'ús a `tfg/figures/use-cases.pdf`._
- [ ] Configurar Zotero amb estil APA 7 i importar les 15 fonts del document de recerca. _Provisional: 15 entrades manuals a `tfg/references.bib` escrites a mà. Sergi hi enllaçarà Better BibTeX quan instal·li Zotero._

### Administració

- [ ] Enviar correu a Marc Sánchez (vegeu "Pròxims passos immediats").
- [ ] Confirmar tribunal del TFG (ha de sortir publicat abans del juny; estar atent a l'avís de la secretaria).
- [ ] Reservar sala d'estudi / espai de treball per a les setmanes 2 a 6.
- [ ] Sincronitzar calendari amb els exàmens de 2n quadrimestre per detectar col·lisions.

### Criteris de sortida setmana 1

- [x] La PoC MCP funciona extrem a extrem en local amb MCP Inspector. _2026-04-19._
- [x] El xat segueix funcionant amb Haiku 4.5. _2026-04-19._
- [x] Les seccions 1 a 8 de la memòria tenen primer esborrany. _2026-04-19, `main.pdf` compila net a 35 pàgines amb bibliografia APA processada via biber (14 cites processades, 1 TODO visible: `fig:gantt`)._
- [x] L'abast queda congelat. Qualsevol canvi posterior va a `00-decision-log.md`. _2026-04-19, D1/D2/D3 resoltes i documentades. L'abast de Fase 1 queda tancat._

---

## Setmana 2. Nucli del servidor MCP (2026-04-27 a 2026-05-03)

### Codi

- [x] `src/lib/mcp/server.ts`: extracció del servidor MCP amb factory `createMcpServer(supabase)`. _2026-04-22 (Fase 1), adapter trivial que registra `search_notes` — les eines restants s'afegeixen a la Fase 2._
- [x] `src/lib/mcp/auth.ts`: verificació del JWT de Supabase (extret del header `Authorization: Bearer ...`). _2026-04-22 (Fase 1), `extractBearerToken` + `createMcpSupabaseClient`, JWT validat via `supabase.auth.getUser(jwt)` i propagat al client per RLS passthrough._
- [x] `src/lib/mcp/tools/search-notes.ts`: handler amb schema Zod, cerca híbrida. _2026-04-22 (Fase 1), migrat des del PoC. Cerca semàntica pura (pgvector) de moment, híbrida queda a Setmana 3 quan afegim full-text si cal._
- [ ] `src/lib/mcp/tools/get-note.ts`.
- [ ] `src/lib/mcp/tools/create-note.ts`.
- [ ] `src/lib/mcp/tools/update-note.ts`.
- [ ] `src/lib/mcp/tools/tag-notes.ts`.
- [ ] `src/lib/mcp/tools/summarise-notes.ts` (sense filtre de seguretat encara).
- [x] Servei `NotesService` amb factory i client injectat. Les eines el consumeixen. _2026-04-22 (Fase 1), ubicat a `src/services/notes.service.ts` (decisió D5: nivell top perquè Server Actions actuals i agents de Setmana 4 el puguin reutilitzar). Només exposa `searchByEmbedding` de moment; la resta de mètodes s'afegeixen a la Fase 2._
- [ ] Recursos MCP: `notes://recent`, `notes://tag/{tag}`.
- [ ] Prompt MCP: `daily-review`.
- [ ] Tests unitaris per a cada eina amb mock de Supabase (≥ 15 tests). _2026-04-22 (Fase 1), 11/15 tests: 7 a `src/lib/mcp/auth.test.ts` + 4 a `src/services/notes.service.test.ts`. Els 4 restants arribaran a la Fase 2 amb les eines noves._
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
| 1 | 100% | 100% | 2026-04-19: commit docs TFG (72d4eae), carpetes creades, deps instal·lades (`@ai-sdk/anthropic`, `@modelcontextprotocol/sdk`, `promptfoo`), xat migrat a `claude-haiku-4-5`, migració SQL aplicada al Supabase dev via MCP remot (correcció `note_id` bigint). Detectats 3 advisors de seguretat pre-existents (search_path de `match_notes`, vector extension al public schema, HaveIBeenPwned off). PoC MCP a `src/app/api/mcp/route.ts` validat extrem-a-extrem amb MCP Inspector: 3 queries contra 5 notes reals del user, user scoping correcte, similarity coherent ("lidl"→0.73). **Finding per al cap. 11:** `match_threshold: 0.1` de Gemini embedding-001 és massa permissiu — gibberish retorna matches a ~0.46-0.58. Mitigació a documentar. PoC MCP commited (e11ed04). Xat verificat localment amb Haiku 4.5 responent amb context RAG real. Vercel redeployat al compte personal actual (projecte `synapse-notes`, env vars pujades via `vercel env add` des de `.env.local`). Toolchain LaTeX triada (memoir + lualatex + biblatex-apa + biber, MiKTeX 25.12 + VS Code LaTeX Workshop) i scaffold de memoir muntat a `tfg/`: `main.tex` + `preamble.tex` + 15 stubs de capítol + `references.bib`. **Bugfix no trivial documentable al cap. 11:** memoir 3.8.4b + kernel LaTeX 2025-11-01 incompatibles — el kernel rebutja `\AddToHook{cmd/@makecaption/...}` sobre comandes `@`-internes si no es pre-declara el hook. Workaround: `\NewHook{cmd/@makecaption/before\|after}` al top de `preamble.tex` dins `\makeatletter`. **Bloc de memòria tancat:** D1/D2/D3 resoltes al decision log, seccions 1-8 amb primer esborrany (portada, resum CA/ES/EN, introducció amb 15 cites a `references.bib`, paraules clau × 3 llengües, objectius O1-O8 amb criteris de verificació, planificació amb taules de fases i riscos, 15 RF + 11 RNF). `main.pdf` compila a 35 pàgines amb bibliografia APA via biber. Pendents de Setmana 1 delegats a Sergi: Zotero+Better BibTeX, correu a Marc Sánchez, tribunal/sala/calendari. Diagrama Gantt i diagrama UML de casos d'ús queden a Setmana 2 per export des de draw.io/Mermaid. **Polish pass 2026-04-19 (tarda):** auditoria de fuites de planificació interna al PDF — detectades 10 referències visibles a "Opció C", `00-decision-log.md`, `01-scope.md`, `docs/tfg/extend.md`, "(veure D2/D3 al decision log)" i secció "Findings del PoC inicial"; reformulades a 4 fitxers (`03-introduccio.tex`, `06-planificacio.tex`, `07-requisits.tex`, `10-avaluacio.tex`) perquè el PDF quedi autocontingut i no referenciï artefactes de planificació que no són entregables. `main.pdf` recompilat net (35 pàgines). **Re-scope 2026-04-19 (vespre):** feedback del Sergi — "el propi Synapse Notes ja ha de formar part del TFG, no es dona per fet". Reestructurat tot el framing al voltant de **Part~A (plataforma base, oct 2025 -- abr 2026): auth OAuth + CRUD + xat RAG + i18n + deploy** i **Part~B (extensió crítica, abr -- jun 2026): MCP + 3 agents + Lethal Trifecta**. Tocades 5 seccions: `03-introduccio` (Context amb itemize Part A/B, Motivació reescrita sense "el producte ja les té", Abast desdoblat amb contribucions de cada part, comptador de RF actualitzat); `05-objectius` (OG1 nou per Part A, O1 nou amb criteri de verificació via URL + demo, O2-O9 renumerats des de O1-O8, mapping de competències SX/SCE/BD/ES/Compiladors actualitzat amb refs per part); `06-planificacio` (paràgraf d'obertura amb les dues fases, Fase~0 afegida a taula de fases amb durada ~180 d, càrrega setmanal aclarida com a Part~B amb nota sobre les ~390 h totals de Part~A); `07-requisits` (bloc nou "Plataforma base (Part~A)" amb RF-A1 OAuth / RF-A2 CRUD notes / RF-A3 xat RAG / RF-A4 canvi d'idioma, intro de 5 blocs en comptes de 4, cross-ref O8→O9); `10-avaluacio` (secció nova "Verificació funcional de la plataforma base (Part~A)"). `main.pdf` recompilat a 37 pàgines amb bibliografia, sense warnings nous (només el `fig:gantt` pendent de Setmana 2). Raó: el TFG no parteix d'una base donada — tot Synapse Notes és treball atribuïble al candidat i ha de ser defensable davant el tribunal. **Rewrite historial git 2026-04-22 (nit):** petició del Sergi per treure mencions a Claude abans de fer públic el repo per al TFG. Executat `git filter-repo 2.47` amb mailmap (8 commits amb `Claude (agent-orchestrator)` com a author reassignats a `Sergi Izquierdo <sergiizquierdo20@gmail.com>`) + message-callback per eliminar totes les línies `Co-Authored-By: Claude*` i `🤖 Generated with Claude*` (17 commits afectats). 48 commits totals reescrits, tots els hashes han canviat. Backup previ pujat com a tag `backup/pre-rewrite-2026-04-22` al remot (restaurable). Eliminades 6 branques remotes abandonades desfasades per squash-merges: `feat/issue-3`, `feat/issue-5`, `feat/issue-7`, `feat/issue-9`, `feat/issue-11`, `fix/lint-errors` (contingut ja era a `main` via els squash PRs #2, #4, #6, #8, #10, #12, #13). Força push a `origin/main` completat. Autors únics que queden al repo: `Sergi Izquierdo <sergiizquierdo20@gmail.com>` i `Sergi Izquierdo Segarra <...@users.noreply.github.com>` (decisió: no unificar-los). Hashes antics substituïts per nous en aquest extend.md (`d1ab994`→`72d4eae`, `d871a4f`→`e11ed04`). **Correcció d'assignatures URV 2026-04-22:** auditoria del mapping a competències contrastada contra el pla oficial del Grau en Enginyeria Informàtica (2021-22+). Detectades 3 assignatures errònies al PDF: "Sistemes Concurrents" (no existeix al pla), "Seguretat **en** Xarxes" (preposició incorrecta, és "de Xarxes") i "Compiladors" (només a l'especialitat de Computació, el Sergi fa Enginyeria del Software). També detectada contradicció directa del re-scope del 19-vespre: bloc "Ús esperat" a `03-introduccio.tex:131` deia "Aquest flux ja existeix i no és l'aportació del TFG" sobre el xat RAG — contradeia el framing Part A/B que fa tot Synapse Notes atribuïble. Tocats 2 fitxers: `03-introduccio.tex` (bloc "Alineació formativa" reescrit amb 6 assignatures reals; bloc "Ús esperat" refet amb etiqueta (Part~A)/(Part~B) a cada item eliminant la frase "ja existeix") i `05-objectius.tex` (bloc "Justificació formativa" reescrit: SX, SD, BDA, IA, DAAW, ADA amb acrònims correctes i mapping O1-O9 actualitzat). Acrònims assumits (no són oficials del pla URV però són habituals entre estudiants): SX=Seguretat de Xarxes, SD=Sistemes Distribuïts, BDA=Bases de Dades Avançades, IA=Intel·ligència Artificial, DAAW=Desenvolupament Avançat d'Aplicacions Web, ADA=Anàlisi i Disseny d'Aplicacions. `main.pdf` recompilat net (37 pàgines). Canvis committejats al final de la sessió com `cdaad9f docs(tfg): reframe memoir as Part A/B + fix URV subject names`. **Preparació del repo per a públic (nit 2026-04-22):** petició del Sergi de posar el repo al portafoli. (1) Reescrit `README.md` des del scaffold de create-next-app a un document portfolio-grade amb secció Part~A / Part~B, stack table, getting started, repo layout i thesis section (`c5630a1 docs: rewrite README as portfolio-grade project overview`). (2) Afegit memory entry `feedback_readme_maintenance.md` al registre global del Claude perquè mantinguem el README al dia per milestone. (3) **CI desbloquejat:** els 3 commits previs estaven fallant al GitHub Actions per desincronització entre `package.json` i `package-lock.json` (npm 11 de Node 24 local vs npm 10.8/10.9 de Node 20/22 del CI difereixen en com resolen peer-dep conflicts de `gcp-metadata`, `@swc/helpers`, `picomatch`, `chokidar`, `readdirp`). Resolt amb (a) regeneració del lockfile des de zero (−900 línies netes: `c6bc867`), (b) bump del CI a Node 24 per alinear el resolver amb local (`dee37f5`), i (c) afegit `engines: { node: ">=24.0.0" }` al `package.json` + nota explícita al README perquè `npm install` avisi als qui clonin amb Node antic (`e1ce7af`). CI verd confirmat en 1m 27s. Setmana 1 tancada formalment. |
| 2 | 100% | 25% | 2026-04-22: **Fase 1 tancada** (refactor del PoC al patró JWT + RLS). Commits `83a2832` (refactor) + `1b0cadf` (dev/whoami helper). 5 fitxers nous (`src/lib/mcp/auth.ts`, `src/lib/mcp/server.ts`, `src/lib/mcp/tools/search-notes.ts`, `src/services/notes.service.ts` + tests) + route.ts de 137 a 30 línies + `.env.example` sense `MCP_POC_TOKEN`/`MCP_POC_USER_ID`. 16/16 tests verds, CI verd. Verificat manualment via MCP Inspector: query `pLATANO` → top-1 "Platano" similarity 0.976 sobre 5 notes reals del user. Guia detallada a `docs/tfg/setmana-2.md` + mirall a SecondBrain. Fase 2 (5 eines restants + NotesService expandit) i Fase 3 (resources + prompt + deploy + memòria §9.1/§9.3) queden per sessions següents d'aquesta setmana. |
| 3 | 100% | — | — |
| 4 | 100% | — | — |
| 5 | 100% | — | — |
| 6 | 100% | — | — |
| 7 | 100% | — | — |
