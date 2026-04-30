import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createNotesService } from "@/services/notes.service";

export const updateNoteInputSchema = {
    id: z.number().int().positive().describe("Note id to update."),
    title: z
        .string()
        .max(200)
        .nullable()
        .optional()
        .describe(
            "New title. Pass null to clear, omit to keep current. 200 chars max.",
        ),
    content: z
        .string()
        .min(1)
        .optional()
        .describe(
            "New content. Omit to keep current. Embedding is regenerated only when title or content change.",
        ),
    tags: z
        .array(z.string().min(1).max(40))
        .max(20)
        .optional()
        .describe(
            "Replacement tag set (the full new array, not a delta). Use the `tag_notes` tool for partial add/remove.",
        ),
};

export const updateNoteToolDefinition = {
    // SESSION-SCOPED CONFIRMATION at the host per D2 — first
    // invocation prompts, subsequent ones in the same session auto.
    description:
        "Update an existing note. `undefined` fields are not touched, so this is a partial-update tool: send only the fields you want to change. Tags are replaced wholesale; use `tag_notes` to add or remove individual tags. Hosts should request session-scoped confirmation per D2.",
    inputSchema: updateNoteInputSchema,
};

export function createUpdateNoteHandler(client: SupabaseClient) {
    const service = createNotesService(client);
    return async ({
        id,
        title,
        content,
        tags,
    }: {
        id: number;
        title?: string | null;
        content?: string;
        tags?: string[];
    }) => {
        try {
            const patch: {
                title?: string | null;
                content?: string;
                tags?: string[];
            } = {};
            if (title !== undefined) patch.title = title;
            if (content !== undefined) patch.content = content;
            if (tags !== undefined) patch.tags = tags;

            const note = await service.updateNote(id, patch);
            return {
                content: [
                    {
                        type: "text" as const,
                        text: JSON.stringify(
                            {
                                id: note.id,
                                title: note.title,
                                content: note.content,
                                tags: note.tags,
                                updated_at: note.updated_at,
                            },
                            null,
                            2,
                        ),
                    },
                ],
            };
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Unknown error";
            return {
                content: [
                    {
                        type: "text" as const,
                        text: `Failed to update note ${id}: ${message}`,
                    },
                ],
                isError: true,
            };
        }
    };
}
