import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createNotesService } from "@/services/notes.service";
import {
    JudgeBlockedError,
    JudgeUnavailableError,
} from "@/lib/ai/content-judge";
import { assertAiAllowed, isAiGuardError } from "@/lib/ai/guards";

// SECURITY: Lethal Trifecta surface
// ──────────────────────────────────────────
// This is the canonical Lethal Trifecta tool in this MCP server
// (untrusted content + private data + external comms via the LLM
// response). Defence in depth (D2, D3, D4):
//   1. D4 cost gates (auth allowlist) — assertAiAllowed below.
//   2. RLS gates which notes the SupabaseClient can read — the
//      summary can only ever be over the authenticated user's own
//      rows, so cross-tenant exfiltration is structurally blocked.
//   3. D3 LLM-as-judge filter — runs inside NotesService.summariseNotes
//      before the summariser; throws JudgeBlockedError on detected
//      injection, surfaced here as a friendly MCP error.
//   4. Restrictive summariser system prompt (in NotesService).
//   5. Output is plain text — chained mutations are gated by Claude
//      Desktop confirmation per D2.
//
// See docs/tfg/00-decision-log.md (D2, D3, D4).

export const summariseNotesInputSchema = {
    note_ids: z
        .array(z.number().int().positive())
        .max(50)
        .optional()
        .describe(
            "Specific notes to summarise (max 50). Mutually exclusive-ish with `tag` — if both, ids win. When neither is set the tool summarises the 20 most recent notes.",
        ),
    tag: z
        .string()
        .min(1)
        .max(40)
        .optional()
        .describe(
            "Summarise every note carrying this tag (capped at 50 rows).",
        ),
    style: z
        .enum(["bullets", "paragraph"])
        .optional()
        .describe(
            "Output shape. `bullets` produces 5–10 list items; `paragraph` produces 2–3 short paragraphs. Defaults to `bullets`.",
        ),
};

export const summariseNotesToolDefinition = {
    description:
        "Generate a natural-language summary of the user's own notes. Read-only at the database level. Output is filtered by an LLM-as-judge content classifier (D3) before reaching the summariser; calls may return isError if the judge detects prompt-injection or exfiltration attempts in the corpus.",
    inputSchema: summariseNotesInputSchema,
};

export function createSummariseNotesHandler(
    client: SupabaseClient,
    userId: string,
) {
    const service = createNotesService(client);
    return async ({
        note_ids,
        tag,
        style,
    }: {
        note_ids?: number[];
        tag?: string;
        style?: "bullets" | "paragraph";
    }) => {
        // Cost-safety gate (TFG D4). Read-only MCP tools (search_notes,
        // get_note, graph_*) are intentionally NOT gated — they return
        // useful data without spending Anthropic/Google quota. The
        // mutating tools (create_note, update_note, tag_notes) only
        // call the embedding model, which the route layer governs via
        // the same env vars indirectly (a leaked JWT can mutate, but
        // the spend is bounded by Google's per-call cost cap and the
        // host's per-call confirmation under D2). Only summarise_notes
        // does an unbounded LLM call here.
        try {
            assertAiAllowed(userId);
        } catch (err) {
            if (isAiGuardError(err)) {
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `summarise_notes is unavailable: ${err.message}.`,
                        },
                    ],
                    isError: true,
                };
            }
            throw err;
        }

        try {
            const summary = await service.summariseNotes({
                noteIds: note_ids,
                tag,
                style,
            });
            return {
                content: [{ type: "text" as const, text: summary }],
            };
        } catch (err) {
            // D3 judge blocked the corpus before summarisation reached
            // the model. The categories + reason are user-friendly and
            // useful for §11.3 metric collection (Promptfoo asserts on
            // text matching /blocked/i).
            if (err instanceof JudgeBlockedError) {
                const cats =
                    err.verdict.categories.join(", ") || "unspecified";
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `summarise_notes blocked by content judge (${cats}): ${err.verdict.reason}`,
                        },
                    ],
                    isError: true,
                };
            }
            // Judge upstream call failed; we fail-closed so the caller
            // sees a 503-style transient error rather than the bare
            // summary. Anthropic outage = no summarisation, by design.
            if (err instanceof JudgeUnavailableError) {
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: "summarise_notes is temporarily unavailable: content judge upstream error. Retry shortly.",
                        },
                    ],
                    isError: true,
                };
            }
            const message =
                err instanceof Error ? err.message : "Unknown error";
            return {
                content: [
                    {
                        type: "text" as const,
                        text: `Failed to summarise notes: ${message}`,
                    },
                ],
                isError: true,
            };
        }
    };
}
