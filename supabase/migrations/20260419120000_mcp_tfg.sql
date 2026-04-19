-- TFG Option C: MCP server + background agents support
-- Adds audit trail for agent actions, tag suggestion queue for human-in-the-loop,
-- and an HNSW composite index for RLS-scoped vector search.
--
-- References: docs/tfg/01-scope.md §5

-- -----------------------------------------------------------------------------
-- agent_events: audit trail for every background agent / MCP tool invocation
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_events (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    agent      text NOT NULL,  -- 'auto-tag' | 'embedding-backfill' | 'digest' | 'mcp:<tool>'
    action     text NOT NULL,  -- e.g. 'tag.proposed', 'note.summarised'
    payload    jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_events_user_created_idx
    ON public.agent_events (user_id, created_at DESC);

ALTER TABLE public.agent_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own events" ON public.agent_events;
CREATE POLICY "own events"
    ON public.agent_events
    FOR SELECT
    USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- tag_suggestions: queue of agent-proposed tags, user accepts/rejects before apply
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tag_suggestions (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    note_id    uuid NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
    tag        text NOT NULL,
    status     text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tag_suggestions_user_status_idx
    ON public.tag_suggestions (user_id, status);

CREATE INDEX IF NOT EXISTS tag_suggestions_note_idx
    ON public.tag_suggestions (note_id);

ALTER TABLE public.tag_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own suggestions" ON public.tag_suggestions;
CREATE POLICY "own suggestions"
    ON public.tag_suggestions
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- HNSW index for RLS-scoped vector search. Partial index on non-null embeddings
-- keeps build time and footprint small. Matches the Supabase + Tiger Data
-- recommendation for multi-tenant RAG (pre-filter by RLS, then ANN).
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS notes_user_embedding_idx
    ON public.notes
    USING hnsw (embedding vector_cosine_ops)
    WHERE embedding IS NOT NULL;
