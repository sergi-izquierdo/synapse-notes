# Pla de contingut de la memòria del TFG. Estàndard ADA (17 seccions)

> Associa cada secció requerida per l'ADA a contingut concret que escriurà Sergi, amb el nombre estimat de pàgines, les fonts principals i les dependències amb les fites de codi. Els objectius de pàgines segueixen el TFG de referència (`docs/TFG_8213.pdf`, unes 55 pàgines).

**Extensió objectiu:** entre 50 i 60 pàgines de cos més annexos.
**Llengua:** català (per l'estàndard de la URV) amb resums trilingües (CA, ES, EN).
**Cites:** APA 7 (vegeu `docs/guia_APA_7edicion.pdf`).

---

## 1. Portada

- Plantilla oficial de la URV. Títol, autor, tutor (**Marc Sánchez**), convocatòria (1a, juny de 2026), grau (Eng. Informàtica, ETSE).
- **Títol proposat:** *"Synapse Notes: disseny i anàlisi de seguretat d'un servidor MCP multi-tenant per a agents d'IA sobre una base de coneixement personal"*.
- 1 pàgina.

## 2. Resum (trilingüe)

- Tres versions d'unes 100 paraules: català, castellà i anglès.
- Cadascuna: problema, enfocament, resultat, paraules clau.
- 1 pàgina en total.

## 3. Índex

- Generació automàtica. 1 pàgina.

## 4. Introducció

- **Context:** sobrecàrrega informativa, coneixement personal fragmentat, aparició dels agents d'IA com a nova capa d'interacció, MCP com a estàndard de facto d'integració (citar l'anunci d'Anthropic del novembre de 2024 i l'estat del 2026).
- **Necessitats:** els usuaris tenen notes repartides en moltes eines; els agents necessiten una manera segura de llegir-les; les eines existents (Notion AI i similars) van patir fuites el gener de 2026 via la Lethal Trifecta. Buit detectat: com exposar de manera segura una base de coneixement personal als agents dins d'un SaaS multi-tenant.
- **Ús esperat:** base de coneixement personal més ecosistema d'agents. L'usuari connecta el seu Claude Desktop o Cursor a la seva instància de Synapse via MCP.
- 2 a 3 pàgines. Fonts: anunci de l'especificació MCP, Simon Willison 2025, divulgacions d'incidents del gener de 2026 (tot a `02-research-mcp-agents-2026.md`).

## 5. Paraules clau

- Entre 6 i 8 paraules en CA, ES i EN.
- Candidates: MCP, RAG, SaaS multi-tenant, prompt injection, RLS, pgvector, seguretat d'agents, Lethal Trifecta, Next.js, Supabase.
- 0,5 pàgina.

## 6. Objectius i justificació formativa

**Objectius generals:**
1. Dissenyar i implementar un servidor MCP multi-tenant sobre Synapse Notes.
2. Analitzar la superfície d'atac de l'agent resultant amb el marc de la Lethal Trifecta i aplicar mitigacions documentades.
3. Avaluar empíricament l'aïllament multi-tenant (RLS), el rendiment de la cerca híbrida (pgvector) i la resistència a la injecció indirecta de prompt.

**Objectius específics (≥ 8, mesurables):**
- O1. Implementar 6 eines MCP amb Streamable HTTP i OAuth 2.1.
- O2. Implementar 3 agents en segon pla (backfill, auto-tag, digest) sobre Edge Functions de Supabase amb `pg_cron`.
- O3. Definir un model d'amenaces eina a eina amb taula explícita.
- O4. Obtenir 0 fuites en 15 o més tests d'aïllament de RLS.
- O5. Aconseguir un 80% o més de mitigació en 15 o més atacs de Promptfoo.
- O6. Mantenir p95 de latència per sota de 500 ms a `search_notes` amb 100 tenants simulats.
- O7. Documentar un flux de demostració amb Claude Desktop com a client MCP.
- O8. Produir 30 o més tests automatitzats (unitaris i d'integració).

**Justificació formativa:** mapatge de competències del grau (assignatures cursades: SCE, Sistemes Concurrents; SX, Seguretat de Xarxes; BD; ES; Compiladors). SX és especialment rellevant, ja que cobreix OAuth, RLS i modelatge d'amenaces.

- 2 a 3 pàgines. Fonts: PDF del pla d'estudis del grau a la URV.

## 7. Planificació (Gantt)

- Diagrama de Gantt amb 4 fases (setmanes 1-7), vegeu `04-gantt.md` per al detall.
- Eina: diagrama de Gantt amb Mermaid, exportat a PNG. Incloure la càrrega estimada (hores per setmana).
- **Riscos identificats amb mitigacions** (taula): tutor absent, canvis incompatibles a l'especificació MCP, tall de Gemini, infravaloració del temps de memòria.
- 2 pàgines.

## 8. Requisits (funcionals i no funcionals)

**RF. 15 o més casos d'ús**, en format UML amb descripció textual:
- RF01 a RF06: 6 eines MCP (una per eina).
- RF07 a RF09: 3 agents.
- RF10 a RF12: flux OAuth, refresh token i revocació.
- RF13 a RF15: UI per visualitzar l'activitat dels agents, acceptar o rebutjar suggeriments d'etiqueta i consultar els logs.

**RNF:**
- RNF01 Seguretat: OAuth 2.1, RLS obligatòria, auditoria d'accions d'agent.
- RNF02 Rendiment: p95 de `search_notes` per sota de 500 ms amb 100 tenants concurrents.
- RNF03 Escalabilitat: suport de 10.000 notes per usuari sense reindexar.
- RNF04 Disponibilitat: servidor MCP sense estat i, per tant, escalable horitzontalment.
- RNF05 Accessibilitat: WCAG AA a la UI (ja s'aplica, cal documentar-ho).
- RNF06 Privacitat: RGPD, vegeu la secció 13.

- 4 a 5 pàgines. Un cas d'ús per eina forma l'esquelet.

## 9. Disseny

La secció més llarga. Tres subcapítols.

### 9.1 Arquitectura general

- Diagrames C4: context i contenidors. Amb Mermaid o draw.io.
- Diagrama de flux: client MCP, autenticació, distribució a les eines, servei i base de dades.
- Diagrama de desplegament: Vercel (Next.js amb la ruta MCP) més Supabase (Postgres, Edge Functions i Auth).

### 9.2 Disseny de la base de dades

- Diagrama entitat-relació de totes les taules (`notes`, `chats`, `messages`, `tag_suggestions`, `agent_events`).
- Taula de polítiques RLS per a cada taula. Justificació de cada política.
- Justificació de l'ús de pgvector respecte a Pinecone o Weaviate (cost, locality, integració amb RLS).
- Explicació de l'índex HNSW amb prefiltre per tenant.

### 9.3 Disseny del servidor MCP

- Diagrama de seqüència: handshake d'OAuth i primera crida d'eina.
- Diagrama de classes i mòduls del servidor (`McpServer`, `ToolHandlers`, `AuthGuard`, `SupabaseClientFactory`).
- Taula d'eines amb l'schema JSON complet (arguments i tipus de retorn).

### 9.4 Disseny de seguretat (**nucli del TFG**)

- Introducció al marc de la Lethal Trifecta.
- **Taula de trifecta per eina** (ja esbossada a `01-scope.md` secció 2.1).
- Arbre d'atacs per a `summarise_notes`, l'eina amb més risc.
- Estratègies de mitigació: segregació de capacitats, etiquetatge de procedència, filtre de sortida i aprovacions humanes.

- **15 a 18 pàgines** (aprox. 30% de la memòria).

## 10. Implementació

Crucial: sense codi en brut (el tribunal ho penalitza). Sí amb:
- Justificació de cada decisió tècnica (Next.js 16, TypeScript estricte, AI SDK 6 contra LangChain, Gemini 2.5 Flash contra GPT-4o).
- Fragments curts (màx. 20 línies) que il·lustrin els patrons clau:
  - Factory del servei MCP (client de Supabase injectat).
  - Schemes Zod de les eines.
  - Migració idempotent amb política RLS.
  - Edge Function de Supabase amb disparador `pg_cron`.
- Problemes reals trobats (secció honesta, el tribunal ho valora):
  - Sessions MCP amb estat o sense.
  - Trade-off cost contra latència de la passada secundària de LLM.
  - Diferències entre els runtimes Deno i Node a Edge Functions.

- 8 a 10 pàgines.

## 11. Avaluació

- **11.1 Tests funcionals.** Taula amb 30 o més IDs de test i percentatge de cobertura per mòdul.
- **11.2 Tests d'aïllament de RLS.** 15 escenaris A a B, A a A, anònim, token caducat. Taula de resultats (PASS o FAIL).
- **11.3 Red team amb Promptfoo.** 15 intents d'injecció. Taxa d'èxit abans i després de les mitigacions.
- **11.4 Benchmarks.** Latència p50, p95 i p99 de cada eina amb 10, 100 i 500 clients concurrents. Gràfic de línies.
- **11.5 Cas d'estudi.** Transcripció de la demo entre Claude Desktop i Synapse.

- 6 a 8 pàgines. Dependència: **els tests han d'estar escrits i verds** al final de la setmana 5.

## 12. Costos

- **Personal:** 320 hores estimades a 18 €/hora (preu de becari junior a la URV) = 5.760 €.
- **Material:**
  - Llicències de desenvolupament: 0 € (Cursor gratuït, Claude Code Pro ja contractat).
  - Supabase Pro: 25 $/mes × 3 mesos = 75 $.
  - Vercel Pro: 20 $/mes × 3 mesos = 60 $.
  - API de Gemini: uns 20 $ per a tots els tests.
  - Total de cloud: uns 155 $, equivalent a 145 €.
- **Total del TFG:** uns 5.905 €.
- **Cost operatiu** (projecció per a 1.000 usuaris actius): taula detallada (trams de Supabase, amplada de banda de Vercel, Gemini per cada 1.000 consultes).
- 2 a 3 pàgines. Seguint l'exemple del TFG_8213 (Hamdouch, 2024).

## 13. Legislació

- **RGPD i LOPDGDD:**
  - Synapse processa contingut personal de l'usuari, per tant són dades personals.
  - Bases legals: consentiment explícit (registre) més execució contractual.
  - Com s'implementen els drets ARCO-POL: exportar notes i esborrar compte.
  - DPO: no és obligatori a aquesta escala.
- **LSSI-CE:** política de galetes (només la sessió de Supabase) i avís legal.
- **MCP i dades:** cada token MCP és una autorització delegada per llegir dades personals; ha de poder-se revocar i ha de quedar registrat a l'audit log.
- 2 a 3 pàgines. Cal referenciar articles concrets del RGPD (art. 6, 15, 17, 20, 32).

## 14. Implicacions ètiques, igualtat, medi ambient

- **Ètica en IA:** biaix del model (Gemini), risc de suggeriments d'etiqueta incorrectes, transparència (l'usuari veu què fa l'agent).
- **Igualtat:** i18n en 3 llengües (CA, ES, EN); accessibilitat WCAG AA; no discriminació per capacitat tècnica (UX simple).
- **Medi ambient:** cost energètic dels LLM; mitigació: Gemini Flash és més eficient que GPT-4o; caching; no reembedding si no cal.
- 1,5 pàgines.

## 15. Valoració personal (reflexiva)

- Què he après (MCP, modelatge d'amenaces, coneixement profund de RLS).
- Dificultats reals trobades (sessions MCP amb estat, bones pràctiques de seguretat d'agents).
- Què faria diferent (començar l'avaluació abans, invertir més en observabilitat).
- Com connecta amb el futur professional (agents i seguretat són àrea clau a partir del 2026).
- 1 a 1,5 pàgines. Escrita en primera persona. El tribunal valora l'honestedat.

## 16. Bibliografia

- APA 7. Seguir `docs/guia_APA_7edicion.pdf`.
- 25 fonts com a mínim. Mescla: especificació oficial (MCP), OWASP, Simon Willison, articles acadèmics sobre prompt injection, documentació oficial (Next.js, Supabase, Vercel).
- 2 pàgines.

## 17. Annexos

- **Annex A:** guia d'instal·lació (README del repositori més configuració de Supabase).
- **Annex B:** manual d'ús (captures del flux d'usuari més demo amb Claude Desktop).
- **Annex C:** llista completa d'eines MCP amb els seus schemes.
- **Annex D:** suite completa de red-team amb Promptfoo (YAML).
- **Annex E:** enllaç al repositori de GitHub i al vídeo de la demo (YouTube privat).
- 8 a 12 pàgines.

---

## Alineament amb el calendari d'escriptura

| Secció | Es pot escriure a la setmana | Depèn de |
|---|---|---|
| 1, 2, 3, 5 | 1 | Res. Títol i paraules clau es fixen d'hora |
| 4 | 1 a 2 | Document de recerca |
| 6 | 2 | Tancament de l'abast |
| 7 | 2 | Gantt tancat |
| 8 | 2 | Tancament de l'abast |
| 9 (disseny) | 3 a 4 | Implementació central feta |
| 10 (impl.) | 5 | Codi complet |
| 11 (aval.) | 6 | Tests complets |
| 12, 13, 14, 15 | 6 | Producte gairebé complet |
| 16, 17 | 7 (final) | La resta |

La memòria **no** s'escriu al final. Les seccions 1-8 s'han de redactar a les setmanes 1 i 2 mentre encara es programa. Les seccions 9-11 es fixen quan l'arquitectura i els tests són estables.

---
