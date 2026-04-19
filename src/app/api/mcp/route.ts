import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { generateEmbedding } from "@/lib/ai";
import type { MatchedNote } from "@/types/database";

export const runtime = "nodejs";
export const maxDuration = 30;

// PoC auth: hardcoded Bearer token + hardcoded user_id.
// Phase 2 will replace this with Supabase JWT passthrough + user-scoped client.
function assertAuthorized(req: Request): string {
    const expected = process.env.MCP_POC_TOKEN;
    const pocUserId = process.env.MCP_POC_USER_ID;
    if (!expected || !pocUserId) {
        throw new Error("MCP_POC_TOKEN and MCP_POC_USER_ID must be set");
    }
    const header = req.headers.get("authorization") ?? "";
    const token = header.toLowerCase().startsWith("bearer ")
        ? header.slice(7).trim()
        : "";
    if (token !== expected) {
        const err = new Error("Unauthorized") as Error & { status?: number };
        err.status = 401;
        throw err;
    }
    return pocUserId;
}

function createAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
        throw new Error("Supabase URL or service role key missing");
    }
    return createSupabaseClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}

async function handle(req: Request): Promise<Response> {
    let pocUserId: string;
    try {
        pocUserId = assertAuthorized(req);
    } catch (err) {
        const status = (err as { status?: number }).status ?? 500;
        return new Response(
            JSON.stringify({ error: (err as Error).message }),
            { status, headers: { "content-type": "application/json" } },
        );
    }

    const server = new McpServer(
        { name: "synapse-notes-mcp", version: "0.0.1" },
        { capabilities: { tools: {} } },
    );

    server.registerTool(
        "search_notes",
        {
            description:
                "Semantic search over the authenticated user's notes via pgvector similarity.",
            inputSchema: {
                query: z.string().min(1).describe("Natural-language query"),
                limit: z
                    .number()
                    .int()
                    .min(1)
                    .max(20)
                    .optional()
                    .describe("Max number of notes to return (default 5)"),
            },
        },
        async ({ query, limit }) => {
            const topN = limit ?? 5;
            const admin = createAdminClient();
            const queryEmbedding = await generateEmbedding(query);

            // Oversample to leave room for user-scoped post-filter.
            const { data: candidates, error: rpcError } = await admin.rpc(
                "match_notes",
                {
                    query_embedding: queryEmbedding,
                    match_threshold: 0.1,
                    match_count: topN * 5,
                },
            );
            if (rpcError) throw new Error(`match_notes failed: ${rpcError.message}`);

            const matched = (candidates ?? []) as MatchedNote[];
            if (matched.length === 0) {
                return {
                    content: [{ type: "text", text: "[]" }],
                };
            }

            // PoC ownership filter: service-role bypasses RLS, so we enforce
            // user scoping in a second query. Phase 2 will do this via RLS.
            const { data: owned, error: ownedError } = await admin
                .from("notes")
                .select("id")
                .eq("user_id", pocUserId)
                .in(
                    "id",
                    matched.map((n) => n.id),
                );
            if (ownedError) throw new Error(`ownership lookup failed: ${ownedError.message}`);

            const ownedIds = new Set((owned ?? []).map((n) => n.id));
            const scoped = matched
                .filter((n) => ownedIds.has(n.id))
                .slice(0, topN)
                .map((n) => ({
                    id: n.id,
                    content: n.content,
                    similarity: n.similarity,
                }));

            return {
                content: [
                    { type: "text", text: JSON.stringify(scoped, null, 2) },
                ],
            };
        },
    );

    const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless
        enableJsonResponse: true,
    });
    await server.connect(transport);
    return transport.handleRequest(req);
}

export { handle as GET, handle as POST, handle as DELETE };
