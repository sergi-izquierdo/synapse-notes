import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpSupabaseClient, McpAuthError } from "@/lib/mcp/auth";
import { createMcpServer } from "@/lib/mcp/server";

export const runtime = "nodejs";
export const maxDuration = 30;

async function handle(req: Request): Promise<Response> {
    let client;
    try {
        ({ client } = await createMcpSupabaseClient(req));
    } catch (err) {
        const status = err instanceof McpAuthError ? err.status : 500;
        const message = err instanceof Error ? err.message : "Internal error";
        return new Response(JSON.stringify({ error: message }), {
            status,
            headers: { "content-type": "application/json" },
        });
    }

    const server = createMcpServer(client);
    const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
    });
    await server.connect(transport);
    return transport.handleRequest(req);
}

export { handle as GET, handle as POST, handle as DELETE };
