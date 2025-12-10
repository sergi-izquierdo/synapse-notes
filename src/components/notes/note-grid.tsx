"use client";

import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Trash2 } from "lucide-react";
import { deleteNote } from "@/actions/notes";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";
// Nous imports
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner"; // Per notificar l'esborrat

interface NoteGridProps {
  notes: any[];
}

export function NoteGrid({ notes }: NoteGridProps) {
  const { t } = useLanguage();

  if (!notes || notes.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-10">
        {t.dashboard.empty}
      </div>
    );
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteNote(id);
      toast.success("Nota eliminada correctament.");
    } catch (error) {
      toast.error("Error al eliminar la nota.");
    }
  };

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {notes.map((note) => (
        <Card
          key={note.id}
          className="group relative flex flex-col overflow-hidden border-muted-foreground/10 bg-background/80 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-primary/40"
        >
          <CardContent className="flex-1 p-6">
            {/* Renderitzat Markdown amb plugin GFM (taules, checklists...) */}
            {/* Afegim text-foreground per augmentar el contrast (no muted) */}
            <div className="prose prose-sm dark:prose-invert wrap-break-word text-foreground/90">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {note.content}
              </ReactMarkdown>
            </div>
          </CardContent>

          <CardFooter className="flex justify-between border-t bg-muted/30 p-3 opacity-0 transition-opacity group-hover:opacity-100">
            <span className="text-[10px] text-muted-foreground font-medium">
              {new Date(note.created_at).toLocaleDateString()}
            </span>

            {/* Modal de Confirmació */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:bg-destructive hover:text-white rounded-full"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Estàs absolutament segur?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Aquesta acció no es pot desfer. La nota s'esborrarà
                    permanentment del teu cervell digital.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel·lar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => handleDelete(note.id)}
                  >
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
