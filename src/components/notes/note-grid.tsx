"use client";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Trash2 } from "lucide-react";
import { deleteNote } from "@/actions/notes";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";
interface NoteGridProps {
  notes: any[]; // O el tipus Note
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

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {notes.map((note) => (
        <Card
          key={note.id}
          className="group relative flex flex-col overflow-hidden border-muted-foreground/10 bg-background/80 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-primary/20"
        >
          <CardContent className="flex-1 p-6">
            <div className="prose prose-sm dark:prose-invert break-words text-muted-foreground group-hover:text-foreground transition-colors">
              {/* Si vols pots usar ReactMarkdown aquí també per les notes, o deixar text pla */}
              <p className="whitespace-pre-wrap">{note.content}</p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between border-t bg-muted/20 p-3 opacity-0 transition-opacity group-hover:opacity-100">
            <span className="text-[10px] text-muted-foreground">
              {new Date(note.created_at).toLocaleDateString()}
            </span>
            <form action={deleteNote.bind(null, note.id)}>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:bg-destructive hover:text-white rounded-full"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </form>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
