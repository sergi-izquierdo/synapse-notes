# Gantt del TFG. Calendari de 47 dies (2026-04-19 a 2026-06-05)

> Finestra de treball: **47 dies naturals** fins a l'entrega de la memòria per a la 1a convocatòria.
> Finestra de defensa: del 15 al 30 de juny de 2026, entre 10 i 25 dies de marge després de l'entrega per preparar la presentació.
> Hipòtesi de planificació: unes 25 hores setmanals sostingudes (flexibles segons exàmens).

---

## Visió general per fases

| # | Fase | Dates | Durada | Focus |
|---|---|---|---|---|
| 1 | Fonaments i tancament de la recerca | 2026-04-19 a 2026-04-26 | 8 dies | Context, sincronització amb el tutor, abast tancat, esborrany de les seccions 1-8 de la memòria |
| 2 | Implementació del servidor MCP | 2026-04-27 a 2026-05-10 | 14 dies | Eines MCP centrals, OAuth, desplegament |
| 3 | Agents i enduriment de seguretat | 2026-05-11 a 2026-05-24 | 14 dies | Agents en segon pla, model d'amenaces, mitigacions |
| 4 | Avaluació, memòria i marge | 2026-05-25 a 2026-06-05 | 12 dies | Tests, benchmarks, seccions 9-17 i revisió final |
| 5 | Preparació de la defensa | 2026-06-06 a 2026-06-14 | 9 dies | Diapositives, guió de la demo, assajos (fora del temps del TFG) |

---

## Detall setmana a setmana

### Setmana 1. Fonaments (2026-04-19 a 2026-04-26)

**Codi:**
- Preparació del repositori: crear les carpetes `/mcp`, `/supabase/functions` i `/tests/{security,rls}`.
- Instal·lar `@modelcontextprotocol/sdk`, `promptfoo` i els tipus estrictes de `zod`.
- Esborrany de la migració del model de dades: taules `agent_events` i `tag_suggestions` més polítiques. Aplicar-la al Supabase de desenvolupament.
- **Prova de concepte:** un servidor MCP mínim amb una sola eina (`search_notes`), token cablejat per a proves, validat amb MCP Inspector.

**Memòria:**
- Esborrany de les seccions 1, 2 (resum trilingüe), 3 i 5 (paraules clau).
- Esborrany complet de la secció 4 (Introducció) fent servir `02-research-mcp-agents-2026.md` com a font.
- Esborrany complet de la secció 6 (Objectius), amb la llista O1-O8 amb mètriques.
- Primer esborrany de la secció 7 (Planificació), amb aquest Gantt i la taula de riscos.
- Primer esborrany de la secció 8 (Requisits), amb 15 casos d'ús en UML.

**Administració:**
- **Enviar un correu a Marc Sánchez** per informar-lo de l'ampliació d'abast i compartir-li aquesta carpeta. Correu breu, sense cap petició més enllà d'un "per a la teva informació, aquí tens l'abast actualitzat".
- Configurar el gestor de cites (Zotero) amb estil APA 7.

**Criteris de sortida:**
- La PoC del MCP funciona extrem a extrem en local.
- Les seccions 1-8 de la memòria tenen com a mínim un primer esborrany.
- L'abast queda congelat. No s'admeten canvis d'abast sense una entrada nova al registre de decisions.

---

### Setmana 2. Nucli del MCP (2026-04-27 a 2026-05-03)

**Codi:**
- Implementar les 6 eines MCP amb els seus schemes Zod i tests:
  `search_notes`, `get_note`, `create_note`, `update_note`, `tag_notes` i `summarise_notes`.
- Flux OAuth 2.1: verificació del JWT de Supabase a cada crida d'eina.
- Refactor de la capa de servei: les eines criden `NotesService` (factory amb client injectat), no pas Supabase directament.
- Desplegar la ruta MCP en preview a Vercel. Comprovar que funciona sobre Streamable HTTP.

**Memòria:**
- Avançar les seccions 9.1 (arquitectura general) i 9.3 (disseny del servidor MCP) amb diagrames a draw.io.

**Criteris de sortida:**
- Les 6 eines es poden invocar des de MCP Inspector i des de Claude Desktop.
- La RLS s'activa a cada crida (el pas del JWT funciona).
- 15 o més tests unitaris verds per als handlers d'eina.

---

### Setmana 3. Polit del MCP i primera passada de seguretat (2026-05-04 a 2026-05-10)

**Codi:**
- Escriure la suite de tests d'aïllament de RLS (15 o més escenaris: A contra B bloquejat a totes les eines, A contra A permès, anònim bloquejat, token caducat bloquejat, service role acotat).
- Afegir l'índex HNSW compost `notes_user_embedding_idx` i fer benchmark abans i després.
- Primera passada de seguretat a `summarise_notes`: afegir etiquetes de procedència i la passada secundària amb un LLM per filtrar la sortida.
- Començar la configuració de Promptfoo amb 5 casos bàsics d'injecció indirecta.

**Memòria:**
- Avançar la secció 9.2 (disseny de BD amb diagrama ER i taula de polítiques).
- Primer esborrany de la secció 9.4 (disseny de seguretat): taula de Lethal Trifecta per eina i arbre d'atacs de `summarise_notes`.

**Criteris de sortida:**
- Tots els tests d'aïllament de RLS en verd.
- Dades de benchmark recollides per a la secció 11.4.
- `summarise_notes` passa 5 de 5 tests de Promptfoo.

---

### Setmana 4. Agents en segon pla (2026-05-11 a 2026-05-17)

**Codi:**
- Implementar `agent:embedding-backfill` com a Edge Function amb programació via `pg_cron`.
- Implementar `agent:auto-tag` que escriu a la taula `tag_suggestions`.
- Implementar `agent:weekly-digest`.
- Registre d'auditoria dels agents a `agent_events`. Cada acció queda registrada.
- UI: "calaix" d'activitat amb els `agent_events` recents i els suggeriments d'etiqueta amb botons d'acceptar i rebutjar. UI mínima, funcional, no polida.

**Memòria:**
- Primer esborrany de la secció 10 (Implementació): justificar les decisions tecnològiques, incloure fragments de patrons i llistar problemes trobats.
- Actualitzar la secció 9.3 amb l'arquitectura d'agents.

**Criteris de sortida:**
- Els 3 agents corren segons la seva programació al Supabase de desenvolupament.
- La UI permet veure i actuar sobre els suggeriments.
- `agent_events` es va omplint i té la RLS aplicada.

---

### Setmana 5. Enduriment de seguretat i proves de càrrega (2026-05-18 a 2026-05-24)

**Codi:**
- Ampliar la suite de Promptfoo a 15 o més casos red-team que cobreixin: fuga entre tenants via cadena d'eines, injecció d'instruccions via contingut de nota, exfiltració via summariser i atacs de confusió d'etiquetes.
- Implementar mitigacions iterativament. Reexecutar la suite després de cada mitigació.
- Segregació de capacitats: camí de codi separat per a "agent de només lectura" i "agent amb capacitat d'escriptura". Documentar-ho a la memòria.
- Prova de càrrega: 100 tenants concurrents, mesura de p50, p95 i p99 per a cada eina.
- Cablejar l'aprovació humana a `create_note` quan la crida ve d'un client MCP.

**Memòria:**
- Completar la secció 11 (Avaluació). Totes les 5 subseccions poblades amb dades.
- Primer esborrany de la secció 12 (costos). Utilitzar el format del TFG de referència.

**Criteris de sortida:**
- Taxa de mitigació del 80% o més a Promptfoo després de les mesures.
- Informe de la prova de càrrega inserit a la memòria.
- Els 30 o més tests unitaris i d'integració en verd.
- Demo enregistrada amb Claude Desktop (cas d'estudi).

---

### Setmana 6. Empenta final a la memòria i capítols legals i ètics (2026-05-25 a 2026-05-31)

**Codi:** congelat. Només correccions de bugs.

**Memòria:**
- Esborrany complet de la secció 13 (legislació): RGPD, LOPDGDD, LSSI i cites d'articles concrets.
- Esborrany complet de la secció 14 (implicacions ètiques, igualtat i medi ambient).
- Esborrany complet de la secció 15 (valoració personal).
- Esborrany de la secció 16 (bibliografia). Recollir totes les cites i formatar-les en APA 7.
- Començar la secció 17 (annexos): instal·lació, ús, schemes d'eines i YAML de la suite Promptfoo.

**Administració:**
- Enregistrar un vídeo de demo (2-3 minuts) per a l'annex.
- Verificar que el repositori està apte per ser públic (cap variable d'entorn sensible, README polit).

**Criteris de sortida:**
- La memòria té un primer esborrany complet de cada secció.
- La bibliografia està completa.

---

### Setmana 7. Polit final i entrega (2026-06-01 a 2026-06-05)

- **Dia -5 (dilluns 01).** Relectura completa, correcció d'errates i repàs de coherència.
- **Dia -4 (dimarts 02).** Repàs de qualitat dels diagrames. Exportacions PNG i SVG. Verificació APA 7.
- **Dia -3 (dimecres 03).** Enviar l'esborrany a 1 o 2 revisors (Marc Sánchez si està disponible, més un company tècnic). Arreglar el més evident.
- **Dia -2 (dijous 04).** Edició final. Exportació a PDF. Repàs de la llista de verificació.
- **Dia -1 (divendres 05).** **ENTREGA DE LA MEMÒRIA**.

**Després de l'entrega (2026-06-06 a 2026-06-14):** preparació de la defensa.
- Presentació (pressupost de 15 minuts).
- Guió de la demo amb Claude Desktop en viu.
- Assajar 3 o més cops. Preveure les preguntes del tribunal (vegeu `05-defense-points.md`).

---

## Registre de riscos

| Risc | Probabilitat | Impacte | Mitigació |
|---|---|---|---|
| Canvi incompatible a l'especificació MCP durant la implementació | Baixa | Alt | Fixar versió del SDK; deixar anotada la versió de l'especificació a la memòria |
| Saturar els límits de les Edge Functions de Supabase durant els tests | Mitjana | Mitjà | Provar en un projecte aïllat; fer servir Supabase local per a la càrrega |
| Tall del servei de Gemini durant la demo | Baixa | Mitjà | Tenir un vídeo de demo alternatiu; afegir mode manual de fallback |
| Memòria infravalorada, crunch de temps | **Alta** | **Alt** | Començar a escriure a la setmana 1. No deixar l'escriptura per a la setmana 6 |
| Tutor no respon al canvi d'abast | Baixa | Baix | Marc Sánchez ja va donar llibertat oberta; documentar-ho al registre de decisions i continuar |
| Malaltia o col·lisió amb exàmens | Mitjana | Alt | Marge d'un dia a la setmana 4 més marge a la setmana 7 (la preparació de defensa pot moure's 2 o 3 dies) |
| Scope creep ("només una eina més") | **Alta** | **Alt** | Tancar l'abast al final de la setmana 1. Les peticions fora d'abast van a la secció de "treball futur" |

---

## Ritme diari sostenible

- **Bloc de matí (2 h).** Codi, feina de concentració.
- **Bloc de tarda (2 h).** Escriptura de la memòria o tests.
- **Vespre (1 h opcional).** Recerca, lectura, administració lleugera.
- Diumenge lliure com a mínim. Si es crema a la setmana 4, es mata la setmana 6.

---
