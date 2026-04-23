# After UI-2 — Midnight Cartography applied

Captures de `/login` després de commit `e1fdac1` (tokens + tipografia).
Preses des de `npm run dev` local a `http://localhost:3000/login` amb
Playwright (preview deploy va fallar per falta d'env vars a l'entorn
preview; localhost comparteix el mateix Supabase dev).

| Fitxer | Resolució | Mode |
|--------|-----------|------|
| `01-login-light-1440.png` | 1440 × 900 | light |
| `02-login-dark-1440.png` | 1440 × 900 | dark |
| `03-login-dark-mobile.png` | 375 × 800 | dark mobile |

> **Nota:** els cercles negres amb la "N" al cantó inferior esquerre
> són el Next.js dev toolbar (`next/dev`). Només es veu a `npm run
> dev`; desapareix en production. Ignora-ho a la comparació.

## Diff visual contra el baseline

### Light mode

| Aspecte | Baseline (`../baseline/01`) | After UI-2 (`01`) |
|---------|-----------------------------|-------------------|
| Fons | Blanc pur `oklch(1 0 0)` | Paper càlid `oklch(0.97 0.008 85)` |
| Dot pattern universal | Sí (distractor) | **Fora** |
| Icon cervell | Gris neutre | **Parchment-gold** `oklch(0.52 0.09 78)` |
| Heading | Inter Bold | **Young Serif** (serif editorial) |
| Body text | Inter regular | **Literata** (serif optical) |
| Botons UI | Inter | **Inter Tight** (més caràcter) |
| Radius cards | `0.625rem` | `0.5rem` (tighter) |

### Dark mode

| Aspecte | Baseline (`../baseline/02`) | After UI-2 (`02`) |
|---------|-----------------------------|-------------------|
| Fons | Slate-950 fred `oklch(0.145 0 0)` | **Deep blue-green** `oklch(0.18 0.025 200)` |
| Text | Near-white `oklch(0.985 0 0)` | **Parchment cream** `oklch(0.92 0.025 85)` — lleuger tint càlid |
| Icon cervell | Gris subtil | **Parchment-gold** — visible, càlid |
| Card | Gris subtle | Blue-green una mica més clar + border hairline parchment |
| Personalitat | "Tailwind default dark" | **Distintiu** (library basement vibe) |

### Mobile dark

Baseline tenia dot-pattern molt visible competint amb el card; ara la
superfície és clean, card té borders fines parchment, touch targets
≥ 44px mantinguts. L'accent gold a `Synapse Notes` es veu molt més al
viewport petit.

## Validació ràpida

**Fonts carregades**: Young Serif al `<h1>`, Literata al body, Inter
Tight als botons, JetBrains Mono disponible via `.font-mono`. (Mono
no visible aquí perquè el login no té metadata; es veurà a UI-3/UI-4
quan afegim timestamps i footnote IDs).

**Dot-pattern**: confirmat fora del `<body>`. La utility class
`.bg-dot-pattern` segueix definida a `globals.css` per reutilització
puntual en landing pública.

**Contrast AA** (ulleres, no tool):
- Light: text ink `oklch(0.2 0.015 255)` sobre paper `oklch(0.97 0.008
  85)` → passa AA còmodament (ratio estimada ~12:1)
- Dark: parchment cream `oklch(0.92)` sobre deep blue-green
  `oklch(0.18)` → passa AA còmodament (ratio estimada ~11:1)
- Primary-foreground sobre primary a light (`0.98` sobre `0.52`) →
  passa AA
- Primary-foreground sobre primary a dark (`0.18` sobre `0.82`) →
  passa AA amb marge

**Pending visual check**: pantalles interiors (dashboard, chat, note
editor, command palette) — requereixen login. Es validaran en UI-3
un cop toquem els components específics. El **bug** del sidebar
("Nova Conversa" × 25) encara no s'ha tocat, és objectiu de UI-3.
