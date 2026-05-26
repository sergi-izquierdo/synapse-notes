import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

// Weekly digest agent: aggregates the user's note activity from the
// past 7 days into a structured summary. No LLM call, just SQL
// aggregation. Writes the digest as a new note tagged "weekly-digest"
// and logs to agent_events.

export interface WeeklyDigestResult {
  notesCreated: number;
  notesUpdated: number;
  topTags: Array<{ tag: string; count: number }>;
  period: { from: string; to: string };
  digestNoteId?: number;
}

class WeeklyDigestService {
  constructor(private readonly client: SupabaseClient) {}

  async generateDigest(
    userId: string,
    options: { persist?: boolean } = {},
  ): Promise<WeeklyDigestResult> {
    const { persist = true } = options;
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const from = weekAgo.toISOString();
    const to = now.toISOString();

    const { data: created, error: createdErr } = await this.client
      .from("notes")
      .select("id, title, tags, created_at")
      .eq("user_id", userId)
      .gte("created_at", from)
      .is("archived_at", null)
      .order("created_at", { ascending: false });
    if (createdErr) throw createdErr;

    const { data: updated, error: updatedErr } = await this.client
      .from("notes")
      .select("id, title, tags, updated_at")
      .eq("user_id", userId)
      .gte("updated_at", from)
      .lt("created_at", from)
      .is("archived_at", null)
      .order("updated_at", { ascending: false });
    if (updatedErr) throw updatedErr;

    const tagCounts = new Map<string, number>();
    for (const note of [...(created ?? []), ...(updated ?? [])]) {
      for (const tag of (note.tags ?? []) as string[]) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }
    const topTags = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, count }));

    const result: WeeklyDigestResult = {
      notesCreated: created?.length ?? 0,
      notesUpdated: updated?.length ?? 0,
      topTags,
      period: { from, to },
    };

    if (persist) {
      const digestContent = this.formatDigest(result, created ?? [], updated ?? []);
      const { data: note, error: noteErr } = await this.client
        .from("notes")
        .insert({
          user_id: userId,
          title: `Weekly Digest (${weekAgo.toLocaleDateString("ca-ES")} - ${now.toLocaleDateString("ca-ES")})`,
          content: digestContent,
          tags: ["weekly-digest"],
        })
        .select("id")
        .single();
      if (noteErr) throw noteErr;
      result.digestNoteId = note.id;

      const { error: evtErr } = await this.client.from("agent_events").insert({
        user_id: userId,
        agent: "weekly-digest",
        action: "digest.created",
        payload: {
          digest_note_id: note.id,
          notes_created: result.notesCreated,
          notes_updated: result.notesUpdated,
          top_tags: result.topTags,
        },
      });
      if (evtErr) throw evtErr;
    }

    return result;
  }

  private formatDigest(
    result: WeeklyDigestResult,
    created: Array<{ id: number; title: string | null; tags: unknown }>,
    updated: Array<{ id: number; title: string | null; tags: unknown }>,
  ): string {
    const lines: string[] = [];

    lines.push(`## Resum de la setmana\n`);
    lines.push(`- **Notes noves:** ${result.notesCreated}`);
    lines.push(`- **Notes actualitzades:** ${result.notesUpdated}`);

    if (result.topTags.length > 0) {
      lines.push(`\n### Tags mes actius`);
      for (const { tag, count } of result.topTags) {
        lines.push(`- \`${tag}\`: ${count} notes`);
      }
    }

    if (created.length > 0) {
      lines.push(`\n### Notes noves`);
      for (const note of created.slice(0, 10)) {
        const label = note.title ?? `Nota #${note.id}`;
        lines.push(`- [[${note.id}]] ${label}`);
      }
      if (created.length > 10) {
        lines.push(`- ...i ${created.length - 10} mes`);
      }
    }

    if (updated.length > 0) {
      lines.push(`\n### Notes actualitzades`);
      for (const note of updated.slice(0, 10)) {
        const label = note.title ?? `Nota #${note.id}`;
        lines.push(`- [[${note.id}]] ${label}`);
      }
      if (updated.length > 10) {
        lines.push(`- ...i ${updated.length - 10} mes`);
      }
    }

    return lines.join("\n");
  }
}

export function createWeeklyDigestService(client: SupabaseClient) {
  return new WeeklyDigestService(client);
}
