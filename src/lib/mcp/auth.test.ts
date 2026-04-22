import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@supabase/ssr", () => ({
    createServerClient: vi.fn(),
}));

import { createServerClient } from "@supabase/ssr";
import {
    createMcpSupabaseClient,
    extractBearerToken,
    McpAuthError,
} from "./auth";

const mockedCreateServerClient = vi.mocked(createServerClient);

describe("extractBearerToken", () => {
    it("returns the token when the header is well-formed", () => {
        const req = new Request("http://localhost/api/mcp", {
            headers: { Authorization: "Bearer abc.def.ghi" },
        });
        expect(extractBearerToken(req)).toBe("abc.def.ghi");
    });

    it("throws when the header is missing", () => {
        const req = new Request("http://localhost/api/mcp");
        expect(() => extractBearerToken(req)).toThrow(McpAuthError);
    });

    it("throws when the scheme is not Bearer", () => {
        const req = new Request("http://localhost/api/mcp", {
            headers: { Authorization: "Basic abc" },
        });
        expect(() => extractBearerToken(req)).toThrow(McpAuthError);
    });

    it("throws when the token is empty after the scheme", () => {
        const req = new Request("http://localhost/api/mcp", {
            headers: { Authorization: "Bearer " },
        });
        expect(() => extractBearerToken(req)).toThrow(McpAuthError);
    });
});

describe("createMcpSupabaseClient", () => {
    beforeEach(() => {
        vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
        vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
        mockedCreateServerClient.mockReset();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("rejects with 401 when the JWT is invalid", async () => {
        mockedCreateServerClient.mockReturnValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({
                    data: { user: null },
                    error: new Error("invalid token"),
                }),
            },
        } as never);

        const req = new Request("http://localhost/api/mcp", {
            headers: { Authorization: "Bearer invalid-jwt" },
        });

        await expect(createMcpSupabaseClient(req)).rejects.toMatchObject({
            name: "McpAuthError",
            status: 401,
        });
    });

    it("returns the client and the user when the JWT validates", async () => {
        const fakeUser = { id: "user-1", email: "u@test.com" } as never;
        const fakeClient = {
            auth: {
                getUser: vi.fn().mockResolvedValue({
                    data: { user: fakeUser },
                    error: null,
                }),
            },
        };
        mockedCreateServerClient.mockReturnValue(fakeClient as never);

        const req = new Request("http://localhost/api/mcp", {
            headers: { Authorization: "Bearer valid-jwt" },
        });

        const { client, user } = await createMcpSupabaseClient(req);

        expect(user).toBe(fakeUser);
        expect(client).toBe(fakeClient);
        expect(mockedCreateServerClient).toHaveBeenCalledWith(
            "https://test.supabase.co",
            "anon-key",
            expect.objectContaining({
                global: expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: "Bearer valid-jwt",
                    }),
                }),
            }),
        );
    });

    it("returns a 500 McpAuthError when Supabase env vars are missing", async () => {
        vi.unstubAllEnvs();

        const req = new Request("http://localhost/api/mcp", {
            headers: { Authorization: "Bearer whatever" },
        });

        await expect(createMcpSupabaseClient(req)).rejects.toMatchObject({
            name: "McpAuthError",
            status: 500,
        });
    });
});
