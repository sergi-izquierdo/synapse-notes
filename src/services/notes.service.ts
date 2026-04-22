import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateEmbedding } from "@/lib/ai";
import type { MatchedNote } from "@/types/database";

export interface SearchByEmbeddingOptions {
    query: string;
    limit?: number;
}

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
}

export function createNotesService(client: SupabaseClient) {
    return new NotesService(client);
}
