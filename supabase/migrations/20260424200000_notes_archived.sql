-- QoL-7: soft-delete via archive (docs/tfg/backlog.md §2 Fase QoL-7).
--
-- `archived_at IS NULL` is the "live" state. When a user archives a
-- note we stamp the column; unarchiving clears it. The dashboard
-- query stays simple (`.is('archived_at', null)`), the row keeps its
-- embedding, and restoring costs zero additional Gemini calls.
--
-- Partial index on archived_at IS NULL speeds up the dashboard query
-- — the common path — without bloating the index with archived rows.
-- Idempotent.

alter table public.notes
    add column if not exists archived_at timestamptz;

create index if not exists notes_user_live_created_idx
    on public.notes (user_id, created_at desc)
    where archived_at is null;
