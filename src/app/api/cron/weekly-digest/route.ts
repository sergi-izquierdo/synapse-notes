import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createWeeklyDigestService } from "@/services/weekly-digest.service";

export const maxDuration = 30;

// Vercel cron entry point for the weekly-digest agent.
// Schedule: "0 3 * * 0" (Sunday 3 AM UTC) in vercel.json.
// Iterates the allowlist and creates a digest note per user.

function unauthorized(reason: string) {
  return NextResponse.json({ error: reason }, { status: 401 });
}

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }
  const header = req.headers.get("authorization") ?? "";
  if (header !== `Bearer ${expected}`) {
    return unauthorized("Invalid or missing cron secret");
  }

  const rawAllowlist = process.env.AI_ALLOWLIST_USER_IDS ?? "";
  const userIds = rawAllowlist
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (userIds.length === 0) {
    return NextResponse.json({
      ok: true,
      message: "No allowlisted users; nothing to do",
      processed: 0,
    });
  }

  const admin = createAdminClient();
  const service = createWeeklyDigestService(admin);

  const perUser: Array<{
    userId: string;
    digestNoteId?: number;
    notesCreated?: number;
    notesUpdated?: number;
    error?: string;
  }> = [];

  for (const userId of userIds) {
    try {
      const result = await service.generateDigest(userId);
      perUser.push({
        userId,
        digestNoteId: result.digestNoteId,
        notesCreated: result.notesCreated,
        notesUpdated: result.notesUpdated,
      });
    } catch (err) {
      perUser.push({
        userId,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    runAt: new Date().toISOString(),
    perUser,
  });
}
