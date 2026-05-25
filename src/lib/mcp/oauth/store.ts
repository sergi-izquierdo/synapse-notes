import "server-only";

import { createHash, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Stateless client registration. The client_id IS an encrypted token
// containing the registration metadata. No shared state between Vercel
// Fluid Compute instances. When the authorize or token endpoint
// receives a client_id, it decrypts it to recover the metadata.

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export interface OAuthClient {
  client_id: string;
  client_name?: string;
  redirect_uris: string[];
  client_id_issued_at: number;
}

interface ClientPayload {
  n?: string; // client_name (short key to keep token compact)
  r: string[]; // redirect_uris
  t: number; // issued_at
}

function getKey(): Buffer {
  const secret = process.env.MCP_OAUTH_SECRET;
  if (!secret) {
    throw new Error("MCP_OAUTH_SECRET env var is required for MCP OAuth");
  }
  return createHash("sha256").update(secret + ":clients").digest();
}

function encrypt(payload: ClientPayload): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const json = JSON.stringify(payload);
  const encrypted = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, tag])
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function decrypt(token: string): ClientPayload | undefined {
  try {
    const key = getKey();
    const padded = token.replace(/-/g, "+").replace(/_/g, "/");
    const combined = Buffer.from(padded, "base64");
    if (combined.length < IV_LENGTH + TAG_LENGTH + 1) return undefined;
    const iv = combined.subarray(0, IV_LENGTH);
    const tag = combined.subarray(combined.length - TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = decipher.update(encrypted) + decipher.final("utf8");
    return JSON.parse(decrypted) as ClientPayload;
  } catch {
    return undefined;
  }
}

export function registerClient(metadata: {
  client_name?: string;
  redirect_uris: string[];
}): OAuthClient {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: ClientPayload = {
    n: metadata.client_name,
    r: metadata.redirect_uris,
    t: issuedAt,
  };
  return {
    client_id: encrypt(payload),
    client_name: metadata.client_name,
    redirect_uris: metadata.redirect_uris,
    client_id_issued_at: issuedAt,
  };
}

export function getClient(clientId: string): OAuthClient | undefined {
  const payload = decrypt(clientId);
  if (!payload) return undefined;
  return {
    client_id: clientId,
    client_name: payload.n,
    redirect_uris: payload.r,
    client_id_issued_at: payload.t,
  };
}
