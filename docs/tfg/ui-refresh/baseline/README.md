# Baseline visual — feat/ui-refresh

Captures previs a UI-0 de l'estat actual de Synapse Notes a production
(`https://synapse-notes.vercel.app`), 2026-04-23.

## Cobertura

| Fitxer | Resolució | Mode | Pantalla |
|--------|-----------|------|----------|
| `01-login-light-1440.png` | 1440 × 900 | light | `/login` |
| `02-login-dark-1440.png` | 1440 × 900 | dark | `/login` |
| `03-login-dark-mobile.png` | 375 × 800 | dark | `/login` |
| `04-dashboard-light-1440.png` | 1440 × 900 | light | Dashboard sense chat actiu |
| `05-dashboard-dark-1440.png` | 1440 × 900 | dark | Dashboard sense chat actiu |
| `06-command-palette-dark.png` | 1440 × 900 | dark | Command Palette obert (⌘K) |
| `07-note-editor-loaded-dark.png` | 1440 × 900 | dark | Modal "Edit Note" amb contingut |
| `08-chat-existing-dark.png` | 1440 × 900 | dark | Chat amb 3 missatges reals (RAG actiu) |
| `09-dashboard-dark-mobile.png` | 375 × 800 | dark | Dashboard responsive mobile |
| `10-chat-existing-light-1440.png` | 1440 × 900 | light | Chat amb missatges |
| `01-login.a11y.yml` | — | — | Accessibility tree de `/login` |

## Troballes crítiques (≥ Alt severity)

### 1. Bug d'auto-titling dels xats (Alt)

Al sidebar hi ha **25+ botons "Nova Conversa"** — tots els xats tenen el
mateix títol default. Feature d'auto-títol documentada al log de
Setmana 1 (Bloc B, "chat auto-titles") aparentment mai es va activar o
trencada. Fa el sidebar **inservible per navegar** entre xats:
l'usuari no pot distingir-los.

**Acció prevista:** incloure el fix dins UI-3 (Core screens — chat
sidebar redesign). Si el hook d'auto-title existeix però no dispara,
arreglar-lo és prioritat; si no existeix, implementar-lo amb una crida
ràpida a Haiku 4.5 sobre el primer missatge del xat.

### 2. Emoji 🧠 al titular `<h1>` (Alt)

A `04`/`05`: el header diu `Synapse Notes 🧠`. El UUPM checklist
prohibeix explícitament emojis com a icons UI. A més el cervell ja
apareix com a icona SVG Lucide al card de la portada — redundant.

**Acció prevista:** eliminar l'emoji a UI-3. El logo cervell Lucide ja
aporta identitat visual.

### 3. Accent violet "AI purple" al titular (Mig-alt)

`Synapse Notes` té un tint violet a la paraula `Notes` i un **punt
violet/chat-bubble** al costat (veure `04` detall). Això és literalment
l'"AI purple" que vam identificar com a anti-pattern i que Sergi va
demanar explícitament evitar.

**Acció prevista:** substituir per accent **parchment-gold**
(`oklch(0.82 0.065 80)`) de la paleta Midnight Cartography a UI-2.

### 4. Zero visibilitat de tool calls al chat (Oportunitat)

La conversa capturada a `08` mostra que `getNotesByTag` s'està cridant
(la pregunta "Quines idees tinc?" retorna una llista ordenada de
#Idees) però **la UI no ho indica**. Per a una aplicació que és
sobretot "AI + MCP + RAG" aquesta és l'oportunitat més clara per a un
signature element distintiu.

**Acció prevista:** implementar footnotes editorials a UI-4 (signature).

### 5. Dot-pattern domina a mobile dark (Mig)

`09` (375×800): amb menys superfície visible, el `bg-dot-pattern`
competeix molt amb el contingut. Tant a light com a dark, però és més
pronunciat a mobile dark per l'alt contrast.

**Acció prevista:** eliminar `bg-dot-pattern` del `<body>` a UI-0,
reservar-lo com a textura opcional només a landing pública.

## Troballes secundàries

- **Note edit obre modal** (`07`). Pattern OK per a shadcn, però un
  modal interromp el flux. Considerar a UI-3 si val la pena inline
  edit (Notion-style) o si mantenir el modal amb un tractament
  editorial millor és suficient. Recomanació: **mantenir modal** amb
  refinament estètic; inline edit és molt més feina per poc retorn.
- **Chat bubbles** (`08`/`10`): user i AI es distingeixen només per
  alignment i fons lleugerament diferent. A UI-3 introduirem
  distinció tipogràfica (typography mood diferent) i un fi caret ink
  per al streaming actiu.
- **Sidebar amagada a mobile** (`09`): no hi ha obvious handle. Hi ha
  un FAB de chat però no sidebar handle. Accessibility concern menor.
- **Command Palette** (`06`): estructura OK (4 commands amb keyboard
  hints), només necessita tractament visual nou amb la paleta.
- **Font ús**: tot és Inter (confirmat per `tsx layout.tsx` + snapshot).
  Substitució prevista a UI-2: Young Serif display, Literata body,
  JetBrains Mono per codi/metadata, Inter Tight Display per UI chrome.
- **Accessibility**: a la snapshot YAML no veig `aria-current` a
  l'element del sidebar actualment actiu (el primer xat highlighted).
  Afegir a UI-3.
- **Theme toggle** (lucida moon icon) és un botó sense label visible —
  depèn de `aria-label="Toggle theme"` (present al snapshot). OK.

## Evidència quantitativa (de l'auditoria prèvia, per contexte)

- `grep motion\.` → 1 fitxer (`chat-interface.tsx`) de 60+ components
- `find src/app -name "loading.tsx"` → 0 files
- `find src/app -name "error.tsx"` → 0 files
- `lang="en"` hardcoded a `layout.tsx:22` mentre `LanguageProvider`
  fa switching CA/ES/EN

## Proper pas

Arrancar **UI-0 Foundations cleanup** (task #24): fora
`bg-dot-pattern` del body, fora `tw-animate-css`, afegir `loading.tsx`
i `error.tsx` bàsics, `<html lang>` dinàmic, scaffold OKLCH tokens
que UI-2 consolidarà.
