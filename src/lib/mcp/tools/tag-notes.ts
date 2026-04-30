import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createNotesService } from "@/services/notes.service";

export const tagNotesInputSchema = {
    note_ids: z
        .array(z.number().int().positive())
        .min(1)
        .max(200)
        .describe("Ids of the notes to tag (1–200)."),
    add: z
        .array(z.string().min(1).max(40))
        .max(20)
        .optional()
        .describe(
            "Tags to add to every listed note. Idempotent — adding a tag a note already carries is a no-op.",
        ),
    remove: z
        .array(z.string().min(1).max(40))
        .max(20)
        .optional()
        .describe(
            "Tags to remove from every listed note. Idempotent — removing a tag a note doesn't carry is a no-op.",
        ),
};

export const tagNotesToolDefinition = {
    description:
        "Add and/or remove tags across a batch of notes the user owns. Set semantics — duplicates de-duplicated, missing-tag removes ignored. RLS limits the batch to the caller's notes; ids belonging to other users silently disappear from the count.",
    inputSchema: tagNotesInputSchema,
};

export function createTagNotesHandler(client: SupabaseClient) {
    const service = createNotesService(client);
    return async ({
        note_ids,
        add,
        remove,
    }: {
        note_ids: number[];
        add?: string[];
        remove?: string[];
    }) => {
        try {
            const result = await service.applyTagOps({
                noteIds: note_ids,
                add,
                remove,
            });
            return {
                content: [
                    {
                        type: "text" as const,
                        text: JSON.stringify(
                            {
                                requested: note_ids.length,
                                updated: result.updated,
                                added: add ?? [],
                                removed: remove ?? [],
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
                        text: `Failed to apply tag ops: ${message}`,
                    },
                ],
                isError: true,
            };
        }
    };
}
