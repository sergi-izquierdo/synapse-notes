import "server-only";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
    createSearchNotesHandler,
    searchNotesToolDefinition,
} from "@/lib/mcp/tools/search-notes";
import {
    createGraphNeighborsHandler,
    graphNeighborsToolDefinition,
} from "@/lib/mcp/tools/graph-neighbors";
import {
    createGraphShortestPathHandler,
    graphShortestPathToolDefinition,
} from "@/lib/mcp/tools/graph-shortest-path";

export function createMcpServer(client: SupabaseClient) {
    const server = new McpServer(
        { name: "synapse-notes-mcp", version: "0.2.0" },
        { capabilities: { tools: {} } },
    );

    server.registerTool(
        "search_notes",
        searchNotesToolDefinition,
        createSearchNotesHandler(client),
    );

    server.registerTool(
        "graph_neighbors",
        graphNeighborsToolDefinition,
        createGraphNeighborsHandler(client),
    );

    server.registerTool(
        "graph_shortest_path",
        graphShortestPathToolDefinition,
        createGraphShortestPathHandler(client),
    );

    return server;
}
