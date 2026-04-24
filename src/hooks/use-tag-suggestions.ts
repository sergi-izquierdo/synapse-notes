"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type TagSuggestions = {
    existing: string[];
    newTag: string | null;
};

type Status = "idle" | "loading" | "ready" | "error";

// Debounced content-to-tag-suggestion hook. Keeps a single in-flight
// request alive at a time (any newer content cancels the previous via
// AbortController) so fast typing doesn't fan out to N parallel LLM
// calls. Suggestions are only requested once `content` exceeds
// `minChars`; shorter drafts are too ambiguous to tag meaningfully.
//
// `auto` controls whether typing triggers suggestions automatically.
// When false, the only way to get suggestions is a manual `trigger()`
// call — used in edit-mode when the note already has tags and we
// don't want re-thinking on every dialog open.
export function useTagSuggestions(
    content: string,
    availableTags: string[],
    opts: {
        debounceMs?: number;
        minChars?: number;
        enabled?: boolean;
        auto?: boolean;
    } = {},
) {
    const {
        debounceMs = 700,
        minChars = 15,
        enabled = true,
        auto = true,
    } = opts;
    const [status, setStatus] = useState<Status>("idle");
    const [suggestions, setSuggestions] = useState<TagSuggestions>({
        existing: [],
        newTag: null,
    });
    const abortRef = useRef<AbortController | null>(null);

    // Keep the latest values available to `trigger()` without
    // re-creating the callback on every keystroke — refs let the
    // imperative trigger read what's current at call time while the
    // callback identity stays stable across renders.
    const contentRef = useRef(content);
    const tagsRef = useRef(availableTags);
    useEffect(() => {
        contentRef.current = content;
        tagsRef.current = availableTags;
    });

    const fetchSuggestions = useCallback(async (body: string) => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setStatus("loading");
        try {
            const res = await fetch("/api/suggest-tags", {
                method: "POST",
                signal: controller.signal,
                headers: { "content-type": "application/json" },
                body,
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json: TagSuggestions = await res.json();
            setSuggestions({
                existing: Array.isArray(json.existing) ? json.existing : [],
                newTag:
                    typeof json.newTag === "string" && json.newTag
                        ? json.newTag
                        : null,
            });
            setStatus("ready");
        } catch (err) {
            if ((err as Error).name === "AbortError") return;
            setStatus("error");
        }
    }, []);

    // Synchronizes React state with an external async system
    // (debounced fetch + abort). The setState calls below reset
    // client-visible status when the input drops below the threshold
    // or the hook is disabled — this is an effect-driven state
    // machine, not derivable during render, so the lint rule's
    // default guidance doesn't apply.
    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        if (!enabled || !auto) {
            // `auto` off means no typing-triggered fetch. State is
            // left untouched so a prior manual trigger's result stays
            // visible.
            return;
        }
        const trimmed = content.trim();
        if (trimmed.length < minChars) {
            setStatus("idle");
            setSuggestions({ existing: [], newTag: null });
            return;
        }

        const timer = window.setTimeout(() => {
            void fetchSuggestions(
                JSON.stringify({ content: trimmed, availableTags }),
            );
        }, debounceMs);

        return () => {
            window.clearTimeout(timer);
        };
    }, [
        content,
        availableTags,
        debounceMs,
        minChars,
        enabled,
        auto,
        fetchSuggestions,
    ]);
    /* eslint-enable react-hooks/set-state-in-effect */

    const dismiss = useCallback(() => {
        abortRef.current?.abort();
        setSuggestions({ existing: [], newTag: null });
        setStatus("idle");
    }, []);

    // Imperative kick-off. Used by edit-mode when the user opens the
    // tag dropdown on a note that already has tags — we only want to
    // call the LLM on that explicit intent, not on every dialog open.
    const trigger = useCallback(() => {
        const trimmed = contentRef.current.trim();
        if (trimmed.length < minChars) return;
        void fetchSuggestions(
            JSON.stringify({
                content: trimmed,
                availableTags: tagsRef.current,
            }),
        );
    }, [fetchSuggestions, minChars]);

    return { status, suggestions, dismiss, trigger };
}
