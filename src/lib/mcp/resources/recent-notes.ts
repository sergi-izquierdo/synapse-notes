import type { SupabaseClient } from "@supabase/supabase-js";
import { createNotesService } from "@/services/notes.service";

export const recentNotesUri = "notes://recent";

export const recentNotesMetadata = {
    title: "Recent notes",
    description:
        "The 20 most recent live (non-archived) notes the authenticated user owns. Returned as a JSON array — clients should parse and render however they like.",
    mimeType: "application/json",
};

export function createRecentNotesReader(client: SupabaseClient) {
    const service = createNotesService(client);
    return async (uri: URL) => {
        const notes = await service.getRecentNotes(20);
        const payload = notes.map((n) => ({
            id: n.id,
            title: n.title,
            content: n.content,
            tags: n.tags,
            starred: n.starred,
            created_at: n.created_at,
        }));
        return {
            contents: [
                {
                    uri: uri.href,
                    mimeType: "application/json",
                    text: JSON.stringify(payload, null, 2),
                },
            ],
        };
    };
}
