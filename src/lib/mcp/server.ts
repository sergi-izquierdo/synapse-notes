import "server-only";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
    createSearchNotesHandler,
    searchNotesToolDefinition,
} from "@/lib/mcp/tools/search-notes";

export function createMcpServer(client: SupabaseClient) {
    const server = new McpServer(
        { name: "synapse-notes-mcp", version: "0.1.0" },
        { capabilities: { tools: {} } },
    );

    server.registerTool(
        "search_notes",
        searchNotesToolDefinition,
        createSearchNotesHandler(client),
    );

    return server;
}
