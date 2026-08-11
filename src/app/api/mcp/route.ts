import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpSupabaseClient, McpAuthError } from "@/lib/mcp/auth";
import { createMcpServer } from "@/lib/mcp/server";

export const runtime = "nodejs";
export const maxDuration = 30;

async function handle(req: Request): Promise<Response> {
    let client;
    let user;
    try {
        ({ client, user } = await createMcpSupabaseClient(req));
    } catch (err) {
        const status = err instanceof McpAuthError ? err.status : 500;
        const message = err instanceof Error ? err.message : "Internal error";
        const headers: Record<string, string> = {
            "content-type": "application/json",
        };
        // RFC 9728: point MCP clients to the OAuth discovery endpoint
        if (status === 401) {
            const origin = new URL(req.url).origin;
            headers["WWW-Authenticate"] =
                `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`;
        }
        return new Response(JSON.stringify({ error: message }), {
            status,
            headers,
        });
    }

    const server = createMcpServer(client, user.id);
    const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
    });
    await server.connect(transport);
    return transport.handleRequest(req);
}

export { handle as GET, handle as POST, handle as DELETE };
