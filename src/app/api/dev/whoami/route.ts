import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Dev-only helper. Returns the current Supabase session's access_token so
// MCP Inspector (or `curl`) can hit /api/mcp without hand-decoding the
// split cookies that @supabase/ssr writes to the browser. Gated on
// NODE_ENV: production builds always return 404 and never touch the
// session.
export async function GET() {
    if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.getSession();

    if (error || !data.session) {
        return NextResponse.json(
            {
                error: "No active session. Log in at /login first, then reload this page.",
            },
            { status: 401 },
        );
    }

    const { session } = data;
    return NextResponse.json({
        user: { id: session.user.id, email: session.user.email },
        access_token: session.access_token,
        expires_at: session.expires_at,
    });
}
