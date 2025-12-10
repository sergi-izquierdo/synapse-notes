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
  const validatedFields = NoteSchema.safeParse({ content });

  if (!validatedFields.success) {
    return { error: "Invalid note content." };
  }

  try {
    // 🧠 1. Generem l'Embedding (La part IA)
    const embedding = await generateEmbedding(validatedFields.data.content);

    // 💾 2. Guardem Text + Vector a Supabase
    const { error } = await supabase.from("notes").insert({
      user_id: user.id,
      content: validatedFields.data.content,
      embedding: embedding, // <--- Aquí guardem el vector!
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
