import { google } from "@ai-sdk/google";
import { embed } from "ai";

const embeddingModel = google.embedding("gemini-embedding-001");

export async function generateEmbedding(text: string): Promise<number[]> {
  // Protecció contra undefined/null
  if (!text || typeof text !== "string") {
    console.warn("Intent de generar embedding sense text vàlid");
    return [];
  }

  const cleanText = text.replace(/\n/g, " ").trim();

  if (!cleanText) return [];

  try {
    const { embedding } = await embed({
      model: embeddingModel,
      value: cleanText,
      providerOptions: {
        google: {
          outputDimensionality: 768,
        },
      },
    });

    return embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    // Retornem array buit en lloc de petar, així el xat continua funcionant (simplement sense context)
    return [];
  }
}
