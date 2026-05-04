# Setmana 3 — Kickoff (2026-05-04)

**Per a:** la propera sessió / el proper agent que continuï el TFG.
**Estat al moment d'escriure-ho:** Setmana 2 tancada al 100%, working tree net a `main @ 6a22bd9`.

## On érem

Setmana 2 va lliurar el servidor MCP complet (8 tools + 2 resources + 1 prompt), tests
verds (24/15), memoir §9.1 + §9.3 visibles, deploy a producció, i va deixar un
**baseline empíric de prompt-injection sobre `summarise_notes`** (vegeu `00-decision-log.md` D3 i el Setmana 2 progress-log row a `extend.md`).

5 commits aquesta setmana, sense Claude attribution:

```
6a22bd9 docs(tfg): log Setmana 2 verification + red-team baseline for D3
328f377 fix(mcp): set user_id explicitly in createNote so RLS INSERT passes
e16a8c7 fix(tfg): float package + relative figure paths so memoir builds
36c1558 docs(tfg): close Setmana 2 — memoir §9.1 + §9.3 + plan + figures
632798c feat(mcp): 5 tools + resources + daily-review prompt with rls passthrough
```

## Decisió a prendre primer

**Setmana 3 té dues vies viables**, ambdues alineades amb `docs/tfg/04-gantt.md`. Trieu una abans de res:

### Via (A) — Tancar el cercle de seguretat: D3 LLM-as-judge + Promptfoo

**Què lliurarà:**

- Implementar el filtre de sortida `summariseNotesWithFilter()` al servei: segona crida a Haiku 4.5 sense tools, prompt-classificador, output rebutjat o neutralitzat si es detecta injection.
- Setup de Promptfoo amb 50-100 variants d'atac (paràfrasis del IGNORE PREVIOUS INSTRUCTIONS, encodings base64/ROT13, role-play DAN, multilingual jailbreaks, multi-turn).
- Mètrica: taxa de detecció amb filtre ON vs OFF — el "valor marginal" del filtre per a §11.3.
- Memoir §9.4 "Disseny de seguretat" i §11.3 "Avaluació Promptfoo" guanyen contingut visible.

**Pros:** és el contribut central del TFG (la part "research" del projecte), produeix números defensables al tribunal, i tanca la història de la Lethal Trifecta. **El més impressionant per al jurat.**

**Cons:** és la setmana més arriscada — els resultats del red-team poden ser sorpresos i requerir iteracions del prompt. Pressupost de cost a vigilar (Haiku 4.5 a Promptfoo es pot escalar ràpid).

**On començar:**

1. Llegir `00-decision-log.md` D3 (línia 147+) — el disseny ja està documentat.
2. Crear `src/lib/mcp/services/output-filter.ts` (o similar) amb la segona passada Haiku.
3. Wrapping a `summarise_notes` tool perquè el filtre s'apliqui sempre.
4. Setup Promptfoo: `npm install -D promptfoo` (ja a dev deps), config a `tests/security/summarise-redteam.yaml`.
5. Generar 50 variants amb una mix de patterns documentats al baseline.
6. Mesurar i escriure §11.3 (baseline + amb filtre).

### Via (B) — Polish del memoir §10 Implementació

**Què lliurarà:**

- Les 13 subseccions de `tfg/sections/09-implementacio.tex` que actualment són LaTeX-commented scaffolding (sec:graphify-audit, sec:optimistic-ui, sec:bulk-delete-chats, sec:drag-fractional, sec:neural-graph, sec:graph-physics, sec:tag-suggestion, sec:tag-management, sec:mcp-graph-tools, sec:backlinks, sec:graph-polish, sec:title-and-autocomplete, sec:search-path-bug) passen a tenir prosa visible al PDF.
- §9.2 "Migració SQL per a MCP i agents" omplenat (ara és un stub).
- §9.4 "Agents en segon pla" i §9.5 "Decisions destacades" omplenats.
- PDF passa de 48 pàgines a aproximadament 80-100 pàgines.

**Pros:** és treball de redacció pur, baix risc, predictible en temps. Apropa la memòria al lliurament del 5 de juny.

**Cons:** no produeix contribucions noves de codi. La part "research" segueix pendent fins a Setmana 5.

**On començar:**

1. `tfg/sections/09-implementacio.tex` línia 28 (sec:graphify-audit) — descomentar i reescriure com a prosa visible. La majoria de subseccions ja tenen el material — només cal treure els `%` i refinar.
2. Compilar amb `lualatex + biber + lualatex × 2` per veure progres.
3. Refinar les figures al `tfg/figures/` (mmdc compila a PDF/SVG segons toolchain).

### Recomanació

**(A) per defecte** si l'usuari no expressa preferència. Justificació: la part B del TFG (MCP + seguretat) és el diferenciador respecte un projecte de notes "vanilla", i sense els números de Promptfoo el §11 queda buit. La redacció (B) pot fer-se a Setmana 6 quan ja tinguem tots els resultats.

## Toolchain al laptop (ja instal·lat)

- Node 24 + npm 10
- MiKTeX 25.12 (lualatex + biber a `C:/Users/sergi/AppData/Local/Programs/MiKTeX/miktex/bin/x64`)
- Mermaid CLI 11.14.0 (`mmdc` global)
- Vercel CLI 52.2.1 — autenticat, projecte enllaçat a `synapse-notes`
- `.env.local` pullat des de Vercel production (26 vars)

Memoir build: des de `tfg/`,

```bash
mmdc -i figures/c4-context.mmd -o figures/c4-context.pdf
mmdc -i figures/c4-containers.mmd -o figures/c4-containers.pdf
mmdc -i figures/mcp-oauth-sequence.mmd -o figures/mcp-oauth-sequence.pdf
lualatex -interaction=nonstopmode main.tex
biber main
lualatex -interaction=nonstopmode main.tex
lualatex -interaction=nonstopmode main.tex
```

PDF surt a `tfg/main.pdf` (gitignored).

## Quick commands

| Need | Command |
|---|---|
| Run dev server | `npm run dev` (3000) |
| Run tests | `npx vitest run` |
| Typecheck | `npx tsc --noEmit` |
| Lint | `npx eslint src/` |
| Get fresh JWT | Console snippet at `_active.md` (cookie chunks for `sb-ilcajfngpxehmwkqjqwt-auth-token`) |
| MCP Inspector | `npx @modelcontextprotocol/inspector` (transport: Streamable HTTP, URL: `http://localhost:3000/api/mcp`) |
| Production deploy | `vercel --prod --yes` (auto-deploy from git is broken per memory) |
| Refresh `.env.local` | `vercel env pull .env.local --environment=production` |

## Claude Desktop wire-up template

Si volguéssim verificar el "real-world host" loop, afegir a `~/.claude/claude_desktop_config.json` (o `%APPDATA%\Claude\claude_desktop_config.json` a Windows):

```json
{
  "mcpServers": {
    "synapse-notes": {
      "type": "http",
      "url": "https://synapse-notes.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer <JWT>"
      }
    }
  }
}
```

Reiniciar Claude Desktop. JWT del cookie snippet (1h expiry).

## Cleanup pendent

- Nota 27 (`[REDTEAM] Trifecta probe`) viu encara al corpus de l'usuari `d8303657-49fc-49d4-8a10-f73c31ef5010`. Per a treure-la del dashboard sense esborrar el record (es pot voler conservar per al §11.3): `update_note({ id: 27, tags: ["redteam-archived"] })` via MCP, després archive des de la UI.

## Memòria persistent rellevant

A `C:/Users/sergi/.claude/projects/C--GitHub-synapse-notes/memory/`:

- `feedback_no_claude_attribution.md` — commit-message hygiene
- `feedback_pg_search_path_syntax.md` — Postgres `set search_path = a, b` sintaxi (no quotes)
- `feedback_radix_nested_portal_clicks.md` — pointer-events + onInteractOutside dance
- `feedback_flex_min_h_0_scroll.md` — flex + overflow-y-auto + min-h-0 rule
- `project_backlinks_and_mentions.md` — `[[N]]` + `@` + `#` autocomplete + tag chips snapshot
- `project_graph_viewer.md` — graph viewer architecture
- `project_graphify_audit.md` — 2026-04-24 audit findings (380 nodes / 427 edges)
- `project_ui_refresh.md` — UI refresh historical context
- `tfg_decision.md` — Option C pivot, tutor Marc Sánchez

A `C:/SecondBrain/_raw/projects/synapse-notes/`:

- `_active.md` — live thread (refreshed at session boundaries)
- `tfg-extend.md` — index file pointing to `docs/tfg/extend.md`
- `MEMORY.md`, `project_synapse_notes.md` — older snapshots

---

**Bona feina i bona setmana 3!**
