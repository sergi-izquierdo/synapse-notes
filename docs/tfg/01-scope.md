# Abast del TFG. Opció C: Synapse Notes més MCP més seguretat d'agents

> Defineix **què** construeix el TFG sobre la base de codi existent de Synapse Notes, i **què deixa fora explícitament**. Sense un control estricte d'abast, 47 dies no arriben.

---

## 1. Plantejament del producte (una frase)

> **Synapse Notes** és un SaaS multi-tenant de notes amb IA, el back-end del qual s'exposa com a **servidor MCP** perquè agents autònoms puguin llegir, cercar i enriquir de manera segura la base de coneixement personal de cada usuari, amb aïllament de tenant, segregació de capacitats i model d'amenaces de la Lethal Trifecta com a restriccions de disseny de primer nivell.

Aquest plantejament defensa bé davant el tribunal perquè:

- És un **producte real** (menys objeccions de "projecte de joguina").
- Té **profunditat de recerca** (seguretat i arquitectura, no només funcionalitats).
- **Cita bones pràctiques del 2026** (especificació MCP, OAuth 2.1, OWASP Gen AI).
- Té **resultats mesurables** (tests d'aïllament, tests de trifecta, benchmarks de latència).

---

## 2. Dins de l'abast. Entregables concrets

### 2.1 Servidor MCP

Un servidor MCP en TypeScript amb `@modelcontextprotocol/sdk` i transport **Streamable HTTP**, desplegat a Vercel (com a route handler separat o com a funció aïllada), que exposa les operacions de Synapse com a eines.

**Eines que cal implementar (6, una per operació central):**

| Eina | Propòsit | Risc de trifecta |
|---|---|---|
| `search_notes` | Cerca híbrida (pgvector més filtre d'etiqueta) sobre les notes de qui crida | Només lectura, sense trifecta |
| `get_note` | Obté una nota per ID | Només lectura, sense trifecta |
| `create_note` | Crea una nota (títol, contingut, etiquetes) | Escriptura, segura (aïllada) |
| `update_note` | Actualitza contingut o etiquetes | Escriptura, segura |
| `tag_notes` | Aplica etiquetes en bloc | Escriptura, segura |
| `summarise_notes` | Resum generat per LLM d'un conjunt de resultats | **Candidata a trifecta**, coberta al capítol de seguretat |

**Recursos (concepte MCP):**
- `notes://recent`. Les 20 notes més recents de qui crida, com a context.
- `notes://tag/{tag}`. Notes filtrades per etiqueta.

**Prompts (concepte MCP):**
- `daily-review`. Plantilla estructurada per a la revisió diària de notes.

### 2.2 Autenticació. OAuth 2.1 sobre Supabase Auth

- El client MCP inicia OAuth amb Supabase (ja establert per al login web).
- El servidor valida el JWT de Supabase a cada crida d'eina.
- L'execució de l'eina fa servir un client de Supabase lligat al JWT. Així **totes les polítiques de RLS s'apliquen automàticament**. Al camí de l'usuari no hi ha service role.
- L'aïllament per tenant es fa complir a la base de dades, no al codi de l'aplicació.

### 2.3 Agents en segon pla

Tres agents programats com a Edge Functions de Supabase més `pg_cron`:

| Agent | Freqüència | Feina | Escriu a |
|---|---|---|---|
| `agent:embedding-backfill` | cada 15 min | Localitza notes amb `embedding IS NULL`, les genera i les desa | `notes.embedding` |
| `agent:auto-tag` | cada hora | Llegeix notes recents, proposa entre 0 i 3 etiquetes via Gemini, les desa com a suggeriments | taula `tag_suggestions` (l'usuari accepta o rebutja) |
| `agent:weekly-digest` | setmanal (diumenge) | Resum setmanal de les notes per usuari, desat com a nota especial "digest" | `notes` |

Cada agent s'executa amb una **service role key dedicada** i amb un **filtre per tenant explícit a SQL**. No hi ha cap lectura en blanc. Tota l'activitat queda registrada a `agent_events(id, user_id, agent, action, payload, created_at)`.

### 2.4 Anàlisi de seguretat. Contribució original de la memòria

És la **contribució de recerca principal** del TFG. Estructura:

1. **Model d'amenaces** amb la Lethal Trifecta. Taula eina a eina indicant si cada propietat (dades privades, contingut no confiable, comunicació externa) hi és present, absent o mitigada.
2. **Atacs intentats (red team)**. Suite impulsada per Promptfoo:
   - Injecció indirecta de prompt via contingut manipulat de notes.
   - Intents d'accés entre tenants.
   - Atacs per encadenament d'eines (cerca i fuga via summariser).
3. **Mitigacions implementades**. Etiquetatge de procedència, segregació de capacitats (agent de lectura contra agent d'escriptura), aprovacions humanes a les eines destructives, filtre de sortida a `summarise_notes`.
4. **Tests d'aïllament de RLS**. Comprovacions automatitzades que l'usuari A no pot llegir les notes de l'usuari B sota cap eina MCP, inclosa la cerca per similitud.
5. **Taula de resultats**. Taxa d'èxit dels atacs abans i després, amb cada capa de mitigació activada.

### 2.5 Dades per al capítol d'avaluació

- **Tests funcionals:** 30 o més tests unitaris i d'integració entre eines MCP, RLS i agents.
- **Tests de seguretat:** 15 o més casos red-team amb Promptfoo.
- **Rendiment:** distribució de latència (p50, p95, p99) per cada eina MCP amb 100 tenants concurrents a la prova de càrrega.
- **Cas d'estudi:** demostració extrem a extrem amb Claude Desktop com a client MCP atacant el Synapse desplegat.

---

## 3. Fora de l'abast. Exclusions explícites

Per protegir la finestra de 47 dies, el TFG **no** inclou:

- Aplicació mòbil ni port a React Native.
- Workspaces d'equip ni interfície de compartició (la multi-tenancy per usuari ja permet demostrar els patrons multi-tenant).
- Facturació, Stripe ni plans de subscripció.
- Panell d'administració.
- Cerca full-text més enllà del combinat vector més etiqueta.
- Fine-tuning de LLM. Els models queden fixats: **Claude Haiku 4.5** (`@ai-sdk/anthropic`) per al xat i per a la passada secundària de seguretat; **Gemini embedding-001** per als embeddings (Anthropic no n'ofereix). La migració a Voyage AI pels embeddings queda com a treball futur.
- Funcionalitats noves de UI. La UI queda congelada a l'estat actual, excepte el que calgui per visualitzar els agents en segon pla (un "calaix" d'activitat simple).
- Supabase auto-allotjat. Només el servei gestionat.

Si una funcionalitat no és a la llista **dins de l'abast**, no s'entrega. Punt.

---

## 4. Base existent. Què es manté sense tocar

Ja existeix i NO es reescriu:

- Shell de l'aplicació Next.js 16, fluxos d'autenticació (OAuth de Google i GitHub), UI del dashboard.
- Taules `notes`, `chats` i `messages` amb les seves polítiques de RLS.
- RPC `match_notes` per a la similitud vectorial.
- Internacionalització (EN, ES, CA), dark mode, paleta d'ordres.
- Xat en streaming amb Vercel AI SDK i eina `getNotesByTag`.

El codi nou viu a:

- `/mcp/`. Servidor MCP (route handler nou a Next.js o desplegament separat, vegeu la decisió 1 a la secció 6).
- `/supabase/functions/`. Edge Functions dels agents.
- `/supabase/migrations/`. Taules noves: `tag_suggestions` i `agent_events`.
- `/src/lib/mcp/`. Utilitats de client MCP compartides perquè la UI web pugui consumir el seu propi servidor MCP (dogfooding).
- `/tests/security/`. Configuracions i assercions de Promptfoo.
- `/tests/rls/`. Tests d'aïllament de RLS.

---

## 5. Afegits al model de dades

```sql
-- Auditoria dels agents. Cada acció d'un agent queda registrada
CREATE TABLE agent_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent       text NOT NULL,  -- 'auto-tag' | 'embedding-backfill' | 'digest' | 'mcp:<tool>'
  action      text NOT NULL,  -- p. ex. 'tag.proposed', 'note.summarised'
  payload     jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE agent_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own events" ON agent_events
  FOR SELECT USING (user_id = auth.uid());

-- Suggeriments d'etiqueta. L'usuari els aprova abans que s'apliquin a la nota
CREATE TABLE tag_suggestions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_id     uuid NOT NULL REFERENCES notes(id)      ON DELETE CASCADE,
  tag         text NOT NULL,
  status      text NOT NULL DEFAULT 'pending',  -- pending | accepted | rejected
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE tag_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own suggestions"
  ON tag_suggestions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Índex compost per a cerca vectorial filtrada per tenant (capítol de rendiment)
CREATE INDEX IF NOT EXISTS notes_user_embedding_idx
  ON notes USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;
-- (HNSW més prefiltre per RLS és el patró que recomanen Tiger i Supabase)
```

---

## 6. Decisions pendents (marcades per resoldre més endavant)

- **D1. Objectiu de desplegament del MCP.** Opcions: route handler de Next.js a Vercel (`/api/mcp`) o Edge Function de Supabase (basada en Deno). Vercel és més senzill (un sol desplegament); Supabase queda més a prop de la BD (menys latència). **Tendència:** route handler de Next.js per al MVP, amb benchmark dels dos per a la memòria.
- **D2. UX d'aprovació per a eines destructives.** Opcions: pantalla intermèdia de confirmació o concessió de capacitats pre-aprovades per sessió. AI SDK 6 dona suport a les dues. **Tendència:** concessions per sessió per a l'experiència d'usuari, amb confirmació només a `create_note` des del MCP.
- **D3. Filtre de sortida a `summarise_notes`.** Opcions: segona passada amb LLM o regex amb allowlist i truncament. **Tendència:** segona passada amb Claude Haiku 4.5 (el mateix model del xat, sense duplicar proveïdors). En cas que el cost sigui un problema a les proves de càrrega, recular a una heurística regex.

Les decisions viuen en aquest document i s'hi actualitzen a mesura que es resolen.

---
