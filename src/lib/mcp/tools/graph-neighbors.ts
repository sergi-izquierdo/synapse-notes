import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createGraphService } from "@/services/graph.service";

export const graphNeighborsInputSchema = {
    noteId: z.number().int().describe("Numeric note id."),
    depth: z
        .number()
        .int()
        .min(1)
        .max(3)
        .optional()
        .describe("1 for direct neighbours, up to 3 for a wider sub-graph. Default 1."),
    limit: z
        .number()
        .int()
        .min(1)
        .max(30)
        .optional()
        .describe("Max neighbours to return, ordered by edge weight. Default 20."),
};

export const graphNeighborsToolDefinition = {
    description:
        "Return the notes directly connected to a given note in the authenticated user's knowledge graph. Edges are either `tag` (shared tag, Jaccard-weighted) or `embed` (pgvector cosine similarity). Use when asking 'what relates to note X?' or 'what's near this idea?'.",
    inputSchema: graphNeighborsInputSchema,
};

export function createGraphNeighborsHandler(client: SupabaseClient) {
    const service = createGraphService(client);
    return async ({
        noteId,
        depth = 1,
        limit = 20,
    }: {
        noteId: number;
        depth?: number;
        limit?: number;
    }) => {
        const entries = await service.neighbours(noteId, depth, limit);
        if (entries === null) {
            return {
                content: [
                    {
                        type: "text" as const,
                        text: `No graph neighbours for note ${noteId} — note is unconnected, archived, or not owned by the caller.`,
                    },
                ],
            };
        }
        if (entries.length === 0) {
            return {
                content: [
                    {
                        type: "text" as const,
                        text: `Note ${noteId} has no neighbours within ${depth} hop(s).`,
                    },
                ],
            };
        }
        return {
            content: [
                {
                    type: "text" as const,
                    text: JSON.stringify(entries, null, 2),
                },
            ],
        };
    };
}
