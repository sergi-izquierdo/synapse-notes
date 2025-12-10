import { createClient } from "@/lib/supabase/server";
import { google } from "@ai-sdk/google";
import { streamText, convertToCoreMessages } from "ai";
import { generateEmbedding } from "@/lib/ai";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();

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

  console.log("🔍 Pregunta Usuari:", userQuestion); // LOG 1

  // 1. Vectoritzem
  const queryEmbedding = await generateEmbedding(userQuestion);

  // 2. Busquem context (baixem el threshold a 0.3 per ser més permissius)
  const supabase = await createClient();
  const { data: similarNotes, error } = await supabase.rpc("match_notes", {
    query_embedding: queryEmbedding,
    match_threshold: 0.3, // ⚠️ BAIXEM LLISTÓ (Abans 0.5)
    match_count: 5,
  });

  if (error) console.error("❌ Error Supabase:", error);
  console.log("📄 Notes Trobades:", similarNotes?.length || 0); // LOG 2
  if (similarNotes && similarNotes.length > 0) {
    console.log("📝 Contingut 1a nota:", similarNotes[0].content); // LOG 3
  }

  const context =
    similarNotes?.map((note: any) => note.content).join("\n\n") || "";

  const systemPrompt = `
    You are a helpful assistant for a "Second Brain" app.
    
    CONTEXT FROM USER NOTES:
    ---------------------
    ${context}
    ---------------------
    
    INSTRUCTIONS:
    Answer the user's question based ONLY on the provided context.
    If the context is empty or doesn't contain the answer, say "I can't find that information in your notes."
    Current language: Catalan/Spanish/English mix. Answer in the user's language.
  `;

  // 3. Generem resposta amb un model
  const result = streamText({
    model: google("gemini-2.5-flash"),
    system: systemPrompt,
    messages: convertToCoreMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
