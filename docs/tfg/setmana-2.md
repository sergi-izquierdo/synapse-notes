# Setmana 2 — Nucli del servidor MCP

> **Finestra:** 2026-04-27 → 2026-05-03 (el pla), però iniciem abans (22 abril) perquè tenim marge.
> **Objectiu:** les 6 eines MCP funcionant des de MCP Inspector i des de Claude Desktop, amb RLS disparant-se a cada crida i ≥15 tests unitaris verds.
> **Font de veritat d'estat:** aquest document (fase per fase). La checklist tancada és al `extend.md` (taula de Setmana 2 al Progress Log).
> **Mirall:** `C:/SecondBrain/tfg-setmana-2.md` — sincronitzat després de cada actualització.

---

## Criteris de sortida (copiats de `extend.md`)

- [ ] Les 6 eines funcionen des de MCP Inspector i des de Claude Desktop.
- [ ] La RLS es dispara a cada crida (verificable amb logs de Supabase).
- [ ] 15+ tests unitaris verds.

## Estructura en 3 fases

| Fase | Contingut | Data prevista | Estat |
|------|-----------|---------------|-------|
| 1 | Refactor del PoC al patró definitiu (JWT + RLS + service factory) | 2026-04-22 | ✅ Fet |
| 2 | Deploy Vercel production + les 5 eines restants + NotesService expandit (≥15 tests) | 2026-04-27 → 29 | En curs (deploy fet, eines pendents) |
| 3 | Resources + prompt + prova amb Claude Desktop com a client MCP remot + memòria §9.1/§9.3 | 2026-04-30 → 05-03 | Pendent |

---

## Fase 1 — Refactor del PoC (2026-04-22)

### Context

El PoC actual (`src/app/api/mcp/route.ts`, commit `e11ed04`) funciona extrem-a-extrem però té 3 hacks explícitament temporals:

1. **Token hardcoded** (`MCP_POC_TOKEN`): qualsevol client amb el token pot cridar. No hi ha noció d'usuari.
2. **User_id hardcoded** (`MCP_POC_USER_ID`): totes les crides es fan com a aquest únic user. No hi ha multi-tenant.
3. **Service-role client + filtre d'ownership a mà**: el client de Supabase bypassa RLS, i el PoC fa un segon query `.eq("user_id", pocUserId)` per reconstruir l'aïllament manualment.

Abans d'afegir 5 eines més, cal substituir aquests 3 hacks pel patró definitiu. Així cada eina nova ja neix amb JWT + RLS passthrough.

### Decisions (tancades 2026-04-22)

- **D4. Verificació del JWT.** Un sol client Supabase creat amb `Authorization: Bearer <JWT>` al header. `client.auth.getUser()` el valida; el mateix client serveix per a les queries i RLS el veu com a user autenticat.
- **D5. Ubicació de `NotesService`.** `src/services/notes.service.ts` (nivell top). Reutilitzable per MCP tools, Server Actions del CRUD i (Setmana 4) pels agents en segon pla.
- **D6. `MCP_POC_TOKEN` i `MCP_POC_USER_ID`.** Eliminats del `.env.example` a la mateixa sessió. (El `.env.local` local pot conservar-los fins que confirmem que el nou camí funciona, però el repo els treu.)

### Què s'ha fet

Tots els fitxers creats o modificats el 2026-04-22:

| Fitxer | Acció | Què fa |
|--------|-------|--------|
| `src/lib/mcp/auth.ts` | nou, 54 línies | `extractBearerToken(req)` + `createMcpSupabaseClient(req)`. Valida JWT via `supabase.auth.getUser(jwt)` i retorna un client amb el token al header `Authorization` perquè RLS apliqui. Llança `McpAuthError` amb status 401 o 500. |
| `src/services/notes.service.ts` | nou, 40 línies | Classe privada `NotesService` + factory `createNotesService(client)`. Mètode `searchByEmbedding({ query, limit = 5 })` que genera l'embedding amb Gemini i crida `match_notes`. Retorna `[]` si l'embedding falla en lloc de propagar l'error. |
| `src/lib/mcp/tools/search-notes.ts` | nou, 40 línies | Schema Zod + `createSearchNotesHandler(client)`. El handler crea un `NotesService` i retorna el payload amb format MCP (`content: [{ type: "text", text: JSON }]`). |
| `src/lib/mcp/server.ts` | nou, 23 línies | `createMcpServer(client)` instancia `McpServer` i registra `search_notes` amb el handler del tool. |
| `src/app/api/mcp/route.ts` | refactor, 137 → 30 línies | Adapter trivial: `createMcpSupabaseClient(req)` → `createMcpServer(client)` → transport. Tot l'auth i la lògica de tool viuen fora. |
| `.env.example` | edit | Fora `MCP_POC_TOKEN` i `MCP_POC_USER_ID`. Comentari actualitzat per a `SUPABASE_SERVICE_ROLE_KEY` explicant que queda reservada per als agents de Setmana 4. |
| `src/lib/mcp/auth.test.ts` | nou | 7 tests: header present/absent/mal format/Bearer buit, JWT invàlid, JWT vàlid (verifica que el Authorization header es passa al client), env vars absents → 500. |
| `src/services/notes.service.test.ts` | nou | 4 tests: RPC amb params correctes, límit per defecte 5, embedding buit → curt-circuit sense cridar RPC, RPC error → throw. |

**Total:** 8 fitxers tocats, 11 tests nous, 16 tests totals verds.

### Com provar-ho (Fase 1)

**Pre-requisit:** necessites l'`access_token` JWT de la teva sessió Supabase. La manera fàcil:

1. `npm run dev` i entra a <http://localhost:3000/login>. Fes login (Google/GitHub).
2. Obre <http://localhost:3000/api/dev/whoami> al navegador. Retornarà un JSON amb `access_token`. Copia el valor (comença per `eyJ...`).

> **Per què un endpoint i no les cookies:** `@supabase/ssr` talla el cookie de sessió en dues parts (`...-auth-token.0` i `.1`) i les codifica en base64 quan el JSON és gran. Reconstruir-ho a mà és pesat. El endpoint `/api/dev/whoami` està gatejat a `NODE_ENV !== 'production'` — no s'exposa mai al deploy.
>
> **Nota sobre cookies residuals:** potser veus també `next-auth.session-token` o `sb-127-auth-token` al DevTools. La primera és residu d'alguna prova amb NextAuth (el projecte no en té); la segona és d'un altre projecte Supabase (`127` ≈ localhost Studio). Pots ignorar-les o esborrar-les si fan nosa visualment.

**Test amb MCP Inspector:**

```bash
npx @modelcontextprotocol/inspector
```

A la UI:
1. **Transport Type:** `Streamable HTTP`
2. **URL:** `http://localhost:3000/api/mcp`
3. **Headers:** afegeix `Authorization: Bearer <JWT>` (el que has copiat)
4. Clic **Connect**
5. Ves a la pestanya **Tools** → selecciona `search_notes` → introdueix una query (p. ex. `"lista compra"`) → clic **Call Tool**

**Resultat esperat:**
- Connexió OK (sense 401).
- La resposta del tool torna els teus top-N notes ordenats per similarity.
- A Supabase Dashboard → Logs → postgres logs hauria d'aparèixer la RLS policy disparant-se (`auth.uid() = ...`).

**Prova del 401:** repeteix la connexió sense header `Authorization` (o amb token d'altri). Has de rebre `401 Unauthorized` abans de cap crida al tool.

**Prova d'aïllament multi-tenant (opcional però recomanat):** si tens un segon compte a Supabase (o algun col·laborador), obté el seu JWT, connecta amb aquell, i verifica que `search_notes` **no** retorna les teves notes. Si retorna res, és bug de RLS — ha de ser zero.

### Troubleshooting

| Símptoma | Causa probable | Correcció |
|----------|----------------|-----------|
| `401 Unauthorized` amb JWT vàlid | JWT caducat (expiren en 1h per defecte) | Refresca la sessió al navegador i torna a copiar |
| Resposta buida `[]` quan hauria de retornar notes | Les teves notes no tenen `embedding` generat | Crea una nota nova — els embeddings es generen al servidor action de `create_note` |
| `rpc "match_notes" failed` | Migració no aplicada al Supabase dev | `npx supabase db push` o comprova que la migració `20260419120000_mcp_tfg.sql` està aplicada |
| Server crash a `createMcpSupabaseClient` | Supabase env vars mal configurades | Comprova `NEXT_PUBLIC_SUPABASE_URL` i `NEXT_PUBLIC_SUPABASE_ANON_KEY` a `.env.local` |

### Tests unitaris

```bash
npm test
```

Ha de sortir **16 tests passed** (5 existents + 11 nous):

- `src/lib/mcp/auth.test.ts` — 7 tests: happy path + header absent + header mal format + Bearer buit + JWT invàlid + JWT vàlid (verifica que el client rep l'`Authorization`) + env vars absents.
- `src/services/notes.service.test.ts` — 4 tests: RPC amb params correctes + límit per defecte + embedding buit (curt-circuit) + RPC error.

Si en falla algun, és senyal que una refactorització posterior ha trencat el contracte d'alguna capa — llegeix el test, no el codi. Els tests documenten què s'esperava.

### Estat de verificació (2026-04-22)

| Comprovació | Resultat |
|-------------|----------|
| `npm test` | ✅ 16/16 passats |
| `npm run lint` | ✅ 0 errors, 24 warnings (tots pre-existents, cap dels nous fitxers) |
| `npm run build` | ✅ Build complet, ruta `/api/mcp` detectada com a dinàmica |
| Prova manual MCP Inspector | ✅ 2026-04-22 — query `pLATANO` sobre 5 notes reals del Sergi, top-1 nota id=19 "Platano" amb similarity 0.976, 5 resultats retornats. Connexió OK amb Bearer via `/api/dev/whoami`. |

---

## Fase 2 — Deploy Vercel + 5 eines restants (en curs)

### 2.0 Deploy Vercel production (2026-04-22)

El deploy previ a Vercel era del 2026-04-19 (commit `e11ed04`) i encara tenia el PoC amb token hardcoded. Calia redesplegar amb Fase 1.

**Actions preses:**

1. `vercel env rm MCP_POC_TOKEN production --yes` → eliminat.
2. `vercel env rm MCP_POC_USER_ID production --yes` → eliminat.
3. `vercel --prod --yes` → deploy de `main` a production. Estat: **Ready** ✓.
4. URL de production: https://synapse-notes-fndtghjma-sergis-projects-2e66a325.vercel.app
5. Smoke test amb `curl -X POST .../api/mcp` sense auth → HTTP 401.

**Complicació detectada — Vercel Deployment Protection:**

El HTTP 401 del smoke test **no** és la nostra auth MCP; és la capa de Vercel Deployment Protection (activada per defecte al projecte). Qualsevol petició externa (MCP Inspector, Claude Desktop, curl) topa amb una pàgina HTML "Authentication Required" de Vercel abans d'arribar al nostre `route.ts`.

Per a un TFG amb demo pública, l'opció canònica és **desactivar la protecció per a production** i deixar-la activa per a preview deployments. La seguretat real la fa JWT + RLS al nostre codi.

**Resolució (2026-04-22, en seqüència):**

1. Sergi desactiva Deployment Protection per production al dashboard. ✓
2. Descobert un 404 a totes les rutes (inclús `/api/health`). Causa: el Framework Preset del projecte Vercel era `Other`, no `Next.js` — Vercel intentava servir `public/` estàtic en comptes de les lambdas de Next.js. El build passava net però el serving era incorrecte.
3. Afegit `vercel.json` al repo amb `{"framework": "nextjs"}` per pinnejar el preset des del codi (immune a drift del dashboard). Commit `732b824`. ✓
4. Redeploy `vercel --prod --yes` → nou URL `https://synapse-notes-i46i6lmgk-sergis-projects-2e66a325.vercel.app` amb status Ready. ✓
5. Alias curt `synapse-notes.vercel.app` repointejat al nou deploy. ✓

**Verificació remota (tota OK):**

- `GET https://synapse-notes.vercel.app/api/health` → **200** amb JSON `{"status":"ok",...}`
- `GET https://synapse-notes.vercel.app/` → **307** (redirect a login si no hi ha sessió, comportament correcte)
- `POST https://synapse-notes.vercel.app/api/mcp` sense Bearer → **401** (és el nostre `McpAuthError`, no la capa de Vercel)

**Smoke test complet d'MCP Inspector contra remot:** pendent de repetir amb un JWT de local (`npm run dev` + `/api/dev/whoami` → copiar token → Inspector apuntant a `https://synapse-notes.vercel.app/api/mcp`). El JWT val per production perquè tots dos entorns usen el mateix Supabase dev.

### 2.x Les 5 eines restants (encara no iniciat)

Eines previstes: `get_note`, `create_note`, `update_note`, `tag_notes`, `summarise_notes`.

Cada una afegirà:
- Un mètode al `NotesService` (amb tests unitaris).
- Un fitxer `src/lib/mcp/tools/<name>.ts` amb schema Zod + handler factory.
- Registre al `createMcpServer`.

Requereix ≥15 tests unitaris totals (tenim 11; 4 més mínim, un per eina).

## Fase 3 — Resources + prompt + deploy (pendent)

_Idem._

---

## Registre de sessió

| Data | Fase | Resum |
|------|------|-------|
| 2026-04-22 | 1 | Refactor complet del PoC. 5 fitxers nous (auth, notes.service, tool, server factory) + route.ts reduït a 30 línies + 2 fitxers de test (11 nous tests). 16/16 verds, lint i build nets. |
| 2026-04-22 | 1 | Afegit `/api/dev/whoami` dev-only per facilitar extracció del JWT (substitueix el cookie-digging). Commit `1b0cadf`. |
| 2026-04-22 | 1 | **Fase 1 verificada end-to-end** via MCP Inspector: JWT obtingut del endpoint, tool `search_notes` amb query `pLATANO` retorna les 5 notes reals del Sergi ordenades per similarity (top-1 "Platano" 0.976, molt superior al 0.73 del PoC perquè la query pràcticament coincideix amb el contingut). RLS passthrough confirmat implícitament: el client amb JWT només veu les notes del user autenticat. Prova d'aïllament creuat entre tenants queda per Setmana 3 (suite de 15 tests RLS). |
| 2026-04-22 | 2 | **Deploy Vercel production amb Fase 1 — complet.** POC env vars esborrades. Primer `vercel --prod --yes` OK però deployment Protection bloquejava accés extern → Sergi la desactiva al dashboard. Segon problema: totes les rutes retornen 404 perquè el Framework Preset del projecte era `Other` en comptes de `Next.js`. Solucionat amb `vercel.json` pinnant `framework: nextjs` (commit `732b824`) + redeploy. Alias `synapse-notes.vercel.app` apuntat al nou deploy. Verificacions: `/api/health` 200, `/` 307, `/api/mcp` sense Bearer 401 del nostre codi. Smoke test MCP Inspector contra remot queda pendent (el JWT de local val per al mateix Supabase dev). |
