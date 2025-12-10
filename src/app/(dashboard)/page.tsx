import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { signOut } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { CreateNoteForm } from "@/components/notes/create-note-form";
import { NoteGrid } from "@/components/notes/note-grid";
import { LogOut } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return redirect("/login");

  return (
    <div className="container mx-auto max-w-4xl p-6">
      {/* Header Senzill */}
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">El meu Cervell 🧠</h1>
        <form action={signOut}>
          <Button variant="outline" size="sm">
            <LogOut className="mr-2 h-4 w-4" /> Sortir
          </Button>
        </form>
      </header>

      {/* Formulari de Creació */}
      <CreateNoteForm />

      {/* Llista de Notes */}
      <NoteGrid />
    </div>
  );
}
