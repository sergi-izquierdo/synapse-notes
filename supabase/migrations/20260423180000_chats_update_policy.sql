-- Defensive migration for the chat title backfill (docs/tfg/backlog.md §1).
--
-- Symptom: regenerateStaleTitlesAction reports updated: 17 via .select()
-- yet sidebar labels stay on "Nova Conversa". Most likely cause is that
-- public.chats has RLS enabled and a SELECT policy, but no UPDATE policy
-- scoped to the owner — so the UPDATE silently affects zero rows while
-- returning error: null. Postgres + Supabase behaviour.
--
-- This migration creates the owner-scoped UPDATE policy if it does not
-- already exist. Idempotent: running twice is a no-op.

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'chats'
          and policyname = 'Users can update own chats'
    ) then
        create policy "Users can update own chats"
            on public.chats
            for update
            to authenticated
            using (auth.uid() = user_id)
            with check (auth.uid() = user_id);
    end if;
end$$;
