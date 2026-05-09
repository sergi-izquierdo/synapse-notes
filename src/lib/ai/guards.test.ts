import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  AiDisabledError,
  AiNotAllowlistedError,
  assertAiAllowed,
  isAiAllowedForUser,
  isAiGuardError,
} from "./guards";

const USER = "00000000-0000-0000-0000-000000000001";
const OTHER = "00000000-0000-0000-0000-000000000002";

describe("assertAiAllowed", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("permits everyone when no env vars are set (dev default)", () => {
    expect(() => assertAiAllowed(USER)).not.toThrow();
    expect(isAiAllowedForUser(USER)).toBe(true);
  });

  it("kill-switch blocks every user when AI_ENABLED=false", () => {
    vi.stubEnv("AI_ENABLED", "false");
    expect(() => assertAiAllowed(USER)).toThrow(AiDisabledError);
    expect(isAiAllowedForUser(USER)).toBe(false);
  });

  it("recognises 0 / off / no as kill-switch values", () => {
    for (const v of ["0", "off", "OFF", "no"]) {
      vi.stubEnv("AI_ENABLED", v);
      expect(() => assertAiAllowed(USER)).toThrow(AiDisabledError);
    }
  });

  it("treats AI_ALLOWLIST_ONLY=false as open access regardless of allowlist", () => {
    vi.stubEnv("AI_ALLOWLIST_ONLY", "false");
    vi.stubEnv("AI_ALLOWLIST_USER_IDS", USER);
    expect(() => assertAiAllowed(OTHER)).not.toThrow();
  });

  it("blocks non-allowlisted users when AI_ALLOWLIST_ONLY=true", () => {
    vi.stubEnv("AI_ALLOWLIST_ONLY", "true");
    vi.stubEnv("AI_ALLOWLIST_USER_IDS", USER);
    expect(() => assertAiAllowed(OTHER)).toThrow(AiNotAllowlistedError);
    expect(isAiAllowedForUser(OTHER)).toBe(false);
    expect(isAiAllowedForUser(USER)).toBe(true);
  });

  it("permits allowlisted users when AI_ALLOWLIST_ONLY=true", () => {
    vi.stubEnv("AI_ALLOWLIST_ONLY", "true");
    vi.stubEnv("AI_ALLOWLIST_USER_IDS", `${USER}, ${OTHER}`);
    expect(() => assertAiAllowed(USER)).not.toThrow();
    expect(() => assertAiAllowed(OTHER)).not.toThrow();
  });

  it("blocks every user when allowlist is empty and ALLOWLIST_ONLY=true", () => {
    vi.stubEnv("AI_ALLOWLIST_ONLY", "true");
    vi.stubEnv("AI_ALLOWLIST_USER_IDS", "");
    expect(() => assertAiAllowed(USER)).toThrow(AiNotAllowlistedError);
  });

  it("kill-switch beats allowlist (defence in depth)", () => {
    vi.stubEnv("AI_ENABLED", "false");
    vi.stubEnv("AI_ALLOWLIST_ONLY", "true");
    vi.stubEnv("AI_ALLOWLIST_USER_IDS", USER);
    expect(() => assertAiAllowed(USER)).toThrow(AiDisabledError);
  });

  it("isAiGuardError discriminates guard errors from other throws", () => {
    expect(isAiGuardError(new AiDisabledError())).toBe(true);
    expect(isAiGuardError(new AiNotAllowlistedError())).toBe(true);
    expect(isAiGuardError(new Error("anything else"))).toBe(false);
    expect(isAiGuardError(null)).toBe(false);
  });
});
