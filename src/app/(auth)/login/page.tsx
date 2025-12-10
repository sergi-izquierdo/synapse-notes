import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { signInWith } from "@/actions/auth";
import { BrainCircuit, Github } from "lucide-react";

// Icona de Google
function GoogleIcon() {
  return (
    <svg
      className="mr-2 h-4 w-4"
      aria-hidden="true"
      focusable="false"
      data-prefix="fab"
      data-icon="google"
      role="img"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 488 512"
    >
      <path
        fill="currentColor"
        d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"
      ></path>
    </svg>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 px-4">
      <Card className="w-full max-w-sm border-none shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <BrainCircuit className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Synapse Notes</CardTitle>
          <CardDescription>
            El teu segon cervell, potenciat per IA.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
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
              <Github className="mr-2 h-4 w-4" />
              Continuar amb GitHub
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
