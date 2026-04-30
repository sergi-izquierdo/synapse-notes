import "server-only";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
    createSearchNotesHandler,
    searchNotesToolDefinition,
} from "@/lib/mcp/tools/search-notes";
import {
    createGetNoteHandler,
    getNoteToolDefinition,
} from "@/lib/mcp/tools/get-note";
import {
    createCreateNoteHandler,
    createNoteToolDefinition,
} from "@/lib/mcp/tools/create-note";
import {
    createUpdateNoteHandler,
    updateNoteToolDefinition,
} from "@/lib/mcp/tools/update-note";
import {
    createTagNotesHandler,
    tagNotesToolDefinition,
} from "@/lib/mcp/tools/tag-notes";
import {
    createSummariseNotesHandler,
    summariseNotesToolDefinition,
} from "@/lib/mcp/tools/summarise-notes";
import {
    createGraphNeighborsHandler,
    graphNeighborsToolDefinition,
} from "@/lib/mcp/tools/graph-neighbors";
import {
    createGraphShortestPathHandler,
    graphShortestPathToolDefinition,
} from "@/lib/mcp/tools/graph-shortest-path";
import {
    createRecentNotesReader,
    recentNotesMetadata,
    recentNotesUri,
} from "@/lib/mcp/resources/recent-notes";
import {
    createNotesByTagReader,
    createNotesByTagTemplate,
    notesByTagMetadata,
} from "@/lib/mcp/resources/notes-by-tag";
import {
    createDailyReviewHandler,
    dailyReviewMetadata,
} from "@/lib/mcp/prompts/daily-review";

export function createMcpServer(client: SupabaseClient) {
    const server = new McpServer(
        { name: "synapse-notes-mcp", version: "0.3.0" },
        {
            capabilities: {
                tools: {},
                resources: {},
                prompts: {},
            },
        },
    );

    // ─────────── Tools ───────────
    // Read-only — D2 says no host confirmation needed.
    server.registerTool(
        "search_notes",
        searchNotesToolDefinition,
        createSearchNotesHandler(client),
    );
    server.registerTool(
        "get_note",
        getNoteToolDefinition,
        createGetNoteHandler(client),
    );

    // Mutations — D2 expects the host to gate these.
    server.registerTool(
        "create_note",
        createNoteToolDefinition,
        createCreateNoteHandler(client),
    );
    server.registerTool(
        "update_note",
        updateNoteToolDefinition,
        createUpdateNoteHandler(client),
    );
    server.registerTool(
        "tag_notes",
        tagNotesToolDefinition,
        createTagNotesHandler(client),
    );

    // LLM-derived — Lethal Trifecta surface (see file header). Output
    // filter D3 lands in Setmana 5; until then RLS + system-prompt
    // constraint are the sole defences.
    server.registerTool(
        "summarise_notes",
        summariseNotesToolDefinition,
        createSummariseNotesHandler(client),
    );

    // Graph-aware exploration tools, shared backend with the internal
    // /api/chat handler so external agents see the same view.
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

    // ─────────── Resources ───────────
    server.registerResource(
        "recent-notes",
        recentNotesUri,
        recentNotesMetadata,
        createRecentNotesReader(client),
    );
    server.registerResource(
        "notes-by-tag",
        createNotesByTagTemplate(client),
        notesByTagMetadata,
        createNotesByTagReader(client),
    );

    // ─────────── Prompts ───────────
    server.registerPrompt(
        "daily-review",
        dailyReviewMetadata,
        createDailyReviewHandler(client),
    );

    return server;
}
