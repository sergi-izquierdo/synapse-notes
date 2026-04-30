import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai", () => ({
    generateEmbedding: vi.fn().mockResolvedValue(Array(768).fill(0.1)),
}));
vi.mock("ai", () => ({
    generateText: vi.fn(),
}));
vi.mock("@ai-sdk/anthropic", () => ({
    anthropic: vi.fn().mockReturnValue("mock-anthropic-model"),
}));

import { generateEmbedding } from "@/lib/ai";
import { generateText } from "ai";
import { createNotesService } from "./notes.service";

const mockedGenerateEmbedding = vi.mocked(generateEmbedding);
const mockedGenerateText = vi.mocked(generateText);

// Build a chainable mock for `client.from("notes").<methods>()` that
// resolves at the leaf via .single() / .limit() / await. Each leaf
// method takes its own resolved value so individual tests can shape
// the response per-call without rebuilding the chain.
//
// Why a builder rather than a single jest.fn() — Supabase queries
// chain method calls before awaiting (`.from().select().eq().single()`),
// and tests need to control which chain step a given test resolves
// at. The builder lets a test say "this select-eq-is-single resolves
// with X, then this insert-select-single resolves with Y".
type LeafResolver = () => Promise<{ data: unknown; error: unknown }>;

function makeFromBuilder(leaves: Record<string, LeafResolver>) {
    const chain: Record<string, unknown> = {};
    const proxyMaker = (path: string[]): unknown =>
        new Proxy(() => undefined, {
            get(_t, key) {
                if (typeof key !== "string") return undefined;
                if (key === "then") {
                    // When the chain itself is awaited (no leaf method),
                    // resolve with the leaf keyed by ".end".
                    const resolver = leaves["end"];
                    if (!resolver) return undefined;
                    return (
                        onFulfilled?: (v: unknown) => unknown,
                        onRejected?: (e: unknown) => unknown,
                    ) => resolver().then(onFulfilled, onRejected);
                }
                return proxyMaker([...path, key]);
            },
            apply(_t, _this, args) {
                const last = path[path.length - 1];
                if (last && leaves[last]) {
                    // Returning a thenable so `await chain.x.y.single()`
                    // resolves with the configured response.
                    return Promise.resolve(leaves[last]!());
                }
                // Non-leaf method calls simply continue the chain.
                void args;
                return proxyMaker(path);
            },
        });
    chain.from = vi.fn(() => proxyMaker([]));
    return chain;
}

describe("NotesService.searchByEmbedding", () => {
    it("calls match_notes with the embedding and the requested limit", async () => {
        const rpc = vi.fn().mockResolvedValue({
            data: [{ id: 1, content: "note 1", similarity: 0.8 }],
            error: null,
        });
        const service = createNotesService({ rpc } as never);

        const results = await service.searchByEmbedding({
            query: "test",
            limit: 3,
        });

        expect(rpc).toHaveBeenCalledWith("match_notes", {
            query_embedding: expect.any(Array),
            match_threshold: 0.1,
            match_count: 3,
        });
        expect(results).toEqual([
            { id: 1, content: "note 1", similarity: 0.8 },
        ]);
    });

    it("defaults limit to 5 when omitted", async () => {
        const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
        const service = createNotesService({ rpc } as never);

        await service.searchByEmbedding({ query: "test" });

        expect(rpc).toHaveBeenCalledWith(
            "match_notes",
            expect.objectContaining({ match_count: 5 }),
        );
    });

    it("returns an empty array when the embedding generator returns nothing", async () => {
        mockedGenerateEmbedding.mockResolvedValueOnce([]);
        const rpc = vi.fn();
        const service = createNotesService({ rpc } as never);

        const results = await service.searchByEmbedding({ query: "" });

        expect(results).toEqual([]);
        expect(rpc).not.toHaveBeenCalled();
    });

    it("throws when the RPC returns an error", async () => {
        const rpc = vi.fn().mockResolvedValue({
            data: null,
            error: { message: "db down" },
        });
        const service = createNotesService({ rpc } as never);

        await expect(
            service.searchByEmbedding({ query: "test" }),
        ).rejects.toThrow(/db down/);
    });
});

describe("NotesService.getNote", () => {
    it("returns the row matching the id when present", async () => {
        const note = {
            id: 42,
            user_id: "u",
            title: "App Budget",
            content: "App de budgeting",
            tags: ["Idees"],
            created_at: "2026-04-30T10:00:00Z",
            updated_at: null,
            embedding: null,
            starred: false,
            archived_at: null,
            position: null,
        };
        const client = makeFromBuilder({
            single: () => Promise.resolve({ data: note, error: null }),
        });
        const service = createNotesService(client as never);

        const result = await service.getNote(42);

        expect(result).toEqual(note);
        expect(client.from).toHaveBeenCalledWith("notes");
    });

    it("throws when the row is missing or RLS hides it", async () => {
        const client = makeFromBuilder({
            single: () =>
                Promise.resolve({
                    data: null,
                    error: { message: "PGRST116: no rows" },
                }),
        });
        const service = createNotesService(client as never);

        await expect(service.getNote(999)).rejects.toThrow(/PGRST116/);
    });
});

describe("NotesService.createNote", () => {
    it("inserts with normalised title and indexed embedding text", async () => {
        const inserted = {
            id: 7,
            user_id: "u",
            title: "Tasques",
            content: "comprar pa",
            tags: ["compra"],
            created_at: "2026-04-30T10:00:00Z",
            updated_at: null,
            embedding: Array(768).fill(0.1),
            starred: false,
            archived_at: null,
            position: null,
        };
        const client = makeFromBuilder({
            single: () => Promise.resolve({ data: inserted, error: null }),
        });
        // createNote needs auth.getUser() because the RLS INSERT policy
        // requires user_id = auth.uid() and the column has no default.
        (client as { auth?: unknown }).auth = {
            getUser: () =>
                Promise.resolve({
                    data: { user: { id: "u" } },
                    error: null,
                }),
        };
        const service = createNotesService(client as never);

        const result = await service.createNote({
            title: "  Tasques  ",
            content: "comprar pa",
            tags: ["compra"],
        });

        expect(result).toEqual(inserted);
        // Embedding generator must receive the title-prefixed text so
        // the new note is recallable by topic name.
        expect(mockedGenerateEmbedding).toHaveBeenCalledWith(
            expect.stringContaining("Tasques\n\ncomprar pa"),
        );
    });

    it("rejects when the content is empty after trimming", async () => {
        const client = makeFromBuilder({});
        const service = createNotesService(client as never);

        await expect(
            service.createNote({ content: "   " }),
        ).rejects.toThrow(/empty/);
    });
});

describe("NotesService.updateNote", () => {
    it("regenerates embedding only when title or content changes", async () => {
        const current = {
            id: 7,
            user_id: "u",
            title: "Old",
            content: "Old body",
            tags: [],
            created_at: "2026-04-30T10:00:00Z",
            updated_at: null,
            embedding: null,
            starred: false,
            archived_at: null,
            position: null,
        };
        const updated = { ...current, tags: ["next"] };
        let singleCallCount = 0;
        const client = makeFromBuilder({
            single: () => {
                singleCallCount++;
                return Promise.resolve({
                    data: singleCallCount === 1 ? current : updated,
                    error: null,
                });
            },
        });
        const service = createNotesService(client as never);
        mockedGenerateEmbedding.mockClear();

        const result = await service.updateNote(7, { tags: ["next"] });

        expect(result).toEqual(updated);
        // Tag-only update — must NOT regenerate embedding.
        expect(mockedGenerateEmbedding).not.toHaveBeenCalled();
    });

    it("regenerates embedding when content changes", async () => {
        const current = {
            id: 7,
            user_id: "u",
            title: "Old",
            content: "Old body",
            tags: [],
            created_at: "2026-04-30T10:00:00Z",
            updated_at: null,
            embedding: null,
            starred: false,
            archived_at: null,
            position: null,
        };
        let singleCallCount = 0;
        const client = makeFromBuilder({
            single: () => {
                singleCallCount++;
                return Promise.resolve({
                    data:
                        singleCallCount === 1
                            ? current
                            : { ...current, content: "New body" },
                    error: null,
                });
            },
        });
        const service = createNotesService(client as never);
        mockedGenerateEmbedding.mockClear();

        await service.updateNote(7, { content: "New body" });

        expect(mockedGenerateEmbedding).toHaveBeenCalledWith(
            expect.stringContaining("New body"),
        );
    });
});

describe("NotesService.applyTagOps", () => {
    it("returns 0 updated when noteIds is empty", async () => {
        const client = makeFromBuilder({});
        const service = createNotesService(client as never);

        const result = await service.applyTagOps({ noteIds: [], add: ["x"] });

        expect(result).toEqual({ updated: 0 });
    });

    it("returns 0 updated when neither add nor remove is set", async () => {
        const client = makeFromBuilder({});
        const service = createNotesService(client as never);

        const result = await service.applyTagOps({ noteIds: [1, 2] });

        expect(result).toEqual({ updated: 0 });
    });
});

describe("NotesService.getRecentNotes", () => {
    it("returns rows ordered by created_at desc with the given limit", async () => {
        const rows = [
            { id: 2, content: "newer" },
            { id: 1, content: "older" },
        ];
        const client = makeFromBuilder({
            limit: () => Promise.resolve({ data: rows, error: null }),
        });
        const service = createNotesService(client as never);

        const result = await service.getRecentNotes(2);

        expect(result).toEqual(rows);
    });

    it("throws when the underlying query errors", async () => {
        const client = makeFromBuilder({
            limit: () =>
                Promise.resolve({
                    data: null,
                    error: { message: "boom" },
                }),
        });
        const service = createNotesService(client as never);

        await expect(service.getRecentNotes()).rejects.toThrow(/boom/);
    });
});

describe("NotesService.getNotesByTag", () => {
    it("filters with `contains` on the tags array", async () => {
        const rows = [{ id: 9, content: "Noms de gat", tags: ["Idees"] }];
        const client = makeFromBuilder({
            limit: () => Promise.resolve({ data: rows, error: null }),
        });
        const service = createNotesService(client as never);

        const result = await service.getNotesByTag("Idees");

        expect(result).toEqual(rows);
    });
});

describe("NotesService.summariseNotes", () => {
    it("returns the empty-result placeholder when no notes match", async () => {
        const client = makeFromBuilder({
            limit: () => Promise.resolve({ data: [], error: null }),
        });
        const service = createNotesService(client as never);

        const result = await service.summariseNotes({});

        expect(result).toBe("(No notes found to summarise.)");
        expect(mockedGenerateText).not.toHaveBeenCalled();
    });

    it("calls Haiku with a system prompt that constrains output", async () => {
        const rows = [
            {
                id: 1,
                title: "Llista",
                content: "comprar pa",
                tags: [],
                user_id: "u",
                created_at: "2026-04-30T10:00:00Z",
                updated_at: null,
                embedding: null,
                starred: false,
                archived_at: null,
                position: null,
            },
        ];
        const client = makeFromBuilder({
            limit: () => Promise.resolve({ data: rows, error: null }),
        });
        const service = createNotesService(client as never);
        mockedGenerateText.mockResolvedValueOnce({
            text: "- comprar pa",
        } as Awaited<ReturnType<typeof generateText>>);

        const result = await service.summariseNotes({ style: "bullets" });

        expect(result).toBe("- comprar pa");
        expect(mockedGenerateText).toHaveBeenCalledWith(
            expect.objectContaining({
                system: expect.stringContaining("summarise"),
                prompt: expect.stringContaining("Llista"),
            }),
        );
    });
});
