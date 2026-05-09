import "server-only";

// Cost-safety guards (TFG D4).
//
// Three env vars compose a kill-switch + allowlist on top of the
// AI surfaces (chat, suggest-tags, MCP summarise-notes, embedding
// generation on note save). They exist because Synapse Notes is
// publicly reachable at synapse-notes.vercel.app and the AI calls
// hit metered third-party APIs (Anthropic + Google AI). Without
// these gates, a leaked URL or scraped form-post endpoint could
// run up the bill before provider-side caps kick in.
//
// Defence in depth (D4):
//   1. AI_ENABLED          — global kill-switch. Wins over everything.
//   2. AI_ALLOWLIST_ONLY   — when "true", only listed user_ids can
//                            call AI. Default off so dev is frictionless.
//   3. AI_ALLOWLIST_USER_IDS — comma-separated UUIDs. Empty list +
//                              ALLOWLIST_ONLY=true = nobody (intentional).
//
// Provider-side spending caps (Google AI Studio + Anthropic Console)
// remain the last line of defence and are configured outside the
// codebase. See docs/tfg/00-decision-log.md D4.

export class AiDisabledError extends Error {
  readonly status = 503;
  constructor() {
    super("AI features are temporarily disabled");
    this.name = "AiDisabledError";
  }
}

export class AiNotAllowlistedError extends Error {
  readonly status = 403;
  constructor() {
    super("AI features are not enabled for this account");
    this.name = "AiNotAllowlistedError";
  }
}

function envFlag(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  const v = value.toLowerCase().trim();
  if (v === "" || v === "false" || v === "0" || v === "off" || v === "no") {
    return false;
  }
  if (v === "true" || v === "1" || v === "on" || v === "yes") {
    return true;
  }
  return defaultValue;
}

export function isAiEnabled(): boolean {
  return envFlag(process.env.AI_ENABLED, true);
}

export function isAllowlistRestricted(): boolean {
  return envFlag(process.env.AI_ALLOWLIST_ONLY, false);
}

function parseAllowlist(): Set<string> {
  const raw = process.env.AI_ALLOWLIST_USER_IDS ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function isAiAllowedForUser(userId: string): boolean {
  if (!isAiEnabled()) return false;
  if (!isAllowlistRestricted()) return true;
  return parseAllowlist().has(userId);
}

export function assertAiAllowed(userId: string): void {
  if (!isAiEnabled()) throw new AiDisabledError();
  if (!isAllowlistRestricted()) return;
  if (!parseAllowlist().has(userId)) throw new AiNotAllowlistedError();
}

export function isAiGuardError(
  err: unknown,
): err is AiDisabledError | AiNotAllowlistedError {
  return err instanceof AiDisabledError || err instanceof AiNotAllowlistedError;
}
