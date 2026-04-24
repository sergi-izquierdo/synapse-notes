-- Rewrite positions to library-canonical fractional-indexing keys.
--
-- The earlier backfill (20260425120000_notes_position.sql) used
-- `'a' || lpad(rn::text, 6, '0')` which produces strings like
-- 'a000010', 'a000020' — those are INVALID keys for the
-- `fractional-indexing` library: the integer part is 'a0' (length 2
-- for head 'a') and the fractional part is '00010', which ends in
-- '0'. The library rejects such keys on generateKeyBetween with
-- "invalid order key".
--
-- Fix: assign new compact 2-char keys 'a0'..'a9','aA'..'aZ','aa'..'az'
-- to all rows in each (user, starred) section based on their CURRENT
-- order (position ASC NULLS LAST, created_at DESC). These are the
-- exact keys `generateNKeysBetween(null, null, N)` would emit, so
-- every downstream call is guaranteed valid.
--
-- Preserves any in-flight drag orders because they're already
-- reflected in the current position sort. Section capacity: 62 rows
-- at 2-char length; sections beyond that fall back to `'z' || idx`
-- which is still distinct and lex-sortable, even if not canonical.
-- Not expected at the current project scale.

with ordered as (
    select
        id,
        row_number() over (
            partition by user_id, starred
            order by position asc nulls last, created_at desc
        ) - 1 as idx
    from public.notes
    where position is not null
)
update public.notes
set position = 'a' || case
    when ordered.idx < 10 then chr(48 + ordered.idx)        -- '0'..'9'
    when ordered.idx < 36 then chr(65 + ordered.idx - 10)   -- 'A'..'Z'
    when ordered.idx < 62 then chr(97 + ordered.idx - 36)   -- 'a'..'z'
    else 'z' || ordered.idx::text                           -- safety fallback
end
from ordered
where notes.id = ordered.id;
