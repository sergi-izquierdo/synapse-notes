"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge"; // ✅ Necessari
import { Trash2, Search, Pencil, X } from "lucide-react";
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
import { FilterBar } from "./filter-bar";

interface NoteGridProps {
  notes: Array<{
    id: number;
    content: string;
    created_at: string;
    tags: string[] | null;
  }>;
  availableTags: string[]; // ✅ New Prop
}

export function NoteGrid({ notes, availableTags }: NoteGridProps) {
  const { t } = useLanguage();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<{
    id: number;
    content: string;
    tags: string[];
  } | null>(null);

  // 🔎 FILTER LOGIC
  const filteredNotes = notes.filter((note) => {
    const matchesSearch = note.content
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesTag = selectedTag
      ? note.tags && note.tags.includes(selectedTag)
      : true;
    return matchesSearch && matchesTag;
  });

  const handleDelete = async (id: number) => {
    try {
      await deleteNote(id);
      toast.success("Deleted"); // Keeping generic, use t.common... later
    } catch (error) {
      toast.error("Error");
    }
  };

  return (
    <>
      {/* ✅ NEW FILTER BAR */}
      <FilterBar
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedTag={selectedTag}
        setSelectedTag={setSelectedTag}
        availableTags={availableTags}
      />

      {/* GRID */}
      {filteredNotes.length === 0 ? (
        <div className="text-center text-muted-foreground py-10 opacity-50">
          {t.common.no_results}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredNotes.map((note) => (
            <Card
              key={note.id}
              className="group relative flex flex-col overflow-hidden border-muted-foreground/10 bg-background/80 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-primary/40 cursor-pointer"
              onClick={() => setEditingNote({ ...note, tags: note.tags || [] })}
            >
              {/* Card Content */}
              <CardContent className="flex-1 p-6 pb-2 max-h-[300px] overflow-hidden mask-gradient-b">
                <div className="prose prose-sm dark:prose-invert wrap-break-word text-foreground/90 pointer-events-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {note.content}
                  </ReactMarkdown>
                </div>
              </CardContent>

              {/* TAGS */}
              {note.tags && note.tags.length > 0 && (
                <div className="px-6 pb-2 flex flex-wrap gap-1">
                  {note.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 border-primary/20 text-muted-foreground bg-primary/5"
                    >
                      #{tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* FOOTER */}
              <CardFooter className="flex justify-between border-t bg-muted/30 p-3 opacity-0 transition-opacity group-hover:opacity-100 mt-2">
                <span className="text-[10px] text-muted-foreground font-medium">
                  {new Date(note.created_at).toLocaleDateString()}
                </span>

                <div
                  className="flex gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* EDIT & DELETE Buttons (Same as before) */}
                  <AlertDialog>
                    {/* ... Alert Dialog implementation ... */}
                  </AlertDialog>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* EDIT DIALOG */}
      {editingNote && (
        <EditNoteDialog
          open={!!editingNote}
          onOpenChange={(open) => !open && setEditingNote(null)}
          note={editingNote}
          availableTags={availableTags}
        />
      )}
    </>
  );
}
