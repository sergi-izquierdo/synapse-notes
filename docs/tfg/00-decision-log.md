# Registre de decisions del TFG

> Registre persistent de l'abast, el tutor, les dates clau i les decisions importants del TFG.
> S'actualitza cronològicament. Les entrades antigues no es reescriuen mai: les noves s'afegeixen al final.

---

## 2026-04-19. Pivot cap a l'Opció C (híbrida)

**Decisió:** redefinir l'abast del TFG. Es passa de "SaaS Synapse Notes complet" a un **abast híbrid** que conserva la base existent i hi afegeix una contribució de recerca sobre MCP (Model Context Protocol) i seguretat d'agents.

### Per què

- Synapse Notes ja està completa com a producte (8 fases més 2 blocs). Fer la memòria només sobre això seria feble: l'aplicació existeix, però el document seria descriptiu, sobre una CRUD amb RAG d'alta qualitat però poc sorprenent.
- El tribunal del TFG valora **profunditat d'enginyeria i novetat defensable**. La referència (`docs/TFG_8213.pdf`, Tarek Ben Hamdouch, 2024) marca el nivell en raonament arquitectural (diagrames UML, de seqüència, anàlisi de cost a AWS, discussió de RGPD i LOPD), no en llistes de funcionalitats.
- MCP i els agents són una àrea viva i no resolta, amb un precedent aprovat al DEIM de la URV (proposta de Marc Ruiz, curs 2025-26: "Creació d'un MCP Server per a Sistemes d'Agents d'IA a partir d'un CLI"). Això legitima el tema a l'ETSE.
- Sergi té experiència adjacent (agent-fleet, claude-usage-taskbar) i alineació amb el pla d'estudis (Seguretat de Xarxes, Sistemes Concurrents).

### Forma de l'Opció C

Es manté Synapse Notes com a base. S'hi afegeixen tres capes:

1. **Servidor MCP** que exposa les operacions de Synapse com a eines (cerca, creació, etiquetatge, resum), consumibles des de Claude Desktop, Cursor o agents propis.
2. **Agents en segon pla** a Supabase (Edge Functions i cron) que actuen sobre les notes: auto-etiquetatge, deduplicació, backfill d'embeddings, resum periòdic.
3. **Capítol d'anàlisi de seguretat**: model d'amenaces de la superfície MCP amb el marc de la **Lethal Trifecta** de Simon Willison (contingut no confiable, dades privades, comunicació externa), aplicació de RLS sota la identitat de l'agent i proves d'aïllament multi-tenant.

El producte continua sent Synapse Notes. La **novetat de la memòria** és l'anàlisi arquitectural i de seguretat de convertir un SaaS multi-tenant en una superfície accessible per agents de manera segura.

### Tutor

- **Marc Sánchez**. Ja va aprovar Synapse Notes i va donar llibertat total a Sergi. Implicació baixa. L'Opció C cau dins d'aquesta llibertat, per tant **no cal tornar a demanar aprovació**. Sergi li ha de notificar el canvi un cop, sense esperar resposta.

### Dates (absolutes)

| Fita | Data |
|---|---|
| Convocatòria avançada (passada) | 2026-01-16 |
| **Primera convocatòria. Entrega de la memòria** | **2026-06-05** |
| Primera convocatòria. Defensa | 2026-06-15 a 2026-06-30 |
| Segona convocatòria (pla B) | 2026-09-02 |

Des d'avui (2026-04-19) fins a l'entrega: **47 dies**.

### Alternatives descartades

- **Opció A. TFG de Synapse Notes pur.** Descartada: el producte ja està fet i la memòria seria descriptiva, no investigadora. El tribunal el qualificaria de competent però poc destacable (7-8).
- **Opció B. Pivot complet a un projecte nou d'agents o MCP.** Descartada: 47 dies no donen per a una base de codi nova més la memòria. Alt risc d'acabar a la segona convocatòria.

### Què NO és aquest document

- No és un pla (vegeu `04-gantt.md`).
- No és una especificació d'abast (vegeu `01-scope.md`).
- No és un guió de la memòria (vegeu `03-memoria-plan.md`).
- Aquí només es registren **les decisions i el seu perquè**, per poder reconstruir la intenció en el futur sense haver-la de deduir.

---

## 2026-04-19. Migració del LLM del xat a Claude Haiku 4.5

**Decisió:** substituir `gemini-2.5-flash` (xat) i `gemini-2.0-flash-lite` (generació de títols) per **`claude-haiku-4-5`** via `@ai-sdk/anthropic`. Els embeddings es mantenen a `gemini-embedding-001` perquè Anthropic no ofereix servei d'embeddings.

### Per què

- Sergi ja treballa dins l'ecosistema Anthropic (Claude Code Pro, experiència amb SDK i tool calling). Consolidar proveïdor redueix fricció de desenvolupament i d'integració (el servidor MCP també és d'Anthropic).
- AI SDK 6 té suport nadiu a `@ai-sdk/anthropic` amb la mateixa API (`streamText`, `generateText`, `tool`). La migració és de **3 línies** als fitxers `src/app/api/chat/route.ts` i cap canvi lògic.
- Claude Haiku 4.5 té tool calling més robust, millor adhesió als schemes Zod i aprovació d'execució d'eines nadiu (rellevant per al capítol de seguretat i la segregació de capacitats).
- El cost per token és més alt que Gemini Flash (aprox. 10x), però l'ús del xat és baix durant el TFG i l'avaluació; amb el volum previst (100 tenants simulats a la prova de càrrega) el cost total continua dins del pressupost de `03-memoria-plan.md` secció 12.

### Abast del canvi

| Fitxer | Abans | Després |
|---|---|---|
| `src/app/api/chat/route.ts:80` | `google("gemini-2.5-flash")` | `anthropic("claude-haiku-4-5")` |
| `src/app/api/chat/route.ts:126` | `google("gemini-2.0-flash-lite")` | `anthropic("claude-haiku-4-5")` (mateix model per simplificar) |
| `src/lib/ai.ts:4` | `gemini-embedding-001` | **sense canvi** (embeddings es mantenen) |
| `package.json` | `@ai-sdk/google` | afegir `@ai-sdk/anthropic`; deixar `@ai-sdk/google` mentre els embeddings hi depenen |
| `.env.local` | `GOOGLE_GENERATIVE_AI_API_KEY` | afegir `ANTHROPIC_API_KEY`; mantenir la de Google per als embeddings |

### Implicacions per a la memòria

- Secció 10 (Implementació): s'afegeix una taula "Selecció de models" que justifica la configuració multi-vendor (Anthropic per a raonament i eines, Google per a embeddings).
- Secció 12 (Costos): recalcular taula de projecció operativa amb les tarifes de Haiku 4.5.
- "Treball futur" a la secció 15: migració dels embeddings a Voyage AI (proveïdor recomanat per Anthropic) per consolidar l'ecosistema complet sense perdre suport oficial.

### Alternatives descartades

- **Quedar-se a Gemini.** Descartada: Sergi ja és a l'ecosistema Anthropic i l'esforç de migració és baix. La coherència d'ecosistema també simplifica el capítol de seguretat (les recomanacions OWASP MCP es testen contra Anthropic SDK, no contra Google).
- **Migrar també els embeddings a Voyage AI ara.** Descartada de moment: obliga a re-embeddar totes les notes existents i, si la dimensionalitat canvia, a modificar el schema Postgres (`vector(768)`). L'esforç es trasllada a "treball futur" per no saturar la setmana 1.

---

## 2026-04-19. D1. Objectiu de desplegament del MCP

**Decisió:** el servidor MCP es desplega com a **route handler de Next.js a Vercel** (`/api/mcp`, ruta ja creada a la PoC). Es descarta, per al MVP, l'alternativa d'Edge Function de Supabase (Deno).

### Per què

- **Coherència amb el codebase.** Synapse ja és un monòlit Next.js 15 desplegat a Vercel. Afegir un segon runtime (Deno) duplica pipelines de CI, gestió d'env vars i observabilitat. Per un TFG de 47 dies el cost d'integració supera el benefici de latència.
- **PoC ja validada.** `src/app/api/mcp/route.ts` ja compila, respon sobre Streamable HTTP i s'ha provat amb MCP Inspector (commit d871a4f). Canviar de runtime implicaria reescriure auth, transport i client de Supabase.
- **Tooling MCP.** `@modelcontextprotocol/sdk` té suport de primera classe a Node i a Web (Next.js App Router compatible). Deno té suport funcional però les edge cases de streaming no estan igual de polides.
- **Latència acceptable.** El cas crític és `search_notes`, dominat pel `generateEmbedding` (round-trip a Google AI, ~200-400 ms) i la crida `match_notes` RPC a Supabase (~20-50 ms). El sobrecost d'un hop extra Vercel→Supabase és marginal respecte a l'embedding.

### Implicacions per a la memòria

- Secció 9.3 (Disseny del servidor MCP): diagrama de desplegament amb Vercel com a host del servidor MCP i Supabase com a BD+agents.
- Secció 11.4 (Benchmarks): mesurar p50/p95/p99 de `search_notes` des d'un client extern amb 100 tenants concurrents. Si la cua es satura, documentar-ho com a *treball futur: moure a Edge Function*.

### Alternativa descartada

- **Edge Function de Supabase.** Queda com a *treball futur* a la secció 15. Beneficis teòrics: menys latència a la BD, runtime Deno més modern. Cost: duplicar infra, nou pipeline de deployment, reescriure la capa d'auth (Supabase Edge usa altres primitives).

---

## 2026-04-19. D2. UX d'aprovació d'eines destructives al MCP

**Decisió:** model **híbrid**. Eines de només lectura (`search_notes`, `get_note`) no requereixen confirmació. Eines d'escriptura segura (`update_note`, `tag_notes`) van amb *concessió per sessió*: la primera crida demana confirmació, les següents dins la mateixa sessió MCP s'aproven automàticament. `create_note` demana **confirmació sempre** via el mecanisme d'aprovació nadiu d'AI SDK 6.

### Per què

- **La trifecta no està uniformement repartida.** Només `summarise_notes` (via LLM, pot seguir instruccions no confiables) i `create_note` (pot fabricar contingut des d'input no confiable) són candidates a atacs d'injecció indirecta amb efecte extern. La resta d'operacions d'escriptura són idempotents sobre notes que ja existeixen i pertanyen al mateix usuari.
- **UX acceptable.** Demanar confirmació a cada crida MCP trenca el cas d'ús d'agents autònoms (punt del TFG). Concessió per sessió és el patró que segueix Claude Desktop per defecte amb servidors MCP i és defensable amb la literatura d'OWASP MCP (autorització granular, no per crida).
- **`create_note` és l'excepció.** Una injecció via `summarise_notes` podria teòricament crear una nota nova amb contingut controlat per l'atacant; forçar confirmació tanca aquest vector. AI SDK 6 exposa `needsApproval` a l'schema de tool, amb integració nadiva amb Claude Desktop.

### Implementació

| Eina | Aprovació |
|---|---|
| `search_notes` | Cap (read-only) |
| `get_note` | Cap (read-only) |
| `update_note` | Per sessió (1a crida demana confirmació) |
| `tag_notes` | Per sessió |
| `create_note` | **Per crida, sempre** |
| `summarise_notes` | Cap a nivell MCP, però la sortida passa pel filtre del D3 |

### Implicacions per a la memòria

- Secció 9.4 (Disseny de seguretat): subseccio "Aprovacions humanes" amb la taula anterior i la justificació.
- Secció 11.3 (Avaluació Promptfoo): casos de test específics que intenten crear notes via `summarise_notes`→`create_note`. Han de fallar o demanar confirmació.

### Alternativa descartada

- **Confirmació a cada crida.** Descartada per UX: anul·la l'ús d'agents autònoms, que és el punt de MCP.
- **Sense confirmacions.** Descartada per seguretat: `create_note` és el vector d'exfiltració més probable.

---

## 2026-04-19. D3. Filtre de sortida a `summarise\_notes`

**Decisió:** **segona passada amb Claude Haiku 4.5 sense cap eina** (LLM-as-a-judge). La sortida del summariser inicial passa per un segon prompt que rep la instrucció de *classificar i, si cal, neutralitzar* qualsevol fragment que sembli una injecció d'instruccions. En cas que el cost sigui un problema durant les proves de càrrega de la setmana 5, es recula a una heurística regex+allowlist.

### Per què

- **Haiku 4.5 ja és al codebase.** Cap nova dependència, cap nou proveïdor. L'alternativa regex és robusta contra atacs trivials però cega a paràfrasis (p. ex. "ignora les instruccions anteriors" traduït a un altre idioma o escrit amb sinònims).
- **Latència acceptable.** Haiku 4.5 té p50 ~400 ms per una crida curta (<500 tokens). Afegit al summariser principal (1-2 s) queda dins del pressupost de latència documentat.
- **Cost controlable.** Amb 100 tenants simulats fent 10 crides/h a `summarise_notes`, són 1.000 crides/h a Haiku per al filtre. A 1 $/M tokens input (Haiku 4.5) i ~300 tokens/crida, són ~0,3 $/h de saturació màxima. Dins del pressupost de `03-memoria-plan.md` secció 12.
- **Defensa en profunditat.** El filtre no substitueix les altres mesures (etiquetatge de procedència, segregació de capacitats, aprovacions); s'afegeix com a **última línia** abans de retornar el text a qui crida.

### Implementació

```
summarise_notes(input):
  raw_summary = LLM_principal(input + notes_etiquetades_com_untrusted)
  veredicte = LLM_filtre(raw_summary, sense eines, prompt de classificació)
  if veredicte == "injection":
    return summary_neutralitzat  // truncat o rebutjat
  return raw_summary
```

### Implicacions per a la memòria

- Secció 9.4 (Disseny de seguretat): subsecció "Filtre de sortida" amb el diagrama de flux anterior.
- Secció 11.3 (Avaluació): taxa de detecció del filtre aïlladament (Promptfoo amb filtre ON/OFF) per mesurar el seu valor marginal.

### Alternativa descartada

- **Regex + allowlist.** Descartada com a primera opció per cegesa a paràfrasis. Queda com a *pla B* si els costos operatius del filtre LLM es fan insostenibles a Setmana 5.

---
