# Recerca: MCP i seguretat d'agents. Estat de l'art (març-abril 2026)

> Compilat el 2026-04-19 a partir de cerques web sobre material publicat els darrers 30 a 60 dies. Cada afirmació està enllaçada amb la seva font. Aquesta és la base bibliogràfica que citarà la memòria quan hagi de justificar les decisions d'arquitectura.

---

## 1. MCP. Què és i en quin punt es troba

El **Model Context Protocol (MCP)** és un protocol obert d'Anthropic que estandarditza com els hosts de LLM (Claude Desktop, Cursor, agents propis) descobreixen i criden eines, recursos i prompts externs. Al 2026 és la capa d'integració dominant per a la IA amb agents.

### Evolució del transport (crítica per a la implementació)

- **Antic:** `stdio` (processos locals) i `HTTP + SSE` (Server-Sent Events).
- **Actual (2026):** **Streamable HTTP**. Substitueix SSE. HTTP pla, amb o sense sessió, sense connexions de llarga durada. És el transport a fer servir per a servidors MCP remots. ([MCP TS SDK docs][ts-sdk])
- **SDK:** `@modelcontextprotocol/sdk` a npm. SDK oficial en TypeScript per a servidor i client. Dona suport a Streamable HTTP via `NodeStreamableHTTPServerTransport`.

### Línia base de seguretat oficial

La pàgina oficial "Security Best Practices" ([especificació MCP][mcp-spec-sec]) i el projecte Gen AI d'OWASP ([guia OWASP MCP][owasp-mcp]) convergeixen en:

1. **L'autenticació és obligatòria.** Executar un servidor MCP sense autenticació significa que qualsevol atacant que escaneja ports pot executar eines arbitràries amb tots els privilegis.
2. **Aïllament de tokens.** Els servidors MCP tendeixen a agregar tokens OAuth de molts serveis. Un compromís es converteix en una bretxa transversal. Cal mantenir tokens per tenant, xifrats en repòs i amb scope mínim.
3. **Validació d'entrada.** El 2026, el 43% dels servidors MCP analitzats són vulnerables a injecció d'ordres i els atacs de path traversal són habituals. Cal validar cada argument i no invocar mai el shell amb entrada no confiable.
4. **Aïllament entre servidors.** Credencials, processos i xarxes separats. Cap servidor MCP compromès ha de permetre pivotar als altres.
5. **Revisió de la cadena de subministrament.** SAST i SCA a tots els servidors i les dependències. Cal mantenir una llista interna de servidors aprovats.

### Estàndard d'autenticació

**OAuth 2.1** és el model d'autorització oficial a l'especificació MCP ([modelcontextprotocol.io/authorization][mcp-auth]). Servidor MCP igual a resource server d'OAuth 2.1. Client MCP igual a client d'OAuth 2.1 que fa peticions en nom de l'usuari. Es preveu que els tokens admetin refresh, revocació i expiració.

**Progressió pràctica** ([GitGuardian][gg-oauth], [DEV][dev-oauth]):

| Etapa | Autenticació |
|---|---|
| Desenvolupament local, un sol tenant | API keys |
| SaaS multi-tenant | OAuth 2.1 Client Credentials amb tokens per tenant |
| Infraestructura regulada | mTLS per sobre de l'OAuth |

AWS publica una implementació de referència d'un servidor MCP multi-tenant amb **Cognito** com a IdP OAuth 2.1 ([aws-samples][aws-mcp]). La documentació de Cloudflare descriu el flux equivalent ([Cloudflare Agents][cf-auth]). **Per a Synapse, l'equivalent és Supabase Auth (compatible amb OAuth 2.1) que emet JWTs per tenant i el servidor MCP els verifica.**

---

## 2. La Lethal Trifecta. Model d'amenaces obligatori

El marc de Simon Willison ([simonwillison.net][lethal]) és **el** marc que cita el sector al 2026. Un agent és **incondicionalment vulnerable** a la injecció indirecta de prompt si té les 3 condicions alhora:

1. **Accés a dades privades** (notes de l'usuari, correus, files de BD).
2. **Exposició a contingut no confiable** (pàgines web, PDFs, documents pujats, dades d'altres usuaris en un workspace compartit).
3. **Capacitat de comunicar-se cap a l'exterior** (peticions HTTP, correus, crides d'eina que creuen un límit de confiança).

> "Un agent amb les tres propietats de la Lethal Trifecta és incondicionalment vulnerable a la injecció indirecta de prompt, independentment de l'alineament del model, de l'endurimento del system prompt o del fine-tuning de seguretat. L'única manera de ser segur és evitar aquesta combinació del tot."

### Per què és rellevant per a Synapse

El xat RAG actual de Synapse té:

- Sí. Dades privades (les notes de l'usuari).
- Parcial. Contingut no confiable (les notes poden contenir qualsevol cosa que l'usuari hi hagi enganxat, incloses càrregues d'injecció copiades del web).
- Parcial. Potencial de comunicació externa (si les eines MCP o futurs agents poden sortir a fora, com enviar correus, postejar a webhooks o seguir URLs).

**El TFG ha d'analitzar quines eines entren a la trifecta i mitigar-ho.**

### Mitigacions citades a material del 2026

- **Etiquetatge de procedència.** Envoltar cada fragment no confiable amb XML del tipus `<untrusted source="note:id">...</untrusted>` i instruir el model a no seguir mai instruccions dins d'aquestes etiquetes. És una defensa feble, per tant cal tractar-la com a capa addicional, no com a solució.
- **Segregació de capacitats.** Dividir l'agent en dos: un amb accés a dades (sense comunicació externa) i un altre amb comunicació externa (sense accés a dades privades). Es comuniquen per una interfície tipada i restringida.
- **Filtre de sortida.** Abans de qualsevol crida cap enfora (correu, webhook), cal passar el text per un LLM de seguretat sense cap eina que classifiqui l'esborrany.
- **Aprovacions humanes.** AI SDK 6 dona suport natiu a aprovació d'execució d'eina ([blog AI SDK 6][aisdk6]). És obligatori per a qualsevol eina destructiva.
- **Bretxes reals (gener de 2026):** IBM Bob, Superhuman AI, Notion AI i Claude Cowork d'Anthropic van divulgar exploits de trifecta en una sola setmana. És la prova que l'amenaça no és teòrica.

### Marcs de test

- **Promptfoo** ([promptfoo.dev][promptfoo]). Guia publicada el 2026 per a tests automatitzats de trifecta. Corpus de red-team més biblioteca d'assercions. **És l'eina que farem servir per al capítol d'Avaluació.**

---

## 3. RAG multi-tenant amb RLS. Patró validat

Synapse ja és multi-tenant per `user_id` a `notes`. La memòria ha de mostrar que aquest patró és deliberat, no accidental.

### Estat de l'art

- Postgres més pgvector més RLS més índex HNSW és la pila **per defecte** per a RAG multi-tenant al 2026 ([Supabase RAG with Permissions][supa-rag], [Tiger Data multi-tenant RAG][tiger-rag], [Nile multi-tenant RAG][nile-rag]).
- Les polítiques de RLS filtren les files **abans** de l'escaneig de similitud vectorial. Combinat amb un índex amb scope de tenant (`tenant_id, embedding`), és el punt dolç de rendiment. Tiger va provar 50 M de vectors a 768 dimensions i va obtenir 471 QPS amb un 99% de recall.
- **Retrieval híbrid** (KNN vectorial més filtres estructurats sobre `tenant_id`, `language`, `created_at`) guanya sistemàticament un ordre de magnitud als escanejos només vectorials en càrregues multi-tenant.

### Què li falta a Synapse (oportunitats per a la memòria)

- Ara mateix no tenim un índex compost explícit (`tenant_id`, `embedding`) sobre `embedding`. Val la pena mesurar-ho.
- No hi ha tests de RLS que validin la prevenció de fuites entre tenants sota cerca per similitud. **Cal afegir una suite de tests** (proves d'aïllament de RAG). Contingut fort per a la memòria.
- No hi ha un filtre híbrid explícit per etiquetes ni per timestamp.

---

## 4. Segon pla a Supabase. Ja en estat de producció

A principis del 2026, Supabase ofereix tres primitives complementàries ([docs de Supabase][supa-cron], [blog de Supabase][supa-jobs]):

- **`pg_cron`.** Jobs programats recurrents dins de Postgres.
- **`pgmq`.** Cua de missatges nativa de PostgreSQL (abans només en auto-allotjat; ara disponible en el servei gestionat).
- **Edge Functions amb Background Tasks.** Feina de llarga durada després de la resposta HTTP, recolzada per la cua.

Patró:

```
disparador cron → Edge Function → llegeix pgmq → crida LLM o fa la feina
                                ↓
                         escriu de tornada a la BD
```

Aquesta és la base per als agents en segon pla de Synapse:

- `agent:auto-tag`. Llegeix notes sense etiquetar, en proposa etiquetes, escriu a `agent_events`.
- `agent:dedupe`. Escaneig nocturn de similitud, marca notes duplicades.
- `agent:digest`. Resum setmanal de les notes recents per usuari.
- `agent:embedding-backfill`. Assegura que tota nota té embedding.

**Cada agent ha de passar per la RLS fent servir una service role amb un filtre explícit de `tenant_id`**. Res de lectures en blanc amb service role. És un capítol concret sobre execució segura d'agents.

---

## 5. Vercel AI SDK 6. Primitives d'agent

`ai@6` (ja al `package.json` de Synapse) va afegir el 2026:

- Primitives d'**agent** natives (no només `streamText`).
- **Aprovació d'execució d'eina.** Humà al circuit.
- **DevTools** per inspeccionar cadenes de crides d'eina.
- **Suport complet de MCP.** L'AI SDK pot consumir servidors MCP directament.
- **Blocs de raonament.** Models que emeten passos de raonament explícits (estil Claude 3.7 o posterior).

**Implicació:** la UI del xat de Synapse ja fa servir `streamText` més l'eina `getNotesByTag`. El camí de millora del TFG és: afegir eines basades en MCP al costat de les natives, exigir aprovació a qualsevol operació d'escriptura i enregistrar els blocs de raonament a `agent_events` per a la traçabilitat.

---

## 6. Què pot defensar raonablement la memòria

Síntesi dels punts anteriors en afirmacions que Sergi pot defensar davant del tribunal:

| Afirmació | Evidència a la memòria |
|---|---|
| "MCP és l'estàndard del 2026 per a la integració agent-eina, no una elecció de nínxol." | Citar l'especificació MCP, referències d'AWS i Cloudflare, guia d'OWASP. |
| "MCP multi-tenant és un problema de disseny no trivial." | Mostrar el flux OAuth 2.1, la verificació del JWT de Supabase al servidor MCP i l'scope per tenant dels tokens. |
| "L'arquitectura RLS més pgvector de Synapse no és casual; és el patró de l'estat de l'art per a RAG multi-tenant segur." | Citar els articles de Supabase, Tiger i Nile del 2026. Ensenyar els tests d'aïllament en verd. |
| "La superfície d'agent s'ha modelat sistemàticament com a amenaça." | Fer servir el marc Lethal Trifecta. Taula eina a eina amb dades privades, contingut no confiable i comunicació externa. Mitigacions aplicades. |
| "L'arquitectura és testejable, no només aspiracional." | Resultats de red-team amb Promptfoo més tests d'aïllament de RLS més tests d'integració d'agents en segon pla. |

---

## Índex de fonts

[ts-sdk]: https://github.com/modelcontextprotocol/typescript-sdk
[mcp-spec-sec]: https://modelcontextprotocol.io/specification/draft/basic/security_best_practices
[mcp-auth]: https://modelcontextprotocol.io/specification/draft/basic/authorization
[owasp-mcp]: https://genai.owasp.org/resource/a-practical-guide-for-secure-mcp-server-development/
[gg-oauth]: https://blog.gitguardian.com/oauth-for-mcp-emerging-enterprise-patterns-for-agent-authorization/
[dev-oauth]: https://dev.to/whoffagents/mcp-server-authentication-oauth-vs-api-keys-vs-mutual-tls-which-to-use-and-when-4nj3
[aws-mcp]: https://github.com/aws-samples/sample-multi-tenant-saas-mcp-server
[cf-auth]: https://developers.cloudflare.com/agents/model-context-protocol/authorization/
[lethal]: https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/
[promptfoo]: https://www.promptfoo.dev/blog/lethal-trifecta-testing/
[supa-rag]: https://supabase.com/docs/guides/ai/rag-with-permissions
[tiger-rag]: https://www.tigerdata.com/blog/building-multi-tenant-rag-applications-with-postgresql-choosing-the-right-approach
[nile-rag]: https://www.thenile.dev/blog/multi-tenant-rag
[supa-cron]: https://supabase.com/docs/guides/functions/schedule-functions
[supa-jobs]: https://supabase.com/blog/processing-large-jobs-with-edge-functions
[aisdk6]: https://vercel.com/blog/ai-sdk-6

- SDK TypeScript del MCP: <https://github.com/modelcontextprotocol/typescript-sdk>
- Especificació MCP (seguretat): <https://modelcontextprotocol.io/specification/draft/basic/security_best_practices>
- Especificació MCP (authorization): <https://modelcontextprotocol.io/specification/draft/basic/authorization>
- OWASP Gen AI. Desenvolupament segur de MCP: <https://genai.owasp.org/resource/a-practical-guide-for-secure-mcp-server-development/>
- GitGuardian. OAuth per a MCP: <https://blog.gitguardian.com/oauth-for-mcp-emerging-enterprise-patterns-for-agent-authorization/>
- Mostra d'AWS. MCP multi-tenant: <https://github.com/aws-samples/sample-multi-tenant-saas-mcp-server>
- Autorització a Cloudflare Agents: <https://developers.cloudflare.com/agents/model-context-protocol/authorization/>
- Simon Willison. Lethal Trifecta: <https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/>
- Promptfoo. Tests de trifecta: <https://www.promptfoo.dev/blog/lethal-trifecta-testing/>
- Supabase. RAG amb permisos: <https://supabase.com/docs/guides/ai/rag-with-permissions>
- Tiger Data. RAG multi-tenant: <https://www.tigerdata.com/blog/building-multi-tenant-rag-applications-with-postgresql-choosing-the-right-approach>
- Nile. RAG multi-tenant: <https://www.thenile.dev/blog/multi-tenant-rag>
- Supabase. Cron a Edge Functions: <https://supabase.com/docs/guides/functions/schedule-functions>
- Supabase. Processament de jobs grans: <https://supabase.com/blog/processing-large-jobs-with-edge-functions>
- Vercel AI SDK 6: <https://vercel.com/blog/ai-sdk-6>
