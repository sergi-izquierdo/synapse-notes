import { describe, it, expect, vi } from "vitest";

const mockSelect = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: () => ({ select: mockSelect }),
  }),
}));

describe("GET /api/stats", () => {
  it("returns totalNotes and an ISO 8601 timestamp", async () => {
    mockSelect.mockResolvedValue({ count: 42, error: null });

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.totalNotes).toBe(42);
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it("returns 500 when the database query fails", async () => {
    mockSelect.mockResolvedValue({
      count: null,
      error: { message: "db error" },
    });

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Failed to fetch note count");
  });
});
