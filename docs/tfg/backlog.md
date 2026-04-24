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

---

## 4. Reactivity + chat management (2026-04-24)

Segona ronda de polishing a `main`, tota directa al branch principal
seguint la instrucció del Sergi *"qualsevol altre canvi d'interfaç el
treballem allí directament"*.

### Reactivitat a les cards de notes

- [x] **Star/archive/delete amb `useOptimistic`** — el round-trip
      (action → Supabase → `revalidatePath` → render) es notava com a
      ~1-2 s entre el clic i el canvi d'estat visible. Solució: nova
      capa optimista sobre la prop `notes` dins `NoteGrid` via
      `useOptimistic` de React 19. Dues formes d'acció: `patch`
      (merge de camps, p. ex. `{ starred: !current }`) i `remove`
      (filtra la nota fora, per a archive/delete). Cada handler
      s'embolcalla en `useTransition` i crida `applyOptimistic(...)`
      abans d'awaitar la server action; React descarta la capa
      optimista quan la transició resol i els props reals tornen.
      Derivats (`tagCounts`, `filteredNotes`, empty-state) també
      apunten a `optimisticNotes` perquè l'efecte és immediat en tot
      el grid. `framer-motion` `layout` afegit a cada `motion.div` de
      card perquè el reorder (nota que passa a estrellada → va dalt
      del grid) s'animi en comptes de saltar. Commit `e94aea5`.
- [x] **Duplicate NO optimista** — el nou id s'assigna al servidor i
      la generació de l'embedding és el coll d'ampolla real; fer un
      placeholder faria ombra del timing real. Queda amb el toast.
- [x] **Create note** (ComposeZone / CreateNoteForm) tampoc és
      optimista pel mateix motiu (call a Gemini embedding-001 ~1-2 s).
      Si arriba a molestar, es pot afegir una card "pending" al grid,
      però per ara el `toast.loading` cobreix el feedback.

### Gestió de xats: delete + bulk

- [x] **Delete per xat** — cada fila de l'historial ara té una icona
      de paperera revelada en hover (sempre visible a mòbil).
      `deleteChatAction(chatId)` + `messages.chat_id ON DELETE
      CASCADE` netegen l'historial. Optimistic: la fila cau al moment,
      si és el xat actiu es buida la vista; en cas d'error es reverteix
      la llista. Commit `77c15e5`.
- [x] **Bulk select mode** — botó `SquareCheckBig` nou al header que
      entra en mode selecció. Files intercanvien la icona del xat per
      una checkbox, el tap a la fila toggla selecció en comptes
      d'obrir el xat, i el header mostra `N selected · Cancel ·
      Delete` en lloc de Export/Nou. Delete demana confirmació via
      `AlertDialog` i crida `deleteChatsAction(ids[])` en una sola
      volta. L'action fa `.in('id', ids).eq('user_id', user.id)` com
      a belt-and-braces sobre RLS, i retorna el count real. Commit
      `77c15e5`.
- [x] **Canvi de markup a les files** — de `<motion.button>` únic a
      `<motion.div>` amb dos `<button>` fills (toggle/load vs delete)
      perquè cada acció tingui focus i aria-label propi.
  `motion.div` porta `layout` per animar la sortida suau.

### Tidying visual

- [x] **Uniforme 340 px d'alçada per a les cards** — discussió
      prèvia sobre masonry (`grid-template-rows: masonry` encara
      darrere flag a Chromium) descartada; fixat `h-[340px]` al
      `<Card>`. `<CardContent>` substitueix `max-h-[260px]` per
      `flex-1 min-h-0` perquè el body creixi a l'espai lliure sota
      les tags i el footer. Contingut llarg seguit tallat amb
      `mask-gradient-b`; contingut curt empeny el footer a baix.
      Cost: espai buit a notes molt curtes; benefici: grid sense
      jitter entre files. Commit `50e38f6`.

### Lliçó de patró a deixar a la memòria

Qualsevol mutation que faci un round-trip server-action →
`revalidatePath` ha de considerar `useOptimistic` per defecte. El
patró és prou barat (un reducer, un useTransition) i la percepció de
latència cau a zero per a l'usuari. Excepcions legítimes: operacions
que generen nous ids servidor-side (`createNote`, `duplicateNote`) o
que depenen de treball lent real (generació d'embeddings, inferència
LLM). Anotat al `feedback_optimistic_ui_default.md` del registre
auto-memòria.

### Deploy a production

- **Commits:** `ae7a5c4..e94aea5` (optimistic) · `e94aea5..77c15e5`
  (chat delete) · `77c15e5..50e38f6` (uniform cards).
- **Vercel:** tres deploys successius via `vercel --prod --yes`,
  tots aliased a `https://synapse-notes.vercel.app`. El GitHub
  integration segueix sense autodeployar del main (bug obert del
  2026-04-23).

---

## 5. Auditoria estructural via graphify (2026-04-24)

Execució de graphify (pipeline graph-RAG: AST + LLM-inference +
Louvain clustering) sobre tot el repositori com a validació
estructural pre-TFG. Corpus: 132 fitxers · ~90.365 mots → 380
nodes · 427 arestes · 77 comunitats. Outputs conservats a
`graphify-out/` (graph.html interactiu, graph.json, GRAPH_REPORT.md,
cost.json, manifest.json).

### Troballes documentades al memoir

- [x] **Separació Part~A/Part~B verificable estructuralment** — el
      node `GET()` de `src/app/api/mcp/route.ts` és l'únic pont
      cross-community de pes (betweenness 0.022) entre el cluster
      de notes/auth i el cluster MCP. Documentat a §9 Disseny i
      §9 Implementació (subsecció *Auditoria estructural*).
- [x] **Consolidació d'auth-gates verificada per degree centrality**
      — `requireUser()` i `requireChatAccess()` amb 8 arestes c/u,
      cobreixen totes les mutation actions. Patró belt-and-braces
      sobre RLS documentat a §9 Implementació.
- [x] **Re-descobriment automàtic de grups de disseny** —
      l'extractor va generar 4 hyperedges sense supervisió:
      (1) MCP security stack 0.90 EXTRACTED; (2) Six MCP tools
      1.00 EXTRACTED; (3) QoL star/archive/delete theme 0.85
      INFERRED; (4) Palette variants 1.00 EXTRACTED. Les dues
      primeres són validació forta que docs i codi parlen del
      mateix sistema.
- [x] **Mapping 1:1 comunitats-mòduls** — 15 comunitats denses
      mapegen directament als mòduls del disseny intencional;
      62 comunitats single/double-node confirmen baix acoplament
      al long tail. Documentat a §9 Disseny + §10 Avaluació.
- [x] **Fals positiu `Select()` com a cas metodològic** — node
      "més central" (21 edges) és error léxic:
      `supabase.from(...).select(...)` confós amb `<Select>` de
      shadcn. Auditable via tags INFERRED. Documentat a §10
      Avaluació com a limitació honest-amente defensable.

### Mètriques quantitatives per a §10 Avaluació

| Mesura | Valor |
|---|---|
| Corpus total (estimat) | 120.486 tokens |
| Query mitjana (BFS depth 3) | 251 tokens |
| Factor de reducció | 480× |
| Nodes | 380 |
| Arestes | 427 |
| Comunitats (total / denses) | 77 / 15 |
| Falsos positius detectats | 1 (sistemàtic — `Select()`) |

### Limitacions detectades

- **Confusió léxica mètode encadenat ↔ símbol JSX.** L'extractor
  LLM confon `.select()` i `<Select>`. Auditable via tags INFERRED.
  Mitigable amb alias ergonòmic o tipat més agressiu al prompt.
- **PDFs amb imatges >2000 px bloquegen l'extracció de visió.**
  5 PDFs del corpus (guies URV + APA 7 + memoir compilat) no van
  entrar al chunk-2. Cobertura mitigada pels `.tex` i `.md`
  companys. Mitigació automatitzable: pre-downsampling amb
  `pdfimages`/`pdf2image`.
- **Graph és snapshot, no evolució temporal.** La narrativa Part~A
  → Part~B és cronològica; el graph l'aixafa. Mitigació futura:
  `graphify --update` a cada milestone + graph-diff.

### Outputs conservats al repositori

- `graphify-out/graph.html` — graph interactiu (265 KB)
- `graphify-out/graph.json` — dades brutes (293 KB, GraphRAG-ready)
- `graphify-out/GRAPH_REPORT.md` — audit report (27 KB, 554 línies)
- `graphify-out/cost.json` + `manifest.json` — reproducibility

Exclosos del repo via `.gitignore`: `graphify-out/cache/` i
`graphify-out/node_modules/` (regenerables).

### Follow-up per a setmana 3

- [ ] Re-executar graphify després de tancar Fase 2 del MCP
      (5 eines restants) per veure si el cluster C6 "MCP server
      (JWT + NotesService)" creix o es manté consistent.
- [ ] Exportar graph.svg per incloure a figures del memoir
      (`\includegraphics` a §9 Disseny).
- [ ] Passada manual de filtrat dels falsos positius INFERRED
      relacionats amb `Select()` per netejar el graph per a la
      defensa.

---

## 6. Reordenació manual + visualitzador de graph neural (2026-04-25)

Dues features grans afegides avui, documentades com a tracks
estructurats a `extend.md` abans d'implementar (patró memòria
aprovada el 2026-04-24).

### Drag-and-drop de notes ✓

Enviat a production en 9 commits successius de
refinement/bugfix. Última iteració: `922b018` (swap semantics).
Arquitectura:

- `@dnd-kit` (core + sortable + utilities) + `fractional-indexing`.
- Schema: columna `notes.position text` + índex compost
  `notes_user_section_position_idx`. Backfill inicial corregit
  per migració `20260425150000_notes_position_canonical.sql`
  (keys library-canonical `a0`..`az`).
- Dues `SortableContext` (starred vs rest) perquè no es pugui
  creuar la frontera. Swap semantics: només el hover target es
  mou, la resta queda fixa.
- Mobile: `TouchSensor` amb `delay: 200, tolerance: 15` per
  diferenciar swipe (scroll) vs long-press (drag).
- `swapSortingStrategy` custom per a dnd-kit (en comptes de
  `rectSortingStrategy` que fa insert-shift).
- `DragOverlay` portal per al card en moviment.
- Outlined placeholder al slot d'origen durant el drag.
- Server action `swapNotePositions(idA, idB)` amb two sequential
  UPDATEs + `.select('id')` per detectar el patró RLS silent-fail.

Lliçó tècnica per al memoir: Framer Motion `layout` + `variants`
amb `y` bindings són incompatibles amb dnd-kit's transform.
Reduir variants a opacity-only i treure `layout` de les
targetes ordenables.

### Graph neural visualizer ✓

Enviat en 2 commits: `b89e013` (viewer + RPC) i `684ef04` (chat
tools). Arquitectura:

- RPC `public.get_note_graph()` retorna `{ nodes, links, meta }`
  en un jsonb: tag-Jaccard $\geq 0.2$ + embedding top-5
  $\geq 0.75$. `SECURITY INVOKER` + `search_path=''`, grant
  només a `authenticated`.
- Route handler GET `/api/graph` (auth-gated).
- `/graph` page (RSC + client GraphViewer amb `react-force-
  graph-2d` dinàmic, Louvain seeded per colors deterministes).
- Side panel: search, stats, legend, hover preview, click
  inspector (top-12 veïns).
- Dashboard header gains Network icon + `G` global shortcut
  (toggle `/` ↔ `/graph`).
- Dos tools nous al `/api/chat`: `graph_neighbors` i
  `graph_shortest_path`. Adjacency precomputada per-request,
  BFS amb early exit. Inventari del system prompt prefixa
  notes amb `[id=N]` perquè el model tingui el handle.

Relació amb tesi Part~B: el graph és un **exemple pràctic de la
propietat de retrieval acotada** que defensa la tesi — exposa
estructura (ids, kinds, weights) en lloc de text complet, amb
la mateixa reducció de superfície d'exposició que vam mesurar
al primer audit de graphify (§10 Avaluació).

### Pendent (v2 / pre-defensa)

- [ ] Settings popover amb els 5 sliders d'Obsidian
      (centerForce, repelForce, linkForce, linkDistance,
      labelFadeThreshold) amb persistència a localStorage.
- [x] **Parser de `[[N]]` en markdown** — un tipus d'aresta
      més ric (EXTRACTED, directional, pes 1.0). _2026-04-24,
      migració `20260426140000_note_links.sql` + RPC
      `sync_note_links` + arrow rendering al viewer._
      Documentat a `§sec:backlinks`.
- [ ] Chat co-occurrence edges (signal passiu a partir dels
      `agent_events` / chat messages).
- [ ] Export `graph.svg` per incloure com a figura a §9 Disseny.

---

## 7. Graph hardening + tag ecosystem + graph-MCP (2026-04-24)

Sessió de polishing post-llançament del graph viewer. Quatre
features no-trivials, totes amb entrada a `§9 Implementació`:

### Física estil Obsidian ✓

Els defaults de `react-force-graph-2d` (charge -30 unbounded, cap
gravetat per-node, cap collision) donaven una experiència de drag
"blast": arrossegar un node propagava la pertorbació a tota la
tela i els orphans s'apilaven sobre clústers densos. Reescrit
el setup de forces (`src/components/graph/graph-viewer.tsx`):

- `charge.strength(-55).distanceMax(500)` — repulsió multi-body
  acotada.
- `forceX(0).strength(0.07)` + `forceY(0).strength(0.07)` —
  gravetat lineal per-node que crea el "perímetre virtual".
- `forceCollide(38).strength(0.95)` — resolució geomètrica
  hard que impedeix solapament visual quan la charge falla a
  curt rang.
- `d3AlphaDecay: 0.02`, `d3VelocityDecay: 0.5`, `cooldownTicks:
  200` — sim queda calenta prou perquè un node arrossegat fora
  tingui temps de retornar.
- `onNodeDragEnd` explicita `d3ReheatSimulation()` per garantir
  alpha positiu post-drop.

**Bug operacional detectable**: el ref imperativa a ForceGraph2D
no es capturava mai amb `useRef` perquè el component era
carregat via `next/dynamic`; l'efecte de tuning disparava amb
`ref.current === null` i el tuning no s'aplicava mai. Fix: ref
backed per `useState` + callback-ref. Documentat a
`§sec:graph-physics` com a lliçó.

Equilibri matemàtic (balança charge vs gravetat):
$d^3 \propto |Q| / k_g$. Amb $|Q| = 55$ i $k_g = 0.07$, $d ≈ 9.3$
unitats de d3 (~80–100 px a zoom 1×).

### Suggeriment d'etiquetes amb structured output LLM ✓

`POST /api/suggest-tags` — auth-gated, content + availableTags,
torna fins a 3 etiquetes existents + (opcional) una nova tag
normalitzada. Model: Claude Haiku 4.5 via
`generateObject()` amb schema Zod.

Hook client `useTagSuggestions`: debounce 700 ms, minChars 15,
AbortController per cancel·lar fetches stale, mode `auto: false`
per no re-thinking quan l'edit dialog obre una nota ja
categoritzada (trigger imperatiu des de `onOpenChange` del
`TagSelector`). Dos punts d'integració: `CreateNoteForm` i
`EditNoteDialog`.

**Gotcha trobada**: Anthropic rebutja `maxItems` al JSON Schema
generat per structured output
(`"For 'array' type, property 'maxItems' is not supported"`).
Solució: treure `.max(3)` del Zod schema, aplicar `.slice(0, 3)`
post-response, reforçar el cap al prompt.

Documentat a `§sec:tag-suggestion`.

### Gestió d'etiquetes (rename + delete atòmics) ✓

Migració `20260426120000_rename_and_delete_tag_rpcs.sql` amb
dues funcions `SECURITY INVOKER`:

- `public.rename_tag(from_tag, to_tag)` — substitueix cada
  ocurrència, dedupa merges (`DISTINCT` dins `array_agg`),
  retorna el count de files tocades.
- `public.delete_tag(target_tag)` — filtra amb `array(SELECT t
  ... WHERE t <> target_tag)`.

UI: `TagManagerDialog` darrere un botó gear al `FilterBar`.
Inline rename (Enter commits, Escape cancel·la), delete amb
`AlertDialog` de confirmació, usage count per tag. Server
actions a `src/actions/tags.ts` amb validació Zod (sense comes,
max 40 chars).

Documentat a `§sec:tag-management`.

### Tools de graph exposades a MCP ✓

Refactor del BFS/shortest-path del route handler del xat a un
servei compartit `src/services/graph.service.ts` (patró factory
+ classe privada, mateix layout que `NotesService`). Tant
`/api/chat/route.ts` com dues tools MCP noves
(`src/lib/mcp/tools/graph-neighbors.ts`,
`src/lib/mcp/tools/graph-shortest-path.ts`) consumeixen el
mateix servei.

L'increment de versió de `synapse-notes-mcp` passa a
`0.2.0`. Qualsevol agent extern (Claude Desktop, Cursor, client
MCP genèric) pot ara fer les mateixes consultes de graph que el
xat intern, amb la mateixa RLS (l'RPC és `SECURITY INVOKER`).

Documentat a `§sec:mcp-graph-tools` (amb la tesi "same service,
many interfaces"). Valor defensable davant el tribunal: aquesta
és l'aplicació del principi central de la Part~B (bounded
retrieval) al domini del graph — agents externs reben estructura
(ids + weights + kinds), no el contingut text, per defecte.

### Micro-fixes del mateix commit

- Deep-link `/ ?note=<id>` → obre l'edit dialog (reaprofita
  `NoteGrid` com a host de la dialog modal, evita una ruta
  separada).
- `formatDateTime()` a `src/lib/format-relative.ts` —
  `DD/MM/YYYY HH:MM` locale-independent, afegit al card footer
  al costat del relatiu.
- `formatRelative()` clampa `diffMs > 0` a zero (evita
  "d'aquí a 2 minuts" per clock-skew de pocs segons).
- System prompt del xat: 3 noves prioritats (estratègia d'eines,
  estil de resposta, gramàtica catalana) per reduir la
  verbositat i millorar el raonament en correlacions.
- Bug de `search_path` documentat a `§sec:search-path-bug` com a
  lliçó d'enginyeria transferible.

### Pendent (v2)

- [ ] Batch reconciliation: opció "aplica a totes les notes
      seleccionades" quan renomena una tag per sobre-escriure
      existents en conflicte en lloc del dedup silenciós.
- [ ] `suggest-tags` tool al servidor MCP (l'agent extern pot
      suggerir tags per a notes que no són seves via l'auth del
      seu propi usuari).
- [ ] Métrica: mesurar cost real del endpoint de suggerències
      contra el volum de notes creades per usuari/mes per
      justificar el debounce actual a la memòria.

---

## 8. Backlinks + títols + mentions + graph polish (2026-04-24)

Sessió continuada després de §7 amb una pila de features i polishing
que toquen mig stack de la Part~A. Cinc blocs, tots documentats a
`§9 Implementació` amb labels nous:

### Backlinks `[[N]]` (EXTRACTED edges) ✓

- Migració `20260426140000_note_links.sql` — taula
  `public.note_links(source_id, target_id, user_id, created_at)`,
  PK composta, `ON DELETE CASCADE`, `CHECK (source_id <> target_id)`,
  4 polítiques RLS (SELECT/INSERT/UPDATE/DELETE) denormalitzades
  sobre `user_id` per evitar joins a `notes` al caller-path.
- RPC `sync_note_links(source_id, target_ids[])` — `SECURITY
  INVOKER`, patró "replace entire outgoing set" (DELETE + filtered
  INSERT), valida ownership del source i filter silenciós de
  targets no pertanyents al caller / self-refs / archived.
- RPC `public.get_note_graph()` reescrita amb un tercer CTE
  `link_edges` que NO dedupa per parell no-ordenat (preserva la
  direcció), emet `kind: 'link'` al JSON.
- Parser a `src/lib/note-links.ts` amb regex `/\[\[\s*(\d+)\s*\]\]/g`
  + dedup via `Set`. Cridat des de `createNote`/`updateNote`
  (amb `.select('id').single()` al create per obtenir l'id abans
  de sincronitzar).
- Graph viewer: `linkDirectionalArrowLength: 7` només per
  `kind === 'link'`, color ambre/violeta segons palette.
- `NoteMarkdown` fa un pass `renderBacklinksAsMarkdown` que
  converteix `[[42]]` a `[<label>](/?note=42#backlink)`. El
  `<label>` es resol via un `noteIndex` Map passat des de
  `NoteGrid` — mostra el TÍTOL del target, no l'id cru (clau
  per entendre auto-refs i links trencats).
- Click del pill navega via `<Link scroll={false}>`, el hook
  `?note=<id>` de NoteGrid obre el diàleg d'edició.

Documentat a `§sec:backlinks`.

### Camp `title` explícit ✓

- Migració `20260426160000_notes_title_column.sql` — columna
  `notes.title text` nullable amb CHECK length 1..200, índex GIN
  `pg_trgm` sobre `lower(title)` per al typeahead del popover.
  No uuid al mateix índex (no hi ha opclass per defecte de
  GIN + uuid; la RLS + els índexs user-scoped filtren primer).
- Migració `20260426160100` reescriu `get_note_graph()` per
  preferir `n.title` sobre el split_part(content, '\n', 1)
  quan existeix.
- `createNote`/`updateNote` accepten `title` opcional; es
  normalitza a null quan és buit. L'embedding es genera sobre
  `${title}\n\n${content}` per permetre RAG pel nom del tòpic
  encara que el cos sigui sparse.
- Chat inventory line del route handler prefereix title quan
  existeix.
- UI: input gran al capçal del `CreateNoteForm` i del
  `EditNoteDialog`; el card renderitza un `<h3>` `line-clamp-2`
  sobre el body.

Documentat a `§sec:title-and-autocomplete`.

### Autocompletes `[[` / `@` / `#` ✓

`BacklinkTextarea` a `src/components/notes/backlink-textarea.tsx`:

- Tres triggers, UN commit. `[[` i `@` obren el popover de notes
  (fetch `/api/note-search?q=<q>&limit=8`, trigram-powered);
  `#` obre el popover de tags (filtrat localment des de
  `availableTags` — sense round-trip). Pick sempre escriu
  `[[<id>]]` per notes o `#<TagName>` per tags.
- Guarda contra markdown `# Heading`: si `#` és a l'inici de
  línia i el caret és immediatament darrera, NO s'obre el
  popover; la popover només fires a partir del segon keystroke.
- Posicionament caret-relatiu via mirror-div (tècnica estàndard:
  `<div>` off-screen amb typography copiada + marker `<span>` al
  `selectionStart`, `getBoundingClientRect()` del marker traduït
  via `scrollTop/Left` del textarea). Popover s'obre just sota
  la línia del caret; flip a dalt si no cap sota viewport.
- Renderitzat via `ReactDOM.createPortal(..., document.body)`
  per escapar `overflow: hidden` del diàleg d'edició.
- Navegació: ↑/↓ Enter Tab acceptar, Escape cancel·lar; mouse
  hover + click; `scrollIntoView({block:'nearest'})` segueix el
  cursor de teclat quan la llista passa de l'altura visible.
- Fix flex gotcha: `min-h-0` a la `<ul>` perquè
  `overflow-y-auto` activés dins un parent amb `max-height`
  (sense min-h-0 la ul creix a l'altura de contingut i no es
  retalla, tot i que el parent té max-height).

Documentat a `§sec:title-and-autocomplete`.

### Tag pill renderitzat a `NoteMarkdown` + deep-link `?tag=X` ✓

- `renderTagChipsAsMarkdown` a `NoteMarkdown` amb regex
  `/(^|[\s.,;:!?()[\]{}"'«»¿¡])#([\p{L}\p{N}][\p{L}\p{N}_-]*)/gu`
  (Unicode-aware, word-boundary, suprimeix headings i URLs
  amb fragment). Substitueix `#Idees` per un `<Link>` amb
  sentinel `#tag-ref` que el renderer detecta i pinta com a
  pill primary-color amb icona `Hash`.
- URL deep-link `/?tag=<name>` consumit pel mateix
  `useEffect` del `NoteGrid` que ja gestiona `?note=<id>`,
  additiu a `selectedTags` (no sobreescriu filtres
  pre-existents), `router.replace("/")` neteja la URL.

Documentat a `§sec:title-and-autocomplete`.

### Graph viewer polish ✓

Quatre canvis independents al `GraphViewer`:

1. **Louvain només sobre tag+embed edges** (ignorant `kind === 'link'`)
   perquè un backlink user-authored no hauria de re-pintar
   clusters de notes semànticament no-relacionades. Els clusters
   queden estables sota edició de backlinks.
2. **Favorits amb ring ambre + glow exterior** en lloc de disc
   més gran + halo permanent. V1: disc més gran (halo
   competia amb hover). V2: glyph d'estrella dins el disc (fon
   amb paletes sage/warm-yellow). V3 (final): anell ambre
   outside del disc + `shadowBlur 10` + backing ring de
   contrast fi (fosc sobre dark, clar sobre light). Canvia
   amb theme; el hover aura només s'activa per a nodes
   hovered/selected, no per starred.
3. **Hover focus estil Obsidian**: `focusIds = 1-hop neighbourhood`
   del hovered/selected. `isActive(id)` combina searchIds +
   focusIds amb AND. Nodes no-active a `globalAlpha`
   configurable per theme (dark 0.15, light 0.25). Edges
   non-focus a `palette.edgeDim`. Labels del sub-graph focused
   forçats a qualsevol zoom (no requereixen `globalScale > 1.6`).
4. **Palette light/dark reactiu via `next-themes`**. V1 usava
   colors codificats dark (text blanc, edges blavosos) que en
   light mode quedaven invisibles. V2 construeix `palette` amb
   `useMemo(isDark)`; totes les crides canvas consumeixen del
   palette. `canvasBg`, `labelFill`, `edgeTagIdle/Active`,
   `edgeEmbedIdle/Active`, `edgeLinkIdle/Active`, `edgeDim`,
   `starRingBacking`, `inactiveAlpha` — tot reactiu.

Documentat a `§sec:graph-polish`.

### Debug lessons: Radix nested popover + pointer-events

Dos bugs de cooperació Radix que van costar tres iteracions
resoldre i que generen un feedback memory
(`feedback_radix_nested_portal_clicks.md`):

1. **`onInteractOutside`'s CustomEvent target**: `e.target` de
   l'event és la DialogContent, no el click real. El target
   veritable viu a `e.detail.originalEvent.target`. Sense
   llegir el camp nested el check `.closest()` sempre falla i
   Radix tanca el diàleg a cada click del popover.
2. **`pointer-events: none` a `document.body`**: Radix Dialog
   (i Sheet, Popover, Drawer) aplica aquesta regla mentre
   obert per garantir que DialogContent sigui l'única surface
   interactiva. Els portals-sibling al body hereten el `none`
   i els clicks "cauen a través" cap al textarea. Fix: `pointer-
   events: auto` explícit al contenidor del popover.

Tots dos calen: el primer sense el segon vol dir que els events
arriben però Radix tanca el diàleg; el segon sense el primer vol
dir que els events no arriben enlloc. Patró documentat a
`§sec:title-and-autocomplete` i al feedback memory.

### Pendent (v2)

- [ ] Autocomplete per títol al `[[` (ara només funciona per id
      literal; el popover mostra els títols però la commit
      passa per id). Millor UX seria que `[[Noms de ga` obri
      el popover i el pick inserti `[[9]]` i el pill mostri
      "Noms de gat:".
- [ ] Panell "Backlinks a aquesta nota" al diàleg d'edició —
      llistar les notes amb `target_id = editing.id`.
- [ ] Markdown preview en viu al `EditNoteDialog` (ara és
      només textarea; el preview només es veu un cop desat).
- [ ] Editor field amb toolbar d'inserció de backlink
      (botó "🔗 Link" que obre el popover forçat sense haver
      de teclejar `[[`).


