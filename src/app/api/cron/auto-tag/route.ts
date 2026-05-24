import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAutoTagService } from "@/services/auto-tag.service";
import { isAiAllowedForUser } from "@/lib/ai/guards";

export const maxDuration = 60;

// Vercel cron entry point for the auto-tag agent.
//
// Auth: Vercel injects `Authorization: Bearer <CRON_SECRET>` on
// scheduled invocations. We refuse anything else. The cron secret
// is set via `vercel env add CRON_SECRET production`.
//
// Scope: iterates the D4 allowlist (AI_ALLOWLIST_USER_IDS) and, for
// each user, picks up to N untagged notes and proposes tags. Writes
// proposals to `tag_suggestions` (status=pending) for human review,
// logs every proposal to `agent_events`.
//
// Cost: bounded by `MAX_NOTES_PER_RUN` × number of allowlisted users.
// At allowlist=1, MAX_NOTES_PER_RUN=10, hourly schedule, this is at
// most 240 LLM calls/day to Anthropic Haiku 4.5 (~0.20 EUR).
const MAX_NOTES_PER_RUN = 10;

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
  const service = createAutoTagService(admin);

  const perUser: Array<{
    userId: string;
    skipped?: string;
    notesSeen?: number;
    proposalsWritten?: number;
    errors?: string[];
  }> = [];

  for (const userId of userIds) {
    if (!isAiAllowedForUser(userId)) {
      perUser.push({ userId, skipped: "not-allowlisted-or-kill-switch" });
      continue;
    }

    try {
      const notes = await service.findCandidateNotes(userId, {
        limit: MAX_NOTES_PER_RUN,
      });
      const availableTags = await service.listAvailableTags(userId);
      const errors: string[] = [];
      let proposalsWritten = 0;

      for (const note of notes) {
        try {
          const proposal = await service.proposeForNote({
            note,
            availableTags,
            userId,
            persist: true,
          });
          if (proposal.existing.length > 0 || proposal.newTag) {
            proposalsWritten += 1;
          }
        } catch (err) {
          errors.push(
            `note ${note.id}: ${err instanceof Error ? err.message : "unknown"}`,
          );
        }
      }

      perUser.push({
        userId,
        notesSeen: notes.length,
        proposalsWritten,
        ...(errors.length > 0 ? { errors } : {}),
      });
    } catch (err) {
      perUser.push({
        userId,
        errors: [err instanceof Error ? err.message : "unknown"],
      });
    }
  }

  return NextResponse.json({
    ok: true,
    runAt: new Date().toISOString(),
    perUser,
  });
}
