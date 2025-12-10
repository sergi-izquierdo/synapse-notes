import { createClient } from "@/lib/supabase/server";
import { google } from "@ai-sdk/google";
import { streamText, convertToCoreMessages } from "ai";
import { generateEmbedding } from "@/lib/ai";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages, chatId } = await req.json();

  console.log("API Chat rebuda. ChatID:", chatId); // LOG DEBUG

  const lastMessage = messages[messages.length - 1];
  let userQuestion = "";

  if (typeof lastMessage.content === "string") {
    userQuestion = lastMessage.content;
  } else if (Array.isArray(lastMessage.parts)) {
    userQuestion = lastMessage.parts
      .filter((part: any) => part.type === "text")
      .map((part: any) => part.text)
      .join("\n");
  }

  // 1. RAG
  const queryEmbedding = await generateEmbedding(userQuestion);
  const supabase = await createClient();

  const { data: similarNotes } = await supabase.rpc("match_notes", {
    query_embedding: queryEmbedding,
    match_threshold: 0.3,
    match_count: 5,
  });

  const context =
    similarNotes?.map((note: any) => note.content).join("\n\n") || "";

  const systemPrompt = `
    You are a helpful assistant for a "Second Brain" app.
    CONTEXT:
    ${context}
    INSTRUCTIONS: Answer based on context.
  `;

  // 2. Generar i Guardar
  const result = streamText({
    model: google("gemini-2.5-flash"),
    system: systemPrompt,
    messages: convertToCoreMessages(messages),

    onFinish: async ({ text }) => {
      console.log("Stream finalitzat. Guardant a DB...", chatId);

      if (!chatId) {
        console.error("No hi ha ChatID, no es pot guardar.");
        return;
      }

      // Guardem missatge USER
      const { error: errorUser } = await supabase.from("messages").insert({
        chat_id: chatId,
        role: "user",
        content: userQuestion,
      });
      if (errorUser) console.error("Error guardant User Msg:", errorUser);

      // Guardem missatge AI
      const { error: errorAI } = await supabase.from("messages").insert({
        chat_id: chatId,
        role: "assistant",
        content: text,
      });
      if (errorAI) console.error("Error guardant AI Msg:", errorAI);

      console.log("Conversa guardada correctament.");
    },
  });

  return result.toUIMessageStreamResponse();
}
