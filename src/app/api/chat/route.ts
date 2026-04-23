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
    // tool, without flooding the context with full markdown.
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
        return `- ${excerpt}${tagList}`;
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

     4. **Language:** answer in the user's language.
   `;

    // Define Tool Schema
    const GetNotesByTagSchema = z.object({
        tag: z.string().describe(`The tag to filter by. Must be one of: ${uniqueTags}`),
    });

    // 5. Generate Response
    const result = streamText({
        model: anthropic("claude-haiku-4-5"),
        system: systemPrompt,
        messages: coreMessages,
        stopWhen: stepCountIs(3),

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