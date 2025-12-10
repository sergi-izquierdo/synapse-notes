import { createClient } from "@/lib/supabase/server";
import { google } from "@ai-sdk/google";
import { streamText, convertToCoreMessages } from "ai"; // ✅ IMPORT NOU
import { generateEmbedding } from "@/lib/ai";

export const maxDuration = 30;

export async function POST(req: Request) {
  // 1. Rebem els missatges "bruts" del frontend
  const { messages } = await req.json();

  // 2. Extraiem el text de l'últim missatge per fer el RAG (Cerca)
  const lastMessage = messages[messages.length - 1];
  let userQuestion = "";

  // Lògica robusta per treure el text (sigui string o parts)
  if (typeof lastMessage.content === "string") {
    userQuestion = lastMessage.content;
  } else if (Array.isArray(lastMessage.parts)) {
    userQuestion = lastMessage.parts
      .filter((part: any) => part.type === "text")
      .map((part: any) => part.text)
      .join("\n");
  }

  // 3. Generem l'Embedding de la pregunta
  const queryEmbedding = await generateEmbedding(userQuestion);

  // 4. Busquem context a Supabase
  const supabase = await createClient();
  const { data: similarNotes } = await supabase.rpc("match_notes", {
    query_embedding: queryEmbedding,
    match_threshold: 0.5,
    match_count: 5,
  });

  const context =
    similarNotes?.map((note: any) => note.content).join("\n\n") || "";

  const systemPrompt = `
    You are a helpful assistant.
    Context from user's notes:
    ---
    ${context}
    ---
    Answer based on the context. If the answer is not in the context, say so.
  `;

  // 5. Generem la resposta convertint els missatges
  const result = streamText({
    model: google("gemini-2.5-flash"),
    system: systemPrompt,
    // ✅ CORRECCIÓ CLAU: Convertim de "UI Messages" a "Core Messages"
    messages: convertToCoreMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
