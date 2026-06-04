// CORS for the browser-facing OAuth endpoints.
//
// MCP clients that run their OAuth dance in the browser (e.g. the MCP
// Inspector) fetch the discovery metadata, register dynamically, and exchange
// the auth code directly against this origin from `http://localhost:<port>`.
// Those are cross-origin requests, and because the Inspector attaches a custom
// `MCP-Protocol-Version` header they are "non-simple", so the browser sends a
// preflight `OPTIONS` first. Without an OPTIONS handler and the matching
// `Access-Control-Allow-*` headers the preflight fails and the whole flow dies.
//
// The MCP transport itself does NOT need this: it runs server-to-server through
// the Inspector proxy. Only the OAuth metadata/token/register routes are hit
// straight from the browser.
//
// `Access-Control-Allow-Origin: *` is safe here: these endpoints carry no
// cookies (the token endpoint is a public PKCE client, auth method "none"), so
// there are no credentials to protect. Note the spec excludes `Authorization`
// from the `*` header wildcard, so it is listed explicitly.

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id",
  "Access-Control-Max-Age": "86400",
};

/** Add the CORS headers to an existing response and return it. */
export function withCors<T extends Response>(res: T): T {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    res.headers.set(key, value);
  }
  return res;
}

/** Reply to a CORS preflight (`OPTIONS`) request. */
export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
