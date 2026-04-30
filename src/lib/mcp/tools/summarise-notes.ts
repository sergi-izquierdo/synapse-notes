import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createNotesService } from "@/services/notes.service";

// SECURITY NOTE — Lethal Trifecta surface
// ──────────────────────────────────────────
// This tool is the canonical Lethal Trifecta vector in this MCP
// server (untrusted content + private data + external comms via the
// LLM response). It ships in Setmana 2 WITHOUT the D3 output filter
// (LLM-as-judge with Haiku 4.5) which is planned for Setmana 5 §11.3
// alongside the Promptfoo red-team suite.
//
// Until then, the layered defences are:
//   1. RLS gates which notes the SupabaseClient can read — the
//      summary can only ever be over the authenticated user's own
//      rows, so cross-tenant exfiltration is structurally blocked.
//   2. The model's system prompt (in NotesService.summariseNotes)
//      constrains output to a summary; tool use isn't bound here.
//   3. The output is plain text returned to the caller — there are
//      no automatic side effects unless the caller chains it into
//      `create_note` or `update_note`, both of which Claude Desktop
//      gates with confirmation per D2.
//
// See docs/tfg/00-decision-log.md (D2, D3) and docs/tfg/setmana-2-
// mcp-tools-plan.md for the full reasoning.

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
        "Generate a natural-language summary of the user's own notes. Read-only at the database level. Output is unfiltered text — see file header for the open security question this raises and where the planned mitigation lives (§11.3).",
    inputSchema: summariseNotesInputSchema,
};

export function createSummariseNotesHandler(client: SupabaseClient) {
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
