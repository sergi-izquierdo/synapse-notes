-- QoL-3: star/pin notes (docs/tfg/backlog.md §2 Fase QoL-3).
--
-- Adds a boolean `starred` column so the dashboard can pin notes to
-- the top of the grid. Composite index covers the common listing
-- sort: first starred, then most recent — scoped by user.
--
-- Idempotent: safe to run twice.

alter table public.notes
    add column if not exists starred boolean not null default false;

create index if not exists notes_user_starred_created_idx
    on public.notes (user_id, starred desc, created_at desc);
