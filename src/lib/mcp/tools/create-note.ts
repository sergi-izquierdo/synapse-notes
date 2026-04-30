import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createNotesService } from "@/services/notes.service";

export const createNoteInputSchema = {
    title: z
        .string()
        .max(200)
        .nullable()
        .optional()
        .describe(
            "Optional explicit title (max 200 chars). When omitted the graph and inventory fall back to the first content line.",
        ),
    content: z
        .string()
        .min(1)
        .describe("Body of the note in markdown. Required."),
    tags: z
        .array(z.string().min(1).max(40))
        .max(20)
        .optional()
        .describe("Up to 20 tags. Each tag 1–40 chars."),
};

export const createNoteToolDefinition = {
    // PER-CALL CONFIRMATION expected at the host level (Claude Desktop
    // and other MCP clients gate this tool with their own approval UI
    // per docs/tfg/00-decision-log.md D2). The server itself doesn't
    // enforce approval — it relies on the host because the MCP wire
    // protocol leaves approval semantics to the client.
    description:
        "Create a new note in the authenticated user's library. The note's embedding is generated server-side over `${title}\\n\\n${content}` so semantic search can recall it by topic. Hosts SHOULD prompt the user for confirmation before invoking — this tool can be chained from `summarise_notes` and that path is the Lethal Trifecta vector D3 covers.",
    inputSchema: createNoteInputSchema,
};

export function createCreateNoteHandler(client: SupabaseClient) {
    const service = createNotesService(client);
    return async ({
        title,
        content,
        tags,
    }: {
        title?: string | null;
        content: string;
        tags?: string[];
    }) => {
        try {
            const note = await service.createNote({ title, content, tags });
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
                                created_at: note.created_at,
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
                        text: `Failed to create note: ${message}`,
                    },
                ],
                isError: true,
            };
        }
    };
}
