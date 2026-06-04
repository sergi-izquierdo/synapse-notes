import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { decryptAuthCode, verifyPkceS256 } from "@/lib/mcp/oauth/crypto";
import { getClient } from "@/lib/mcp/oauth/store";
import { withCors, corsPreflight } from "@/lib/mcp/oauth/cors";

// OAuth 2.1 Token Endpoint
//
// grant_type=authorization_code → decrypt code, verify PKCE, return Supabase tokens
// grant_type=refresh_token      → call Supabase refreshSession, return new tokens

export function OPTIONS() {
  return corsPreflight();
}

function oauthError(error: string, description: string, status = 400) {
  return withCors(
    NextResponse.json({ error, error_description: description }, { status }),
  );
}

export async function POST(req: Request) {
  let params: URLSearchParams;
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    params = new URLSearchParams(await req.text());
  } else if (contentType.includes("application/json")) {
    const body = await req.json();
    params = new URLSearchParams(body as Record<string, string>);
  } else {
    return oauthError("invalid_request", "Content-Type must be application/x-www-form-urlencoded or application/json");
  }

  const grantType = params.get("grant_type");
  const clientId = params.get("client_id");

  if (!clientId) {
    return oauthError("invalid_request", "Missing client_id");
  }
  const client = getClient(clientId);
  if (!client) {
    return oauthError("invalid_client", "Unknown client_id. Re-register via DCR.");
  }

  if (grantType === "authorization_code") {
    return handleAuthorizationCode(params, clientId);
  } else if (grantType === "refresh_token") {
    return handleRefreshToken(params);
  } else {
    return oauthError("unsupported_grant_type", "Only authorization_code and refresh_token are supported");
  }
}

async function handleAuthorizationCode(params: URLSearchParams, clientId: string) {
  const code = params.get("code");
  const codeVerifier = params.get("code_verifier");
  const redirectUri = params.get("redirect_uri");

  if (!code || !codeVerifier) {
    return oauthError("invalid_request", "Missing code or code_verifier");
  }

  let payload;
  try {
    payload = decryptAuthCode(code);
  } catch (err) {
    return oauthError("invalid_grant", err instanceof Error ? err.message : "Invalid auth code");
  }

  if (payload.clientId !== clientId) {
    return oauthError("invalid_grant", "client_id mismatch");
  }
  if (redirectUri && payload.redirectUri !== redirectUri) {
    return oauthError("invalid_grant", "redirect_uri mismatch");
  }
  if (!verifyPkceS256(codeVerifier, payload.codeChallenge)) {
    return oauthError("invalid_grant", "PKCE verification failed");
  }

  return withCors(
    NextResponse.json({
      access_token: payload.accessToken,
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: payload.refreshToken,
    }),
  );
}

async function handleRefreshToken(params: URLSearchParams) {
  const refreshToken = params.get("refresh_token");
  if (!refreshToken) {
    return oauthError("invalid_request", "Missing refresh_token");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return oauthError("server_error", "Supabase not configured", 500);
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) {
    return oauthError("invalid_grant", "Failed to refresh token. Re-authorize.");
  }

  return withCors(
    NextResponse.json({
      access_token: data.session.access_token,
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: data.session.refresh_token,
    }),
  );
}
