import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { signInWith } from "@/actions/auth";
import { BrainCircuit, Github } from "lucide-react";
import { BackgroundPaths } from "@/components/backgrounds/background-paths";

function GoogleIcon() {
  return (
    <svg
      className="mr-2 h-4 w-4"
      aria-hidden="true"
      focusable="false"
      role="img"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 488 512"
    >
      <path
        fill="currentColor"
        d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"
      />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <div className="relative min-h-screen flex flex-col bg-background overflow-hidden">
      <BackgroundPaths />

      <header className="relative z-10 px-6 py-5 flex items-center justify-between max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <BrainCircuit className="h-7 w-7 text-primary" aria-hidden />
          <span className="text-lg font-semibold tracking-tight">
            Synapse Notes
          </span>
        </div>
        <a
          href="https://github.com/sergi-izquierdo/synapse-notes"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-base text-muted-foreground hover:text-foreground transition-colors"
        >
          <Github className="h-5 w-5" aria-hidden />
          GitHub
        </a>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-12">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 max-w-5xl w-full items-center">
          {/* Hero pitch */}
          <div className="space-y-6 text-center lg:text-left">
            <h1 className="text-4xl lg:text-5xl font-semibold tracking-tight leading-[1.1]">
              Un segon cervell
              <br />
              <span className="text-primary">amb agents</span>
              <br />
              que el poden llegir.
            </h1>
            <p className="text-muted-foreground leading-relaxed max-w-md mx-auto lg:mx-0">
              Notes SaaS multi-tenant amb xat RAG, més un servidor MCP
              que permet a agents d&apos;IA externs operar sobre la teva
              base de coneixement sota OAuth 2.1.
            </p>
            <ul className="text-xs text-muted-foreground space-y-1.5 font-mono max-w-md mx-auto lg:mx-0 text-left">
              <li>
                <span className="text-primary">§</span> Notes a Postgres
                amb pgvector + RLS multi-tenant
              </li>
              <li>
                <span className="text-primary">§</span> Xat contextual
                amb Claude Haiku 4.5
              </li>
              <li>
                <span className="text-primary">§</span> Model Context
                Protocol server amb OAuth 2.1 (en curs)
              </li>
            </ul>
          </div>

          {/* Login card */}
          <div className="flex justify-center lg:justify-end">
            <Card className="w-full max-w-sm">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-border/60">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
                    <BrainCircuit
                      className="h-5 w-5 text-primary"
                      aria-hidden
                    />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold">
                      Entra a la teva sessió
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      continua amb el teu proveïdor
                    </p>
                  </div>
                </div>

                <form
                  action={async () => {
                    "use server";
                    await signInWith("google");
                  }}
                >
                  <Button variant="outline" className="w-full" type="submit">
                    <GoogleIcon />
                    Continuar amb Google
                  </Button>
                </form>

                <form
                  action={async () => {
                    "use server";
                    await signInWith("github");
                  }}
                >
                  <Button variant="outline" className="w-full" type="submit">
                    <Github className="mr-2 h-4 w-4" aria-hidden />
                    Continuar amb GitHub
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <footer className="relative z-10 px-6 py-5 text-center text-xs text-muted-foreground">
        <p className="font-mono">
          §&nbsp;Treball de Fi de Grau · Sergi Izquierdo · URV Tarragona · Juny
          2026
        </p>
      </footer>
    </div>
  );
}
