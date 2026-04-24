"use server";

import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { revalidatePath } from "next/cache";
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

// Shared auth helper — keeps every action below from repeating the same
// three lines. Returns null client when unauthenticated so callers can
// short-circuit with a typed error.
async function requireChatAccess(chatId: string) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { supabase: null, user: null, error: "Unauthorized" as const };

    // RLS already scopes chats/messages to the owner; fetching the chat
    // also validates that the caller actually owns it before we start
    // mutating rows.
    const { data: chat, error } = await supabase
        .from("chats")
        .select("id, user_id, title")
        .eq("id", chatId)
        .single();
    if (error || !chat) return { supabase: null, user: null, error: "Chat not found" as const };
    if (chat.user_id !== user.id) return { supabase: null, user: null, error: "Forbidden" as const };

    return { supabase, user, chat, error: null };
}

/**
 * Delete a single message. Used before `regenerate({ messageId })` so
 * the stale assistant row doesn't linger when the new response is
 * persisted by the /api/chat route.
 */
export async function deleteMessageAction(chatId: string, messageId: string) {
    const { supabase, error } = await requireChatAccess(chatId);
    if (error || !supabase) return { error };

    const { error: deleteError } = await supabase
        .from("messages")
        .delete()
        .eq("id", messageId)
        .eq("chat_id", chatId);

    if (deleteError) {
        console.error("Supabase Error:", deleteError);
        return { error: "Error deleting message." };
    }

    return { success: true };
}

/**
 * Delete a message and every message that comes after it in the same
 * chat. Used when the user edits a prior message — the rewrite has to
 * prune the downstream conversation so the new send starts fresh.
 */
export async function deleteMessageAndFollowingAction(
    chatId: string,
    messageId: string,
) {
    const { supabase, error } = await requireChatAccess(chatId);
    if (error || !supabase) return { error };

    const { data: pivot, error: fetchError } = await supabase
        .from("messages")
        .select("created_at")
        .eq("id", messageId)
        .eq("chat_id", chatId)
        .single();
    if (fetchError || !pivot) return { error: "Pivot message not found." };

    const { error: deleteError } = await supabase
        .from("messages")
        .delete()
        .eq("chat_id", chatId)
        .gte("created_at", pivot.created_at as string);

    if (deleteError) {
        console.error("Supabase Error:", deleteError);
        return { error: "Error pruning messages." };
    }

    return { success: true };
}

/**
 * Branch the chat: create a new chat whose messages are a copy of the
 * original chat up to *and including* the pivot message. The user ends
 * up in a fresh conversation they can continue without disturbing the
 * original timeline.
 */
export async function branchChatAction(
    chatId: string,
    pivotMessageId: string,
) {
    const { supabase, user, chat, error } = await requireChatAccess(chatId);
    if (error || !supabase || !user || !chat) return { error };

    const { data: pivot, error: pivotError } = await supabase
        .from("messages")
        .select("created_at")
        .eq("id", pivotMessageId)
        .eq("chat_id", chatId)
        .single();
    if (pivotError || !pivot) return { error: "Pivot message not found." };

    const { data: toCopy, error: msgsError } = await supabase
        .from("messages")
        .select("role, content, created_at")
        .eq("chat_id", chatId)
        .lte("created_at", pivot.created_at as string)
        .order("created_at", { ascending: true });

    if (msgsError) return { error: "Error reading original messages." };

    const branchTitle = chat.title
        ? `↳ ${String(chat.title).substring(0, 56)}`
        : "Branch";

    const { data: newChat, error: createError } = await supabase
        .from("chats")
        .insert({ user_id: user.id, title: branchTitle })
        .select()
        .single();
    if (createError || !newChat) {
        console.error("Supabase Error:", createError);
        return { error: "Error creating branch chat." };
    }

    if (toCopy && toCopy.length > 0) {
        const rows = toCopy.map((m) => ({
            chat_id: newChat.id,
            role: m.role as string,
            content: m.content as string,
        }));
        const { error: insertError } = await supabase.from("messages").insert(rows);
        if (insertError) {
            // Clean up the empty chat so the user doesn't see an orphan
            // row if the bulk copy fails midway.
            await supabase.from("chats").delete().eq("id", newChat.id);
            console.error("Supabase Error:", insertError);
            return { error: "Error copying messages into branch." };
        }
    }

    revalidatePath("/");
    return { success: true, newChatId: newChat.id as string };
}

/**
 * Delete a single chat. `messages.chat_id` cascades on delete so the
 * chat's history vanishes with it. RLS + the chat-access gate keep
 * the action scoped to the caller.
 */
export async function deleteChatAction(chatId: string) {
    const { supabase, error } = await requireChatAccess(chatId);
    if (error || !supabase) return { error };

    const { error: deleteError } = await supabase
        .from("chats")
        .delete()
        .eq("id", chatId);

    if (deleteError) {
        console.error("Supabase Error:", deleteError);
        return { error: "Error deleting chat." };
    }

    revalidatePath("/");
    return { success: true };
}

/**
 * Bulk delete. Issues one DELETE with `.in("id", chatIds)` after
 * scoping to the authenticated user so a forged id list from the
 * client can't reach a chat they don't own. Returns the count of
 * rows actually removed so the caller can report "Deleted N chats"
 * without re-querying.
 */
export async function deleteChatsAction(chatIds: string[]) {
    if (!Array.isArray(chatIds) || chatIds.length === 0) {
        return { error: "No chats selected" };
    }

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    // .in() + user_id filter is belt-and-braces: RLS already scopes
    // to the owner, but duplicating the check on the server keeps
    // this action safe even if a future policy regression widens
    // visibility.
    const { data: deleted, error: deleteError } = await supabase
        .from("chats")
        .delete()
        .in("id", chatIds)
        .eq("user_id", user.id)
        .select("id");

    if (deleteError) {
        console.error("Supabase Error:", deleteError);
        return { error: "Error deleting chats." };
    }

    revalidatePath("/");
    return { success: true, deleted: deleted?.length ?? 0 };
}

/**
 * Export a chat as a Markdown document: H1 title, short header, then
 * one H2 per turn (`# User` / `# Assistant`). Kept server-side so the
 * caller doesn't need to re-fetch messages.
 */
export async function exportChatAsMarkdownAction(chatId: string) {
    const { supabase, chat, error } = await requireChatAccess(chatId);
    if (error || !supabase || !chat) return { error };

    const { data: messages, error: messagesError } = await supabase
        .from("messages")
        .select("role, content, created_at")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

    if (messagesError) return { error: "Error fetching messages." };

    const header = `# ${chat.title ?? "Untitled chat"}\n\nExported ${new Date().toISOString().split("T")[0]} · ${messages?.length ?? 0} messages\n`;
    const body = (messages ?? [])
        .map((m) => {
            const label = m.role === "user" ? "User" : "Assistant";
            return `## ${label}\n\n${m.content}`;
        })
        .join("\n\n---\n\n");

    return {
        success: true,
        title: chat.title as string | null,
        data: `${header}\n${body}\n`,
    };
}
