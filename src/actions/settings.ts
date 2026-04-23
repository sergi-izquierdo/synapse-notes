"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

// Shared auth gate — returns the authenticated user or throws so the
// caller can surface a 401-style response. Kept local to avoid
// spreading `supabase.auth.getUser()` across every action below.
async function requireUser() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return { supabase: null, user: null, error: "Unauthorized" as const };
    }
    return { supabase, user, error: null };
}

export async function clearAllChatsAction() {
    const { supabase, user, error } = await requireUser();
    if (error || !supabase || !user) return { error: "Unauthorized" };

    // RLS on public.chats already scopes the delete to the caller; the
    // explicit user_id filter is a belt-and-braces guard in case a
    // future policy change widens access.
    const { error: deleteError } = await supabase
        .from("chats")
        .delete()
        .eq("user_id", user.id);

    if (deleteError) {
        console.error("Supabase Error:", deleteError);
        return { error: "Error clearing chats." };
    }

    revalidatePath("/");
    return { success: true };
}

export async function deleteAllNotesAction() {
    const { supabase, user, error } = await requireUser();
    if (error || !supabase || !user) return { error: "Unauthorized" };

    const { error: deleteError } = await supabase
        .from("notes")
        .delete()
        .eq("user_id", user.id);

    if (deleteError) {
        console.error("Supabase Error:", deleteError);
        return { error: "Error deleting notes." };
    }

    revalidatePath("/");
    return { success: true };
}

export async function signOutEverywhereAction() {
    const supabase = await createClient();
    // Global scope revokes every refresh token for this user, so all
    // other sessions (other browsers, phones) are invalidated too.
    // The local session also dies → we redirect to /login.
    await supabase.auth.signOut({ scope: "global" });
    redirect("/login");
}

const RenameTagSchema = z.object({
    oldTag: z.string().min(1).max(60),
    newTag: z.string().min(1).max(60),
});

export async function renameTagAction(oldTag: string, newTag: string) {
    const parsed = RenameTagSchema.safeParse({ oldTag, newTag });
    if (!parsed.success) return { error: "Invalid tag names." };

    const { supabase, user, error } = await requireUser();
    if (error || !supabase || !user) return { error: "Unauthorized" };

    const trimmedOld = parsed.data.oldTag.trim();
    const trimmedNew = parsed.data.newTag.trim();
    if (trimmedOld === trimmedNew) return { success: true, updated: 0 };

    // Pull every note that carries the old tag, then rewrite each row
    // in turn. Two reasons for row-at-a-time instead of a single SQL
    // update:
    //   1. Supabase JS doesn't expose array_replace, so we'd have to
    //      hit an RPC — overkill for a rarely-used admin action.
    //   2. If the new tag already lives on the note we dedupe so we
    //      don't end up with duplicate tag strings in the array.
    const { data: notes, error: fetchError } = await supabase
        .from("notes")
        .select("id, tags")
        .eq("user_id", user.id)
        .contains("tags", [trimmedOld]);

    if (fetchError) return { error: "Error fetching notes." };

    let updated = 0;
    for (const note of notes ?? []) {
        const existing = (note.tags as string[]) ?? [];
        const replaced = existing.map((t) => (t === trimmedOld ? trimmedNew : t));
        const deduped = Array.from(new Set(replaced));
        const { error: updateError } = await supabase
            .from("notes")
            .update({ tags: deduped })
            .eq("id", note.id);
        if (!updateError) updated += 1;
    }

    revalidatePath("/");
    return { success: true, updated };
}

export async function deleteTagAction(tag: string) {
    if (!tag || tag.trim().length === 0) return { error: "Invalid tag." };

    const { supabase, user, error } = await requireUser();
    if (error || !supabase || !user) return { error: "Unauthorized" };

    const trimmed = tag.trim();

    const { data: notes, error: fetchError } = await supabase
        .from("notes")
        .select("id, tags")
        .eq("user_id", user.id)
        .contains("tags", [trimmed]);

    if (fetchError) return { error: "Error fetching notes." };

    let updated = 0;
    for (const note of notes ?? []) {
        const existing = (note.tags as string[]) ?? [];
        const filtered = existing.filter((t) => t !== trimmed);
        const { error: updateError } = await supabase
            .from("notes")
            .update({ tags: filtered })
            .eq("id", note.id);
        if (!updateError) updated += 1;
    }

    revalidatePath("/");
    return { success: true, updated };
}

// Export helpers — both return a string the client can blob + download.
// Kept server-side so we rely on RLS for scoping rather than trusting
// a browser client to filter correctly.

export async function exportNotesAsJsonAction() {
    const { supabase, user, error } = await requireUser();
    if (error || !supabase || !user) return { error: "Unauthorized" };

    const { data: notes, error: notesError } = await supabase
        .from("notes")
        .select("id, content, tags, starred, created_at, updated_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    if (notesError) return { error: "Error fetching notes." };

    const payload = {
        exported_at: new Date().toISOString(),
        user_id: user.id,
        count: notes?.length ?? 0,
        notes: notes ?? [],
    };

    return { success: true, data: JSON.stringify(payload, null, 2) };
}

export async function exportNotesAsMarkdownAction() {
    const { supabase, user, error } = await requireUser();
    if (error || !supabase || !user) return { error: "Unauthorized" };

    const { data: notes, error: notesError } = await supabase
        .from("notes")
        .select("content, tags, starred, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    if (notesError) return { error: "Error fetching notes." };

    // One H2 per note, tags as a hashtag line, `---` separators. The
    // goal is "drop this into Obsidian and it just works" rather than
    // lossless re-import — the JSON export covers the round-trip case.
    const blocks = (notes ?? []).map((n) => {
        const date = new Date(n.created_at as string)
            .toISOString()
            .split("T")[0];
        const title = n.starred ? `★ ${date}` : date;
        const tagLine =
            (n.tags as string[] | null)?.length
                ? `\n${(n.tags as string[]).map((t) => `#${t}`).join(" ")}`
                : "";
        return `## ${title}\n${tagLine}\n\n${n.content}`;
    });

    const header = `# Synapse Notes export — ${new Date().toISOString().split("T")[0]}\n\n${notes?.length ?? 0} notes.\n`;
    const body = blocks.join("\n\n---\n\n");

    return { success: true, data: `${header}\n${body}\n` };
}
