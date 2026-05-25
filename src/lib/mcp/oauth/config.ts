import "server-only";

function baseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function getIssuerUrl(): string {
  return baseUrl();
}

export function getResourceUrl(): string {
  return `${baseUrl()}/api/mcp`;
}

export function getAuthorizationEndpoint(): string {
  return `${baseUrl()}/api/oauth/authorize`;
}

export function getTokenEndpoint(): string {
  return `${baseUrl()}/api/oauth/token`;
}

export function getRegistrationEndpoint(): string {
  return `${baseUrl()}/api/oauth/register`;
}
