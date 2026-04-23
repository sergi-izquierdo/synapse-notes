# UI refresh — branca `feat/ui-refresh`

Registre viu de la refresh de disseny de Synapse Notes. Feina paral·lela
al pla de Setmana 2 del TFG: la plataforma base (Part~A) fa de portafoli
públic i el look actual (scaffold shadcn default + dot pattern +
`tw-animate-css`) va ser generat per un LLM antic amb inconsistències
visuals i d'accessibilitat documentades. L'objectiu és passar a una
direcció distintiva sense caure en estètica generic-AI.

> Aquest doc és la **font d'estat** de la branca. Les captures prèvies
> són a [`baseline/`](./baseline/README.md).

## Direcció acordada (2026-04-23)

**Concepte:** *Editorial-technical* — biblioteca + terminal tècnica.
Combina Linear/Notion productivity restraint amb tocs AI-native sense
caure al "purple gradient SaaS".

**Variant triada: 3 — Midnight Cartography** (light + dark coherents)

- **Dark ground:** `oklch(0.18 0.025 200)` deep blue-green
- **Dark text:** `oklch(0.92 0.025 85)` parchment cream
- **Primary accent:** `oklch(0.82 0.065 80)` parchment-gold
- **Secondary:** `oklch(0.58 0.075 150)` topographic green
- **Light ground:** `oklch(0.97 0.008 85)` paper càlid (coordinació amb dark)
- **Display:** Young Serif (Google Fonts)
- **Body:** Literata (Google Fonts)
- **UI chrome:** Inter Tight Display
- **Mono:** JetBrains Mono

**Signature element:** footnote system per a tool calls del RAG/MCP
(números superscript + marge editorial, timestamps *proceedings*).
Ningú més al mercat ho fa i liga amb el concepte "second brain".

**Anti-patterns explícits:** Inter regular, Space Grotesk, purple/violet
gradients, glass blur, aurora, typewriter decoratiu, emojis com a icons.

## Fases

| # | Fase | Estat | Commit |
|---|------|-------|--------|
| UI-0 | Foundations cleanup | ✅ Fet | `636d6f3` |
| UI-1 | Motion integration | Pendent | — |
| UI-2 | Design system tokens | ✅ Fet | `e1fdac1` |
| UI-3 | Core screens redesign | Pendent | — |
| UI-4 | Footnote system (signature) | Pendent | — |
| UI-5 | Landing + UUPM checklist | Pendent | — |

## Log per fase

### UI-0 — Foundations cleanup (2026-04-23, `636d6f3`)

Feina estructural, zero risc estètic. Només prepara el terreny.

**Canvis:**

- `src/app/layout.tsx`
  - Fora `bg-dot-pattern` del `<body>` (el dot pattern competia amb
    contingut dens, especialment a mobile dark).
  - `<html lang="en">` → `<html lang="ca">` (el catalano és la
    locale primaria del projecte).
- `src/components/language-provider.tsx`
  - Nou `useEffect` que manté `document.documentElement.lang`
    sincronitzat amb l'idioma actiu. Fix d'a11y: els screen readers
    ara anuncien EN / ES / CA correctament al moment que l'usuari
    canvia el selector.
- `src/app/(auth)/loading.tsx` + `error.tsx` (nous)
- `src/app/(dashboard)/loading.tsx` + `error.tsx` (nous)
  - Abans no hi havia cap: les rutes carregaven en pantalla en blanc
    i qualsevol error runtime tombava l'arbre sencer. Ambdós usen
    `text-muted-foreground`, `text-foreground` → heretaran la paleta
    Midnight Cartography sense més edicions quan UI-2 entri.

**Decisió retardada:** `tw-animate-css` es queda. Tota la suite shadcn
(dialog, popover, sheet, alert-dialog, select) depèn dels seus
`animate-in`, `zoom-in-95`, `slide-in-from-*`. Reavaluarem a UI-1 si
Motion cobreix aquests casos prou bé per deprecar-la.

**Verificació:** 16/16 tests · 0 lint errors · build clean · totes les
rutes al build output.

### UI-1 — Motion integration (pendent)

Planificat: sidebar layout animation, note list staggered reveal,
shared layout `note-card` ↔ `note-detail`, chat `AnimatePresence` +
caret ink per streaming, command palette spring. Respect
`prefers-reduced-motion` a tot arreu.

### UI-2 — Design system tokens (2026-04-23, `e1fdac1`)

Tokens i tipografia. Paleta Midnight Cartography aplicada. Cap
component tocat — la feina de "com es veu cada pantalla" arriba a
UI-3. En canvi, com que tot el codi consum `bg-background`,
`text-foreground`, `bg-primary`, etc., **l'app sencera canvia
d'aspecte d'un sol commit**.

**Canvis:**

- `src/app/layout.tsx`
  - 4 fonts via `next/font/google` amb CSS variables:
    `--font-display` (Young Serif 400), `--font-body` (Literata
    400/500/600/700 + italic), `--font-sans` (Inter Tight
    400/500/600/700), `--font-mono` (JetBrains Mono 400/500/600).
  - `inter.className` al `<body>` substituït per les 4 variables.
- `src/app/globals.css`
  - **Light mode**: ground paper càlid `oklch(0.97 0.008 85)`, ink
    quasi-fred `oklch(0.2 0.015 255)`, primary gold darker
    `oklch(0.52 0.09 78)` per contrast AA.
  - **Dark mode**: deep blue-green `oklch(0.18 0.025 200)`, parchment
    cream `oklch(0.92 0.025 85)`, primary parchment-gold
    `oklch(0.82 0.065 80)`. Secondary verd topogràfic
    `oklch(0.58 0.075 150)`, destructive rust `oklch(0.64 0.14 26)`.
  - **Chart colors** ajustats (fora lavender/violet; `chart-5` és
    slate blue moderat, no AI-purple).
  - **Sidebar colors** coherents amb card.
  - **Radius** redunded a `0.5rem` (abans `0.625rem`) — lleugerament
    més tight, més editorial.
  - **Base layer rules**: `h1`/`h2`/`h3` i `.font-display` hereten
    `var(--font-display)`; `.prose`/`.font-body` hereten
    `var(--font-body)`; `code`/`kbd`/`pre`/`.font-mono` hereten
    `var(--font-mono)`. El `<body>` es queda amb `font-sans` (Inter
    Tight).
  - **`<hr>` i `.contour-divider`** com a dos fi strokes amb gap —
    referència topogràfica que substitueix el `<hr>` genèric de
    shadcn.
  - **`.bg-dot-pattern`** reafinat a OKLCH (no és universal ja, només
    si algú opta-in — reservat per a landing pública).

**Verificació:** 16/16 tests · 0 lint errors · build clean.

**Visual check NO fet en preview deploy** perquè els preview
deployments no hereten les env vars de production (Vercel les guarda
només a production). El middleware caia amb
`MIDDLEWARE_INVOCATION_FAILED`. Opcions per al futur:

1. Afegir totes les env vars també a `preview` (via `vercel env add
   <name> preview`).
2. Fer deploy directe a production quan volguem smoke-test visual.
3. `npm run dev` local + Playwright localhost (més ràpid).

De moment s'ha saltat — amb tests + build verds la paleta aplica
deterministament. La validació visual formal es farà a UI-3 quan
toquem components clau.

### UI-3 — Core screens redesign (pendent)

Planificat: login polish, dashboard-header (fora emoji 🧠, fora AI
purple dot), note card (editorial amb marginalia), chat bubbles amb
distinció tipogràfica user/AI, command palette refinat, **fix del bug
d'auto-titling dels xats** (al sidebar apareixen 25+ "Nova Conversa").

### UI-4 — Footnote system (pendent — el signature)

Planificat: tool calls MCP/RAG com a footnotes editorials amb números
superscript i marge expandible, timestamps estil *proceedings*
(`§MM.DD · HH:MM`). És el diferenciador memorable.

### UI-5 — Landing + UUPM checklist (pendent)

Planificat: landing pública amb hero epigràfic (zero aurora), stack
table com a índex, aplicar la checklist pre-delivery de UUPM
(contrast, focus rings, cursor-pointer, responsive 375/768/1024/1440,
`prefers-reduced-motion`).

## Merge plan

Quan tot el pla estigui verd, fem un sol PR `feat/ui-refresh` → `main`
amb les 10 captures *abans/després* al descripció. No mergem fase a
fase per mantenir `main` sempre consistent (o bé tota la refresh, o
bé cap).
