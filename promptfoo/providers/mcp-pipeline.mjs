// Promptfoo custom provider that exercises the production
// summarise_notes pipeline end-to-end through the MCP transport.
//
// Per-variant flow:
//   1. POST /api/mcp tools/call create_note with the variant content
//   2. Capture the new note id
//   3. POST /api/mcp tools/call summarise_notes with note_ids=[id]
//   4. Return the response text (judge block message or summary)
//
// Cleanup: every probe is tagged `promptfoo-eval`. The MCP server
// does not expose a `delete_note` tool, so cleanup happens via a
// separate script (`promptfoo/cleanup.mjs`) that uses the service
// role key to bulk-delete notes carrying that tag. Run it after
// `promptfoo:eval` finishes.
//
// Auth: PROMPTFOO_USER_JWT env var holds a fresh Supabase access
// token for the allowlisted user. Tokens expire after 1h. Extract
// via the browser console snippet documented in
// docs/tfg/extend.md Setmana 3 progress-log row.
//
// Cost ceiling: each variant = 1 create_note (1 embedding call) +
// 1 summarise_notes (1 judge call + maybe 1 summariser call).
// ~36 variants = ~0.20 EUR against the 10 EUR Anthropic cap.

const MCP_URL =
    process.env.PROMPTFOO_MCP_URL ?? "https://synapse-notes.vercel.app/api/mcp";

const HEADERS = () => {
    const token = process.env.PROMPTFOO_USER_JWT;
    if (!token) {
        throw new Error(
            "PROMPTFOO_USER_JWT not set. Extract a fresh Supabase access token via the browser console snippet in docs/tfg/extend.md and export it before running promptfoo.",
        );
    }
    return {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${token}`,
    };
};

const createdNoteIds = new Set();

// JSON-RPC id must be an integer (or string), not a float. Some
// MCP servers reject Date.now()+Math.random() floats with -32700.
let nextRpcId = 1;

async function mcpCall(method, name, args) {
    const body = {
        jsonrpc: "2.0",
        id: nextRpcId++,
        method,
        params: { name, arguments: args },
    };
    const res = await fetch(MCP_URL, {
        method: "POST",
        headers: HEADERS(),
        body: JSON.stringify(body),
    });
    const text = await res.text();
    let json;
    try {
        json = JSON.parse(text);
    } catch {
        throw new Error(`MCP non-JSON response (${res.status}): ${text.slice(0, 200)}`);
    }
    if (json.error) {
        throw new Error(
            `MCP error ${json.error.code}: ${json.error.message}`,
        );
    }
    return json.result;
}

function extractIdFromCreateResponse(result) {
    const text = result?.content?.[0]?.text ?? "";
    try {
        const parsed = JSON.parse(text);
        if (typeof parsed.id === "number") return parsed.id;
    } catch {
        /* fall through */
    }
    const m = text.match(/"id"\s*:\s*(\d+)/);
    if (m) return Number(m[1]);
    throw new Error(`Could not extract note id from create_note response: ${text.slice(0, 150)}`);
}

export default class McpSummarisePipelineProvider {
    constructor() {}

    id() {
        return "mcp-summarise-pipeline";
    }

    async callApi(prompt, context) {
        const variantId = context?.vars?.variant_id ?? "unknown";
        const category = context?.vars?.category ?? "uncategorized";
        const title = `Promptfoo variant ${variantId} (${category})`;

        try {
            // 1. Create the probe note. Tagged so cleanup script can
            // find leftovers via service role + tag filter.
            const created = await mcpCall("tools/call", "create_note", {
                title,
                content: prompt,
                tags: ["promptfoo-eval"],
            });
            const noteId = extractIdFromCreateResponse(created);
            createdNoteIds.add(noteId);

            // 2. Summarise it. This is what we are evaluating: does the
            // judge correctly block injection variants and allow legit ones?
            const t0 = Date.now();
            const summary = await mcpCall("tools/call", "summarise_notes", {
                note_ids: [noteId],
            });
            const latency_ms = Date.now() - t0;

            const text = summary?.content?.[0]?.text ?? "";
            const isError = summary?.isError === true;

            return {
                output: text,
                metadata: {
                    isError,
                    noteId,
                    latency_ms,
                    variantId,
                    category,
                },
            };
        } catch (err) {
            return {
                error: err instanceof Error ? err.message : String(err),
            };
        }
    }
}

// Created-id tracking export for diagnostics. Cleanup runs from the
// separate `promptfoo/cleanup.mjs` script via service role key.
export function getCreatedNoteIds() {
    return Array.from(createdNoteIds);
}
