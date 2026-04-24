-- QoL follow-up: manual drag-reorder of note cards.
--
-- Adds a `position text` column to public.notes that stores a
-- fractional index (lexicographically ordered string) for each row.
-- Clients generate new positions with the `fractional-indexing` npm
-- package (e.g. generateKeyBetween(prev, next)); the server never
-- invents keys, just writes whatever the client proposes.
--
-- Why text + lexicographic ordering instead of a numeric column:
--   - One-UPDATE-per-drag. A numeric `position int` would force
--     renumbering every subsequent row (N+1 updates) which is the
--     classic anti-pattern used by Figma/Notion/Linear blogs as a
--     cautionary tale.
--   - Float precision runs out after ~52 midpoint splits.
--   - Strings have unbounded precision ('a0', 'a05', 'a055', ...).
--
-- Backfill: assign a zero-padded key per existing row, ordered by
-- created_at DESC within each (user_id, starred) section — so the
-- current dashboard sort is preserved. Keys look like 'a000001' …
-- 'a999999', which sort lex-correctly and leave plenty of room for
-- fractional-indexing midpoint insertions.
--
-- Composite index covers the new dashboard query
--   (user_id, starred DESC, position ASC, created_at DESC)
-- where `position` is the primary key within a section and
-- `created_at` is only a tiebreak for any future NULL rows.
--
-- Idempotent: IF NOT EXISTS on column + index; backfill updates
-- only rows where position IS NULL so re-running doesn't rewrite
-- keys the client has already placed.

alter table public.notes
    add column if not exists position text;

with ordered as (
    select
        id,
        'a' || lpad(
            (row_number() over (
                partition by user_id, starred
                order by created_at desc
            ))::text,
            6,
            '0'
        ) as new_pos
    from public.notes
    where position is null
)
update public.notes
set position = ordered.new_pos
from ordered
where notes.id = ordered.id
  and notes.position is null;

create index if not exists notes_user_section_position_idx
    on public.notes (user_id, starred desc, position);
