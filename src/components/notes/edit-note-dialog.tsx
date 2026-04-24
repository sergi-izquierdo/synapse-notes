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
import { updateNote } from "@/actions/notes";
import { toast } from "sonner";
import { Loader2, Bold, Italic, List, ListTodo } from "lucide-react";
import { TagSelector } from "@/components/ui/tag-selector";
import { useTagSuggestions } from "@/hooks/use-tag-suggestions";
import { TagSuggestionRow } from "./tag-suggestion-row";
import { BacklinkTextarea } from "./backlink-textarea";

interface EditNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: {
    id: number;
    title?: string | null;
    content: string;
    tags: string[];
  };
  availableTags: string[];
}

export function EditNoteDialog({
  open,
  onOpenChange,
  note,
  availableTags,
}: EditNoteDialogProps) {
  const [title, setTitle] = useState(note.title ?? "");
  const [content, setContent] = useState(note.content);
  const [tags, setTags] = useState<string[]>(note.tags || []);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  // Edit mode: if the note already has tags, skip the auto-trigger
  // on open (don't burn an LLM call when the user just wanted to
  // read/edit the body). The dropdown's open handler fires a manual
  // trigger so the user can still ask for suggestions on demand.
  const hasExistingTags = (note.tags?.length ?? 0) > 0;
  const { status: suggestionsStatus, suggestions, dismiss, trigger } =
    useTagSuggestions(content, availableTags, {
      enabled: open,
      auto: !hasExistingTags,
    });

  const handleAddSuggestedTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
  };

  const handleSelectorOpen = (openNow: boolean) => {
    if (openNow && hasExistingTags && suggestionsStatus === "idle") {
      trigger();
    }
  };

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

    const result = await updateNote(note.id, content, tags, title);

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
      <DialogContent
        className="sm:max-w-[600px] p-0 overflow-hidden gap-0"
        /* Keep the dialog open when the user clicks inside the
           @/#/[[ autocomplete popover. Radix dispatches
           `onInteractOutside` as a CustomEvent whose own `target`
           is the DialogContent element, not the real click target —
           the latter lives in `event.detail.originalEvent.target`.
           Checking both covers every Radix version and both the
           pointer + focus branches of the detector. */
        onInteractOutside={(e) => {
          const direct = e.target as Element | null;
          const original =
            (e.detail as { originalEvent?: Event } | undefined)
              ?.originalEvent?.target as Element | null | undefined;
          const target = original ?? direct;
          if (target?.closest?.("[data-backlink-popover]")) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Edit Note</DialogTitle>
          <DialogDescription>
            Modify your note title, content and tags.
          </DialogDescription>
        </DialogHeader>

        {/* TITLE — large input that blends into the dialog
            background, matching the compose surface style. */}
        <div className="px-6 pt-1">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            maxLength={200}
            className="w-full bg-transparent border-none text-xl font-semibold tracking-tight placeholder:text-muted-foreground/40 focus:outline-none"
          />
        </div>

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

        <div className="px-6 pt-4 pb-2">
          <BacklinkTextarea
            ref={textareaRef}
            value={content}
            onChange={setContent}
            availableTags={availableTags}
            className="min-h-[300px] resize-none text-base border border-border/60 focus-visible:ring-1 focus-visible:ring-primary p-4 shadow-none font-sans rounded-md"
            placeholder="Type here..."
          />
          {/* Word/char counter — editorial mono row, lives just below
              the textarea and updates as the user types. */}
          <div className="flex items-center justify-end gap-3 pt-1.5 font-mono text-[10px] text-muted-foreground/70 tabular-nums">
            <span>
              {content.trim() ? content.trim().split(/\s+/).length : 0} words
            </span>
            <span className="opacity-40">·</span>
            <span>{content.length} chars</span>
          </div>
        </div>

        <div className="px-6 pb-4 space-y-2">
          <label className="text-xs text-muted-foreground font-medium mb-1.5 block">
            Tags
          </label>
          <TagSuggestionRow
            status={suggestionsStatus}
            suggestions={suggestions}
            selectedTags={tags}
            onAdd={handleAddSuggestedTag}
            onDismiss={dismiss}
          />
          <TagSelector
            selectedTags={tags}
            setSelectedTags={setTags}
            availableTags={availableTags}
            onOpenChange={handleSelectorOpen}
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
