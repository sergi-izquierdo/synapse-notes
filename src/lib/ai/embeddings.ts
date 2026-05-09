import "server-only";

import { generateEmbedding } from "@/lib/ai";
import { assertAiAllowed, isAiGuardError } from "@/lib/ai/guards";

/**
 * Embedding generator with cost-safety degradation (TFG D4).
 *
 * Returns `null` when the AI guard blocks the user (kill-switch off
 * or allowlist-only mode without membership) OR when the underlying
 * Google embedding call fails and `generateEmbedding` falls back to
 * its empty-array escape hatch.
 *
 * Callers should treat `null` as "save the row, but it won't appear
 * in RAG/graph until a successful re-embed". `notes.embedding` is
 * nullable and the HNSW index is partial (`WHERE embedding IS NOT
 * NULL`), so a null vector is structurally fine — the note simply
 * isn't an `embed`-edge candidate in the graph until backfilled.
 *
 * Re-throws any non-guard error so genuine API failures still bubble
 * up and the existing per-action `try/catch` can record them.
 */
export async function tryGenerateEmbedding(
    userId: string,
    text: string,
): Promise<number[] | null> {
    try {
        assertAiAllowed(userId);
    } catch (err) {
        if (isAiGuardError(err)) return null;
        throw err;
    }
    const vector = await generateEmbedding(text);
    return vector.length > 0 ? vector : null;
}
