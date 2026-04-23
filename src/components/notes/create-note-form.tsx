"use client";

import { createNote } from "@/actions/notes";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useRef, useState } from "react";
import { Send, Bold, List, ListTodo, Italic } from "lucide-react"; // Noves icones
import { useLanguage } from "@/components/language-provider";
import { toast } from "sonner";
import { TagInput } from "@/components/ui/tag-input";
import { TagSelector } from "../ui/tag-selector";

export function CreateNoteForm({
  availableTags,
  onSaved,
}: {
  availableTags: string[];
  onSaved?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null); // Referència per manipular el text
  const { t } = useLanguage();
  const [content, setContent] = useState(""); // Controlem l'estat per a la toolbar
  const [tags, setTags] = useState<string[]>([]); // Estat per tags

  // Funció per inserir format al cursor
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

    // Tornem a posar el focus i el cursor
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        // Assegurem que s'envia l'estat actual
        formData.set("content", content);
        formData.set("tags", JSON.stringify(tags));

        const toastId = toast.loading(t.dashboard.saving || "Saving...");
        const result = await createNote(formData);

        if (result?.error) {
          toast.error(t.dashboard.error_create, {
            description: result.error,
            id: toastId,
          });
        } else {
          toast.success(t.dashboard.save, {
            description: "Note added.",
            id: toastId,
          });
          setContent(""); // Netejem l'estat
          setTags([]); // Netejem tags
          onSaved?.();
        }
      }}
      className="group relative mb-8 overflow-hidden rounded-2xl border bg-background shadow-lg transition-all focus-within:ring-2 focus-within:ring-primary/20"
    >
      {/* TOOLBAR */}
      <div className="flex items-center gap-1 border-b bg-muted/30 p-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => insertFormat("**", "**")}
          title="Negreta"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => insertFormat("*", "*")}
          title="Cursiva"
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
          title="Llista"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => insertFormat("- [ ] ")}
          title="Tasques"
        >
          <ListTodo className="h-4 w-4" />
        </Button>
      </div>

      {/* TEXTAREA */}
      <Textarea
        ref={textareaRef}
        name="content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => {
          // Ctrl/⌘ + Enter submits. Enter alone inserts newline as
          // users expect from a multi-line compose box.
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            formRef.current?.requestSubmit();
          }
        }}
        placeholder={t.dashboard.placeholder}
        className="min-h-[140px] w-full resize-none border-none bg-transparent p-6 text-lg placeholder:text-muted-foreground/50 focus-visible:ring-0 font-sans"
      />

      {/* META ROW — live character counter sits directly under the
          textarea, mono so the digits don't reflow as they tick. */}
      <div className="flex items-center justify-end px-6 pb-2 -mt-1 font-mono text-[10px] text-muted-foreground/70 tabular-nums">
        {content.length} {content.length === 1 ? "char" : "chars"}
      </div>

      {/* ZONA DE TAGS — visually separated from the textarea and the
          action row by hairlines on a slightly darker surface. */}
      <div className="border-t border-border/60 bg-muted/15 px-6 py-4">
        <TagSelector
          selectedTags={tags}
          setSelectedTags={setTags}
          availableTags={availableTags}
        />
      </div>

      <div className="flex items-center justify-end border-t border-border/60 bg-muted/25 px-6 py-3">
        <Button
          type="submit"
          className="rounded-full px-6 shadow-md bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-transform hover:scale-105 active:scale-95"
        >
          <Send className="mr-2 h-4 w-4" /> {t.dashboard.save}
        </Button>
      </div>
    </form>
  );
}
