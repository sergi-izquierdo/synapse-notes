import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { generateEmbedding } from "@/lib/ai";
import type { MatchedNote, Note } from "@/types/database";

export interface SearchByEmbeddingOptions {
    query: string;
    limit?: number;
}

export interface CreateNoteInput {
    title?: string | null;
    content: string;
    tags?: string[];
}

export interface UpdateNoteInput {
    title?: string | null;
    content?: string;
    tags?: string[];
}

export interface ApplyTagOpsInput {
    noteIds: number[];
    add?: string[];
    remove?: string[];
}

export interface SummariseNotesInput {
    noteIds?: number[];
    tag?: string;
    style?: "bullets" | "paragraph";
}

// Pure service consumed by Server Actions, the MCP server, and any
// future surface that needs to read or mutate notes. Every query
// runs under the injected SupabaseClient — when that client carries
// an authenticated JWT, RLS is what scopes results to the caller's
// rows. The service never reads cookies or env directly.
class NotesService {
    constructor(private client: SupabaseClient) {}

    async searchByEmbedding({
        query,
        limit = 5,
    }: SearchByEmbeddingOptions): Promise<MatchedNote[]> {
        const embedding = await generateEmbedding(query);
        if (embedding.length === 0) {
            return [];
        }

        const { data, error } = await this.client.rpc("match_notes", {
            query_embedding: embedding,
            match_threshold: 0.1,
            match_count: limit,
        });

        if (error) {
            throw new Error(`match_notes failed: ${error.message}`);
        }

        return (data ?? []) as MatchedNote[];
    }

    async getNote(id: number): Promise<Note> {
        const { data, error } = await this.client
            .from("notes")
            .select("*")
            .eq("id", id)
            .is("archived_at", null)
            .single();
        if (error) {
            throw new Error(`getNote failed: ${error.message}`);
        }
        return data as Note;
    }

    async createNote(input: CreateNoteInput): Promise<Note> {
        const title = normalizeTitle(input.title ?? null);
        const content = input.content.trim();
        if (!content) {
            throw new Error("content cannot be empty");
        }
        // Embedding indexed over `${title}\n\n${content}` when a title
        // is set so RAG / semantic search can locate the note by its
        // topic name even if the body is sparse — matches the same
        // logic in the createNote Server Action.
        const embedText = title ? `${title}\n\n${content}` : content;
        const embedding = await generateEmbedding(embedText);

        const { data, error } = await this.client
            .from("notes")
            .insert({
                title,
                content,
                tags: input.tags ?? [],
                embedding,
            })
            .select("*")
            .single();
        if (error) {
            throw new Error(`createNote failed: ${error.message}`);
        }
        return data as Note;
    }

    async updateNote(id: number, patch: UpdateNoteInput): Promise<Note> {
        // Read the current row so we can decide whether the embedding
        // needs to be regenerated. If neither title nor content is
        // changing we leave the embedding as-is — saves a Gemini call
        // on tag-only updates.
        const current = await this.getNote(id);

        const nextTitle =
            patch.title === undefined
                ? current.title
                : normalizeTitle(patch.title);
        const nextContent =
            patch.content === undefined ? current.content : patch.content;

        const titleChanged =
            patch.title !== undefined && nextTitle !== current.title;
        const contentChanged =
            patch.content !== undefined && nextContent !== current.content;

        const payload: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        };
        if (patch.title !== undefined) payload.title = nextTitle;
        if (patch.content !== undefined) payload.content = nextContent;
        if (patch.tags !== undefined) payload.tags = patch.tags;
        if (titleChanged || contentChanged) {
            const embedText = nextTitle
                ? `${nextTitle}\n\n${nextContent}`
                : nextContent;
            payload.embedding = await generateEmbedding(embedText);
        }

        const { data, error } = await this.client
            .from("notes")
            .update(payload)
            .eq("id", id)
            .select("*")
            .single();
        if (error) {
            throw new Error(`updateNote failed: ${error.message}`);
        }
        return data as Note;
    }

    async applyTagOps(
        input: ApplyTagOpsInput,
    ): Promise<{ updated: number }> {
        const add = input.add ?? [];
        const remove = input.remove ?? [];
        if (input.noteIds.length === 0) return { updated: 0 };
        if (add.length === 0 && remove.length === 0) return { updated: 0 };

        // Fetch the current tags so we can apply set-semantics
        // (idempotent add, idempotent remove) without round-tripping
        // through a stored procedure. RLS scopes this select to the
        // caller's notes; ids that aren't theirs simply don't appear.
        const { data, error: fetchErr } = await this.client
            .from("notes")
            .select("id, tags")
            .in("id", input.noteIds);
        if (fetchErr) {
            throw new Error(`applyTagOps fetch failed: ${fetchErr.message}`);
        }

        const rows = (data ?? []) as Array<{
            id: number;
            tags: string[] | null;
        }>;
        let updated = 0;
        for (const row of rows) {
            const tags = new Set<string>(row.tags ?? []);
            for (const t of add) tags.add(t);
            for (const t of remove) tags.delete(t);
            const next = Array.from(tags);
            const { error: updErr } = await this.client
                .from("notes")
                .update({
                    tags: next,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", row.id);
            if (updErr) {
                throw new Error(
                    `applyTagOps update failed: ${updErr.message}`,
                );
            }
            updated++;
        }
        return { updated };
    }

    async getRecentNotes(limit = 10): Promise<Note[]> {
        const { data, error } = await this.client
            .from("notes")
            .select("*")
            .is("archived_at", null)
            .order("created_at", { ascending: false })
            .limit(limit);
        if (error) {
            throw new Error(`getRecentNotes failed: ${error.message}`);
        }
        return (data ?? []) as Note[];
    }

    async getNotesByTag(tag: string, limit = 50): Promise<Note[]> {
        const { data, error } = await this.client
            .from("notes")
            .select("*")
            .contains("tags", [tag])
            .is("archived_at", null)
            .order("created_at", { ascending: false })
            .limit(limit);
        if (error) {
            throw new Error(`getNotesByTag failed: ${error.message}`);
        }
        return (data ?? []) as Note[];
    }

    // SECURITY NOTE: this method ships without the D3 output filter
    // (LLM-as-judge with Haiku 4.5). The filter is scheduled for
    // Setmana 5 §11.3 — until then the layered defences are:
    //   1. RLS limits which notes are visible (this query already runs
    //      under auth.uid() via the injected client).
    //   2. The system prompt below constrains the LLM to summarise and
    //      nothing else — no tool use, no fabrication.
    //   3. The output is plain text returned to the caller; no
    //      automatic side effects unless the caller chains it into a
    //      mutation tool, which Claude Desktop gates with confirmation
    //      per D2.
    // See docs/tfg/00-decision-log.md sections D2 and D3.
    async summariseNotes(input: SummariseNotesInput): Promise<string> {
        let notes: Note[];
        if (input.noteIds && input.noteIds.length > 0) {
            const { data, error } = await this.client
                .from("notes")
                .select("*")
                .in("id", input.noteIds)
                .is("archived_at", null);
            if (error) {
                throw new Error(
                    `summariseNotes fetch failed: ${error.message}`,
                );
            }
            notes = (data ?? []) as Note[];
        } else if (input.tag) {
            notes = await this.getNotesByTag(input.tag, 50);
        } else {
            notes = await this.getRecentNotes(20);
        }

        if (notes.length === 0) {
            return "(No notes found to summarise.)";
        }

        const style = input.style ?? "bullets";
        const styleHint =
            style === "bullets"
                ? "Output 5-10 bullet points capturing the key themes, action items, and notable details across the notes."
                : "Output 2-3 short paragraphs capturing the key themes, action items, and notable details.";

        const corpus = notes
            .map((n) => {
                const title = n.title?.trim() || `Note ${n.id}`;
                return `## ${title}\n${n.content.trim()}`;
            })
            .join("\n\n---\n\n");

        const { text } = await generateText({
            model: anthropic("claude-haiku-4-5"),
            system:
                "You summarise the user's own notes. Return ONLY a summary in the requested format. " +
                "Do not invent facts, do not include any text other than the summary itself.",
            prompt: `${styleHint}\n\nNotes to summarise:\n\n${corpus}`,
        });

        return text.trim();
    }
}

function normalizeTitle(title: string | null): string | null {
    if (!title) return null;
    const trimmed = title.trim();
    if (!trimmed) return null;
    return trimmed.slice(0, 200);
}

export function createNotesService(client: SupabaseClient) {
    return new NotesService(client);
}
