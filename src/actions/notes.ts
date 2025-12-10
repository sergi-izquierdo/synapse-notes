"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

// Validació de dades amb Zod
const NoteSchema = z.object({
  content: z.string().min(1, "La nota no pot estar buida"),
});

export async function createNote(formData: FormData) {
  const supabase = await createClient();

  // 1. Obtenim l'usuari actual
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 2. Validem l'input
  const content = formData.get("content") as string;
  const validatedFields = NoteSchema.safeParse({ content });

  if (!validatedFields.success) {
    return { error: "La nota és invàlida." };
  }

  // 3. Guardem a la base de dades
  // (Nota: A la Fase 3 afegirem aquí la generació de l'embedding amb IA)
  const { error } = await supabase.from("notes").insert({
    user_id: user.id,
    content: validatedFields.data.content,
  });

  if (error) {
    console.error("Error creating note:", error);
    return { error: "Error al guardar la nota." };
  }

  // 4. Refresquem la UI
  revalidatePath("/");
  return { success: true };
}

export async function deleteNote(noteId: number) {
  const supabase = await createClient();

  const { error } = await supabase.from("notes").delete().eq("id", noteId);

  if (error) throw new Error("Error deleting note");

  revalidatePath("/");
}
