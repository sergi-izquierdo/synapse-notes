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

**Resolució:** _2026-04-23, commit `3ae6f3f` (`fix(ui/chat): scroll,
LLM note recognition, star anchor on cards`)._ Tres canvis a
`src/app/api/chat/route.ts`:

1. `match_threshold` 0.1 → **0.05** i `match_count` 10 → **20** — el
   cas típic (15-30 notes) ara rep una passada completa.
2. Afegit un **inventari a nivell de títol** al `systemPrompt`
   (`📚 EVERY NOTE (title-level inventory — one line per note)`) amb
   primer línia no-buida + llista de tags per cada nota viva. El
   model "sap" sempre que existeixen les notes encara que la RAG no
   les retorni al top-20.
3. System prompt reestructurat amb 3 prioritats: (1) resposta des
   del MEMORY, (2) reconèixer des de l'INVENTORY i cridar
   `getNotesByTag` si una nota hi consta però el cos no està al
   MEMORY, (3) tools. Frase explícita: *"Never tell the user a note
   doesn't exist if it is listed in the INVENTORY"*.

Inventari filtra per `archived_at IS NULL` per no inflar el context
amb files arxivades.

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

### Fase QoL-4 — Tags refinement ✅

- [x] **Tag autocomplete** amb freq count al TagSelector (opcional
      `tagCounts` prop; sort by count desc, alpha tie-break)
- [x] **Multi-tag filter** — FilterBar passa a multi-select via
      `TagSelector(allowCreate=false)`; chips eliminables, AND filter
- [x] **Keyboard quick-filter 1/2/3** — GlobalShortcuts dispatcha
      `notes-filter-top-tag` amb detail.index, NoteGrid resol al top-N
      tag i fa toggle
- [x] **Tag chip click** al card → toggle del filtre per aquell tag;
      estat actiu amb tint primary a la badge

### Fase QoL-5 — Settings page expansion ✅ (parcial)

La `/settings` actual és mínima. Expansió completa.

- [x] **Profile card** — avatar OAuth (`user_metadata.avatar_url|picture`),
      display name, email, nota + chat counts. Provider detectat via
      `identities[0].provider`.
- [x] **Appearance** — theme picker light/dark/system (3 botons
      cards), Language card separat.
- [x] **Data (export)** — JSON (lossless, inclou embeddings-less
      payload) i Markdown (editorial-friendly, dropable a Obsidian).
      Download client-side via `Blob` + anchor.click().
- [x] **Tags manager** — llista ordenada per freq, rename inline amb
      Enter/Esc (renaming a un tag existent = merge + dedupe),
      delete amb confirmació.
- [x] **Keyboard shortcuts reference** — botó que obre el
      `<KeyboardShortcutsDialog>` existent (font única).
- [x] **Chats** — clear all chats amb counter + confirmació.
- [x] **Session** — `signOut({ scope: 'global' })` revoca tots els
      refresh tokens i redirecta a /login.
- [x] **Danger zone: delete all notes** — amb counter + confirmació.
- [ ] **Danger zone: delete account** — requereix admin API
      (service_role) + row cleanup; deferit.
- [ ] **Data (import)** — MD drag-drop parser; deferit.

Settings page passa de CSR pur a RSC que carrega profile+counts+tags
abans d'entregar la vista al client.

### Fase QoL-6 — Chat mechanics ✅

Features de xat que Claude Desktop, ChatGPT, Cursor tenen.

- [x] **Regenerate response** — `regenerate({ messageId })` del AI SDK
      + `deleteMessageAction` per netejar la fila stale. El route
      detecta `trigger === 'regenerate-message'` i NO re-insereix el
      missatge user (ja persistit).
- [x] **Edit user message + re-run** — inline textarea dins la bubble;
      `deleteMessageAndFollowingAction` prunes, setMessages local
      trim, després sendMessage amb el contingut editat.
- [x] **Copy message** — botó hover a cada bubble, `navigator.
      clipboard.writeText` amb check icon feedback (1.2s).
- [x] **Export conversation** — botó Download al header del chat;
      `exportChatAsMarkdownAction` genera MD amb H2 per torn i
      slug del títol al filename.
- [x] **Branch chat** — `branchChatAction(chatId, pivotMessageId)`
      crea nova conversa amb títol `↳ <original>` i copia fins al
      pivot inclusiu; client fa loadChat al nou chatId.

Requisits per funcionar:
- UI message ids s'han d'alinear amb DB ids. `onFinish` del client
  fa `loadChatMessages(chatId)` amb 600ms de delay per esperar al
  server-side insert. Fins que no es sincronitza, les accions queden
  disabled via check regex UUID v4.
- Nova columna `messages.trigger` **no** cal — el flag viatja dins
  el body del request i el server el consumeix.

### Fase QoL-7 — Mobile + misc visuals ✅ (parcial)

- [x] **Archive notes** — migration `20260424200000_notes_archived.sql`
      (`archived_at timestamptz` + partial index
      `notes_user_live_created_idx` on `archived_at IS NULL`).
      `archiveNote` / `unarchiveNote` accions. Dashboard query filtra
      `.is('archived_at', null)`. Settings mostra
      "X notes · Y archived · Z chats" i calcula counts per estat.
- [x] **Skeleton loading** — `loading.tsx` ara reflecteix el layout
      real (chat rail + main + grid) amb `animate-pulse` i stagger
      via `animation-delay`.
- [x] **Empty state il·lustrat** — SVG inline (stack de cards amb
      línies opacity-decreasing) + hint al shortcut `N`. Només es
      mostra quan `notes.length === 0`, no amb filtres actius.
- [~] **Integrar 21st.dev Animated AI Input** — descartat. L'auto-
      resize de QoL-1 cobreix el cas; afegir una dependència
      external per un micro-affordance no val el cost.
- [~] **Swipe actions mobile** — descartat. El hover cluster ja és
      always-visible a mobile (`opacity-100 md:opacity-0
      md:group-hover:opacity-100`), cosa que és més descoberta que
      swipe i no conflicta amb el tap-to-edit.
- [x] **Bottom sheet compose** — `<ComposeZone>` wrapper: inline form
      a `md+`, FAB + `Sheet side="bottom"` a mobile. `n` shortcut
      cau al dispatch de `compose-open` si no troba la textarea
      desktop (mobile no la mounta fins obrir el sheet).
- [x] **Tactile haptics** — `navigator.vibrate(10)` al toggle de
      checkbox dins `NoteMarkdown`. Feature-detected.

### Merge strategy

Cada fase = 1 o 2 commits, agrupats. Quan 3 fases consecutives siguin
verdes, merge al main (petits PRs en lloc d'un sol PR monstre).
Preferible acabar QoL-1 → merge feat/ui-refresh → seguir la resta en
branches noves (`feat/qol-2`, etc.) per tenir diffs revisables.

### Fora d'abast (explícit)

- **Attachment file upload** al chat — requereix Supabase Storage i
  gestió de filets. Quedar per post-TFG.
- **Custom keyboard shortcuts** (usuari defineix els seus) — overkill.

---

## 3. Post-merge bug fixes (2026-04-23)

Totes les QoL-1…7 van ser fusionades a `main` via
`addbc50 Merge feat/ui-refresh: UI refresh + QoL-1…7`. La finestra
de revisió a production va destapar vuit bugs i un forat RLS, tots
corregits el mateix dia. Cada fix té el seu commit específic.

### Correccions visuals

- [x] **Background Paths invisible en light mode** — la classe era
      `text-foreground/10 dark:text-primary/25`, ~10% de foreground
      sobre un card pàl·lid no es veia. Canvi a
      `text-primary/35 dark:text-primary/25` (mateix ambre a les
      dues variants, opacitat una mica més alta en light perquè el
      fons blanc no l'empasti). Commit `41bc61b`.
- [x] **Fonts no uniformes al xat i als cards** — Literata (serif
      editorial) sagnava als bubbles de l'assistent i al prose dels
      cards via `.prose { font-family: var(--font-body) }` global +
      classes `font-body` explícites. Read com a "fonts diferents a
      cada superfície". Eliminat l'override global i les dues
      classes explícites; tot hereta ara Inter Tight. `.font-body`
      queda com a utilitat opt-in. Commit `3710693`.
- [x] **Card amb estrella semi-transparent** — `bg-primary/[0.03]`
      sobreescrivia `bg-card` (tailwind-merge) i deixava passar el
      fons animat. Substituït per
      `bg-[color-mix(in_oklch,var(--primary)_7%,var(--card))]` —
      sòlid, ambre-tint estable. Commit `41bc61b`.
- [x] **Estrella "flotant" al mig del card** — quan els altres
      botons (Duplicate/Archive/Delete) estaven `opacity-0` en
      escriptori, el cluster right-aligned deixava l'estrella al
      costat esquerre de 3 espais invisibles. Moguda a l'últim fill
      del flex row perquè, quan els altres estan amagats, quedi
      ancorada al `top-2 right-2`. Commit `3ae6f3f`.
- [x] **Chip flotant buit sota bubbles al mòbil** — la caixa del
      `<MessageActions>` tenia `bg-background + border + shadow-sm`
      sempre visibles i només els botons interiors tenien
      `opacity-0 group-hover:opacity-100`. A mòbil (sense hover)
      quedava un chip blanc buit cobrint el bubble. Moguda la
      transició d'opacitat al contenidor sencer amb el patró
      `opacity-100 md:opacity-0 md:group-hover:opacity-100` que ja
      gastem a les cards. També bump de `gap-5 → gap-8` al
      contenidor de missatges perquè el chip no toqui el bubble de
      sota. Commit `3710693`.

### Correccions estructurals

- [x] **Sidebar del xat massa comprimida al mòbil** — la `Sheet` de
      85vw intentava encabir els 48w d'historial + la conversa, i a
      telèfon les respostes quedaven a una paraula per línia.
      Afegit `mobileView: 'list' | 'chat'` state: `loadChat` /
      `createNewChat` canvien a `'chat'`; botó `<ChevronLeft>`
      al header (només `md:hidden`) torna a la llista. A `md+`
      tots dos panells continuen renderitzant-se alhora. Commit
      `41bc61b`.
- [x] **El xat no tenia scroll** — la `ScrollArea` vivia en un
      flex-col sense `min-h-0`, i el fill creixia més enllà de
      l'alçada del pane en comptes d'encabir-se i scrollar. Afegit
      `min-h-0` al classe del `ScrollArea`. Commit `3ae6f3f`.
- [x] **Avisos d'a11y `Missing Description or aria-describedby` al
      DialogContent** — el bottom sheet del compose i el sheet del
      chat mòbil no tenien `SheetDescription`. Afegit (visible al
      compose, `VisuallyHidden` al chat on el títol ja està
      visually-hidden). Commit `41bc61b`.

### Correccions funcionals

- [x] **L'assistent no trobava notes existents ("Noms de gat")** —
      veure §1 d'aquest backlog per detall. Resolt al commit
      `3ae6f3f` amb threshold 0.1→0.05, match_count 10→20, i
      inventari de títols dins del system prompt.
- [x] **Shortcut `?` bloquejava escriure interrogants** — el
      handler global capturava `e.key === "?"` fins i tot dins de
      textareas. Canvi a **F1** (rarament reclamat per navegadors,
      històricament "help"), amb `preventDefault` per matar la
      pestanya d'ajuda de Firefox. F1 ara és l'únic shortcut que
      dispara dins d'inputs. Commit `7c1a684`.
- [x] **Shortcuts mostraven només `⌘` (Mac)** — els handlers
      acceptaven `metaKey || ctrlKey` des del principi, però el
      `<KeyboardShortcutsDialog>` pintava només `⌘`. Afegida
      detecció de plataforma via `userAgentData.platform ||
      navigator.platform` i substitució d'un sentinel `MOD` a la
      taula de shortcuts (declaratiu, una sola línia per
      combinació). Ara apareix `Ctrl` a Windows/Linux. Commit
      `7c1a684`.
- [x] **Regenerate duplicava bubbles en comptes de reemplaçar-los**
      (root cause: RLS) — `deleteMessageAction` i
      `deleteMessageAndFollowingAction` cridaven
      `supabase.from("messages").delete()` i supabase-js retornava
      `error: null` amb 0 files afectades. La taula `public.messages`
      tenia RLS activa amb INSERT + SELECT però **no** DELETE ni
      UPDATE, exactament el mateix patró que vam corregir a `chats`
      UPDATE el 2026-04-23. Nova migració
      `20260424220000_messages_delete_update_policy.sql` afegeix
      `"Users can delete messages of their chats"` i
      `"Users can update messages of their chats"`, totes dues
      ancorades en `exists (select 1 from chats c where c.id =
      messages.chat_id and c.user_id = auth.uid())`. Aplicada al
      remot via MCP (`apply_migration`). Commit `b4c5b01`.

### Migrations aplicades en aquesta sessió

| Timestamp (local) | Nom | Què fa | Com |
|---|---|---|---|
| 20260424120000 | `notes_starred` | `starred boolean default false` + índex compost `notes_user_starred_created_idx` | Aplicada via MCP (QoL-3) |
| 20260424200000 | `notes_archived` | `archived_at timestamptz` + índex parcial `notes_user_live_created_idx` on `archived_at IS NULL` | Aplicada via MCP (QoL-7) |
| 20260424220000 | `messages_delete_update_policy` | DELETE + UPDATE policies a `public.messages` scoped per chat owner | Aplicada via MCP (post-merge fix) |

### Deploy a production

- **Push:** `9669b28..addbc50 main -> main` (merge commit) +
  `addbc50..3710693` (font fix) + `3710693..3ae6f3f` (scroll/RAG/
  star) + `3ae6f3f..7c1a684` (F1 / cross-platform) + `7c1a684..b4c5b01` (RLS policy).
- **Vercel:** el GitHub integration no va autodeployar del push a
  `main`, així que vam instal·lar Vercel CLI i llançar
  `vercel --prod --yes`. Produït `dpl_HGq2GGhLEg6pwh5ShDP4saafyVRU`
  (primer deploy) i successius per cada fix. Tots aliased a
  `https://synapse-notes.vercel.app` (també accessible via
  `synapse-notes-fn59vg9pi-sergis-projects-2e66a325.vercel.app` i
  URLs posteriors).
- **Follow-up pendent:** investigar a
  **Vercel → synapse-notes → Settings → Git** per què el push-to-
  main no dispara build automàtic. Hipòtesi: integration pausada o
  production branch mal configurada. Tornar-ho a mirar a Setmana 3.

