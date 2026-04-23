import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
    SettingsView,
    type SettingsViewProps,
} from "@/components/settings/settings-view";

// Server component — gathers everything the settings page needs (user
// profile, note/chat counts, tag frequency map) behind RLS and hands
// it to the client view. No data fetching happens in the browser.
export default async function SettingsPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return redirect("/login");

    const [{ count: notesCount }, { count: chatsCount }, { data: tagRows }] =
        await Promise.all([
            supabase
                .from("notes")
                .select("*", { count: "exact", head: true })
                .eq("user_id", user.id),
            supabase
                .from("chats")
                .select("*", { count: "exact", head: true })
                .eq("user_id", user.id),
            supabase.from("notes").select("tags").eq("user_id", user.id),
        ]);

    const tagCounts: Record<string, number> = {};
    for (const row of tagRows ?? []) {
        for (const tag of (row.tags as string[] | null) ?? []) {
            tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
        }
    }

    const metadata = user.user_metadata ?? {};
    const identities = user.identities ?? [];
    const primaryProvider = identities[0]?.provider;

    const profile: SettingsViewProps["profile"] = {
        email: user.email ?? "",
        name:
            (metadata.full_name as string | undefined) ??
            (metadata.name as string | undefined) ??
            (metadata.user_name as string | undefined) ??
            null,
        avatarUrl:
            (metadata.avatar_url as string | undefined) ??
            (metadata.picture as string | undefined) ??
            null,
        provider:
            primaryProvider === "google"
                ? "google"
                : primaryProvider === "github"
                  ? "github"
                  : primaryProvider === "email"
                    ? "email"
                    : "other",
    };

    return (
        <SettingsView
            profile={profile}
            counts={{
                notes: notesCount ?? 0,
                chats: chatsCount ?? 0,
            }}
            tagCounts={tagCounts}
        />
    );
}
