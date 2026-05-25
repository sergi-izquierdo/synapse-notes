import "server-only";

import { randomUUID } from "node:crypto";

// In-memory client registration store. Clients survive within a single
// Vercel Fluid Compute instance (which reuses across requests). If the
// instance recycles, Claude Code re-registers automatically via DCR.
// For production multi-tenant, replace with a database-backed store.

export interface OAuthClient {
  client_id: string;
  client_name?: string;
  redirect_uris: string[];
  client_id_issued_at: number;
}

const clients = new Map<string, OAuthClient>();

export function registerClient(metadata: {
  client_name?: string;
  redirect_uris: string[];
}): OAuthClient {
  const client: OAuthClient = {
    client_id: randomUUID(),
    client_name: metadata.client_name,
    redirect_uris: metadata.redirect_uris,
    client_id_issued_at: Math.floor(Date.now() / 1000),
  };
  clients.set(client.client_id, client);
  return client;
}

export function getClient(clientId: string): OAuthClient | undefined {
  return clients.get(clientId);
}
