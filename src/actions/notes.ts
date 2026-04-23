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

  // Read the note before deleting so the caller can offer an undo
  // toast. Returning content + tags is enough to recreate — the
  // embedding will be regenerated on restore. If the fetch fails we
  // still proceed with the delete (the undo simply won't be offered).
  const { data: snapshot } = await supabase
    .from("notes")
    .select("content, tags, starred")
    .eq("id", noteId)
    .single();

  const { error } = await supabase.from("notes").delete().eq("id", noteId);

  if (error) throw new Error("Error deleting note");

  revalidatePath("/");

  return snapshot
    ? {
        content: snapshot.content as string,
        tags: (snapshot.tags as string[]) ?? [],
        starred: Boolean(snapshot.starred),
      }
    : null;
}

export async function archiveNote(noteId: number) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("notes")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", noteId);

  if (error) {
    console.error("Supabase Error:", error);
    return { error: "Error archiving note." };
  }

  revalidatePath("/");
  return { success: true };
}

export async function unarchiveNote(noteId: number) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("notes")
    .update({ archived_at: null })
    .eq("id", noteId);

  if (error) {
    console.error("Supabase Error:", error);
    return { error: "Error restoring note." };
  }

  revalidatePath("/");
  return { success: true };
}

export async function toggleNoteStarred(noteId: number, starred: boolean) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("notes")
    .update({ starred })
    .eq("id", noteId);

  if (error) {
    console.error("Supabase Error:", error);
    return { error: "Error toggling star." };
  }

  revalidatePath("/");
  return { success: true };
}

export async function duplicateNote(noteId: number) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: original, error: fetchError } = await supabase
    .from("notes")
    .select("content, tags")
    .eq("id", noteId)
    .single();

  if (fetchError || !original) {
    return { error: "Error fetching note to duplicate." };
  }

  const content = original.content as string;
  const tags = (original.tags as string[]) ?? [];

  try {
    // Regenerate the embedding for the copy so the clone is
    // immediately searchable — we don't trust the original's vector
    // will stay in sync with edits.
    const embedding = await generateEmbedding(content);

    const { error: insertError } = await supabase.from("notes").insert({
      user_id: user.id,
      content,
      tags,
      embedding,
    });

    if (insertError) {
      console.error("Supabase Error:", insertError);
      return { error: "Error duplicating note." };
    }

    revalidatePath("/");
    return { success: true };
  } catch (e) {
    console.error("AI/Server Error:", e);
    return { error: "Failed to duplicate note." };
  }
}

export async function restoreNote(content: string, tags: string[]) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  if (!content || content.trim().length === 0) {
    return { error: "Content cannot be empty." };
  }

  try {
    const embedding = await generateEmbedding(content);

    const { error } = await supabase.from("notes").insert({
      user_id: user.id,
      content,
      tags,
      embedding,
    });

    if (error) {
      console.error("Supabase Error:", error);
      return { error: "Error restoring note." };
    }

    revalidatePath("/");
    return { success: true };
  } catch (e) {
    console.error("AI/Server Error:", e);
    return { error: "Failed to restore note." };
  }
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
