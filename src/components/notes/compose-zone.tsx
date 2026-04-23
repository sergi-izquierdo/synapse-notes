"use client";

import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { CreateNoteForm } from "./create-note-form";

// Responsive compose surface. Desktop (>= md) renders the inline form
// directly so the dashboard still has its "write-then-save" flow.
// Mobile gets a FAB pinned to the bottom-right; tapping it opens a
// bottom sheet with the same form. Successful saves auto-close the
// sheet. The `n` shortcut also opens the sheet on mobile since the
// global handler focuses the textarea and our bottom sheet holds the
// only textarea on those viewports.
export function ComposeZone({ availableTags }: { availableTags: string[] }) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const openSheet = () => setOpen(true);
        document.addEventListener("compose-open", openSheet);
        return () => document.removeEventListener("compose-open", openSheet);
    }, []);

    return (
        <>
            {/* Desktop — form lives in the grid flow. */}
            <div className="hidden md:block">
                <CreateNoteForm availableTags={availableTags} />
            </div>

            {/* Mobile — FAB + bottom sheet. */}
            <div className="md:hidden">
                <Button
                    type="button"
                    onClick={() => setOpen(true)}
                    aria-label="Write a new note"
                    className="fixed bottom-6 left-6 z-40 h-14 w-14 rounded-full shadow-lg"
                    size="icon"
                >
                    <Pencil className="h-5 w-5" />
                </Button>

                <Sheet open={open} onOpenChange={setOpen}>
                    <SheetContent
                        side="bottom"
                        className="max-h-[92vh] overflow-y-auto p-0"
                    >
                        <SheetHeader className="px-5 pt-5 pb-2">
                            <SheetTitle>New note</SheetTitle>
                        </SheetHeader>
                        <div className="p-4 pt-0">
                            <CreateNoteForm
                                availableTags={availableTags}
                                onSaved={() => setOpen(false)}
                            />
                        </div>
                    </SheetContent>
                </Sheet>
            </div>
        </>
    );
}
