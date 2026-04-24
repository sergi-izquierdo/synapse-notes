-- Explicit title column for notes. Until now the "title" shown in
-- the graph, inventory and search was derived from the first line
-- of content -- cheap but fragile (editing the body changed the
-- apparent title, backlinks by title were impossible, long-form
-- notes with no header rendered as "(empty)").
--
-- Nullable on purpose: existing rows keep working because display
-- code (graph RPC, chat inventory, card) falls back to a first-line
-- slice when title is null. Reversible decision.
--
-- Trigram index on lower(title) keeps autocomplete search cheap
-- (ILIKE '%query%' for the [[ popover). No uuid in the index -- UUID
-- has no default GIN opclass, and RLS + the existing user-scoped
-- indexes already prune rows before the title filter runs.

create extension if not exists pg_trgm with schema extensions;

alter table public.notes
    add column if not exists title text;

alter table public.notes
    drop constraint if exists notes_title_length;
alter table public.notes
    add constraint notes_title_length
        check (title is null or length(title) between 1 and 200);

create index if not exists notes_title_trgm_idx
    on public.notes
    using gin (lower(title) extensions.gin_trgm_ops);
