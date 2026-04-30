import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createNotesService } from "@/services/notes.service";

export const getNoteInputSchema = {
    id: z
        .number()
        .int()
        .positive()
        .describe("Numeric id of the note to fetch."),
};

export const getNoteToolDefinition = {
    description:
        "Fetch a single note by id. Read-only. RLS scopes the query to the authenticated user — ids belonging to other users return a not-found error rather than the row.",
    inputSchema: getNoteInputSchema,
};

export function createGetNoteHandler(client: SupabaseClient) {
    const service = createNotesService(client);
    return async ({ id }: { id: number }) => {
        try {
            const note = await service.getNote(id);
            const payload = {
                id: note.id,
                title: note.title,
                content: note.content,
                tags: note.tags,
                starred: note.starred,
                created_at: note.created_at,
                updated_at: note.updated_at,
            };
            return {
                content: [
                    {
                        type: "text" as const,
                        text: JSON.stringify(payload, null, 2),
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
                        text: `Note ${id} not found or not accessible: ${message}`,
                    },
                ],
                isError: true,
            };
        }
    };
}
