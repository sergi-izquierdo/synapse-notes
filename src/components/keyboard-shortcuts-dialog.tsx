"use client";

import { Fragment } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface KeyboardShortcutsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// Source of truth for every keyboard shortcut the app reacts to. Keep
// it in sync with the actual handlers in GlobalShortcuts, ChatSidebar,
// CreateNoteForm, ChatInput, and the CommandPalette.
const SHORTCUTS: Array<{
    keys: string[];
    desc: string;
    scope: "Global" | "Notes" | "Chat";
}> = [
    { keys: ["⌘", "K"], desc: "Open command palette", scope: "Global" },
    { keys: ["?"], desc: "Show this help overlay", scope: "Global" },
    { keys: ["Esc"], desc: "Close any modal or palette", scope: "Global" },
    { keys: ["/"], desc: "Focus search input", scope: "Notes" },
    { keys: ["N"], desc: "Focus the compose textarea", scope: "Notes" },
    { keys: ["⌘", "Enter"], desc: "Save note (inside compose)", scope: "Notes" },
    { keys: ["J"], desc: "Next chat in sidebar", scope: "Chat" },
    { keys: ["K"], desc: "Previous chat in sidebar", scope: "Chat" },
    { keys: ["Enter"], desc: "Send message (inside chat input)", scope: "Chat" },
    { keys: ["Shift", "Enter"], desc: "New line in chat input", scope: "Chat" },
    { keys: ["↑"], desc: "Recall last prompt (empty chat input)", scope: "Chat" },
];

export function KeyboardShortcutsDialog({
    open,
    onOpenChange,
}: KeyboardShortcutsDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                    <DialogTitle>Keyboard shortcuts</DialogTitle>
                    <DialogDescription>
                        Press{" "}
                        <kbd className="inline-block rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                            ?
                        </kbd>{" "}
                        anywhere to toggle this overlay.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-1.5 pt-2">
                    {(["Global", "Notes", "Chat"] as const).map((scope) => (
                        <section key={scope} className="space-y-1">
                            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground font-mono mt-3 first:mt-0">
                                {scope}
                            </h3>
                            {SHORTCUTS.filter((s) => s.scope === scope).map(
                                (s) => (
                                    <div
                                        key={s.desc}
                                        className="flex items-center justify-between gap-4 rounded-md px-2 py-1.5 hover:bg-muted/40"
                                    >
                                        <span className="text-sm text-foreground">
                                            {s.desc}
                                        </span>
                                        <div className="flex gap-1 font-mono text-[11px] shrink-0">
                                            {s.keys.map((k, i) => (
                                                <Fragment key={i}>
                                                    {i > 0 && (
                                                        <span className="text-muted-foreground/60">
                                                            +
                                                        </span>
                                                    )}
                                                    <kbd className="rounded border border-border bg-muted px-1.5 py-0.5">
                                                        {k}
                                                    </kbd>
                                                </Fragment>
                                            ))}
                                        </div>
                                    </div>
                                ),
                            )}
                        </section>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}
