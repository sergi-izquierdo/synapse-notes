-- Hotfix #2: the first hotfix used
--   set search_path = 'public, pg_catalog'
-- which Postgres stores as a SINGLE schema named
-- "public, pg_catalog" (the surrounding quotes collapse the list
-- into one identifier). At call time `public` is therefore NOT on
-- the search_path, so pgvector's `<=>` cosine-distance operator
-- still fails to resolve:
--   operator does not exist: public.vector <=> public.vector
--
-- Correct syntax uses unquoted identifiers separated by commas,
-- so both schemas end up on the runtime path. Every TABLE
-- reference in the body stays fully qualified as `public.notes`,
-- function stays SECURITY INVOKER, so RLS applies the same way.

create or replace function public.get_note_graph()
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
    v_user_id uuid := auth.uid();
    nodes_json jsonb;
    links_json jsonb;
begin
    if v_user_id is null then
        return jsonb_build_object(
            'nodes', '[]'::jsonb,
            'links', '[]'::jsonb,
            'meta', jsonb_build_object('userId', null, 'nodeCount', 0, 'linkCount', 0)
        );
    end if;

    select coalesce(jsonb_agg(
        jsonb_build_object(
            'id', n.id,
            'title', case
                when length(split_part(n.content, E'\n', 1)) > 80
                    then left(split_part(n.content, E'\n', 1), 80) || '…'
                else coalesce(nullif(split_part(n.content, E'\n', 1), ''), '(empty)')
            end,
            'tags', coalesce(n.tags, '{}'::text[]),
            'starred', n.starred,
            'created_at', n.created_at
        )
        order by n.id
    ), '[]'::jsonb)
    into nodes_json
    from public.notes n
    where n.user_id = v_user_id
      and n.archived_at is null;

    with
    tag_pairs as (
        select
            a.id as a_id,
            b.id as b_id,
            (select count(*)::float from unnest(a.tags) t where t = any(b.tags)) as intersect_count,
            (select count(distinct t)::float from (select unnest(a.tags) as t union select unnest(b.tags) as t) u) as union_count
        from public.notes a
        join public.notes b on a.id < b.id
        where a.user_id = v_user_id
          and b.user_id = v_user_id
          and a.archived_at is null
          and b.archived_at is null
          and a.tags && b.tags
    ),
    tag_edges as (
        select a_id as source, b_id as target, (intersect_count / nullif(union_count, 0)) as weight
        from tag_pairs
        where union_count > 0 and (intersect_count / union_count) >= 0.2
    ),
    embed_raw as (
        select src.id as src_id, tgt.id as tgt_id, 1 - (src.embedding <=> tgt.embedding) as similarity
        from public.notes src
        cross join lateral (
            select n2.id, n2.embedding
            from public.notes n2
            where n2.user_id = v_user_id
              and n2.archived_at is null
              and n2.embedding is not null
              and n2.id <> src.id
            order by src.embedding <=> n2.embedding
            limit 5
        ) tgt
        where src.user_id = v_user_id
          and src.archived_at is null
          and src.embedding is not null
    ),
    embed_edges as (
        select distinct on (least(src_id, tgt_id), greatest(src_id, tgt_id))
            least(src_id, tgt_id) as source,
            greatest(src_id, tgt_id) as target,
            similarity as weight
        from embed_raw
        where similarity >= 0.75
        order by least(src_id, tgt_id), greatest(src_id, tgt_id), similarity desc
    ),
    all_edges as (
        select source, target, weight, 'tag' as kind from tag_edges
        union all
        select source, target, weight, 'embed' as kind from embed_edges
    )
    select coalesce(jsonb_agg(
        jsonb_build_object(
            'source', source,
            'target', target,
            'weight', round(weight::numeric, 3),
            'kind', kind
        )
    ), '[]'::jsonb)
    into links_json
    from all_edges;

    return jsonb_build_object(
        'nodes', nodes_json,
        'links', links_json,
        'meta', jsonb_build_object(
            'userId', v_user_id,
            'nodeCount', jsonb_array_length(nodes_json),
            'linkCount', jsonb_array_length(links_json),
            'generatedAt', now()
        )
    );
end;
$$;

revoke all on function public.get_note_graph() from public;
grant execute on function public.get_note_graph() to authenticated;
