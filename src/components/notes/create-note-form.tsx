"use client";

import { createNote } from "@/actions/notes";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea"; // Afegeix-lo si no el tens: npx shadcn@latest add textarea
import { useRef } from "react";
import { Send } from "lucide-react";

export function CreateNoteForm() {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await createNote(formData);
        formRef.current?.reset(); // Neteja el formulari després d'enviar
      }}
      className="mb-8 rounded-lg border bg-card p-4 shadow-sm"
    >
      <div className="flex flex-col gap-4">
        <Textarea
          name="content"
          placeholder="En què estàs pensant? (Escriu la teva nota aquí...)"
          className="min-h-[100px] resize-none border-none bg-transparent text-lg focus-visible:ring-0"
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm">
            <Send className="mr-2 h-4 w-4" /> Guardar Nota
          </Button>
        </div>
      </div>
    </form>
  );
}
