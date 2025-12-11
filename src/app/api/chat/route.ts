import { createClient } from "@/lib/supabase/server";
import { google } from "@ai-sdk/google";
import { streamText, convertToCoreMessages, tool, stepCountIs } from "ai";
import { generateEmbedding } from "@/lib/ai";
import { z } from "zod";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages, chatId } = await req.json();
  const supabase = await createClient();

  // console.log("API Chat received. ChatID:", chatId);

  const lastMessage = messages[messages.length - 1];
  let userQuestion = "";

  // 1. Robust text extraction (String or Multipart)
  if (typeof lastMessage.content === "string") {
    userQuestion = lastMessage.content;
  } else if (Array.isArray(lastMessage.parts)) {
    userQuestion = lastMessage.parts
      .filter((part: any) => part.type === "text")
      .map((part: any) => part.text)
      .join("\n");
  }

  // 2. RAG Context (Vector Search)
  const queryEmbedding = await generateEmbedding(userQuestion);
  const { data: similarNotes } = await supabase.rpc("match_notes", {
    query_embedding: queryEmbedding,
    match_threshold: 0.3,
    match_count: 5,
  });

  const ragContext =
    similarNotes?.map((note: any) => note.content).join("\n\n") || "";

  const systemPrompt = `
    You are a helpful assistant for a "Second Brain" app.
    
    STANDARD CONTEXT (From Vector Search):
    ${ragContext}
    
    INSTRUCTIONS:
    1. **Tool Use (Tags):** 
       - If the user asks for a category, list, or tag (e.g., "my ideas", "shopping list", "things to buy"), use the 'getNotesByTag' tool.
       - **IMPORTANT:** Users might be imprecise. If the user asks for "ideas", try searching for the tag "Ideas" OR "Idees" OR "Idea". 
       - If the first tag search returns nothing, try a likely variation (singular/plural, translated).
    
    2. **General Answering:**
       - If no tool is needed, answer based on the standard context provided above.
    
    3. **Language:**
       - Answer in the user's language (Catalan/Spanish/English).
  `;

  // 3. Define Tool Schema
  const GetNotesByTagSchema = z.object({
    tag: z.string().describe('The tag to filter by (e.g., "Ideas", "Work")'),
  });

  // 4. Generate Response
  const result = streamText({
    model: google("gemini-2.5-flash"),
    system: systemPrompt,
    messages: convertToCoreMessages(messages),
    stopWhen: stepCountIs(3),

    // ✅ TOOLS DEFINITION (AI SDK v5+)
    tools: {
      getNotesByTag: tool({
        description:
          "Get a list of notes that have a specific tag. Use this when the user asks for a category or tag.",

        inputSchema: GetNotesByTagSchema,

        // Explicitly typing arguments ensures TypeScript validation
        execute: async ({ tag }: z.infer<typeof GetNotesByTagSchema>) => {
          console.log(`AI Tool Execution: Searching for tag '${tag}'...`);

          // Exact SQL Search for tags in Supabase
          const { data, error } = await supabase
            .from("notes")
            .select("content, created_at")
            .contains("tags", [tag]) // Postgres array query
            .limit(10);

          if (error) return `Error fetching tags: ${error.message}`;
          if (!data || data.length === 0)
            return `No notes found with tag '${tag}'.`;

          return JSON.stringify(data);
        },
      }),
    },

    // 5. Save to Database (History)
    onFinish: async ({ text }) => {
      if (!chatId) {
        console.error("No ChatID provided, skipping save.");
        return;
      }

      // Save User Message
      const { error: errorUser } = await supabase.from("messages").insert({
        chat_id: chatId,
        role: "user",
        content: userQuestion,
      });
      if (errorUser) console.error("Error saving User Msg:", errorUser);

      // Save AI Message
      const { error: errorAI } = await supabase.from("messages").insert({
        chat_id: chatId,
        role: "assistant",
        content: text,
      });
      if (errorAI) console.error("Error saving AI Msg:", errorAI);
    },
  });

  return result.toUIMessageStreamResponse();
}
