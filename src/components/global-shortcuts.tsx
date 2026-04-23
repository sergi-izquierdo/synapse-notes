"use client";

import { useEffect, useState } from "react";
import { KeyboardShortcutsDialog } from "./keyboard-shortcuts-dialog";

// Global keyboard shortcuts router. Mounted once at the dashboard
// layout level. Listens to document keydown and dispatches to:
//
//   - ?       → show the shortcuts help overlay
//   - /       → focus the notes search input
//   - n       → focus the compose textarea
//   - j / k   → navigate chat list (via custom events)
//
// Shortcuts that target inputs use native focus via querySelector to
// avoid wiring refs across the entire tree. Custom events decouple
// the chat navigation from ChatSidebar's internal state.
//
// The "typing" guard prevents N / J / K from firing while the user
// is composing text. '?' (Shift+/) fires everywhere since modal
// dialogs never need a literal '?' character typed inline.
export function GlobalShortcuts() {
    const [helpOpen, setHelpOpen] = useState(false);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            const isTyping =
                target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement ||
                (target !== null && target.isContentEditable);

            // ? — show shortcuts help (Shift+/ on US layout)
            if (e.key === "?") {
                e.preventDefault();
                setHelpOpen((v) => !v);
                return;
            }

            // The remaining shortcuts only fire when the user is NOT
            // already typing into an input somewhere.
            if (isTyping) return;

            // / — focus the notes search input. Targets the data
            // attribute rather than the placeholder so the shortcut
            // works across EN/ES/CA.
            if (e.key === "/") {
                const search =
                    document.querySelector<HTMLInputElement>(
                        "input[data-search-shortcut]",
                    );
                if (search) {
                    e.preventDefault();
                    search.focus();
                }
                return;
            }

            // n — focus the compose textarea. On mobile the textarea
            // lives inside a bottom sheet that isn't mounted until the
            // user opens it, so fall back to dispatching compose-open
            // for ComposeZone to pick up.
            if (
                e.key === "n" &&
                !e.ctrlKey &&
                !e.metaKey &&
                !e.altKey &&
                !e.shiftKey
            ) {
                const compose = document.querySelector<HTMLTextAreaElement>(
                    'textarea[name="content"]',
                );
                e.preventDefault();
                if (compose) {
                    compose.focus();
                } else {
                    document.dispatchEvent(new CustomEvent("compose-open"));
                }
                return;
            }

            // j / k — navigate chat list via custom events
            if (
                (e.key === "j" || e.key === "k") &&
                !e.ctrlKey &&
                !e.metaKey &&
                !e.altKey &&
                !e.shiftKey
            ) {
                e.preventDefault();
                const eventName =
                    e.key === "j" ? "chat-nav-next" : "chat-nav-prev";
                document.dispatchEvent(new CustomEvent(eventName));
                return;
            }

            // 1 / 2 / 3 — toggle filter by top-N tag. NoteGrid owns the
            // freq map and resolves the index → tag so this handler
            // stays unaware of the current tag roster.
            if (
                (e.key === "1" || e.key === "2" || e.key === "3") &&
                !e.ctrlKey &&
                !e.metaKey &&
                !e.altKey &&
                !e.shiftKey
            ) {
                e.preventDefault();
                document.dispatchEvent(
                    new CustomEvent("notes-filter-top-tag", {
                        detail: { index: Number(e.key) },
                    }),
                );
                return;
            }
        };

        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, []);

    return (
        <KeyboardShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
    );
}
