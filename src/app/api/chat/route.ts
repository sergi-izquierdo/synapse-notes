import { createClient } from "@/lib/supabase/server";
import { google } from "@ai-sdk/google";
import { streamText, tool, stepCountIs } from "ai";
import { generateEmbedding } from "@/lib/ai";
import { z } from "zod";
import type { ChatRequestMessage, MatchedNote } from "@/types/database";

export const maxDuration = 30;

export async function POST(req: Request) {
    const { messages, chatId }: { messages: ChatRequestMessage[]; chatId: string | null } = await req.json();
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

    // 2. Obtenir tags existents
    const { data: allNotesTags } = await supabase.from('notes').select('tags');
    const uniqueTags = Array.from(new Set(allNotesTags?.flatMap(n => n.tags) || [])).join(', ');

    // RAG Context (Vector Search)
    const queryEmbedding = await generateEmbedding(userQuestion);

    const { data: similarNotes } = await supabase.rpc("match_notes", {
        query_embedding: queryEmbedding,
        match_threshold: 0.1,
        match_count: 10,
    });

    const ragContext =
        similarNotes?.map((note: MatchedNote) => `NOTE CONTENT: ${note.content}`).join("\n\n") || "No relevant notes found via search.";

    // 4. Prompt d'Enginyeria (Híbrid)
    const systemPrompt = `
     You are a helpful assistant for a "Second Brain" app.
     
     ==============
     🧠 MEMORY (CONTEXT FROM NOTES):
     ${ragContext}
     ==============

     🏷️ AVAILABLE TAGS:
     [${uniqueTags}]
     
     INSTRUCTIONS:
     1. **PRIORITY 1: CHECK MEMORY.** 
        - Look at the "MEMORY" section above FIRST. 
        - If the answer to the user's question is there, answer directly using that information.
        - Example: If user asks "dog names" and you see "Kuro" in memory, answer "Your dogs are Kuro...".

     2. **PRIORITY 2: USE TOOLS (Only if needed).**
        - ONLY use the 'getNotesByTag' tool if the user explicitly asks for a *list*, *category*, or *tag* that you don't fully see in memory.
        - If user asks for "ideas" and the memory is empty, try the tool with tag "Ideas" or "Idees".
    
     3. **Language:**
        - Answer in the user's language.
   `;

    // Define Tool Schema
    const GetNotesByTagSchema = z.object({
        tag: z.string().describe(`The tag to filter by. Must be one of: ${uniqueTags}`),
    });

    // 5. Generate Response
    const result = streamText({
        model: google("gemini-2.5-flash"),
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
            await supabase.from("messages").insert({
                chat_id: chatId,
                role: "user",
                content: userQuestion,
            });
            await supabase.from("messages").insert({
                chat_id: chatId,
                role: "assistant",
                content: text,
            });
        },
    });

    return result.toUIMessageStreamResponse();
}