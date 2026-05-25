import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getClient } from "@/lib/mcp/oauth/store";
import { createAuthCode } from "@/lib/mcp/oauth/crypto";

// OAuth 2.1 Authorization Endpoint
//
// GET  → validate params, check Supabase session, redirect to consent page
// POST → user approved, generate encrypted auth code, redirect to client

function oauthError(redirectUri: string, error: string, description: string, state?: string) {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  url.searchParams.set("error_description", description);
  if (state) url.searchParams.set("state", state);
  return NextResponse.redirect(url.toString());
}

function jsonError(error: string, description: string, status = 400) {
  return NextResponse.json({ error, error_description: description }, { status });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const clientId = url.searchParams.get("client_id");
  const redirectUri = url.searchParams.get("redirect_uri");
  const codeChallenge = url.searchParams.get("code_challenge");
  const codeChallengeMethod = url.searchParams.get("code_challenge_method");
  const state = url.searchParams.get("state") ?? undefined;
  const responseType = url.searchParams.get("response_type");

  if (!clientId || !redirectUri || !codeChallenge || !responseType) {
    return jsonError("invalid_request", "Missing required parameters (client_id, redirect_uri, code_challenge, response_type)");
  }
  if (responseType !== "code") {
    return jsonError("unsupported_response_type", "Only response_type=code is supported");
  }
  if (codeChallengeMethod && codeChallengeMethod !== "S256") {
    return jsonError("invalid_request", "Only code_challenge_method=S256 is supported");
  }

  const client = getClient(clientId);
  if (!client) {
    return jsonError("invalid_client", "Unknown client_id. Register via the /api/oauth/register endpoint.");
  }
  if (!client.redirect_uris.includes(redirectUri)) {
    return jsonError("invalid_request", "redirect_uri does not match registered URIs");
  }

  // Redirect to consent page (preserves all params as query string)
  const consentUrl = new URL("/mcp-authorize", url.origin);
  consentUrl.searchParams.set("client_id", clientId);
  consentUrl.searchParams.set("redirect_uri", redirectUri);
  consentUrl.searchParams.set("code_challenge", codeChallenge);
  if (state) consentUrl.searchParams.set("state", state);

  return NextResponse.redirect(consentUrl.toString());
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const clientId = formData.get("client_id") as string | null;
  const redirectUri = formData.get("redirect_uri") as string | null;
  const codeChallenge = formData.get("code_challenge") as string | null;
  const state = (formData.get("state") as string | null) ?? undefined;

  if (!clientId || !redirectUri || !codeChallenge) {
    return jsonError("invalid_request", "Missing form fields");
  }

  const client = getClient(clientId);
  if (!client) {
    return jsonError("invalid_client", "Unknown client_id");
  }
  if (!client.redirect_uris.includes(redirectUri)) {
    return jsonError("invalid_request", "redirect_uri mismatch");
  }

  // Verify the user is authenticated via Supabase session (browser cookies)
  const supabase = await createClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) {
    return oauthError(redirectUri, "access_denied", "User is not authenticated. Please log in first.", state);
  }

  // Generate encrypted auth code containing the Supabase tokens
  const code = createAuthCode({
    userId: session.user.id,
    clientId,
    codeChallenge,
    redirectUri,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
  });

  const callbackUrl = new URL(redirectUri);
  callbackUrl.searchParams.set("code", code);
  if (state) callbackUrl.searchParams.set("state", state);

  return NextResponse.redirect(callbackUrl.toString());
}
