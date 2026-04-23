-- Defensive migration for the chat message mutations (regenerate,
-- edit, delete).
--
-- Symptom: deleteMessageAction and deleteMessageAndFollowingAction
-- both reported success via supabase-js yet the rows stayed put.
-- Regenerate then left the stale assistant in the DB, the new one
-- was inserted on top, and the reload showed the chat duplicating
-- every turn.
--
-- Root cause: public.messages has RLS enabled with INSERT + SELECT
-- policies but no DELETE/UPDATE policy, so supabase-js silently 0-row
-- affects every mutation (error: null). Same pattern we hit on
-- public.chats UPDATE in 20260423180000_chats_update_policy.sql.
--
-- Both policies gate on the caller owning the parent chat. Idempotent.

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'messages'
          and policyname = 'Users can delete messages of their chats'
    ) then
        create policy "Users can delete messages of their chats"
            on public.messages
            for delete
            to authenticated
            using (
                exists (
                    select 1
                    from public.chats c
                    where c.id = messages.chat_id
                      and c.user_id = auth.uid()
                )
            );
    end if;

    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'messages'
          and policyname = 'Users can update messages of their chats'
    ) then
        create policy "Users can update messages of their chats"
            on public.messages
            for update
            to authenticated
            using (
                exists (
                    select 1
                    from public.chats c
                    where c.id = messages.chat_id
                      and c.user_id = auth.uid()
                )
            )
            with check (
                exists (
                    select 1
                    from public.chats c
                    where c.id = messages.chat_id
                      and c.user_id = auth.uid()
                )
            );
    end if;
end$$;
