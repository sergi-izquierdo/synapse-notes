import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createNotesService } from "@/services/notes.service";

export const searchNotesInputSchema = {
    query: z.string().min(1).describe("Natural-language query"),
    limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .describe("Max number of notes to return (default 5)"),
};

export const searchNotesToolDefinition = {
    description:
        "Semantic search over the authenticated user's notes via pgvector similarity.",
    inputSchema: searchNotesInputSchema,
};

export function createSearchNotesHandler(client: SupabaseClient) {
    const service = createNotesService(client);
    return async ({ query, limit }: { query: string; limit?: number }) => {
        const results = await service.searchByEmbedding({ query, limit });
        const payload = results.map((r) => ({
            id: r.id,
            content: r.content,
            similarity: r.similarity,
        }));
        return {
            content: [
                { type: "text" as const, text: JSON.stringify(payload, null, 2) },
            ],
        };
    };
}
