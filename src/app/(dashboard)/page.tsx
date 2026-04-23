import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { signOut } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { CreateNoteForm } from "@/components/notes/create-note-form";
import { NoteGrid } from "@/components/notes/note-grid";
import { LogOut } from "lucide-react";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { BackgroundPaths } from "@/components/backgrounds/background-paths";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  const { data: notes } = await supabase
    .from("notes")
    .select("*")
    // Starred notes float to the top; everything else by recency.
    // Matches the composite index notes_user_starred_created_idx.
    .order("starred", { ascending: false })
    .order("created_at", { ascending: false });

  // CALCULATION: Extract unique tags
  const allTags = notes?.flatMap((note) => note.tags || []) || [];
  const availableTags = Array.from(new Set(allTags)).sort();

  return (
    // CONTENIDOR FLEX (Pantalla Completa sense scroll al body)
    <div className="flex h-screen w-full overflow-hidden">
      {/* BARRA LATERAL ESQUERRA (XAT) */}
      <ChatSidebar userId={user.id} />

      {/* CONTINGUT PRINCIPAL (NOTES) */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <BackgroundPaths />
        {/* Scroll només a la zona de contingut */}
        <div className="relative z-10 flex-1 overflow-y-auto">
          <div className="container mx-auto max-w-5xl p-6 space-y-8">
            {/* Header + Logout */}
            <div className="flex items-start justify-between">
              <DashboardHeader userEmail={user.email!} />
              <form action={signOut}>
                <Button variant="outline" size="sm" className="gap-2">
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Log out</span>
                </Button>
              </form>
            </div>

            {/* Creació i Grid */}
            <div className="space-y-8 pb-20">
              <section>
                {/* ✅ PASSING TAGS TO CREATE FORM */}
                <CreateNoteForm availableTags={availableTags} />
              </section>

              <section>
                <h2 className="text-lg font-semibold mb-4 text-muted-foreground flex items-center gap-2">
                  Notes recents
                  <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
                    {notes?.length || 0}
                  </span>
                </h2>
                <NoteGrid notes={notes || []} availableTags={availableTags} />
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
