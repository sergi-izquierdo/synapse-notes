"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { generateKeyBetween } from "fractional-indexing";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateEmbedding } from "@/lib/ai";

const NoteSchema = z.object({
  content: z.string().min(1, "Content cannot be empty"),
});

// Compute a fractional-indexing key that places a new row at the TOP
// of the user's (starred=false) live section — which matches the
// legacy "newest note on top" UX. Fetches the current minimum
// position in that section; `generateKeyBetween(null, min)` returns a
// string lex-lower than `min` (so ASC sort puts the new row first).
// Scoped narrow so a section with tens of thousands of rows still
// hits the composite index notes_user_section_position_idx.
async function nextTopPositionForSection(
  supabase: SupabaseClient,
  userId: string,
  starred: boolean,
): Promise<string> {
  const { data } = await supabase
    .from("notes")
    .select("position")
    .eq("user_id", userId)
    .eq("starred", starred)
    .is("archived_at", null)
    .not("position", "is", null)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();
  const top = (data?.position as string | null) ?? null;
  return generateKeyBetween(null, top);
}

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

    // 2. Position at the top of the unstarred section so the new
    //    note shows up first (preserves the legacy "newest on top"
    //    feel after the fractional-indexing migration).
    const position = await nextTopPositionForSection(
      supabase,
      user.id,
      false,
    );

    // 3. Guardem Text + Vector a Supabase
    const { error } = await supabase.from("notes").insert({
      user_id: user.id,
      content,
      tags,
      embedding,
      position,
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
    const position = await nextTopPositionForSection(
      supabase,
      user.id,
      false,
    );

    const { error: insertError } = await supabase.from("notes").insert({
      user_id: user.id,
      content,
      tags,
      embedding,
      position,
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
    const position = await nextTopPositionForSection(
      supabase,
      user.id,
      false,
    );

    const { error } = await supabase.from("notes").insert({
      user_id: user.id,
      content,
      tags,
      embedding,
      position,
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

/**
 * Assign a new fractional-indexing position to a note. Called by the
 * grid's drag handler after a `generateKeyBetween(prev, next)` has
 * been computed on the client. `.select('id, position')` catches the
 * RLS-silent-fail pattern — if the UPDATE affected 0 rows we treat
 * it as an error rather than reporting success.
 *
 * Starred <-> unstarred can never be crossed by drag because the UI
 * renders two independent SortableContexts, so this action does not
 * touch the `starred` flag.
 */
export async function reorderNote(noteId: number, newPosition: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  if (typeof newPosition !== "string" || newPosition.length === 0) {
    return { error: "Invalid position key" };
  }

  const { data, error } = await supabase
    .from("notes")
    .update({ position: newPosition })
    .eq("id", noteId)
    .select("id, position");

  if (error) {
    console.error("Supabase Error:", error);
    return { error: "Error reordering note." };
  }
  if (!data || data.length === 0) {
    // RLS UPDATE would silently 0-rows-affect without an error; the
    // feedback_rls_delete_update.md memory exists exactly because of
    // this class of bug. Treat it as a failure the user can see.
    return { error: "Reorder blocked by RLS or note not found." };
  }

  revalidatePath("/");
  return { success: true, position: newPosition };
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
