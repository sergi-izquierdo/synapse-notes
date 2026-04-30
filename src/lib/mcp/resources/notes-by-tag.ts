import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createNotesService } from "@/services/notes.service";

export const notesByTagMetadata = {
    title: "Notes filtered by tag",
    description:
        "Every live note carrying the `{tag}` tag (capped at 50 rows). The completion callback offers the caller's tag library so MCP clients can autocomplete.",
    mimeType: "application/json",
};

export function createNotesByTagTemplate(client: SupabaseClient) {
    return new ResourceTemplate("notes://tag/{tag}", {
        // Listing every {tag} expansion would require pre-enumerating
        // the user's tag library. The MCP spec allows `undefined` to
        // mean "do not enumerate", which is what we want — clients
        // discover tags through completion (below) instead.
        list: undefined,
        complete: {
            tag: async (partial: string) => {
                const { data, error } = await client
                    .from("notes")
                    .select("tags")
                    .is("archived_at", null);
                if (error || !data) return [];
                const all = new Set<string>();
                for (const row of data as Array<{ tags: string[] | null }>) {
                    for (const t of row.tags ?? []) all.add(t);
                }
                const lower = partial.toLowerCase();
                return Array.from(all)
                    .filter((t) => t.toLowerCase().includes(lower))
                    .sort()
                    .slice(0, 20);
            },
        },
    });
}

export function createNotesByTagReader(client: SupabaseClient) {
    const service = createNotesService(client);
    return async (
        uri: URL,
        variables: Record<string, string | string[]>,
    ) => {
        // ResourceTemplate variables can be string or string[] when
        // multiple values are bound; URI templates with a single
        // `{tag}` segment deliver a string. Coerce defensively.
        const raw = variables.tag;
        const tag = Array.isArray(raw) ? raw[0] : raw;
        const safeTag = (tag ?? "").trim();
        if (!safeTag) {
            return {
                contents: [
                    {
                        uri: uri.href,
                        mimeType: "application/json",
                        text: "[]",
                    },
                ],
            };
        }
        const notes = await service.getNotesByTag(safeTag, 50);
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
