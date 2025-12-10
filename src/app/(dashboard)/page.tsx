import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { signOut } from "@/actions/auth";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  return (
    <div className="p-10">
      <h1 className="text-3xl font-bold">Hola, {user.email}!</h1>
      <p className="mb-4 text-muted-foreground">
        Benvingut al teu espai privat.
      </p>

      <form action={signOut}>
        <Button variant="destructive">Tancar Sessió</Button>
      </form>
    </div>
  );
}
