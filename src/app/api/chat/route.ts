import { createClient } from "@/lib/supabase/server";
import { anthropic } from "@ai-sdk/anthropic";
import { streamText, generateText, tool, stepCountIs } from "ai";
import { generateEmbedding } from "@/lib/ai";
import { z } from "zod";
import type { ChatRequestMessage, MatchedNote } from "@/types/database";

export const maxDuration = 30;

export async function POST(req: Request) {
    const {
        messages,
        chatId,
        trigger,
    }: {
        messages: ChatRequestMessage[];
        chatId: string | null;
        // The AI SDK client sets this. 'regenerate-message' means the
        // user message is already in the DB from its first send and we
        // should only persist the new assistant reply.
        trigger?: "submit-message" | "regenerate-message";
    } = await req.json();
    const isRegenerate = trigger === "regenerate-message";
    const supabase = await createClient();

    // Extract text content from each message
    const coreMessages = messages.map((m: ChatRequestMessage) => {
        let content = '';
        if (typeof m.content === 'string') {
            content = m.content;
        } else if (Array.isArray(m.parts)) {
            content = m.parts
                .filter((p) => p.type === 'text')
                .map((p) => p.text ?? '')
                .join('\n');
        }
        return { role: m.role, content: content };
    });

    const lastMessage = coreMessages[coreMessages.length - 1];
    const userQuestion = lastMessage.content;

    // Full inventory of the user's live notes. Two reasons to pull
    // tags + content preview here rather than relying on RAG alone:
    //   1. The semantic search runs on match_count and can drop notes
    //      that don't make the top-N even when the exact phrase is
    //      in the content. A title-level index guarantees the model
    //      "knows" every note exists.
    //   2. It gives us the unique-tag set for free.
    //   3. The numeric ID in each line is what the `graph_*` tools
    //      below require to target a specific note.
    const { data: allNotes } = await supabase
        .from('notes')
        .select('id, content, tags')
        .is('archived_at', null)
        .order('created_at', { ascending: false });

    const uniqueTags = Array.from(
        new Set((allNotes ?? []).flatMap((n) => n.tags ?? [])),
    ).join(', ');

    // 1-line excerpt (first non-blank line, capped) — enough for the
    // model to decide whether to pull the full body via RAG or the tag
    // tool, without flooding the context with full markdown. The
    // leading `[id=N]` is what the graph tools use as the handle.
    const inventoryLines = (allNotes ?? []).map((n) => {
        const firstLine =
            String(n.content ?? '')
                .split('\n')
                .map((s) => s.trim())
                .find(Boolean) ?? '';
        const excerpt =
            firstLine.length > 80 ? `${firstLine.slice(0, 80)}…` : firstLine;
        const tagList =
            n.tags && n.tags.length > 0
                ? ` · [${(n.tags as string[]).map((t) => `#${t}`).join(', ')}]`
                : '';
        return `- [id=${n.id}] ${excerpt}${tagList}`;
    });
    const notesInventory =
        inventoryLines.length > 0
            ? inventoryLines.join('\n')
            : 'No notes yet.';

    // RAG Context (Vector Search). Threshold lowered to 0.05 and
    // match_count bumped to 20 so the common case — a user with ~15-30
    // notes — still gets a full pass of what could be relevant.
    const queryEmbedding = await generateEmbedding(userQuestion);

    const { data: similarNotes } = await supabase.rpc("match_notes", {
        query_embedding: queryEmbedding,
        match_threshold: 0.05,
        match_count: 20,
    });

    const ragContext =
        similarNotes?.map((note: MatchedNote) => `NOTE CONTENT: ${note.content}`).join("\n\n") || "No relevant notes found via search.";

    const systemPrompt = `
     You are a helpful assistant for a "Second Brain" app.

     ==============
     📚 EVERY NOTE (title-level inventory — one line per note):
     ${notesInventory}
     ==============

     ==============
     🧠 MEMORY (full content of the most semantically relevant notes):
     ${ragContext}
     ==============

     🏷️ AVAILABLE TAGS:
     [${uniqueTags}]

     INSTRUCTIONS:
     1. **PRIORITY 1: CHECK MEMORY.**
        - Look at the "MEMORY" section above FIRST.
        - If the answer is in the full content, answer directly using it.

     2. **PRIORITY 2: RECOGNISE FROM INVENTORY.**
        - If the MEMORY doesn't fully answer but a matching note appears
          in the INVENTORY, say so and call 'getNotesByTag' with the
          tag that note carries to pull the full body.
        - Never tell the user a note doesn't exist if it is listed in
          the INVENTORY.

     3. **PRIORITY 3: USE TOOLS.**
        - Call 'getNotesByTag' when the user asks for a list/category
          that maps to a tag in AVAILABLE TAGS.
        - Call 'graph_neighbors' when the user asks "what connects to
          note X?", "what's related to this idea?", or wants to
          explore a note's context. Pass the numeric id from the
          INVENTORY's \`[id=N]\` prefix.
        - Call 'graph_shortest_path' when the user asks "how does X
          connect to Y?" or "what's the link between note A and note
          B?". The returned chain explains the bridge notes and the
          edge kinds ('tag' = shared category, 'embed' = semantic
          similarity) at each hop.

     4. **Language:** answer in the user's language.
   `;

    // Define Tool Schema
    const GetNotesByTagSchema = z.object({
        tag: z.string().describe(`The tag to filter by. Must be one of: ${uniqueTags}`),
    });

    // Lazy graph loader — the RPC is only called if the model decides
    // to invoke one of the graph tools. Cached for the duration of
    // this request so back-to-back graph calls don't re-query
    // Postgres.
    type GraphNode = { id: number; title: string; tags: string[]; starred: boolean; created_at: string };
    type GraphLink = { source: number; target: number; weight: number; kind: 'tag' | 'embed' };
    type CachedGraph = {
        nodes: GraphNode[];
        links: GraphLink[];
        adjacency: Map<number, Array<{ neighbour: number; weight: number; kind: 'tag' | 'embed' }>>;
    };
    let graphCache: CachedGraph | null = null;
    const loadGraph = async (): Promise<CachedGraph> => {
        if (graphCache) return graphCache;
        const { data, error } = await supabase.rpc("get_note_graph");
        if (error || !data) {
            graphCache = { nodes: [], links: [], adjacency: new Map() };
            return graphCache;
        }
        const graph = data as { nodes: GraphNode[]; links: GraphLink[] };
        const adjacency = new Map<number, Array<{ neighbour: number; weight: number; kind: 'tag' | 'embed' }>>();
        for (const link of graph.links) {
            if (!adjacency.has(link.source)) adjacency.set(link.source, []);
            if (!adjacency.has(link.target)) adjacency.set(link.target, []);
            adjacency.get(link.source)!.push({ neighbour: link.target, weight: link.weight, kind: link.kind });
            adjacency.get(link.target)!.push({ neighbour: link.source, weight: link.weight, kind: link.kind });
        }
        graphCache = { nodes: graph.nodes, links: graph.links, adjacency };
        return graphCache;
    };

    const GraphNeighboursSchema = z.object({
        noteId: z.number().int().describe("The numeric note id from the INVENTORY (the `id=N` prefix)."),
        depth: z.number().int().min(1).max(3).default(1).describe("1 for direct neighbours, up to 3 for a wider sub-graph."),
        limit: z.number().int().min(1).max(30).default(20).describe("Maximum number of neighbours to return (ordered by edge weight)."),
    });

    const GraphPathSchema = z.object({
        fromId: z.number().int().describe("Starting note id."),
        toId: z.number().int().describe("Destination note id."),
        maxHops: z.number().int().min(1).max(6).default(4).describe("How far the search should walk before giving up."),
    });

    // 5. Generate Response
    const result = streamText({
        model: anthropic("claude-haiku-4-5"),
        system: systemPrompt,
        messages: coreMessages,
        stopWhen: stepCountIs(5),

        tools: {
            getNotesByTag: tool({
                description:
                    "Get a list of notes that have a specific tag. Use this when the user asks for a category.",
                inputSchema: GetNotesByTagSchema,
                execute: async ({ tag }: z.infer<typeof GetNotesByTagSchema>) => {
                    const { data, error } = await supabase
                        .from("notes")
                        .select("content, created_at")
                        .contains("tags", [tag])
                        .limit(20); // Més resultats per tag

                    if (error) return `Error: ${error.message}`;
                    if (!data || data.length === 0) return `No notes found with tag '${tag}'.`;
                    return JSON.stringify(data);
                },
            }),
            graph_neighbors: tool({
                description:
                    "Return the notes directly connected to a given note in the user's knowledge graph. Edges are either `tag` (shared tag, weighted by Jaccard) or `embed` (cosine similarity on embeddings). Use when the user asks `what does X relate to?` or `what's near this idea?`.",
                inputSchema: GraphNeighboursSchema,
                execute: async ({ noteId, depth, limit }: z.infer<typeof GraphNeighboursSchema>) => {
                    const graph = await loadGraph();
                    if (!graph.adjacency.has(noteId)) {
                        return `No graph neighbours for note ${noteId} (it may be unconnected, archived, or the id doesn't belong to the user).`;
                    }
                    // BFS up to `depth`, collecting unique neighbours
                    // with the first edge encountered (the most direct
                    // one) and its weight/kind.
                    const found = new Map<number, { hops: number; weight: number; kind: 'tag' | 'embed' }>();
                    const frontier: Array<{ id: number; hops: number }> = [{ id: noteId, hops: 0 }];
                    const seen = new Set<number>([noteId]);
                    while (frontier.length > 0) {
                        const { id, hops } = frontier.shift()!;
                        if (hops >= depth) continue;
                        const edges = graph.adjacency.get(id) ?? [];
                        for (const edge of edges) {
                            if (seen.has(edge.neighbour)) continue;
                            seen.add(edge.neighbour);
                            found.set(edge.neighbour, { hops: hops + 1, weight: edge.weight, kind: edge.kind });
                            frontier.push({ id: edge.neighbour, hops: hops + 1 });
                        }
                    }
                    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
                    const entries = Array.from(found.entries())
                        .sort((a, b) => b[1].weight - a[1].weight)
                        .slice(0, limit)
                        .map(([id, meta]) => {
                            const node = byId.get(id);
                            return {
                                id,
                                title: node?.title ?? "(unknown)",
                                tags: node?.tags ?? [],
                                hops: meta.hops,
                                edge_kind: meta.kind,
                                edge_weight: Number(meta.weight.toFixed(3)),
                            };
                        });
                    if (entries.length === 0) return `Note ${noteId} has no neighbours within ${depth} hop(s).`;
                    return JSON.stringify(entries);
                },
            }),
            graph_shortest_path: tool({
                description:
                    "Find the shortest chain of notes that connects two ideas via shared tags or embedding similarity. Use when the user asks `how is X connected to Y?` — the chain explains how one idea leads to the other. Returns the path node by node with the edge kind at each hop.",
                inputSchema: GraphPathSchema,
                execute: async ({ fromId, toId, maxHops }: z.infer<typeof GraphPathSchema>) => {
                    if (fromId === toId) return `Same note (${fromId}) — trivial path.`;
                    const graph = await loadGraph();
                    if (!graph.adjacency.has(fromId) || !graph.adjacency.has(toId)) {
                        return `One of the notes (${fromId} or ${toId}) isn't in the graph — check the inventory for a valid id.`;
                    }
                    // BFS with predecessor map
                    const pred = new Map<number, { from: number; kind: 'tag' | 'embed'; weight: number }>();
                    const seen = new Set<number>([fromId]);
                    const q: Array<{ id: number; hops: number }> = [{ id: fromId, hops: 0 }];
                    let found = false;
                    while (q.length > 0) {
                        const { id, hops } = q.shift()!;
                        if (hops >= maxHops) continue;
                        const edges = graph.adjacency.get(id) ?? [];
                        for (const edge of edges) {
                            if (seen.has(edge.neighbour)) continue;
                            seen.add(edge.neighbour);
                            pred.set(edge.neighbour, { from: id, kind: edge.kind, weight: edge.weight });
                            if (edge.neighbour === toId) { found = true; break; }
                            q.push({ id: edge.neighbour, hops: hops + 1 });
                        }
                        if (found) break;
                    }
                    if (!found) return `No path within ${maxHops} hops between ${fromId} and ${toId}.`;
                    // Reconstruct path
                    const chain: Array<{ id: number; title: string; via?: string }> = [];
                    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
                    let cur = toId;
                    while (cur !== fromId) {
                        const p = pred.get(cur)!;
                        chain.unshift({
                            id: cur,
                            title: byId.get(cur)?.title ?? "(unknown)",
                            via: `${p.kind} (w=${p.weight.toFixed(2)}) from ${p.from}`,
                        });
                        cur = p.from;
                    }
                    chain.unshift({ id: fromId, title: byId.get(fromId)?.title ?? "(unknown)" });
                    return JSON.stringify({ hops: chain.length - 1, chain });
                },
            }),
        },

        onFinish: async ({ text }) => {
            if (!chatId) return;
            // On regenerate the user message is already persisted from
            // its first send; only the assistant reply is new.
            if (!isRegenerate) {
                await supabase.from("messages").insert({
                    chat_id: chatId,
                    role: "user",
                    content: userQuestion,
                });
            }
            await supabase.from("messages").insert({
                chat_id: chatId,
                role: "assistant",
                content: text,
            });

            // Auto-generate chat title if still default
            const { data: chat } = await supabase
                .from("chats")
                .select("title")
                .eq("id", chatId)
                .single();

            if (chat?.title === "Nova Conversa") {
                generateText({
                    model: anthropic("claude-haiku-4-5"),
                    prompt: `Generate a very short title (max 6 words) for a conversation that starts with this message. Reply with ONLY the title, no quotes, no punctuation at the end. Use the same language as the message.\n\nMessage: "${userQuestion}"`,
                }).then(async ({ text: title }) => {
                    const cleanTitle = title.trim().replace(/^["']|["']$/g, '').substring(0, 60);
                    if (cleanTitle) {
                        await supabase
                            .from("chats")
                            .update({ title: cleanTitle })
                            .eq("id", chatId);
                    }
                }).catch((err) => {
                    console.error("Error generating chat title:", err);
                });
            }
        },
    });

    return result.toUIMessageStreamResponse();
}