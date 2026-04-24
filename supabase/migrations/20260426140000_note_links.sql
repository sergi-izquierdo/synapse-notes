-- User-authored directional links between notes, materialised from
-- [[N]] syntax inside note content. This is the EXTRACTED counterpart
-- to the INFERRED tag/embedding edges already present in the graph:
-- a `source → target` row lives here only if the user explicitly
-- typed the reference inside `source`'s body.
--
-- RLS: every row belongs to its author. We denormalise user_id onto
-- note_links so the policy can be a trivial user_id = auth.uid()
-- without joining to notes — the alternative (join every SELECT)
-- would defeat the composite indexes defined below.
--
-- Cascade: DELETE on either endpoint wipes the link so the graph
-- never ends up with dangling edges.

create table if not exists public.note_links (
    source_id bigint not null references public.notes(id) on delete cascade,
    target_id bigint not null references public.notes(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (source_id, target_id),
    constraint note_links_no_self check (source_id <> target_id)
);

create index if not exists note_links_target_user_idx
    on public.note_links (target_id, user_id);
create index if not exists note_links_source_idx
    on public.note_links (source_id);
create index if not exists note_links_user_idx
    on public.note_links (user_id);

alter table public.note_links enable row level security;

drop policy if exists "note_links_own_select" on public.note_links;
drop policy if exists "note_links_own_insert" on public.note_links;
drop policy if exists "note_links_own_delete" on public.note_links;
drop policy if exists "note_links_own_update" on public.note_links;

create policy "note_links_own_select"
    on public.note_links for select
    using (user_id = auth.uid());
create policy "note_links_own_insert"
    on public.note_links for insert
    with check (user_id = auth.uid());
create policy "note_links_own_delete"
    on public.note_links for delete
    using (user_id = auth.uid());
create policy "note_links_own_update"
    on public.note_links for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

-- Atomic "replace the set of outgoing links from source with
-- exactly these targets". Called after every save (create or
-- update) with the parsed [[N]] targets. Filters silently for
-- targets the caller actually owns + that exist + that aren't
-- archived + that aren't the source itself — invalid refs just
-- don't become edges, no error surfaced to the client.

create or replace function public.sync_note_links(
    p_source_id bigint,
    p_target_ids bigint[]
) returns integer
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
    v_user_id uuid := auth.uid();
    v_inserted integer := 0;
begin
    if v_user_id is null then
        raise exception 'Not authenticated';
    end if;

    if not exists (
        select 1 from public.notes
         where id = p_source_id and user_id = v_user_id
    ) then
        raise exception 'Source note not found or not owned by caller';
    end if;

    delete from public.note_links where source_id = p_source_id;

    if p_target_ids is not null and array_length(p_target_ids, 1) > 0 then
        with valid_targets as (
            select n.id
              from public.notes n
             where n.id = any(p_target_ids)
               and n.user_id = v_user_id
               and n.archived_at is null
               and n.id <> p_source_id
        ), inserted as (
            insert into public.note_links (source_id, target_id, user_id)
            select p_source_id, id, v_user_id from valid_targets
            returning 1
        )
        select count(*) into v_inserted from inserted;
    end if;

    return coalesce(v_inserted, 0);
end;
$$;

revoke all on function public.sync_note_links(bigint, bigint[]) from public;
grant execute on function public.sync_note_links(bigint, bigint[]) to authenticated;

-- Update the graph RPC so link edges surface alongside tag + embed.
-- Link edges are DIRECTIONAL (no least/greatest dedup) and carry
-- weight 1.0 because they represent explicit user intent rather than
-- an inferred similarity score.

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
    link_edges as (
        -- Directional: source → target as written by the user.
        -- Only keep edges between two live notes owned by the caller.
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
