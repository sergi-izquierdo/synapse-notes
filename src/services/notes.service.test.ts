import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai", () => ({
    generateEmbedding: vi.fn().mockResolvedValue(Array(768).fill(0.1)),
}));

import { generateEmbedding } from "@/lib/ai";
import { createNotesService } from "./notes.service";

const mockedGenerateEmbedding = vi.mocked(generateEmbedding);

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
