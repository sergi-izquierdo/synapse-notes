import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import type { Note } from "@/types/database";

// Pure service consumed by the auto-tag cron route, by the unit tests,
// and by the offline evaluation script (scripts/eval/auto-tag-eval.mjs).
// Given a note + the user's existing tag library, propose up to 3
// existing tags and at most 1 brand-new tag. Writes proposals to
// `tag_suggestions` (status='pending') for human review and logs an
// agent_events row for observability.
//
// The proposal logic is identical in spirit to /api/suggest-tags, but
// scoped for batch execution: it does not call assertAiAllowed itself,
// because the caller (cron route) checks the allowlist once before the
// per-user loop. Tests and eval scripts bypass the guard entirely.

const SuggestionSchema = z.object({
  existing: z.array(z.string()),
  newTag: z.string().nullable(),
});

export interface AutoTagProposal {
  noteId: number;
  existing: string[];
  newTag: string | null;
}

export interface ProposeForNoteOptions {
  note: Pick<Note, "id" | "title" | "content" | "tags">;
  availableTags: string[];
  userId: string;
  persist?: boolean;
}

class AutoTagService {
  constructor(private readonly client: SupabaseClient) {}

  async findCandidateNotes(
    userId: string,
    options: { limit?: number } = {},
  ): Promise<Pick<Note, "id" | "title" | "content" | "tags">[]> {
    const limit = options.limit ?? 20;
    const { data, error } = await this.client
      .from("notes")
      .select("id, title, content, tags")
      .eq("user_id", userId)
      .is("archived_at", null)
      .or(`tags.eq.{},tags.is.null`)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as Pick<Note, "id" | "title" | "content" | "tags">[];
  }

  async listAvailableTags(userId: string): Promise<string[]> {
    const { data, error } = await this.client
      .from("notes")
      .select("tags")
      .eq("user_id", userId)
      .is("archived_at", null);
    if (error) throw error;
    const seen = new Set<string>();
    for (const row of data ?? []) {
      for (const tag of (row.tags ?? []) as string[]) {
        if (tag) seen.add(tag);
      }
    }
    return [...seen].sort();
  }

  async proposeForNote(
    options: ProposeForNoteOptions,
  ): Promise<AutoTagProposal> {
    const { note, availableTags, userId, persist = true } = options;

    const text = [note.title, note.content].filter(Boolean).join("\n\n");
    if (!text.trim()) {
      return { noteId: note.id, existing: [], newTag: null };
    }

    const tagList =
      availableTags.length > 0
        ? availableTags.map((t) => `- ${t}`).join("\n")
        : "(the user has no tags yet)";

    const { object } = await generateObject({
      model: anthropic("claude-haiku-4-5"),
      schema: SuggestionSchema,
      prompt: `You classify short personal notes into tags.

The user has these existing tags (pick only from this list when possible):
${tagList}

The note content is:
"""
${text.slice(0, 8000)}
"""

Rules:
- Return up to 3 "existing" tags from the list above that genuinely apply to this note. Only echo tags exactly as spelled.
- If the note clearly introduces a topic NOT covered by any existing tag, suggest ONE new tag as "newTag" (lowercase kebab-case, one to three words).
- If nothing fits cleanly, return { "existing": [], "newTag": null }.
- Never return more than 3 existing tags.
- Never invent "existing" tags that aren't in the list.`,
    });

    const existing = object.existing
      .map((t) => t.trim())
      .filter((t) => availableTags.includes(t))
      .slice(0, 3);

    const normalizedNew =
      object.newTag && object.newTag.trim()
        ? object.newTag
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "")
        : null;

    const newTag =
      normalizedNew &&
      !availableTags.some((t) => t.toLowerCase() === normalizedNew) &&
      !existing.some((t) => t.toLowerCase() === normalizedNew)
        ? normalizedNew
        : null;

    const proposal: AutoTagProposal = { noteId: note.id, existing, newTag };

    if (persist) {
      await this.persistProposal({ proposal, userId });
    }

    return proposal;
  }

  private async persistProposal(args: {
    proposal: AutoTagProposal;
    userId: string;
  }): Promise<void> {
    const { proposal, userId } = args;
    const tags = [...proposal.existing];
    if (proposal.newTag) tags.push(proposal.newTag);

    if (tags.length > 0) {
      const rows = tags.map((tag) => ({
        user_id: userId,
        note_id: proposal.noteId,
        tag,
        status: "pending" as const,
      }));
      const { error } = await this.client.from("tag_suggestions").insert(rows);
      if (error) throw error;
    }

    const { error: evtError } = await this.client.from("agent_events").insert({
      user_id: userId,
      agent: "auto-tag",
      action: "tag.proposed",
      payload: {
        note_id: proposal.noteId,
        existing: proposal.existing,
        newTag: proposal.newTag,
      },
    });
    if (evtError) throw evtError;
  }
}

export function createAutoTagService(client: SupabaseClient) {
  return new AutoTagService(client);
}
