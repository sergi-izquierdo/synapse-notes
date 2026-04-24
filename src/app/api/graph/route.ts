import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/graph — returns the authenticated user's note graph
// (nodes + tag-Jaccard + embedding top-k links) computed by the
// `get_note_graph` RPC. Read-only, so this is a Route Handler
// (cacheable per user) rather than a Server Action.

export async function GET() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase.rpc("get_note_graph");
    if (error) {
        console.error("get_note_graph error:", error);
        return NextResponse.json(
            { error: "Failed to build graph" },
            { status: 500 },
        );
    }

    // The RPC returns a single jsonb — supabase-js unwraps it into a
    // plain object already. Shape: { nodes, links, meta }.
    return NextResponse.json(data ?? { nodes: [], links: [], meta: {} });
}
