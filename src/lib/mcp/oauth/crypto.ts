import "server-only";

import { randomBytes, createCipheriv, createDecipheriv, createHash } from "node:crypto";

// AES-256-GCM encrypted auth codes. Stateless: the code IS the
// encrypted payload, so no shared state needed between the authorize
// endpoint (which writes the code) and the token endpoint (which reads
// it). Works across Vercel Fluid Compute instances.

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface AuthCodePayload {
  userId: string;
  clientId: string;
  codeChallenge: string;
  redirectUri: string;
  accessToken: string;
  refreshToken: string;
  exp: number;
}

function getKey(): Buffer {
  const secret = process.env.MCP_OAUTH_SECRET;
  if (!secret) {
    throw new Error("MCP_OAUTH_SECRET env var is required for MCP OAuth");
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptAuthCode(payload: AuthCodePayload): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const json = JSON.stringify(payload);
  const encrypted = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // iv (12) + ciphertext (variable) + tag (16)
  const combined = Buffer.concat([iv, encrypted, tag]);
  return combined
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function decryptAuthCode(code: string): AuthCodePayload {
  const key = getKey();
  // Restore base64 padding
  const padded = code.replace(/-/g, "+").replace(/_/g, "/");
  const combined = Buffer.from(padded, "base64");
  if (combined.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error("Invalid auth code: too short");
  }
  const iv = combined.subarray(0, IV_LENGTH);
  const tag = combined.subarray(combined.length - TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted: string;
  try {
    decrypted = decipher.update(encrypted) + decipher.final("utf8");
  } catch {
    throw new Error("Invalid auth code: decryption failed");
  }
  const payload = JSON.parse(decrypted) as AuthCodePayload;
  if (Date.now() > payload.exp) {
    throw new Error("Auth code expired");
  }
  return payload;
}

export function createAuthCode(data: Omit<AuthCodePayload, "exp">): string {
  return encryptAuthCode({ ...data, exp: Date.now() + CODE_TTL_MS });
}

export function verifyPkceS256(codeVerifier: string, codeChallenge: string): boolean {
  const expected = createHash("sha256")
    .update(codeVerifier)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return expected === codeChallenge;
}
