-- Per-user atomic tag-rename and tag-delete operations. Both run
-- SECURITY INVOKER so RLS on `public.notes` is still in force — a
-- caller can only mutate rows they own. Both return the number of
-- notes touched so the client can surface a toast count.
--
-- Rename semantics: every occurrence of `from_tag` in the caller's
-- notes becomes `to_tag`. If a note already carried both `from_tag`
-- and `to_tag` (common when merging two tags), we de-duplicate so
-- tags stays a set, not a multiset. The tag array stays ordered by
-- first appearance within each note.
--
-- Delete semantics: every occurrence of `target_tag` is stripped
-- from the caller's notes. Notes that lose their last tag end up
-- with `tags = '{}'` (empty array), not NULL.

create or replace function public.rename_tag(
    from_tag text,
    to_tag text
) returns integer
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
    v_user_id uuid := auth.uid();
    v_updated integer := 0;
begin
    if v_user_id is null then
        raise exception 'Not authenticated';
    end if;
    if from_tag is null or to_tag is null
       or length(trim(from_tag)) = 0 or length(trim(to_tag)) = 0 then
        raise exception 'from_tag and to_tag must be non-empty';
    end if;
    if from_tag = to_tag then
        return 0;
    end if;

    with updated as (
        update public.notes n
           set tags = (
               -- Replace from_tag with to_tag, then DISTINCT preserves
               -- set semantics (a note that had both from_tag and
               -- to_tag shouldn't carry to_tag twice afterwards).
               select array_agg(t order by idx)
               from (
                   select distinct on (t)
                       case when t = from_tag then to_tag else t end as t,
                       min(ord) as idx
                   from unnest(n.tags) with ordinality as u(t, ord)
                   group by case when t = from_tag then to_tag else t end,
                            case when t = from_tag then to_tag else t end
               ) sub
           )
         where n.user_id = v_user_id
           and n.tags @> array[from_tag]
        returning n.id
    )
    select count(*) into v_updated from updated;

    return v_updated;
end;
$$;

create or replace function public.delete_tag(
    target_tag text
) returns integer
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
    v_user_id uuid := auth.uid();
    v_updated integer := 0;
begin
    if v_user_id is null then
        raise exception 'Not authenticated';
    end if;
    if target_tag is null or length(trim(target_tag)) = 0 then
        raise exception 'target_tag must be non-empty';
    end if;

    with updated as (
        update public.notes n
           set tags = coalesce(
               array(select t from unnest(n.tags) t where t <> target_tag),
               '{}'::text[]
           )
         where n.user_id = v_user_id
           and n.tags @> array[target_tag]
        returning n.id
    )
    select count(*) into v_updated from updated;

    return v_updated;
end;
$$;

revoke all on function public.rename_tag(text, text) from public;
revoke all on function public.delete_tag(text) from public;
grant execute on function public.rename_tag(text, text) to authenticated;
grant execute on function public.delete_tag(text) to authenticated;
