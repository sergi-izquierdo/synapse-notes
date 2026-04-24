// Parser for the `[[N]]` backlink syntax used inside note content.
// Returns the deduplicated set of numeric ids the note explicitly
// references. Whitespace inside the brackets is tolerated; a self-
// reference is stripped when `selfId` is provided so the graph
// never ends up with a source == target row.
//
// Kept deliberately tiny: the server action feeds the result
// straight into the `sync_note_links` RPC, and the RPC does the
// real validation (ownership, archived state, existence). The
// regex only has to find the syntactic hits.
export function extractNoteLinks(
    content: string,
    selfId?: number,
): number[] {
    if (!content) return [];
    const pattern = /\[\[\s*(\d+)\s*\]\]/g;
    const ids = new Set<number>();
    for (const match of content.matchAll(pattern)) {
        const id = Number(match[1]);
        if (!Number.isFinite(id) || id <= 0) continue;
        if (selfId !== undefined && id === selfId) continue;
        ids.add(id);
    }
    return [...ids];
}
