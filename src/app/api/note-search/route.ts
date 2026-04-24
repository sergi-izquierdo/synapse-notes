import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 10;

const QuerySchema = z.object({
    q: z.string().trim().max(100).optional(),
    limit: z.coerce.number().int().min(1).max(25).default(8),
});

// Lightweight typeahead search over the caller's notes. Used by the
// [[ backlink autocomplete popover: given the partial text the user
// typed after `[[`, return up to `limit` candidates matching by
// title (pg_trgm-powered ILIKE on the explicit column) or by id
// when the query is all digits. Empty `q` returns the most recent
// notes so the popover has something to show at the `[[` trigger
// moment.
export async function GET(req: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse({
        q: searchParams.get("q") ?? undefined,
        limit: searchParams.get("limit") ?? undefined,
    });
    if (!parsed.success) {
        return NextResponse.json({ error: "Invalid query" }, { status: 400 });
    }
    const { q, limit } = parsed.data;

    // Numeric query → exact id match takes priority so `[[12` always
    // surfaces note 12 at the top even if there's a title containing
    // "12" that would otherwise outrank it via trigram.
    const numericMatch = q && /^\d+$/.test(q) ? Number(q) : null;

    let builder = supabase
        .from("notes")
        .select("id, title, content")
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (numericMatch !== null) {
        builder = builder.eq("id", numericMatch);
    } else if (q) {
        // Combined match: title ILIKE OR first 80 chars of content
        // ILIKE. The content clause is what lets the popover work
        // for notes that don't have a title yet (existing rows).
        const needle = `%${q}%`;
        builder = builder.or(
            `title.ilike.${needle},content.ilike.${needle}`,
        );
    }

    const { data, error } = await builder;
    if (error) {
        console.error("note-search error:", error);
        return NextResponse.json({ error: "Search failed" }, { status: 500 });
    }

    const results = (data ?? []).map((row) => ({
        id: row.id as number,
        title: (row.title as string | null)?.trim() || null,
        excerpt: extractFirstLine(row.content as string),
    }));

    return NextResponse.json({ results });
}

function extractFirstLine(content: string): string {
    const first = content
        .split("\n")
        .map((s) => s.trim())
        .find(Boolean);
    if (!first) return "";
    return first.length > 80 ? `${first.slice(0, 80)}…` : first;
}
