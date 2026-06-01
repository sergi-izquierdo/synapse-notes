-- Sparsify get_note_graph to avoid hairball as the corpus grows.
--
-- Baseline (69 notes, 4 tag categories): the previous thresholds
-- produced ~935 edges (avg degree 27). Cause:
--   * tag-Jaccard >= 0.2 admits any pair sharing one tag in a small
--     tag vocabulary (two notes both [Compra] -> Jaccard 1.0)
--   * embed top-5 with sim >= 0.75 admits dense neighbourhoods on
--     768d Gemini embeddings
--   * no per-node cap means O(n^2) growth per cluster
--
-- New policy:
--   * tag edges: top-2 strongest per node, threshold >= 0.4
--   * embed edges: top-3 per node, threshold >= 0.82
--   * link edges (user-authored backlinks): kept as-is, they are
--     explicit and rare
--
-- Expected: ~5-7 edges per node on average instead of ~27. Still
-- captures the semantically strongest neighbours; loses long-tail
-- noise that makes the canvas unreadable.

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
            'title', coalesce(
                nullif(trim(n.title), ''),
                case
                    when length(split_part(n.content, E'\n', 1)) > 80
                        then left(split_part(n.content, E'\n', 1), 80) || '...'
                    else coalesce(nullif(split_part(n.content, E'\n', 1), ''), '(empty)')
                end
            ),
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
    -- Tag-Jaccard candidate pairs (a.id < b.id avoids duplicates).
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
    tag_weighted as (
        select a_id, b_id, (intersect_count / nullif(union_count, 0)) as weight
        from tag_pairs
        where union_count > 0 and (intersect_count / union_count) >= 0.4
    ),
    -- Expand into directed views so we can rank top-K per node from
    -- each endpoint's perspective, then dedupe back to undirected.
    tag_directed as (
        select a_id as src, b_id as nbr, weight from tag_weighted
        union all
        select b_id as src, a_id as nbr, weight from tag_weighted
    ),
    tag_ranked as (
        select src, nbr, weight,
               row_number() over (partition by src order by weight desc, nbr) as rk
        from tag_directed
    ),
    tag_edges as (
        select distinct on (least(src, nbr), greatest(src, nbr))
            least(src, nbr) as source,
            greatest(src, nbr) as target,
            weight
        from tag_ranked
        where rk <= 2
        order by least(src, nbr), greatest(src, nbr), weight desc
    ),
    -- Embedding top-K per node from the source's perspective.
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
            limit 3
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
        where similarity >= 0.82
        order by least(src_id, tgt_id), greatest(src_id, tgt_id), similarity desc
    ),
    link_edges as (
        select nl.source_id as source, nl.target_id as target, 1.0::float as weight
        from public.note_links nl
        join public.notes ns on ns.id = nl.source_id and ns.archived_at is null and ns.user_id = v_user_id
        join public.notes nt on nt.id = nl.target_id and nt.archived_at is null and nt.user_id = v_user_id
        where nl.user_id = v_user_id
    ),
    all_edges as (
        select source, target, weight, 'tag' as kind from tag_edges
        union all
        select source, target, weight, 'embed' as kind from embed_edges
        union all
        select source, target, weight, 'link' as kind from link_edges
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
