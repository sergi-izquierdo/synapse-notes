"use client";

import { Fragment, useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/components/language-provider";

interface KeyboardShortcutsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// Sentinel used in the source-of-truth table. Swapped at render time
// for the platform-specific label (⌘ on macOS, Ctrl everywhere else).
// Keeps the table editable by hand without branching on the OS.
const MOD = "__MOD__";

// Source of truth for every keyboard shortcut the app reacts to. Keep
// it in sync with the actual handlers in GlobalShortcuts, ChatSidebar,
// CreateNoteForm, ChatInput, and the CommandPalette.
// `descKey` indexes into t.shortcuts so the label is resolved at render
// time in the active language. `scope` stays a stable internal key used
// for grouping; its heading label is also resolved via t.shortcuts.
type ShortcutScope = "Global" | "Notes" | "Chat";
type ShortcutDescKey =
    | "openCommandPalette"
    | "showHelpOverlay"
    | "toggleGraph"
    | "closeModal"
    | "focusSearch"
    | "focusCompose"
    | "saveNote"
    | "filterTop1"
    | "filterTop2"
    | "filterTop3"
    | "nextChat"
    | "prevChat"
    | "sendMessage"
    | "newLine"
    | "recallPrompt";

const SHORTCUTS: Array<{
    keys: string[];
    descKey: ShortcutDescKey;
    scope: ShortcutScope;
}> = [
    { keys: [MOD, "K"], descKey: "openCommandPalette", scope: "Global" },
    { keys: ["F1"], descKey: "showHelpOverlay", scope: "Global" },
    { keys: ["G"], descKey: "toggleGraph", scope: "Global" },
    { keys: ["Esc"], descKey: "closeModal", scope: "Global" },
    { keys: ["/"], descKey: "focusSearch", scope: "Notes" },
    { keys: ["N"], descKey: "focusCompose", scope: "Notes" },
    { keys: [MOD, "Enter"], descKey: "saveNote", scope: "Notes" },
    { keys: ["1"], descKey: "filterTop1", scope: "Notes" },
    { keys: ["2"], descKey: "filterTop2", scope: "Notes" },
    { keys: ["3"], descKey: "filterTop3", scope: "Notes" },
    { keys: ["J"], descKey: "nextChat", scope: "Chat" },
    { keys: ["K"], descKey: "prevChat", scope: "Chat" },
    { keys: ["Enter"], descKey: "sendMessage", scope: "Chat" },
    { keys: ["Shift", "Enter"], descKey: "newLine", scope: "Chat" },
    { keys: ["↑"], descKey: "recallPrompt", scope: "Chat" },
];

const SCOPE_LABEL_KEY: Record<ShortcutScope, "scopeGlobal" | "scopeNotes" | "scopeChat"> = {
    Global: "scopeGlobal",
    Notes: "scopeNotes",
    Chat: "scopeChat",
};

// Detect macOS so we can show ⌘ there and Ctrl on Windows / Linux.
// The handlers in GlobalShortcuts and elsewhere already accept both
// metaKey and ctrlKey, so this is purely a display concern. Runs in
// an effect so SSR stays deterministic.
function usePlatformModKey() {
    const [label, setLabel] = useState("Ctrl");
    useEffect(() => {
        if (typeof navigator === "undefined") return;
        const ua =
            (
                navigator as Navigator & {
                    userAgentData?: { platform?: string };
                }
            ).userAgentData?.platform ??
            navigator.platform ??
            navigator.userAgent;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe platform detection
        setLabel(/Mac|iPhone|iPad|iPod/i.test(ua) ? "⌘" : "Ctrl");
    }, []);
    return label;
}

export function KeyboardShortcutsDialog({
    open,
    onOpenChange,
}: KeyboardShortcutsDialogProps) {
    const { t } = useLanguage();
    const modKey = usePlatformModKey();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                    <DialogTitle>{t.shortcuts.title}</DialogTitle>
                    <DialogDescription>
                        {t.shortcuts.helpHintBefore}{" "}
                        <kbd className="inline-block rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                            F1
                        </kbd>{" "}
                        {t.shortcuts.helpHintAfter}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-1.5 pt-2">
                    {(["Global", "Notes", "Chat"] as const).map((scope) => (
                        <section key={scope} className="space-y-1">
                            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground font-mono mt-3 first:mt-0">
                                {t.shortcuts[SCOPE_LABEL_KEY[scope]]}
                            </h3>
                            {SHORTCUTS.filter((s) => s.scope === scope).map(
                                (s) => (
                                    <div
                                        key={s.descKey}
                                        className="flex items-center justify-between gap-4 rounded-md px-2 py-1.5 hover:bg-muted/40"
                                    >
                                        <span className="text-sm text-foreground">
                                            {t.shortcuts[s.descKey]}
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
                                                        {k === MOD ? modKey : k}
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
