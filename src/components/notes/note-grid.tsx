"use client";

import { useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Trash2, Search, Pencil } from "lucide-react";
import { deleteNote } from "@/actions/notes";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
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
import { EditNoteDialog } from "./edit-note-dialog";

interface NoteGridProps {
  notes: any[];
}

export function NoteGrid({ notes }: NoteGridProps) {
  const { t } = useLanguage();

  // Estats per Cerca i Edició
  const [searchTerm, setSearchTerm] = useState("");
  const [editingNote, setEditingNote] = useState<{
    id: number;
    content: string;
  } | null>(null);

  // FILTRATGE EN TEMPS REAL
  const filteredNotes = notes.filter((note) =>
    note.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async (id: number) => {
    try {
      await deleteNote(id);
      toast.success("Nota eliminada.");
    } catch (error) {
      toast.error("Error al eliminar.");
    }
  };

  return (
    <>
      {/* BARRA DE CERCA */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Cercar a les teves notes..."
          className="pl-9 bg-background/50 backdrop-blur-sm border-muted-foreground/20"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* GRID DE NOTES */}
      {filteredNotes.length === 0 ? (
        <div className="text-center text-muted-foreground py-10 opacity-50">
          {searchTerm
            ? "No s'han trobat notes amb aquest text."
            : t.dashboard.empty}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredNotes.map((note) => (
            <Card
              key={note.id}
              className="group relative flex flex-col overflow-hidden border-muted-foreground/10 bg-background/80 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-primary/40 cursor-pointer"
              // CLIC PER EDITAR (Obre el diàleg)
              onClick={() => setEditingNote(note)}
            >
              <CardContent className="flex-1 p-6 max-h-[300px] overflow-hidden mask-gradient-b">
                <div className="prose prose-sm dark:prose-invert wrap-break-word text-foreground/90 pointer-events-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {note.content}
                  </ReactMarkdown>
                </div>
              </CardContent>

              <CardFooter className="flex justify-between border-t bg-muted/30 p-3 opacity-0 transition-opacity group-hover:opacity-100">
                <span className="text-[10px] text-muted-foreground font-medium">
                  {new Date(note.created_at).toLocaleDateString()}
                </span>

                <div
                  className="flex gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Botó Editar */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-primary"
                    onClick={() => setEditingNote(note)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>

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
                        <AlertDialogTitle>Eliminar nota?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Aquesta acció no es pot desfer.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel·lar</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive hover:bg-destructive/90"
                          onClick={() => handleDelete(note.id)}
                        >
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* DIÀLEG D'EDICIÓ */}
      {editingNote && (
        <EditNoteDialog
          open={!!editingNote}
          onOpenChange={(open) => !open && setEditingNote(null)}
          note={editingNote}
        />
      )}
    </>
  );
}
