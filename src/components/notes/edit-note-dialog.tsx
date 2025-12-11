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
// ✅ CHANGE: Import Selector instead of Input
import { TagSelector } from "@/components/ui/tag-selector";

interface EditNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: { id: number; content: string; tags: string[] };
  // ✅ NEW PROP
  availableTags: string[];
}

export function EditNoteDialog({
  open,
  onOpenChange,
  note,
  availableTags,
}: EditNoteDialogProps) {
  const [content, setContent] = useState(note.content);
  const [tags, setTags] = useState<string[]>(note.tags || []);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  // Toolbar logic
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

    const result = await updateNote(note.id, content, tags);

    if (result?.error) {
      setIsSaving(false);
      toast.error("Error", { description: result.error });
    } else {
      toast.success("Updated", { description: "Note updated." });
      router.refresh();
      setIsSaving(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden gap-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Edit Note</DialogTitle>
          <DialogDescription>
            Modify your note content and tags.
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
            placeholder="Type here..."
          />
        </div>

        <div className="px-6 pb-4">
          <label className="text-xs text-muted-foreground font-medium mb-1.5 block">
            Tags
          </label>
          {/* ✅ CHANGE: Use TagSelector */}
          <TagSelector
            selectedTags={tags}
            setSelectedTags={setTags}
            availableTags={availableTags}
          />
        </div>

        <DialogFooter className="px-6 pb-6 sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
