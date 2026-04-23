"use server";

import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { createClient } from "@/lib/supabase/server";

/**
 * Backfill chat titles that are still the "Nova Conversa" default.
 *
 * The server-side auto-titler in /api/chat/route.ts only runs inside the
 * `onFinish` hook of a live stream, so any chat created before that feature
 * landed (or whose first exchange raced past the hook) stays with the
 * placeholder title forever. This action scans the authenticated user's
 * chats, asks Haiku 4.5 to produce a short title for each chat that has at
 * least one user message, and updates the row.
 *
 * Intended to be called once per session from the chat sidebar on mount.
 * Returns the number of rows successfully updated.
 */
export async function regenerateStaleTitlesAction() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { ok: false as const, reason: "unauthenticated", updated: 0 };
    }

    // A "stale" chat is one whose title is still the default placeholder
    // ("Nova Conversa"), missing (NULL), or empty. Any of those three states
    // leaves the sidebar unreadable, so we treat them all the same.
    const { data: staleChats, error: chatsError } = await supabase
        .from("chats")
        .select("id, title")
        .eq("user_id", user.id)
        .or("title.is.null,title.eq.,title.eq.Nova Conversa");

    if (chatsError) {
        return { ok: false as const, reason: chatsError.message, updated: 0 };
    }
    if (!staleChats || staleChats.length === 0) {
        return { ok: true as const, updated: 0 };
    }

    let updated = 0;

    await Promise.all(
        staleChats.map(async (chat) => {
            const { data: msgs } = await supabase
                .from("messages")
                .select("content")
                .eq("chat_id", chat.id)
                .eq("role", "user")
                .order("created_at", { ascending: true })
                .limit(1);

            const firstMessage = msgs?.[0]?.content;
            if (!firstMessage) return;

            try {
                const { text } = await generateText({
                    model: anthropic("claude-haiku-4-5"),
                    prompt: `Generate a very short title (max 6 words) for a conversation that starts with this message. Reply with ONLY the title, no quotes, no punctuation at the end. Use the same language as the message.\n\nMessage: "${firstMessage}"`,
                });

                const cleanTitle = text
                    .trim()
                    .replace(/^["']|["']$/g, "")
                    .substring(0, 60);

                if (!cleanTitle) return;

                // `.select("id")` forces the query to return the rows it
                // actually wrote. Without it, Supabase returns `error: null`
                // even when RLS silently blocks the update (0 rows affected).
                // We only count a success if the row is in the response.
                const { data: updatedRows, error: updateError } = await supabase
                    .from("chats")
                    .update({ title: cleanTitle })
                    .eq("id", chat.id)
                    .select("id");

                if (updateError) {
                    console.error(
                        "regenerateStaleTitlesAction: update failed for",
                        chat.id,
                        updateError,
                    );
                    return;
                }
                if (updatedRows && updatedRows.length > 0) {
                    updated += 1;
                }
            } catch (err) {
                console.error(
                    "regenerateStaleTitlesAction: failed for chat",
                    chat.id,
                    err,
                );
            }
        }),
    );

    return { ok: true as const, updated };
}
