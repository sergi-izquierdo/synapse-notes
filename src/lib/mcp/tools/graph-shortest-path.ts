import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createGraphService } from "@/services/graph.service";

export const graphShortestPathInputSchema = {
    fromId: z.number().int().describe("Starting note id."),
    toId: z.number().int().describe("Destination note id."),
    maxHops: z
        .number()
        .int()
        .min(1)
        .max(6)
        .optional()
        .describe("How far the BFS walks before giving up. Default 4."),
};

export const graphShortestPathToolDefinition = {
    description:
        "Find the shortest chain of notes connecting two ideas via shared tags or embedding similarity. Use when the caller asks 'how is X connected to Y?' — the chain explains each bridge note and the edge kind at every hop.",
    inputSchema: graphShortestPathInputSchema,
};

export function createGraphShortestPathHandler(client: SupabaseClient) {
    const service = createGraphService(client);
    return async ({
        fromId,
        toId,
        maxHops = 4,
    }: {
        fromId: number;
        toId: number;
        maxHops?: number;
    }) => {
        const result = await service.shortestPath(fromId, toId, maxHops);
        let text: string;
        switch (result.status) {
            case "same":
                text = `Same note (${fromId}) — trivial path.`;
                break;
            case "missing":
                text = `One of the notes (${fromId} or ${toId}) isn't in the graph.`;
                break;
            case "no_path":
                text = `No path within ${maxHops} hops between ${fromId} and ${toId}.`;
                break;
            case "ok":
                text = JSON.stringify(
                    { hops: result.hops, chain: result.chain },
                    null,
                    2,
                );
                break;
        }
        return { content: [{ type: "text" as const, text }] };
    };
}
