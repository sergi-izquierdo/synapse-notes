"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// A tag is a short human-readable label — we gate length and strip
// leading/trailing whitespace, but otherwise stay permissive (accents,
// hyphens, numbers all valid). The comma check stops callers from
// sneaking multiple tags into one rename.
const TagSchema = z
    .string()
    .trim()
    .min(1, "Tag can't be empty")
    .max(40, "Tag too long")
    .refine((v) => !v.includes(","), "Tag can't contain commas");

const RenameSchema = z.object({
    from: TagSchema,
    to: TagSchema,
});

const DeleteSchema = z.object({
    tag: TagSchema,
});

export async function renameTagAction(input: { from: string; to: string }) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const parsed = RenameSchema.safeParse(input);
    if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }
    const { from, to } = parsed.data;
    if (from === to) return { updated: 0 };

    const { data, error } = await supabase.rpc("rename_tag", {
        from_tag: from,
        to_tag: to,
    });

    if (error) {
        console.error("rename_tag error:", error);
        return { error: error.message };
    }

    revalidatePath("/");
    revalidatePath("/graph");
    return { updated: (data as number) ?? 0 };
}

export async function deleteTagAction(input: { tag: string }) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const parsed = DeleteSchema.safeParse(input);
    if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }
    const { tag } = parsed.data;

    const { data, error } = await supabase.rpc("delete_tag", {
        target_tag: tag,
    });

    if (error) {
        console.error("delete_tag error:", error);
        return { error: error.message };
    }

    revalidatePath("/");
    revalidatePath("/graph");
    return { updated: (data as number) ?? 0 };
}
