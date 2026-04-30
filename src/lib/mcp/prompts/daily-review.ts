import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createNotesService } from "@/services/notes.service";

export const dailyReviewArgsSchema = {
    date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe(
            "ISO-8601 date (YYYY-MM-DD). When omitted the prompt summarises the 7 most recent notes regardless of date.",
        ),
};

export const dailyReviewMetadata = {
    title: "Daily review",
    description:
        "Generates a user-facing prompt that asks the model to summarise the most recent notes and surface any open action items. Designed to be invoked by a chat client (e.g., Claude Desktop) at the end of a working session.",
    argsSchema: dailyReviewArgsSchema,
};

export function createDailyReviewHandler(client: SupabaseClient) {
    const service = createNotesService(client);
    return async ({ date }: { date?: string }) => {
        const notes = await service.getRecentNotes(20);
        // When the caller passed a date, narrow the corpus to notes
        // created on that calendar day. The bare-string compare
        // works because `created_at` is ISO-8601 and starts with the
        // `YYYY-MM-DD` prefix.
        const filtered = date
            ? notes.filter((n) =>
                  String(n.created_at ?? "").startsWith(date),
              )
            : notes.slice(0, 7);

        const corpus =
            filtered.length === 0
                ? "(No notes found for this period.)"
                : filtered
                      .map((n) => {
                          const title =
                              n.title?.trim() || `Note ${n.id}`;
                          return `### [id=${n.id}] ${title}\n${n.content.trim()}`;
                      })
                      .join("\n\n");

        const dateLabel = date ?? "the past few days";
        const text = `You are reviewing the user's notes from ${dateLabel}. Read every note below carefully, then produce:

1. **Highlights** — 3-5 bullet points capturing the key topics or events.
2. **Action items** — every concrete TODO, follow-up, or pending decision you can find. Use the original wording where possible. Include the source note id in brackets, e.g. \`(from #14)\`.
3. **Open threads** — questions, ideas, or unfinished thoughts the user might want to revisit.

Be terse. Do not invent items. If a section has no content, write "_None_".

---

${corpus}`;

        return {
            messages: [
                {
                    role: "user" as const,
                    content: { type: "text" as const, text },
                },
            ],
        };
    };
}
