import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export class McpAuthError extends Error {
    readonly status: number;

    constructor(message: string, status = 401) {
        super(message);
        this.name = "McpAuthError";
        this.status = status;
    }
}

export function extractBearerToken(req: Request): string {
    const header = req.headers.get("authorization") ?? "";
    if (!header.toLowerCase().startsWith("bearer ")) {
        throw new McpAuthError("Missing or malformed Authorization header");
    }
    const token = header.slice(7).trim();
    if (!token) {
        throw new McpAuthError("Missing bearer token");
    }
    return token;
}

export async function createMcpSupabaseClient(
    req: Request,
): Promise<{ client: SupabaseClient; user: User }> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
        throw new McpAuthError(
            "NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY missing",
            500,
        );
    }

    const token = extractBearerToken(req);

    // MCP clients carry the JWT in the Authorization header, not in cookies.
    // We therefore short-circuit the cookie accessors and inject the bearer
    // token via `global.headers` so every query made with this client runs
    // under the user's JWT and RLS applies automatically.
    const client = createServerClient(url, anonKey, {
        cookies: { getAll: () => [], setAll: () => {} },
        global: {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        },
    });

    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) {
        throw new McpAuthError("Invalid or expired token");
    }

    return { client, user: data.user };
}
