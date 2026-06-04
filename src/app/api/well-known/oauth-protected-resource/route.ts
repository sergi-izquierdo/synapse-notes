import { NextResponse } from "next/server";
import { getIssuerUrl, getResourceUrl } from "@/lib/mcp/oauth/config";
import { withCors, corsPreflight } from "@/lib/mcp/oauth/cors";

// RFC 9728: OAuth 2.0 Protected Resource Metadata
// Tells MCP clients where to find the authorization server for this resource.
export function GET() {
  return withCors(
    NextResponse.json(
      {
        resource: getResourceUrl(),
        authorization_servers: [getIssuerUrl()],
        bearer_methods_supported: ["header"],
        resource_name: "Synapse Notes MCP Server",
      },
      {
        headers: {
          "Cache-Control": "public, max-age=3600",
        },
      },
    ),
  );
}

export function OPTIONS() {
  return corsPreflight();
}
