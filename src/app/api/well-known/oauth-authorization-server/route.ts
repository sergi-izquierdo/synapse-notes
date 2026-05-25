import { NextResponse } from "next/server";
import {
  getIssuerUrl,
  getAuthorizationEndpoint,
  getTokenEndpoint,
  getRegistrationEndpoint,
} from "@/lib/mcp/oauth/config";

// RFC 8414: OAuth 2.0 Authorization Server Metadata
// Tells MCP clients which endpoints to use for the OAuth flow.
export function GET() {
  return NextResponse.json(
    {
      issuer: getIssuerUrl(),
      authorization_endpoint: getAuthorizationEndpoint(),
      token_endpoint: getTokenEndpoint(),
      registration_endpoint: getRegistrationEndpoint(),
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      token_endpoint_auth_methods_supported: ["none"],
      code_challenge_methods_supported: ["S256"],
      service_documentation: "https://github.com/SergiIzworwordo/synapse-notes",
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
