import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Trash2 } from "lucide-react";
import { deleteNote } from "@/actions/notes";
import { Button } from "@/components/ui/button";

export async function NoteGrid() {
  const supabase = await createClient();
  const { data: notes } = await supabase
    .from("notes")
    .select("*")
    .order("created_at", { ascending: false });

  if (!notes || notes.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-10">
        Encara no tens cap nota. Comença a escriure! 🚀
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {notes.map((note) => (
        <Card
          key={note.id}
          className="group relative overflow-hidden transition-all hover:shadow-md"
        >
          <CardContent className="p-4 pt-4">
            <p className="whitespace-pre-wrap text-sm">{note.content}</p>
          </CardContent>
          <CardFooter className="flex justify-end p-2 opacity-0 transition-opacity group-hover:opacity-100">
            <form action={deleteNote.bind(null, note.id)}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </form>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
