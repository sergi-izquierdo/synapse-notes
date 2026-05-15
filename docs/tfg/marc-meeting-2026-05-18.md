# Reunió tutoria 2026-05-18 — Marc Sánchez

**Estudiant:** Sergi Izquierdo Segarra
**TFG:** Synapse Notes — Servidor MCP segur per a una aplicació de notes amb RAG
**Entrega 1a convocatòria:** 2026-06-05 (19 dies de marge des d'avui)

---

## Context (60 segons, llegir abans de la reunió si es pot)

Des de la darrera reunió he tancat **dues capes de seguretat al codi** i la documentació corresponent al memoir:

- **D3** (LLM-as-judge a `summarise_notes`) i **D4** (cost-safety: kill-switch + allowlist + caps de proveïdor) lliures en producció a `synapse-notes.vercel.app`.
- **Suite Promptfoo de 36 variants** (30 atacs en 5 categories + 6 legit baseline) executada contra producció amb D3 ON i OFF. Resultats: 96.7% detection rate, 0% false positives, **0/30 exfiltracions reals als dos modes**. La capa D2 (system prompt restrictiu) sola captura tot el suite; D3 segueix justificat per 4 raons operatives documentades a §8.4.
- §8.4 "Red team amb Promptfoo" escrita amb 3 figures pgfplots natives i taula comparativa.
- §6.5 "Disseny de seguretat" escrita aquesta setmana amb el marc Lethal Trifecta de Willison, una matriu eina-per-eina, i les 5 capes de defensa.

També he polit dues features per a una entrevista de feina (Hablo, 2026-05-13) que afegeixen valor al TFG sense canviar el plantejament: "Today's Brain" (card auto-summary setmanal amb Haiku) i toggle 2D/3D al graph viewer.

---

## Estat de la memòria per capítol

| Capítol | Estat | Pàgines aprox |
|---|---|---|
| 1 Portada | ✅ | 1 |
| 2 Resum (CA/ES/EN) | ✅ | 1 |
| 3 Introducció | ✅ Setmana 1, repassat al re-scope Part A/B | 4 |
| 4 Paraules clau | ✅ | 1 |
| 5 Objectius | ✅ amb mapping a competències URV | 3 |
| 6 Planificació | ✅ taules de fases + riscs; falta Gantt visual | 4 |
| 7 Requisits | ✅ 15 RF + 11 RNF + Part A separats | 6 |
| **8 Disseny** | 🟡 **Disseny de seguretat fet aquesta setmana**; arquitectura general, model de dades, MCP server, agents i interfície en TODO stubs | 5 ara, ~15 quan acabat |
| **9 Implementació** | 🟡 Arquitectura general (C4), MCP server, graphify audit, optimistic UI, backlinks, tag suggestions, MCP graph tools FETS; §10.1 hauria d'estar acabat aquesta setmana | 13 ara, ~22 esperat |
| **10 Avaluació** | 🟡 §8.4 Red team Promptfoo FET amb 3 figures; verificació funcional Part A, tests RLS, benchmark, calibratge, graphify audit en TODO | 11 ara, ~18 esperat |
| 11 Costos | ⚪ Stubs | 0 ara, ~3 final |
| 12 Legislació | ⚪ Stubs | 0 ara, ~3 final |
| 13 Ètica/igualtat/medi ambient | ⚪ Stubs | 0 ara, ~3 final |
| 14 Valoració personal | ⚪ Stubs | 0 ara, ~2-3 final |
| 15 Annexos | ⚪ Stubs | 0 ara, ~5 final |

**PDF actual:** ~59 pàgines, 778 KB. Objectiu final: 80-100 pàgines.

**Còdig:** D1-D4 al codi (decisions arquitectòniques majors), MCP 8 tools en producció, Promptfoo + analyze + cleanup scripts. Tests: 58/58 verds. Demo polida.

---

## 3 decisions concretes que necessito d'aquesta reunió

### 1. Scope dels agents (Setmana 4 oficial)

El plan original són **3 agents en Edge Functions de Supabase + `pg_cron`**:

- `agent-embedding-backfill`: cada 15 min, troba notes amb `embedding IS NULL` i les re-embed. **No usa LLM** (només crida Gemini embedding). Risc mínim.
- `agent-auto-tag`: cada hora, llegeix notes recents, proposa tags via Haiku, escriu propostes a `tag_suggestions` per a aprovació humana.
- `agent-weekly-digest`: diumenge nit, agrega l'activitat setmanal de l'usuari (variant més robusta del que ja existeix al dashboard "Today's Brain").

Cadascun ha d'escriure a `agent_events` (audit trail), i la UI ha d'incloure un activity-drawer per visualitzar-los.

**El meu càlcul:** 5 dies (Mon-Fri) per construir els 3 + memoir §9.3 (arquitectura agents). Setmana 5 hauria de ser load test + Promptfoo expansion + memoir §11. Setmana 6 és memoir-only (capítols 11-15). Setmana 7 és polit final.

**Opcions:**

- **(a) Construir els 3 com previst.** Risc: si surt un bug d'integració d'Edge Functions, em menjo el temps de polit de la memoir. Setmana 5 queda apretada.
- **(b) Construir només `embedding-backfill`** (el més simple, sense LLM downstream, valor immediat: notes que s'havien desat amb embedding null perquè la quota de Google va caducar ara apareixen al RAG i al graph). Documentar els altres 2 al capítol "treball futur" amb diagrames de disseny complets però sense codi.
- **(c) Document-only: cap agent implementat aquesta setmana**, dedicar les hores a polit profund del memoir (§10 implementació, §11 costos, §12 legislació). Justificar la decisió a §14 Valoració personal com a triatge realista de scope.

**Què prefereix Marc?** Personal lean cap a (b): l'agent més simple lliura valor real (notes que tornen al RAG), els altres dos queden a un nivell de detall que el tribunal pot examinar al disseny, i la memoir guanya 2-3 dies extra de polit.

### 2. Promptfoo: ampliació o aturar?

§8.4 actual: 30 atacs + 6 legit = 36 variants. Detection rate 96.7%, FP 0%, 0 exfiltracions reals.

Anàlisi defensable: la mostra és petita per a conclusions estadístiques sòlides; el long tail (paràfrasis automàtiques, atacs combinats, multilingüe avançat) no està explorat.

**Opcions:**

- **(a) Ampliar a 100+ variants** (~$1 cost Anthropic, ~3-4 h treball d'autoria de variants + 1 h re-run + 1-2 h re-anàlisi). Robustesa estadística reforçada. Risc: distreu del polit del memoir.
- **(b) Mantenir 36 variants i citar la limitació de mostra honestament al text.** Ja s'està fent així ara. Tribunal pot preguntar.

Què prefereix Marc?

### 3. Ton i contingut de §14 Valoració personal

La guia ETSE demana reflexió personal honesta. Tinc dificultats per a decidir el nivell adequat: 

- Sobre coses que NO van funcionar bé (rewrites, bugs trobats tard, decisions que vaig recular).
- Sobre tensions reals durant el projecte (re-scope a Setmana 1, decisió Part A/B, replantejament del MCP).
- Sobre lliçons que valen la pena fora del codi (gestió de temps, decisions de scope, com he treballat amb LLMs durant tot el desenvolupament).

**Preguntes per a Marc:**

- Quin nivell de "honestedat tècnica" valora el tribunal? Un capítol que diu "vaig recular aquesta decisió" pot ser interpretat negatiu, o és justament el que volen?
- Vols veure un primer esborrany abans de l'entrega oficial (Setmana 7) o prefereixes llegir-lo directament al PDF final?
- Té sentit incloure una **meta-reflexió** sobre l'ús de Claude Code durant el desenvolupament? El TFG és sobre un agent server (Part B), i jo mateix he treballat amb un agent intensament. Crec que té valor com a primary source.

---

## Preguntes ràpides addicionals

- **Revisió pre-entrega**: estaria disponible per ser un dels 1-2 revisors de la setmana 7? Enviaria un esborrany dimecres 03 de juny i necessitaria feedback dijous 04 per a l'entrega divendres 05.
- **PDF actual**: vol veure'l ara o esperem a tenir més contingut? El puc enviar per correu o portar imprès dilluns.
- **Tribunal**: hi ha algun membre concret del tribunal a qui voldria que el discurs anés dirigit? L'angle de seguretat (Lethal Trifecta, D3, defense-in-depth) està molt elaborat; si el tribunal és més clàssicament d'arquitectura de software, hauria de balancejar.

---

## Material per portar a la reunió

- [ ] PDF actualitzat del memoir (impressió o pantalla)
- [ ] Aquesta agenda (per estructurar la conversa)
- [ ] Decision log `docs/tfg/00-decision-log.md` (D1-D4 + D5 stub)
- [ ] Demo live a `synapse-notes.vercel.app` si pot connectar
- [ ] Screenshots o screencast curt de Today's Brain + graph 3D (si hi ha temps)
- [ ] Llapis / iPad per prendre notes de feedback

---

## Notes per a després de la reunió

(Omplir durant o just després de la reunió, no abans.)

### Decisions preses

-

### Action items (deadline)

-

### Coses que Marc vol veure específicament

-
