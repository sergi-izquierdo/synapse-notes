# Graph Report - .  (2026-04-24)

## Corpus Check
- 132 files · ~90,365 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 380 nodes · 427 edges · 77 communities detected
- Extraction: 79% EXTRACTED · 21% INFERRED · 0% AMBIGUOUS · INFERRED: 91 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Notes & auth server actions|Notes & auth server actions]]
- [[_COMMUNITY_Chat sidebar logic|Chat sidebar logic]]
- [[_COMMUNITY_MCP + agents + Supabase backend|MCP + agents + Supabase backend]]
- [[_COMMUNITY_Login & dashboard visual baselines|Login & dashboard visual baselines]]
- [[_COMMUNITY_Baseline screenshots + palette mockups|Baseline screenshots + palette mockups]]
- [[_COMMUNITY_TFG Part B concepts + research|TFG Part B concepts + research]]
- [[_COMMUNITY_MCP server (JWT + NotesService)|MCP server (JWT + NotesService)]]
- [[_COMMUNITY_Shadcn Sheet primitives|Shadcn Sheet primitives]]
- [[_COMMUNITY_Dashboard header + i18n|Dashboard header + i18n]]
- [[_COMMUNITY_Shadcn Select primitives|Shadcn Select primitives]]
- [[_COMMUNITY_Inspiration radial orbital timeline|Inspiration: radial orbital timeline]]
- [[_COMMUNITY_Settings view destructive actions|Settings view destructive actions]]
- [[_COMMUNITY_NoteGrid action handlers|NoteGrid action handlers]]
- [[_COMMUNITY_Shadcn Dialog primitives|Shadcn Dialog primitives]]
- [[_COMMUNITY_QoL roadmap milestones|QoL roadmap milestones]]
- [[_COMMUNITY_Tags manager editor|Tags manager editor]]
- [[_COMMUNITY_Shadcn AlertDialog|Shadcn AlertDialog]]
- [[_COMMUNITY_Shadcn Card|Shadcn Card]]
- [[_COMMUNITY_Inspiration animated AI input|Inspiration: animated AI input]]
- [[_COMMUNITY_Login page|Login page]]
- [[_COMMUNITY_Filter bar|Filter bar]]
- [[_COMMUNITY_Note markdown checkbox toggle|Note markdown checkbox toggle]]
- [[_COMMUNITY_Shadcn Popover|Shadcn Popover]]
- [[_COMMUNITY_Shadcn ScrollArea|Shadcn ScrollArea]]
- [[_COMMUNITY_Tag selector combobox|Tag selector combobox]]
- [[_COMMUNITY_Inspiration Spline 3D scene|Inspiration: Spline 3D scene]]
- [[_COMMUNITY_Inspiration Aurora background|Inspiration: Aurora background]]
- [[_COMMUNITY_Inspiration Spotlight (Aceternity)|Inspiration: Spotlight (Aceternity)]]
- [[_COMMUNITY_Inspiration Spotlight (ibelick)|Inspiration: Spotlight (ibelick)]]
- [[_COMMUNITY_Root layout|Root layout]]
- [[_COMMUNITY_Auth route error boundary|Auth route error boundary]]
- [[_COMMUNITY_Auth route loading state|Auth route loading state]]
- [[_COMMUNITY_Dashboard route error boundary|Dashboard route error boundary]]
- [[_COMMUNITY_Dashboard layout|Dashboard layout]]
- [[_COMMUNITY_Command palette|Command palette]]
- [[_COMMUNITY_Global keyboard shortcuts|Global keyboard shortcuts]]
- [[_COMMUNITY_Keyboard shortcuts dialog|Keyboard shortcuts dialog]]
- [[_COMMUNITY_Message actions strip|Message actions strip]]
- [[_COMMUNITY_Compose zone (desktop + mobile)|Compose zone (desktop + mobile)]]
- [[_COMMUNITY_Shadcn Badge|Shadcn Badge]]
- [[_COMMUNITY_Shadcn Button|Shadcn Button]]
- [[_COMMUNITY_Shadcn Command|Shadcn Command]]
- [[_COMMUNITY_Shadcn Input|Shadcn Input]]
- [[_COMMUNITY_Shadcn Label|Shadcn Label]]
- [[_COMMUNITY_Shadcn Tag input (legacy)|Shadcn Tag input (legacy)]]
- [[_COMMUNITY_Shadcn Textarea|Shadcn Textarea]]
- [[_COMMUNITY_Relative time formatter|Relative time formatter]]
- [[_COMMUNITY_cn() utility|cn() utility]]
- [[_COMMUNITY_Supabase browser client|Supabase browser client]]
- [[_COMMUNITY_QoL-3 starpin + migration|QoL-3: star/pin + migration]]
- [[_COMMUNITY_Optimistic UI pattern|Optimistic UI pattern]]
- [[_COMMUNITY_Palette decision (MC rejected → Navy+Amber)|Palette decision (MC rejected → Navy+Amber)]]
- [[_COMMUNITY_ESLint config|ESLint config]]
- [[_COMMUNITY_Next.js env types|Next.js env types]]
- [[_COMMUNITY_Next.js config|Next.js config]]
- [[_COMMUNITY_PostCSS config|PostCSS config]]
- [[_COMMUNITY_Inspiration Background Paths (applied)|Inspiration: Background Paths (applied)]]
- [[_COMMUNITY_Inspiration CPU architecture|Inspiration: CPU architecture]]
- [[_COMMUNITY_Root loading state|Root loading state]]
- [[_COMMUNITY_apiversion route test|/api/version route test]]
- [[_COMMUNITY_apiversion test helper|/api/version test helper]]
- [[_COMMUNITY_apiversion test helper|/api/version test helper]]
- [[_COMMUNITY_Theme toggle|Theme toggle]]
- [[_COMMUNITY_Background Paths component|Background Paths component]]
- [[_COMMUNITY_Sonner toast adapter|Sonner toast adapter]]
- [[_COMMUNITY_Shadcn Switch|Shadcn Switch]]
- [[_COMMUNITY_Translations table (CAESEN)|Translations table (CA/ES/EN)]]
- [[_COMMUNITY_MCP auth tests|MCP auth tests]]
- [[_COMMUNITY_NotesService tests|NotesService tests]]
- [[_COMMUNITY_Database types|Database types]]
- [[_COMMUNITY_Memoir TOC artifact|Memoir TOC artifact]]
- [[_COMMUNITY_Out-of-scope features (mobile  teams  billing)|Out-of-scope features (mobile / teams / billing)]]
- [[_COMMUNITY_QoL-4 tags refinement|QoL-4: tags refinement]]
- [[_COMMUNITY_QoL-5 settings expansion|QoL-5: settings expansion]]
- [[_COMMUNITY_QoL-6 chat mechanics|QoL-6: chat mechanics]]
- [[_COMMUNITY_QoL commit uniform 340px cards|QoL commit: uniform 340px cards]]
- [[_COMMUNITY_Next.js starter SVGs (unused)|Next.js starter SVGs (unused)]]

## God Nodes (most connected - your core abstractions)
1. `Select()` - 21 edges
2. `createClient()` - 20 edges
3. `GET()` - 10 edges
4. `In scope: 6 MCP tools + 3 agents + security analysis` - 10 edges
5. `requireChatAccess()` - 8 edges
6. `requireUser()` - 8 edges
7. `47-day Gantt (2026-04-19 to 2026-06-05)` - 8 edges
8. `generateEmbedding()` - 7 edges
9. `Part A -- Platform (Oct 2025 -> Apr 2026)` - 7 edges
10. `Part B -- MCP extension + security research` - 7 edges

## Surprising Connections (you probably didn't know these)
- `requireChatAccess()` --calls--> `createClient()`  [INFERRED]
  src\actions\chats.ts → src\lib\supabase\server.ts
- `requireChatAccess()` --calls--> `Select()`  [INFERRED]
  src\actions\chats.ts → src\components\ui\select.tsx
- `deleteMessageAndFollowingAction()` --calls--> `Select()`  [INFERRED]
  src\actions\chats.ts → src\components\ui\select.tsx
- `branchChatAction()` --calls--> `Select()`  [INFERRED]
  src\actions\chats.ts → src\components\ui\select.tsx
- `deleteChatsAction()` --calls--> `createClient()`  [INFERRED]
  src\actions\chats.ts → src\lib\supabase\server.ts

## Hyperedges (group relationships)
- **QoL phases sharing star/archive/delete soft-mutation theme** — backlog_qol_3, backlog_qol_7, commit_e94aea5, concept_optimistic_ui [INFERRED 0.85]
- **MCP security stack (trifecta + OAuth + RLS + filter)** — concept_mcp, concept_lethal_trifecta, concept_oauth_21, concept_rls, decision_d3_output_filter, concept_promptfoo [EXTRACTED 0.90]
- **Six MCP tools implementing the Synapse Notes surface** — tool_search_notes, tool_get_note, tool_create_note, tool_update_note, tool_tag_notes, tool_summarise_notes [EXTRACTED 1.00]
- **Palette variants explored** — palette_a_graphite_electric, palette_b_zinc_emerald, palette_c_navy_amber [EXTRACTED 1.00]

## Communities

### Community 0 - "Notes & auth server actions"
Cohesion: 0.08
Nodes (28): generateEmbedding(), signInWith(), signOut(), regenerateStaleTitlesAction(), handleSave(), handleDuplicate(), archiveNote(), createNote() (+20 more)

### Community 1 - "Chat sidebar logic"
Cohesion: 0.09
Nodes (26): cancelEdit(), createNewChat(), exitSelectMode(), fetchChats(), findCurrentIdx(), handleBranch(), handleDeleteChat(), handleDeleteMessage() (+18 more)

### Community 2 - "MCP + agents + Supabase backend"
Cohesion: 0.07
Nodes (35): Agent: auto-tag (hourly), Agent: embedding-backfill (15 min), Agent: weekly-digest (weekly), Commit 77c15e5 -- per-chat delete + bulk select, Commit b4c5b01 -- messages RLS policy fix, pgvector + HNSW, Row Level Security (RLS), Supabase (Postgres + Auth + Edge Functions) (+27 more)

### Community 3 - "Login & dashboard visual baselines"
Cohesion: 0.14
Nodes (29): After UI2 - Login Dark 1440px, After UI2 - Login Dark Mobile, After UI2 - Login Light 1440px, Baseline - Dashboard Dark 1440px, Baseline - Dashboard Light 1440px, Baseline - Login Dark 1440px, Baseline - Login Dark Mobile, Baseline - Login Light 1440px (+21 more)

### Community 4 - "Baseline screenshots + palette mockups"
Cohesion: 0.11
Nodes (24): Baseline 06 — Command Palette (Dark), Baseline 07 — Note Editor Loaded (Dark), Baseline 08 — Chat Existing Conversation (Dark), Baseline 09 — Dashboard Dark Mobile, Baseline 10 — Chat Existing Conversation (Light, 1440), Dark/Light Theme Parity, OAuth + Multi-Language Login, Mockup A — Graphite + Electric (Dark) (+16 more)

### Community 5 - "TFG Part B concepts + research"
Cohesion: 0.12
Nodes (23): Backlog 1: RAG recall bug (cats query), Lethal Trifecta, Model Context Protocol (MCP), Next.js 16 (App Router), OAuth 2.1, Supabase OAuth redirect fix (Site URL), Promptfoo red-team testing, Retrieval-Augmented Generation (RAG) (+15 more)

### Community 6 - "MCP server (JWT + NotesService)"
Cohesion: 0.13
Nodes (8): createMcpSupabaseClient(), extractBearerToken(), McpAuthError, createNotesService(), NotesService, handle(), createSearchNotesHandler(), createMcpServer()

### Community 7 - "Shadcn Sheet primitives"
Cohesion: 0.2
Nodes (0): 

### Community 8 - "Dashboard header + i18n"
Cohesion: 0.22
Nodes (4): CreateNoteForm(), DashboardHeader(), useLanguage(), LanguageSwitcher()

### Community 9 - "Shadcn Select primitives"
Cohesion: 0.22
Nodes (0): 

### Community 10 - "Inspiration: radial orbital timeline"
Cohesion: 0.29
Nodes (2): getRelatedItems(), isRelatedToActive()

### Community 11 - "Settings view destructive actions"
Cohesion: 0.29
Nodes (0): 

### Community 12 - "NoteGrid action handlers"
Cohesion: 0.4
Nodes (2): handler(), toggleTagFilter()

### Community 13 - "Shadcn Dialog primitives"
Cohesion: 0.33
Nodes (0): 

### Community 14 - "QoL roadmap milestones"
Cohesion: 0.33
Nodes (6): QoL-1 -- Critical fixes + basic shortcuts, QoL-2 -- Navigation shortcuts, QoL-7 -- Mobile + archive + haptics, Commit addbc50 -- merge feat/ui-refresh + QoL, Migration: notes_archived (20260424200000), Inspiration: Background Paths

### Community 15 - "Tags manager editor"
Cohesion: 0.5
Nodes (2): cancelEdit(), submitRename()

### Community 16 - "Shadcn AlertDialog"
Cohesion: 0.5
Nodes (0): 

### Community 17 - "Shadcn Card"
Cohesion: 0.5
Nodes (0): 

### Community 18 - "Inspiration: animated AI input"
Cohesion: 0.67
Nodes (0): 

### Community 19 - "Login page"
Cohesion: 0.67
Nodes (0): 

### Community 20 - "Filter bar"
Cohesion: 0.67
Nodes (0): 

### Community 21 - "Note markdown checkbox toggle"
Cohesion: 1.0
Nodes (2): handleToggle(), toggleMarkdownCheckbox()

### Community 22 - "Shadcn Popover"
Cohesion: 0.67
Nodes (0): 

### Community 23 - "Shadcn ScrollArea"
Cohesion: 0.67
Nodes (0): 

### Community 24 - "Tag selector combobox"
Cohesion: 0.67
Nodes (0): 

### Community 25 - "Inspiration: Spline 3D scene"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Inspiration: Aurora background"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Inspiration: Spotlight (Aceternity)"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Inspiration: Spotlight (ibelick)"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Root layout"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Auth route error boundary"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Auth route loading state"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Dashboard route error boundary"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Dashboard layout"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Command palette"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Global keyboard shortcuts"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Keyboard shortcuts dialog"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Message actions strip"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Compose zone (desktop + mobile)"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Shadcn Badge"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Shadcn Button"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Shadcn Command"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Shadcn Input"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Shadcn Label"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Shadcn Tag input (legacy)"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Shadcn Textarea"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Relative time formatter"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "cn() utility"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Supabase browser client"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "QoL-3: star/pin + migration"
Cohesion: 1.0
Nodes (2): QoL-3 -- Note features base (star/duplicate/undo), Migration: notes_starred (20260424120000)

### Community 50 - "Optimistic UI pattern"
Cohesion: 1.0
Nodes (2): Commit e94aea5 -- optimistic star/archive/delete, Optimistic UI default pattern

### Community 51 - "Palette decision (MC rejected → Navy+Amber)"
Cohesion: 1.0
Nodes (2): Palette: Midnight Cartography (rejected), Palette: Navy + Amber (final)

### Community 52 - "ESLint config"
Cohesion: 1.0
Nodes (0): 

### Community 53 - "Next.js env types"
Cohesion: 1.0
Nodes (0): 

### Community 54 - "Next.js config"
Cohesion: 1.0
Nodes (0): 

### Community 55 - "PostCSS config"
Cohesion: 1.0
Nodes (0): 

### Community 56 - "Inspiration: Background Paths (applied)"
Cohesion: 1.0
Nodes (0): 

### Community 57 - "Inspiration: CPU architecture"
Cohesion: 1.0
Nodes (0): 

### Community 58 - "Root loading state"
Cohesion: 1.0
Nodes (0): 

### Community 59 - "/api/version route test"
Cohesion: 1.0
Nodes (0): 

### Community 60 - "/api/version test helper"
Cohesion: 1.0
Nodes (0): 

### Community 61 - "/api/version test helper"
Cohesion: 1.0
Nodes (0): 

### Community 62 - "Theme toggle"
Cohesion: 1.0
Nodes (0): 

### Community 63 - "Background Paths component"
Cohesion: 1.0
Nodes (0): 

### Community 64 - "Sonner toast adapter"
Cohesion: 1.0
Nodes (0): 

### Community 65 - "Shadcn Switch"
Cohesion: 1.0
Nodes (0): 

### Community 66 - "Translations table (CA/ES/EN)"
Cohesion: 1.0
Nodes (0): 

### Community 67 - "MCP auth tests"
Cohesion: 1.0
Nodes (0): 

### Community 68 - "NotesService tests"
Cohesion: 1.0
Nodes (0): 

### Community 69 - "Database types"
Cohesion: 1.0
Nodes (0): 

### Community 70 - "Memoir TOC artifact"
Cohesion: 1.0
Nodes (0): 

### Community 71 - "Out-of-scope features (mobile / teams / billing)"
Cohesion: 1.0
Nodes (1): Out of scope (mobile, teams, billing, admin, fine-tuning)

### Community 72 - "QoL-4: tags refinement"
Cohesion: 1.0
Nodes (1): QoL-4 -- Tags refinement

### Community 73 - "QoL-5: settings expansion"
Cohesion: 1.0
Nodes (1): QoL-5 -- Settings page expansion

### Community 74 - "QoL-6: chat mechanics"
Cohesion: 1.0
Nodes (1): QoL-6 -- Chat mechanics (regenerate/edit/branch)

### Community 75 - "QoL commit: uniform 340px cards"
Cohesion: 1.0
Nodes (1): Commit 50e38f6 -- uniform 340px note cards

### Community 76 - "Next.js starter SVGs (unused)"
Cohesion: 1.0
Nodes (1): Next.js starter SVGs (unused)

## Knowledge Gaps
- **40 isolated node(s):** `Sergi Izquierdo Segarra`, `Montse Garcia (TFG Coordinator)`, `Simon Willison`, `Streamable HTTP transport`, `Supabase (Postgres + Auth + Edge Functions)` (+35 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Inspiration: Spline 3D scene`** (2 nodes): `SplineScene()`, `03-spline-scene.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Inspiration: Aurora background`** (2 nodes): `AuroraBackground()`, `04-aurora-background.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Inspiration: Spotlight (Aceternity)`** (2 nodes): `spotlight-aceternity.tsx`, `Spotlight()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Inspiration: Spotlight (ibelick)`** (2 nodes): `spotlight-ibelick.tsx`, `Spotlight()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Root layout`** (2 nodes): `RootLayout()`, `layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Auth route error boundary`** (2 nodes): `AuthError()`, `error.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Auth route loading state`** (2 nodes): `AuthLoading()`, `loading.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dashboard route error boundary`** (2 nodes): `DashboardError()`, `error.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dashboard layout`** (2 nodes): `DashboardLayout()`, `layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Command palette`** (2 nodes): `CommandPalette()`, `command-palette.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Global keyboard shortcuts`** (2 nodes): `GlobalShortcuts()`, `global-shortcuts.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Keyboard shortcuts dialog`** (2 nodes): `usePlatformModKey()`, `keyboard-shortcuts-dialog.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Message actions strip`** (2 nodes): `handleCopy()`, `message-actions.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Compose zone (desktop + mobile)`** (2 nodes): `ComposeZone()`, `compose-zone.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Shadcn Badge`** (2 nodes): `Badge()`, `badge.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Shadcn Button`** (2 nodes): `cn()`, `button.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Shadcn Command`** (2 nodes): `cn()`, `command.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Shadcn Input`** (2 nodes): `Input()`, `input.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Shadcn Label`** (2 nodes): `Label()`, `label.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Shadcn Tag input (legacy)`** (2 nodes): `tag-input.tsx`, `TagInput()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Shadcn Textarea`** (2 nodes): `textarea.tsx`, `cn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Relative time formatter`** (2 nodes): `formatRelative()`, `format-relative.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `cn() utility`** (2 nodes): `utils.ts`, `cn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supabase browser client`** (2 nodes): `createClient()`, `client.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `QoL-3: star/pin + migration`** (2 nodes): `QoL-3 -- Note features base (star/duplicate/undo)`, `Migration: notes_starred (20260424120000)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Optimistic UI pattern`** (2 nodes): `Commit e94aea5 -- optimistic star/archive/delete`, `Optimistic UI default pattern`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Palette decision (MC rejected → Navy+Amber)`** (2 nodes): `Palette: Midnight Cartography (rejected)`, `Palette: Navy + Amber (final)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `ESLint config`** (1 nodes): `eslint.config.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next.js env types`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next.js config`** (1 nodes): `next.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `PostCSS config`** (1 nodes): `postcss.config.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Inspiration: Background Paths (applied)`** (1 nodes): `01-background-paths.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Inspiration: CPU architecture`** (1 nodes): `05-cpu-architecture.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Root loading state`** (1 nodes): `loading.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `/api/version route test`** (1 nodes): `route.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `/api/version test helper`** (1 nodes): `route.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `/api/version test helper`** (1 nodes): `route.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Theme toggle`** (1 nodes): `theme-toggle.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Background Paths component`** (1 nodes): `background-paths.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Sonner toast adapter`** (1 nodes): `sonner.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Shadcn Switch`** (1 nodes): `switch.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Translations table (CA/ES/EN)`** (1 nodes): `translations.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `MCP auth tests`** (1 nodes): `auth.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `NotesService tests`** (1 nodes): `notes.service.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Database types`** (1 nodes): `database.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Memoir TOC artifact`** (1 nodes): `main.toc`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Out-of-scope features (mobile / teams / billing)`** (1 nodes): `Out of scope (mobile, teams, billing, admin, fine-tuning)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `QoL-4: tags refinement`** (1 nodes): `QoL-4 -- Tags refinement`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `QoL-5: settings expansion`** (1 nodes): `QoL-5 -- Settings page expansion`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `QoL-6: chat mechanics`** (1 nodes): `QoL-6 -- Chat mechanics (regenerate/edit/branch)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `QoL commit: uniform 340px cards`** (1 nodes): `Commit 50e38f6 -- uniform 340px note cards`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next.js starter SVGs (unused)`** (1 nodes): `Next.js starter SVGs (unused)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Select()` connect `Notes & auth server actions` to `Shadcn Select primitives`, `Chat sidebar logic`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Why does `GET()` connect `Notes & auth server actions` to `MCP server (JWT + NotesService)`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `createClient()` connect `Notes & auth server actions` to `Chat sidebar logic`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Are the 20 inferred relationships involving `Select()` (e.g. with `regenerateStaleTitlesAction()` and `requireChatAccess()`) actually correct?**
  _`Select()` has 20 INFERRED edges - model-reasoned connections that need verification._
- **Are the 19 inferred relationships involving `createClient()` (e.g. with `signInWith()` and `signOut()`) actually correct?**
  _`createClient()` has 19 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `GET()` (e.g. with `signInWith()` and `createNote()`) actually correct?**
  _`GET()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Sergi Izquierdo Segarra`, `Montse Garcia (TFG Coordinator)`, `Simon Willison` to the rest of the system?**
  _40 weakly-connected nodes found - possible documentation gaps or missing edges._