"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { generateEmbedding } from "@/lib/ai";

const NoteSchema = z.object({
  content: z.string().min(1, "Content cannot be empty"),
});

export async function createNote(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const content = formData.get("content") as string;

  const tagsRaw = formData.get("tags") as string;
  const tags = tagsRaw ? JSON.parse(tagsRaw) : [];

  const validatedFields = NoteSchema.safeParse({ content });

  if (!validatedFields.success) {
    return { error: "Invalid note content." };
  }

  try {
    // 1. Generem l'Embedding (La part IA)
    const embedding = await generateEmbedding(content);

    // 2. Guardem Text + Vector a Supabase
    const { error } = await supabase.from("notes").insert({
      user_id: user.id,
      content,
      tags,
      embedding,
    });

    if (error) {
      console.error("Supabase Error:", error);
      return { error: "Error saving note to database." };
    }

    revalidatePath("/");
    return { success: true };
  } catch (e) {
    console.error("AI/Server Error:", e);
    return { error: "Failed to process note." };
  }
}

export async function deleteNote(noteId: number) {
  const supabase = await createClient();

  const { error } = await supabase.from("notes").delete().eq("id", noteId);

  if (error) throw new Error("Error deleting note");

  revalidatePath("/");
}

export async function updateNote(
  noteId: number,
  content: string,
  tags: string[]
) {
  const supabase = await createClient();

  // 1. Validació usuari
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Unauthorized" };
  }

  if (!content || content.trim().length === 0) {
    return { error: "El contingut no pot estar buit." };
  }

  try {
    // 2. Generar Embedding
    const embedding = await generateEmbedding(content);

    // 3. Actualitzar a Supabase
    const { error } = await supabase
      .from("notes")
      .update({
        content,
        tags,
        embedding,
        updated_at: new Date().toISOString(),
      })
      .eq("id", noteId)
      .select(); // IMPORTANT: Això ens permet veure si realment ha tocat alguna fila

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return { error: "Error al actualitzar la nota." };
  }
}
