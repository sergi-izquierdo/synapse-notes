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
