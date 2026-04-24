import { NextResponse } from "next/server";
import { z } from "zod";
import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 15;

const RequestSchema = z.object({
    content: z.string().min(1).max(20_000),
    availableTags: z.array(z.string()).max(500),
});

// Schema the LLM must conform to. `existing` is a subset of the
// caller's tag library — the model is told to only echo tags it sees.
// `newTag` is nullable (not optional) so the model always emits the
// key; we normalise `""` to `null` post-hoc for clean semantics.
//
// No `.max(3)` on the array: Anthropic's structured-output JSON
// schema rejects `maxItems` with
//   "For 'array' type, property 'maxItems' is not supported".
// The 3-cap is enforced post-response via `.slice(0, 3)` below and
// reinforced in the prompt.
const SuggestionSchema = z.object({
    existing: z.array(z.string()),
    newTag: z.string().nullable(),
});

export async function POST(req: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid request", issues: parsed.error.issues },
            { status: 400 },
        );
    }
    const { content, availableTags } = parsed.data;

    const tagList =
        availableTags.length > 0
            ? availableTags.map((t) => `- ${t}`).join("\n")
            : "(the user has no tags yet)";

    try {
        const { object } = await generateObject({
            model: anthropic("claude-haiku-4-5"),
            schema: SuggestionSchema,
            prompt: `You classify short personal notes into tags.

The user has these existing tags (pick only from this list when
possible):
${tagList}

The note content is:
"""
${content}
"""

Rules:
- Return up to 3 "existing" tags from the list above that genuinely
  apply to this note. Only echo tags exactly as spelled in the list.
- If the note clearly introduces a topic NOT covered by any existing
  tag, suggest ONE new tag as "newTag" — lowercase, kebab-case, one to
  three words, same language as the user's tags (usually English).
  Do not invent a new tag if an existing one fits.
- If nothing fits cleanly, return { "existing": [], "newTag": null }.
- Never return more than 3 existing tags.
- Never invent "existing" tags that aren't in the list.`,
        });

        const normalizedExisting = object.existing
            .map((t) => t.trim())
            .filter((t) => availableTags.includes(t))
            .slice(0, 3);

        const normalizedNew =
            object.newTag && object.newTag.trim()
                ? object.newTag
                      .trim()
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, "-")
                      .replace(/-+/g, "-")
                      .replace(/^-|-$/g, "")
                : null;

        // If the "new" tag collides with one already in the library
        // or one already suggested as existing, drop it.
        const newTag =
            normalizedNew &&
            !availableTags.some((t) => t.toLowerCase() === normalizedNew) &&
            !normalizedExisting.some((t) => t.toLowerCase() === normalizedNew)
                ? normalizedNew
                : null;

        return NextResponse.json({
            existing: normalizedExisting,
            newTag,
        });
    } catch (err) {
        console.error("suggest-tags error:", err);
        return NextResponse.json(
            { error: "Failed to generate suggestions" },
            { status: 500 },
        );
    }
}
