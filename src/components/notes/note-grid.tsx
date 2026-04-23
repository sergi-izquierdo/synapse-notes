"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Copy, Star } from "lucide-react";
import {
  deleteNote,
  duplicateNote,
  restoreNote,
  toggleNoteStarred,
} from "@/actions/notes";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";
import { NoteMarkdown } from "./note-markdown";
import { formatRelative } from "@/lib/format-relative";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EditNoteDialog } from "./edit-note-dialog";
import { FilterBar } from "./filter-bar";

interface NoteGridProps {
  notes: Array<{
    id: number;
    content: string;
    created_at: string;
    tags: string[] | null;
    starred?: boolean;
  }>;
  availableTags: string[];
}

export function NoteGrid({ notes, availableTags }: NoteGridProps) {
  const { t, language } = useLanguage();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<{
    id: number;
    content: string;
    tags: string[];
  } | null>(null);

  const filteredNotes = notes.filter((note) => {
    const matchesSearch = note.content
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesTag = selectedTag
      ? note.tags && note.tags.includes(selectedTag)
      : true;
    return matchesSearch && matchesTag;
  });

  // Delete with a 5-second undo toast. We hard-delete on the server and
  // recreate from the returned snapshot if the user clicks "Undo" —
  // simpler than a soft-delete schema and avoids orphaned rows. Cost:
  // one fresh embedding on restore.
  const handleDelete = async (id: number) => {
    try {
      const snapshot = await deleteNote(id);
      toast.success("Note deleted", {
        duration: 5000,
        action: snapshot
          ? {
              label: "Undo",
              onClick: async () => {
                const result = await restoreNote(snapshot.content, snapshot.tags);
                if (result?.error) {
                  toast.error("Restore failed", { description: result.error });
                } else {
                  toast.success("Note restored");
                }
              },
            }
          : undefined,
      });
    } catch {
      toast.error("Error deleting note");
    }
  };

  const handleDuplicate = async (id: number) => {
    const result = await duplicateNote(id);
    if (result?.error) {
      toast.error("Duplicate failed", { description: result.error });
    } else {
      toast.success("Note duplicated");
    }
  };

  const handleToggleStar = async (id: number, current: boolean) => {
    const result = await toggleNoteStarred(id, !current);
    if (result?.error) {
      toast.error(result.error);
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
        <motion.div
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          initial="hidden"
          animate="show"
          variants={{
            show: { transition: { staggerChildren: 0.04 } },
          }}
        >
          {filteredNotes.map((note) => (
            <motion.div
              key={note.id}
              variants={{
                hidden: { opacity: 0, y: 8 },
                show: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
            <Card
              className={cn(
                "group relative flex flex-col overflow-hidden border-border/60 bg-card transition-colors duration-200 hover:border-primary/40 hover:shadow-md cursor-pointer",
                note.starred && "border-primary/40 bg-primary/[0.03]",
              )}
              onClick={() => setEditingNote({ ...note, tags: note.tags || [] })}
              role="button"
              tabIndex={0}
              aria-label={`Edit note from ${new Date(note.created_at).toLocaleDateString()}`}
            >
              {/* ACTION CLUSTER — top-right. Star is always visible when
                  starred (so pinned state reads at a glance) and fades
                  in on hover otherwise. Duplicate + Delete are hover-
                  only so the card stays quiet at rest. */}
              <div
                className="absolute top-2 right-2 flex gap-0.5 z-10"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-7 w-7 transition-opacity",
                    note.starred
                      ? "opacity-100 text-amber-500 hover:text-amber-500"
                      : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-amber-500",
                  )}
                  onClick={() =>
                    handleToggleStar(note.id, Boolean(note.starred))
                  }
                  aria-label={note.starred ? "Unstar note" : "Star note"}
                  aria-pressed={Boolean(note.starred)}
                  title={note.starred ? "Unstar" : "Star"}
                >
                  <Star
                    className={cn(
                      "h-3.5 w-3.5",
                      note.starred && "fill-amber-500",
                    )}
                  />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                  onClick={() => handleDuplicate(note.id)}
                  aria-label="Duplicate note"
                  title="Duplicate"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(note.id)}
                  aria-label="Delete note"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Card Content — editorial body. Task-list checkboxes are
                  the only interactive target here (see NoteMarkdown);
                  clicks on plain text propagate up to the card and open
                  the edit modal. */}
              <CardContent className="flex-1 p-5 pb-2 max-h-[260px] overflow-hidden mask-gradient-b">
                <div className="prose prose-sm dark:prose-invert wrap-break-word font-body text-card-foreground pointer-events-none">
                  <NoteMarkdown
                    key={note.content}
                    noteId={note.id}
                    content={note.content}
                    tags={note.tags || []}
                  />
                </div>
              </CardContent>

              {/* TAGS — smallcaps style */}
              {note.tags && note.tags.length > 0 && (
                <div className="px-5 pb-2 flex flex-wrap gap-1">
                  {note.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 border-border/60 text-muted-foreground bg-muted/30 uppercase tracking-wider font-mono"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* FOOTER — proceedings-style timestamp, always visible
                  so readers can scan card age without hovering. */}
              <CardFooter className="border-t border-border/60 bg-muted/20 px-5 py-2.5 mt-2">
                <span
                  className="text-[10px] text-muted-foreground font-mono"
                  title={new Date(note.created_at).toLocaleString(language)}
                >
                  {formatRelative(note.created_at, language)}
                </span>
              </CardFooter>
            </Card>
            </motion.div>
          ))}
        </motion.div>
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
