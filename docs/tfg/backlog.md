# Backlog — known issues i follow-ups del projecte

Registre de bugs funcionals i TODOs que **no formen part del scope
actiu** però cal resoldre abans de l'entrega final del TFG. Es
revisarà en tancar cada branca major (p. ex. `feat/ui-refresh` →
repassar aquest fitxer abans de merge).

Cada entrada ha de tenir: data de detecció, evidència, hipòtesi de
causa, on mirar, i (quan es resolgui) commit que la tanca.

---

## 1. RAG: recall insuficient a queries en català singular/plural

**Detectat:** 2026-04-23, durant la review de UI-4.

**Evidència** (chat a production):

> **User:** "Noms de gats?"
> **AI:** *"Segons la memòria que tinc, només hi ha una nota amb el
> contingut 'Test', que no conté cap nom de gats. No puc veure una
> llista de noms de gats a les notes actuals. Les etiquetes
> disponibles són 'Idees' i 'Compra', però cap d'elles sembla ser
> específica per a gats. Vols que cerqui en alguna de les categories
> disponibles?"*

A la base de dades existeix la nota:

> *"Noms de gat: Kuro, Shiro"* (tag: Idees)

El model NO hauria d'haver dit "només hi ha una nota amb el contingut
'Test'". La nota existeix, és rellevant i està indexada amb embedding.

**Hipòtesis de causa (per verificar):**

1. **Embedding mismatch singular/plural.** La query *"gats?"* produeix
   un vector que no queda prou a prop del vector de *"Noms de gat:
   Kuro, Shiro"* (singular vs plural + signe de pregunta). El llindar
   `match_threshold: 0.1` a `/api/chat/route.ts:41` hauria de ser prou
   permissiu, però el top-N pot quedar dominat per notes irrellevants
   més properes.
2. **El model no intenta tools agressivament.** El system prompt a
   `/api/chat/route.ts` diu *"ONLY use the 'getNotesByTag' tool if the
   user explicitly asks for a list, category, or tag"*. Una pregunta
   com *"Noms de gats?"* no sol·licita explícitament una etiqueta, així
   que el model no crida `getNotesByTag('Idees')` tot i que seria la
   ruta correcta.
3. **Inducció incorrecta des del RAG context.** El `systemPrompt`
   concatena les 10 notes més properes al context. Si entre aquestes
   10 no hi ha la de "Noms de gat" (per raó 1), el model respon
   només amb les que veu, i s'estable en *"només hi ha 'Test'"*.

**On mirar:**

- `src/app/api/chat/route.ts` — ajustar `match_threshold` a 0.15-0.2,
  o augmentar `match_count` a 20.
- El system prompt: afegir *"si l'usuari pregunta per un tema concret
  i el context no el conté, intenta cridar `getNotesByTag` amb les
  etiquetes més properes abans de dir que no saps"*.
- `/api/mcp` (no aplica ara, però el problema es repetirà a Setmana
  3-5 amb el red-team suite): documentar el llindar OCK al
  capítol 11 de la memòria.

**Prioritat:** mitjana. No bloqueja entrega però afecta la
credibilitat de la demo (el tribunal pot preguntar pel recall i ara
la resposta és fluixa).

**Commit que ho tanca:** _pendent_.

---

## 2. UI Quality-of-Life roadmap

Llista completa de millores QoL proposades el 2026-04-23 durant la
revisió final de la branca `feat/ui-refresh`. Totes aprovades pel
Sergi, organitzades en 7 fases per prioritat d'impacte/cost. Cada
fase és un bloc independent, committejables per separat.

### Fase QoL-1 — Fixes crítics + shortcuts bàsics

Bug real + els atajos més demanats d'any en any a apps de notes.

- [ ] **Fix regeneració títols de chat** — `updated: 17` retorna OK
      però RLS silenciosament bloca l'UPDATE (ja tenim `.select()`
      retornant data, però potser falta política UPDATE a la taula
      `chats`). Investigar policies + fix.
- [ ] **⌘Enter / Ctrl+Enter** al compose textarea → save note
- [ ] **⌘Enter** al chat input → send (verificar si form.submit funciona)
- [ ] **Esc** a modals → close (shadcn Dialog ja ho fa, verificar)
- [ ] **Auto-resize** del chat textarea (extret del #6 Animated AI Input)
- [ ] **Timestamps relatius** a note cards (`fa 2h`, `ahir`) via
      `date-fns/formatDistanceToNow`

### Fase QoL-2 — Navigation shortcuts ✅

Accelera el keyboard-first workflow.

- [x] **/** global → focus al search de notes (via `data-search-shortcut`,
      compatible amb i18n EN/ES/CA)
- [x] **N** global → focus al compose textarea (`textarea[name="content"]`)
- [x] **?** global → overlay amb tots els shortcuts disponibles
      (`<KeyboardShortcutsDialog>` + `<GlobalShortcuts>` al dashboard layout)
- [x] **J/K** al sidebar chats → navegar amunt/avall via `CustomEvent`
      (`chat-nav-next`/`chat-nav-prev`)
- [x] **↑** al chat input buit → recuperar última pregunta (`lastPrompt` state)

### Fase QoL-3 — Note features base ✅ (pending `20260424120000_notes_starred.sql`)

Features funcionals que s'esperen de qualsevol note app moderna.

- [x] **Star/pin** nota — columna `starred boolean default false`,
      composite index `notes_user_starred_created_idx`, sort `starred
      desc, created_at desc`. Star button top-right del card, amber
      fill quan pinned.
- [x] **Character count** al compose form (mono tabular sota textarea)
- [x] **Word count + char count** al edit modal
- [x] **Duplicate note** action (icon hover al card, regenera embedding)
- [x] **Toast amb undo** al delete note (5s, re-crea via `restoreNote`
      amb nou embedding — simpler que soft-delete)
- [x] **Hover enhanced** card (footer timestamp always-on; action
      cluster roman hover-only per no saturar)
- [ ] **Recent notes** secció top-3 primerament al dashboard
      *(descartat per ara — la sort starred-first ja cobreix el
      "primerament"; afegir una secció separada fragmenta la pàgina)*

### Fase QoL-4 — Tags refinement

- [ ] **Tag autocomplete** amb freq count al TagSelector
- [ ] **Multi-tag filter** (convertir el current select a checkbox list)
- [ ] **Keyboard quick-filter 1/2/3** per top tags
- [ ] **Tag chip click** al card → filtra notes amb aquest tag

### Fase QoL-5 — Settings page expansion

La `/settings` actual és mínima. Expansió completa.

- [ ] **Profile card**: avatar del provider OAuth, display name, email
- [ ] **Appearance**: theme picker gran (light/dark/system), language
- [ ] **Data**: export all (notes + chats) JSON/MD, import MD drag-drop
- [ ] **Tags manager**: llista, rename, merge, delete
- [ ] **Keyboard shortcuts reference** (taula amb tots els shortcuts)
- [ ] **Chats**: clear all chats
- [ ] **Session**: log out of all devices via Supabase Auth
- [ ] **Danger zone**: delete all notes, delete account

### Fase QoL-6 — Chat mechanics

Features de xat que Claude Desktop, ChatGPT, Cursor tenen.

- [ ] **Regenerate response** al missatge d'assistent
- [ ] **Edit user message** + re-run (pruning subsequent messages)
- [ ] **Copy message** botó al hover del bubble
- [ ] **Export conversation** a MD (download)
- [ ] **Branch chat**: fork des d'un missatge específic

### Fase QoL-7 — Mobile + misc visuals

- [ ] **Archive notes** (`archived_at timestamp` a DB, hide en lloc de
      delete)
- [ ] **Skeleton loading** al note grid inicial (en lloc de spinner)
- [ ] **Empty state il·lustrat** (SVG simple) quan 0 notes
- [ ] **Integrar #6 Animated AI Input** al chat (si QoL-1 auto-resize
      no és suficient)
- [ ] **Swipe actions** a note cards mobile (swipe → delete)
- [ ] **Bottom sheet compose** mobile (drawer des de FAB)
- [ ] **Tactile haptics** mobile al toggle checkbox

### Merge strategy

Cada fase = 1 o 2 commits, agrupats. Quan 3 fases consecutives siguin
verdes, merge al main (petits PRs en lloc d'un sol PR monstre).
Preferible acabar QoL-1 → merge feat/ui-refresh → seguir la resta en
branches noves (`feat/qol-2`, etc.) per tenir diffs revisables.

### Fora d'abast (explícit)

- **Attachment file upload** al chat — requereix Supabase Storage i
  gestió de filets. Quedar per post-TFG.
- **Custom keyboard shortcuts** (usuari defineix els seus) — overkill.

