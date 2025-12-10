// src/app/(dashboard)/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { signOut } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { CreateNoteForm } from "@/components/notes/create-note-form";
import { NoteGrid } from "@/components/notes/note-grid";
import { LogOut } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header"; // El creem ara sota
import { ChatInterface } from "@/components/chat/chat-interface";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  // Obtenim les notes al servidor (ràpid i eficient)
  const { data: notes } = await supabase
    .from("notes")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <div className="mb-8 flex items-start justify-between">
        <DashboardHeader userEmail={user.email!} />

        <form action={signOut}>
          <Button variant="outline" size="sm">
            <LogOut className="mr-2 h-4 w-4" />
            {/* El text del botó 'Sortir' no es traduirà dinàmicament aquí perquè és server, 
                però podem deixar "Log out" en anglès o posar una icona només. */}
            <span className="hidden sm:inline ml-2">Log out</span>
          </Button>
        </form>
      </div>

      <CreateNoteForm />
      <NoteGrid notes={notes || []} />
      <ChatInterface />
    </div>
  );
}
