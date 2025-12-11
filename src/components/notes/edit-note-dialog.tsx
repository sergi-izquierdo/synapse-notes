"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateNote } from "@/actions/notes";
import { toast } from "sonner";
import { Loader2, Bold, Italic, List, ListTodo } from "lucide-react";

interface EditNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: { id: number; content: string };
}

export function EditNoteDialog({
  open,
  onOpenChange,
  note,
}: EditNoteDialogProps) {
  const [content, setContent] = useState(note.content);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter(); // Hook per refrescar

  // Lògica de la Toolbar
  const insertFormat = (prefix: string, suffix: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    const before = text.substring(0, start);
    const selection = text.substring(start, end);
    const after = text.substring(end);

    const newText = `${before}${prefix}${selection}${suffix}${after}`;

    setContent(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  const handleSave = async () => {
    setIsSaving(true);

    // 1. Cridem al Server Action
    const result = await updateNote(note.id, content);

    if (result?.error) {
      setIsSaving(false);
      toast.error("Error", { description: result.error });
    } else {
      // 2. Èxit
      toast.success("Actualitzat", {
        description: "Nota i memòria IA actualitzades.",
      });

      // 3. Forcem refresc de la pàgina per veure els canvis al grid
      router.refresh();

      setIsSaving(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden gap-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Editar Nota</DialogTitle>
          <DialogDescription>
            Modifica el contingut i l'estil de la teva nota.
          </DialogDescription>
        </DialogHeader>

        {/* TOOLBAR */}
        <div className="flex items-center gap-1 border-y bg-muted/30 p-2 px-6">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => insertFormat("**", "**")}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => insertFormat("*", "*")}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <div className="h-4 w-px bg-border mx-1" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => insertFormat("- ")}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => insertFormat("- [ ] ")}
          >
            <ListTodo className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6 pt-4">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[300px] resize-none text-base border-none focus-visible:ring-0 p-0 shadow-none font-sans"
            placeholder="Escriu aquí..."
          />
        </div>

        <DialogFooter className="px-6 pb-6 sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel·lar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar Canvis
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
