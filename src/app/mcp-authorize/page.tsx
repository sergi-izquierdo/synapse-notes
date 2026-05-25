import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getClient } from "@/lib/mcp/oauth/store";

interface Props {
  searchParams: Promise<{
    client_id?: string;
    redirect_uri?: string;
    code_challenge?: string;
    state?: string;
  }>;
}

export default async function McpAuthorizePage({ searchParams }: Props) {
  const params = await searchParams;
  const { client_id, redirect_uri, code_challenge, state } = params;

  if (!client_id || !redirect_uri || !code_challenge) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="max-w-md rounded-lg border p-6 text-center">
          <h1 className="text-xl font-semibold text-destructive">Invalid Request</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Missing required authorization parameters.
          </p>
        </div>
      </div>
    );
  }

  const client = getClient(client_id);
  if (!client) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="max-w-md rounded-lg border p-6 text-center">
          <h1 className="text-xl font-semibold text-destructive">Unknown Client</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The client &quot;{client_id}&quot; is not registered.
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = `/login?next=${encodeURIComponent(`/mcp-authorize?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&code_challenge=${code_challenge}${state ? `&state=${state}` : ""}`)}`;
    redirect(loginUrl);
  }

  const clientName = client.client_name ?? "An MCP client";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-8 shadow-lg">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <svg
              className="h-8 w-8 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold">Authorize Access</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            <strong>{clientName}</strong> wants to access your Synapse Notes
          </p>
        </div>

        <div className="mb-6 rounded-md bg-muted p-4 text-sm">
          <p className="font-medium">This will allow the client to:</p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            <li>Read and search your notes</li>
            <li>Create, update, and delete notes</li>
            <li>Manage tags</li>
            <li>Summarize note content</li>
            <li>Navigate the note graph</li>
          </ul>
        </div>

        <p className="mb-6 text-xs text-muted-foreground text-center">
          Signed in as <strong>{user.email}</strong>
        </p>

        <form action="/api/oauth/authorize" method="POST">
          <input type="hidden" name="client_id" value={client_id} />
          <input type="hidden" name="redirect_uri" value={redirect_uri} />
          <input type="hidden" name="code_challenge" value={code_challenge} />
          {state && <input type="hidden" name="state" value={state} />}

          <div className="flex gap-3">
            <a
              href={redirect_uri + "?error=access_denied&error_description=User+denied+access" + (state ? `&state=${state}` : "")}
              className="flex-1 rounded-md border bg-background px-4 py-2.5 text-center text-sm font-medium hover:bg-muted transition-colors"
            >
              Deny
            </a>
            <button
              type="submit"
              className="flex-1 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Authorize
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
