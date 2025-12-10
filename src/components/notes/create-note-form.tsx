"use client";

import { createNote } from "@/actions/notes";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useRef } from "react";
import { Send } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { toast } from "sonner";

export function CreateNoteForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const { t } = useLanguage();

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        // Toast de càrrega
        const toastId = toast.loading(t.dashboard.saving || "Saving...");

        const result = await createNote(formData);

        if (result?.error) {
          // Cas d'error
          toast.error(t.dashboard.error_create || "Error", {
            description: result.error,
            id: toastId, // Substitueix el loading
          });
        } else {
          // Cas d'èxit
          toast.success(t.dashboard.save || "Saved!", {
            description: "Note added to your brain.",
            id: toastId, // Substitueix el loading
          });
          formRef.current?.reset();
        }
      }}
      className="group relative mb-8 overflow-hidden rounded-2xl border bg-background shadow-lg transition-all focus-within:ring-2 focus-within:ring-primary/20"
    >
      <Textarea
        name="content"
        placeholder={t.dashboard.placeholder}
        className="min-h-[120px] w-full resize-none border-none bg-transparent p-6 text-lg placeholder:text-muted-foreground/50 focus-visible:ring-0"
      />

      <div className="flex items-center justify-between bg-muted/30 p-3 px-6">
        <span className="text-xs text-muted-foreground">
          Markdown supported
        </span>
        <Button
          type="submit"
          className="rounded-full px-6 shadow-md transition-transform hover:scale-105 active:scale-95"
        >
          <Send className="mr-2 h-4 w-4" /> {t.dashboard.save}
        </Button>
      </div>
    </form>
  );
}
