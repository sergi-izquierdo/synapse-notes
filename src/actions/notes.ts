"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { generateKeyBetween } from "fractional-indexing";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateEmbedding } from "@/lib/ai";
import { extractNoteLinks } from "@/lib/note-links";

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

  // Title is optional; empty strings are normalized to null so the
  // graph RPC's coalesce(nullif(trim(title), ''), ...) falls back
  // to the first-line-of-content path consistently.
  const titleRaw = (formData.get("title") as string | null) ?? "";
  const title = titleRaw.trim() ? titleRaw.trim().slice(0, 200) : null;

  const validatedFields = NoteSchema.safeParse({ content });

  if (!validatedFields.success) {
    return { error: "Invalid note content." };
  }

  try {
    // 1. Generem l'Embedding. Include the title so semantic search
    //    can surface the note when the user queries its topic even
    //    if the body is short.
    const embedText = title ? `${title}\n\n${content}` : content;
    const embedding = await generateEmbedding(embedText);

    // 2. Position at the top of the unstarred section so the new
    //    note shows up first (preserves the legacy "newest on top"
    //    feel after the fractional-indexing migration).
    const position = await nextTopPositionForSection(
      supabase,
      user.id,
      false,
    );

    // 3. Guardem Text + Vector a Supabase. `.select('id').single()`
    //    perquè necessitem l'id de la nova fila per sincronitzar els
    //    backlinks a continuació.
    const { data: inserted, error } = await supabase
      .from("notes")
      .insert({
        user_id: user.id,
        title,
        content,
        tags,
        embedding,
        position,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Supabase Error:", error);
      return { error: "Error saving note to database." };
    }

    // 4. Parsegem [[N]] i materialitzem els edges dirigits a
    //    `note_links`. La RPC filtra targets que no pertanyen a
    //    l'usuari, self-refs, i notes archived; errors aquí no
    //    haurien de tombar la creació de la nota.
    const targets = extractNoteLinks(content, inserted?.id as number);
    if (targets.length > 0 && inserted?.id) {
      const { error: linkErr } = await supabase.rpc("sync_note_links", {
        p_source_id: inserted.id,
        p_target_ids: targets,
      });
      if (linkErr) console.error("sync_note_links error:", linkErr);
    }

    revalidatePath("/");
    revalidatePath("/graph");
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
 * Swap the `position` values between two notes. Used by the drag
 * handler when the UI drops card A onto card B — the two fractional
 * keys are exchanged outright. Since both keys were already valid
 * canonical library output (or backfill-canonical), no
 * `generateKeyBetween` math is needed, so this is immune to the
 * invalid-trailing-zero class of errors.
 *
 * Two sequential UPDATEs with `user_id` scoping + `.select('id')`
 * to catch the RLS silent-fail pattern (same precaution as every
 * other mutation in this file). Not wrapped in an explicit
 * transaction because Supabase's JS client doesn't expose one, but
 * both rows are scoped to the same user and low-contention single-
 * user drags make the worst-case mid-flight failure recoverable by
 * a page refresh.
 */
export async function swapNotePositions(idA: number, idB: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };
  if (idA === idB) return { error: "Cannot swap a note with itself" };

  const { data: rows, error: fetchError } = await supabase
    .from("notes")
    .select("id, position")
    .in("id", [idA, idB])
    .eq("user_id", user.id);

  if (fetchError) {
    console.error("Supabase Error:", fetchError);
    return { error: "Error fetching positions." };
  }
  if (!rows || rows.length !== 2) {
    return { error: "One or both notes not found." };
  }

  const aRow = rows.find((r) => r.id === idA);
  const bRow = rows.find((r) => r.id === idB);
  const aPos = aRow?.position as string | null | undefined;
  const bPos = bRow?.position as string | null | undefined;
  if (!aPos || !bPos) {
    return { error: "Missing position values on one of the notes." };
  }

  // First: write aPos → B (the swap "loses" one side first).
  const { data: bWrote, error: bErr } = await supabase
    .from("notes")
    .update({ position: aPos })
    .eq("id", idB)
    .select("id");
  if (bErr || !bWrote?.length) {
    console.error("Supabase Error (swap B):", bErr);
    return { error: "Swap failed on the target side." };
  }

  // Then: write bPos → A. If this fails we leave the DB in a
  // half-swapped state; the toast on the client prompts a reload.
  const { data: aWrote, error: aErr } = await supabase
    .from("notes")
    .update({ position: bPos })
    .eq("id", idA)
    .select("id");
  if (aErr || !aWrote?.length) {
    console.error("Supabase Error (swap A):", aErr);
    return { error: "Swap failed on the source side (state inconsistent)." };
  }

  revalidatePath("/");
  return { success: true };
}

/**
 * Assign a new fractional-indexing position to a note. Retained for
 * use cases where a true insert (with arrayMove semantics and a
 * freshly-generated key) would still be preferable — currently not
 * wired into the grid but kept as API surface. `.select('id,
 * position')` catches the RLS-silent-fail pattern.
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
  tags: string[],
  title?: string | null
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

  // Normalize title the same way createNote does. `undefined`
  // means "don't touch" (callers that don't know about titles yet,
  // e.g. the optimistic star toggle path); an explicit null or
  // empty string clears it.
  const normalizedTitle =
    title === undefined
      ? undefined
      : title && title.trim()
        ? title.trim().slice(0, 200)
        : null;

  try {
    // 2. Generar Embedding. Include title when we have one.
    const embedText = normalizedTitle
      ? `${normalizedTitle}\n\n${content}`
      : content;
    const embedding = await generateEmbedding(embedText);

    // 3. Actualitzar a Supabase
    const updatePayload: Record<string, unknown> = {
      content,
      tags,
      embedding,
      updated_at: new Date().toISOString(),
    };
    if (normalizedTitle !== undefined) updatePayload.title = normalizedTitle;
    const { error } = await supabase
      .from("notes")
      .update(updatePayload)
      .eq("id", noteId)
      .select(); // IMPORTANT: Això ens permet veure si realment ha tocat alguna fila

    // 4. Re-sincronitzar els backlinks: la RPC substitueix
    //    completament el set d'outgoing links, per tant un
    //    [[N]] esborrat a l'edit desapareix del graph.
    const targets = extractNoteLinks(content, noteId);
    const { error: linkErr } = await supabase.rpc("sync_note_links", {
      p_source_id: noteId,
      p_target_ids: targets,
    });
    if (linkErr) console.error("sync_note_links error:", linkErr);

    revalidatePath("/");
    revalidatePath("/graph");
    return { success: true };
  } catch (error) {
    return { error: "Error al actualitzar la nota." };
  }
}
