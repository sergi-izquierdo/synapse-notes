"use client";

import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { createPortal } from "react-dom";
import { Hash } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type NoteHit = {
    kind: "note";
    id: number;
    title: string | null;
    excerpt: string;
};

type TagHit = { kind: "tag"; name: string };

type Hit = NoteHit | TagHit;

type TriggerMode = "note" | "tag";

export interface BacklinkTextareaProps {
    value: string;
    onChange: (value: string) => void;
    onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    placeholder?: string;
    className?: string;
    name?: string;
    /** The user's current tag library. Required so the `#` trigger
     *  can offer autocomplete from existing tags without a network
     *  round-trip. Empty array is fine — the popover shows a
     *  "type to create a new tag" hint when the query has no
     *  matches. */
    availableTags?: string[];
}

// Rich textarea that fires three in-body autocomplete popovers:
//
//   `[[query` — existing note (wiki-style, spaces allowed, closes at
//                `]]` or newline). Resolves via /api/note-search and
//                commits as `[[<id>]]`.
//   `@query`  — existing note (mention-style, closes at any whitespace).
//                Requires a word boundary so emails / JSDoc tags don't
//                fire. Same commit as `[[`.
//   `#query`  — existing TAG from the user's library (filtered
//                locally against `availableTags`). Commits as literal
//                `#TagName` — the tag pill parser in NoteMarkdown
//                picks that up and renders it as a clickable chip.
//                Markdown headings (`# Heading` with space) are
//                explicitly suppressed by the detector so a real
//                h1 still works.
//
// The popover escapes any parent `overflow: hidden` (e.g. the edit
// dialog's scroll container) by portaling to document.body and
// positioning itself via the textarea's bounding rect. Without the
// portal, the list gets clipped when there are more items than fit
// inside the parent card.
export const BacklinkTextarea = forwardRef<
    HTMLTextAreaElement,
    BacklinkTextareaProps
>(function BacklinkTextarea(
    {
        value,
        onChange,
        onKeyDown,
        placeholder,
        className,
        name,
        availableTags = [],
    },
    forwardedRef,
) {
    const innerRef = useRef<HTMLTextAreaElement>(null);
    useImperativeHandle(forwardedRef, () => innerRef.current!, []);

    const [trigger, setTrigger] = useState<{
        idx: number;
        prefixLen: number;
        mode: TriggerMode;
    } | null>(null);
    const [query, setQuery] = useState("");
    const [noteHits, setNoteHits] = useState<NoteHit[]>([]);
    const [loadingNotes, setLoadingNotes] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const [popoverRect, setPopoverRect] = useState<{
        left: number;
        top: number;
        width: number;
    } | null>(null);

    const closePopover = useCallback(() => {
        setTrigger(null);
        setQuery("");
        setNoteHits([]);
        setHighlightedIndex(0);
    }, []);

    const detectTrigger = useCallback(
        (
            nextValue: string,
            caret: number,
        ): { idx: number; prefixLen: number; mode: TriggerMode; q: string } | null => {
            // Pass 1: look for an active `[[` session (wiki-style).
            for (let i = caret - 1; i >= 1; i--) {
                const pair = nextValue.slice(i - 1, i + 1);
                if (pair === "]]") break;
                if (nextValue[i] === "\n") break;
                if (pair === "[[") {
                    const q = nextValue.slice(i + 1, caret);
                    if (/^[^\[\]\n]*$/.test(q)) {
                        return {
                            idx: i - 1,
                            prefixLen: 2,
                            mode: "note",
                            q,
                        };
                    }
                    break;
                }
            }

            // Pass 2: look for `@` (note) or `#` (tag) at a word
            // boundary. Walk back collecting non-whitespace chars
            // until we hit either a trigger or whitespace.
            for (let i = caret - 1; i >= 0; i--) {
                const ch = nextValue[i];
                if (ch === "\n" || ch === " " || ch === "\t") return null;
                if (ch === "@" || ch === "#") {
                    const prev = i > 0 ? nextValue[i - 1] : undefined;
                    const boundary =
                        prev === undefined ||
                        /\s/.test(prev) ||
                        /[.,;:!?()[\]{}"'«»¿¡]/.test(prev);
                    if (!boundary) return null;

                    // `# ` at line start is a markdown heading —
                    // suppress the popover on the bare `#` keystroke
                    // so headings keep working. Once the user types
                    // a second character (which necessarily isn't
                    // space, or we'd have returned null above) the
                    // tag popover fires.
                    if (ch === "#") {
                        const atLineStart =
                            prev === undefined || prev === "\n";
                        if (atLineStart && caret === i + 1) return null;
                    }

                    const q = nextValue.slice(i + 1, caret);
                    if (q.length > 80) return null;
                    return {
                        idx: i,
                        prefixLen: 1,
                        mode: ch === "#" ? "tag" : "note",
                        q,
                    };
                }
            }
            return null;
        },
        [],
    );

    const updatePopoverRect = useCallback((triggerIdx?: number) => {
        const ta = innerRef.current;
        if (!ta) return;
        // Measure the caret position (or the trigger char position
        // when we know it) via a mirror div, so the popover opens
        // right below the `@` / `#` / `[[` on the same wrapped line.
        // Falling back to the textarea's top-left when the mirror
        // isn't available keeps SSR / degenerate paths working.
        const idx =
            typeof triggerIdx === "number" ? triggerIdx : ta.selectionStart;
        const caret = measureCaretCoords(ta, idx);
        const taRect = ta.getBoundingClientRect();
        const left = caret ? caret.left : taRect.left;
        const top = caret ? caret.top + caret.lineHeight : taRect.top;
        setPopoverRect({
            left,
            top,
            width: Math.min(taRect.width, 360),
        });
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const next = e.target.value;
        onChange(next);
        const caret = e.target.selectionStart;
        const trig = detectTrigger(next, caret);
        if (trig) {
            setTrigger({
                idx: trig.idx,
                prefixLen: trig.prefixLen,
                mode: trig.mode,
            });
            setQuery(trig.q);
            // Anchor the popover to the trigger character itself so
            // moving the caret forward to type the query doesn't
            // drag the popover sideways.
            updatePopoverRect(trig.idx);
        } else {
            closePopover();
        }
    };

    // Recalculate popover position when the window resizes or the
    // user scrolls — the textarea could slide out from under the
    // popover otherwise.
    useLayoutEffect(() => {
        if (!trigger) return;
        updatePopoverRect(trigger.idx);
        const handler = () => updatePopoverRect(trigger.idx);
        window.addEventListener("resize", handler);
        window.addEventListener("scroll", handler, true);
        return () => {
            window.removeEventListener("resize", handler);
            window.removeEventListener("scroll", handler, true);
        };
    }, [trigger, updatePopoverRect]);

    // Note-mode hits come from the API; tag-mode hits are filtered
    // locally from availableTags (cheap, no round-trip). The
    // setState calls inside this effect are driving a fetch state
    // machine (pending → loaded / error); not derivable from props.
    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        if (!trigger || trigger.mode !== "note") return;
        const controller = new AbortController();
        setLoadingNotes(true);
        fetch(
            `/api/note-search?q=${encodeURIComponent(query)}&limit=8`,
            { signal: controller.signal },
        )
            .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
            .then((json: { results: Omit<NoteHit, "kind">[] }) => {
                setNoteHits(
                    (json.results ?? []).map((r) => ({ ...r, kind: "note" })),
                );
                setHighlightedIndex(0);
            })
            .catch((err: unknown) => {
                if ((err as Error)?.name === "AbortError") return;
                setNoteHits([]);
            })
            .finally(() => setLoadingNotes(false));
        return () => controller.abort();
    }, [trigger, query]);

    const tagHits = useMemo<TagHit[]>(() => {
        if (!trigger || trigger.mode !== "tag") return [];
        const q = query.trim().toLowerCase();
        const pool = q
            ? availableTags.filter((t) => t.toLowerCase().includes(q))
            : availableTags;
        return pool.slice(0, 8).map((name) => ({ kind: "tag", name }));
    }, [trigger, query, availableTags]);

    const hits: Hit[] = trigger?.mode === "tag" ? tagHits : noteHits;

    // Reset the highlighted cursor when the tag hit set changes —
    // tag mode is synchronous (no async fetch) so we need this
    // explicit cursor reset since the note-mode fetch effect
    // doesn't fire for it.
    useEffect(() => {
        setHighlightedIndex(0);
    }, [tagHits]);
    /* eslint-enable react-hooks/set-state-in-effect */

    const applyPick = useCallback(
        (hit: Hit) => {
            const ta = innerRef.current;
            if (!ta || trigger === null) return;
            const before = value.slice(0, trigger.idx);
            const after = value.slice(
                trigger.idx + trigger.prefixLen + query.length,
            );
            const insertion =
                hit.kind === "note" ? `[[${hit.id}]]` : `#${hit.name} `;
            const nextValue = `${before}${insertion}${after}`;
            onChange(nextValue);
            const caret = before.length + insertion.length;
            setTimeout(() => {
                ta.focus();
                ta.setSelectionRange(caret, caret);
            }, 0);
            closePopover();
        },
        [value, trigger, query, onChange, closePopover],
    );

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (trigger !== null && hits.length > 0) {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlightedIndex((i) => (i + 1) % hits.length);
                return;
            }
            if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlightedIndex(
                    (i) => (i - 1 + hits.length) % hits.length,
                );
                return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                applyPick(hits[highlightedIndex]!);
                return;
            }
            if (e.key === "Escape") {
                e.preventDefault();
                closePopover();
                return;
            }
        }
        onKeyDown?.(e);
    };

    return (
        <>
            <Textarea
                ref={innerRef}
                name={name}
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className={className}
            />
            {trigger !== null &&
                popoverRect &&
                typeof document !== "undefined" &&
                createPortal(
                    <Popover
                        rect={popoverRect}
                        mode={trigger.mode}
                        loading={
                            trigger.mode === "note" ? loadingNotes : false
                        }
                        hits={hits}
                        highlightedIndex={highlightedIndex}
                        setHighlightedIndex={setHighlightedIndex}
                        onPick={applyPick}
                    />,
                    document.body,
                )}
        </>
    );
});

function Popover({
    rect,
    mode,
    loading,
    hits,
    highlightedIndex,
    setHighlightedIndex,
    onPick,
}: {
    rect: { left: number; top: number; width: number };
    mode: TriggerMode;
    loading: boolean;
    hits: Hit[];
    highlightedIndex: number;
    setHighlightedIndex: (i: number) => void;
    onPick: (hit: Hit) => void;
}) {
    const listRef = useRef<HTMLUListElement>(null);

    // Follow the keyboard cursor: when the user presses arrow keys
    // past what's in view, scroll the list so the highlighted row
    // stays visible. `block: 'nearest'` keeps the list calm — no
    // jumpy snap when the row is already on screen.
    useEffect(() => {
        const list = listRef.current;
        if (!list) return;
        const row = list.children[highlightedIndex] as
            | HTMLElement
            | undefined;
        row?.scrollIntoView({ block: "nearest" });
    }, [highlightedIndex]);
    // Default: open BELOW the anchor (rect.top is already
    // caret-line-bottom). If that would overflow the viewport flip
    // above the caret so the list stays visible. `position: fixed`
    // on document.body escapes every ancestor's `overflow: hidden`.
    const MAX_HEIGHT = 260;
    const GAP = 4;
    const viewportH =
        typeof window !== "undefined" ? window.innerHeight : 1080;
    const viewportW =
        typeof window !== "undefined" ? window.innerWidth : 1920;
    const fitsBelow = rect.top + GAP + MAX_HEIGHT + 16 < viewportH;
    const top = fitsBelow
        ? rect.top + GAP
        : Math.max(8, rect.top - GAP - MAX_HEIGHT - rect.width * 0);
    // Keep the popover inside the horizontal viewport too — if the
    // caret is near the right edge we shift left so the whole list
    // stays visible.
    const left = Math.min(rect.left, viewportW - rect.width - 8);

    const style: React.CSSProperties = {
        position: "fixed",
        left,
        top,
        width: rect.width,
        maxHeight: MAX_HEIGHT,
        zIndex: 100,
        // Radix Dialog / Sheet apply `pointer-events: none` to
        // document.body while open (so the dialog is the only
        // interactive surface). Our popover is a sibling portal on
        // body, so it inherits the `none` and every click falls
        // straight through to the textarea underneath. Re-enable
        // pointer events explicitly to restore normal hit testing.
        pointerEvents: "auto",
    };

    const label = mode === "note" ? "Link to note" : "Insert tag";

    return (
        <div
            style={style}
            // Data attribute is what the parent dialog's
            // onInteractOutside checks for: a click inside this tree
            // should NOT close the dialog. Canonical Radix pattern
            // for nested interactive layers.
            data-backlink-popover=""
            className="rounded-md border border-border/70 bg-popover shadow-xl overflow-hidden flex flex-col"
            role="listbox"
            aria-label={label}
        >
            <div className="px-3 py-1.5 border-b border-border/60 text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>{label}</span>
                <span className="opacity-60">
                    {loading ? "…" : `${hits.length}`}
                </span>
            </div>
            {hits.length === 0 && !loading ? (
                <p className="px-3 py-3 text-xs italic text-muted-foreground">
                    {mode === "note"
                        ? "No matches. Keep typing, or press Esc to cancel."
                        : "No matching tags. Keep typing, or press Esc."}
                </p>
            ) : (
                <ul
                    ref={listRef}
                    /* `min-h-0` unlocks `overflow-y-auto` inside a
                       flex column with a capped parent height.
                       Without it flexbox sizes the ul to its content
                       and the scrollbar never appears — rows past
                       row 6 render outside the visible container
                       with no way to reach them. */
                    className="flex-1 min-h-0 overflow-y-auto text-sm"
                >
                    {hits.map((hit, idx) => (
                        <li key={hit.kind === "note" ? hit.id : hit.name}>
                            <button
                                type="button"
                                // preventDefault on mousedown stops the
                                // textarea from blurring mid-click; the
                                // actual commit happens on click so the
                                // full press-release cycle completes
                                // before the popover unmounts.
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onPick(hit);
                                }}
                                onMouseEnter={() => setHighlightedIndex(idx)}
                                className={cn(
                                    "w-full text-left px-3 py-2 flex flex-col gap-0.5 transition-colors cursor-pointer",
                                    idx === highlightedIndex
                                        ? "bg-accent"
                                        : "hover:bg-accent/50",
                                )}
                            >
                                {hit.kind === "note" ? (
                                    <>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                                                #{hit.id}
                                            </span>
                                            <span className="truncate font-medium">
                                                {hit.title ??
                                                    hit.excerpt ??
                                                    "(untitled)"}
                                            </span>
                                        </div>
                                        {hit.title && hit.excerpt ? (
                                            <span className="truncate text-xs text-muted-foreground">
                                                {hit.excerpt}
                                            </span>
                                        ) : null}
                                    </>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <Hash
                                            className="h-3.5 w-3.5 text-primary"
                                            aria-hidden
                                        />
                                        <span className="truncate font-mono uppercase tracking-wider text-primary text-xs">
                                            {hit.name}
                                        </span>
                                    </div>
                                )}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

// Measure caret coordinates inside a textarea in viewport pixels.
// Standard mirror-div trick: build an off-screen div that inherits
// the textarea's typography + padding, copy the content up to the
// caret index into it, then append a zero-width marker span. The
// span's bounding rect, translated back through the textarea's own
// scroll offset, gives the caret x/y at the same column+row the
// user sees. Returns null when running without a document (SSR).
//
// Props we replicate on the mirror: everything that affects glyph
// layout. Missing any of these (e.g. letterSpacing) would make the
// caret coord diverge from the visual position as lines get long.
function measureCaretCoords(
    textarea: HTMLTextAreaElement,
    index: number,
): { left: number; top: number; lineHeight: number } | null {
    if (typeof document === "undefined") return null;

    const style = window.getComputedStyle(textarea);
    const mirror = document.createElement("div");
    const mStyle = mirror.style;
    const props: Array<keyof CSSStyleDeclaration> = [
        "boxSizing",
        "borderBottomStyle",
        "borderLeftStyle",
        "borderRightStyle",
        "borderTopStyle",
        "borderBottomWidth",
        "borderLeftWidth",
        "borderRightWidth",
        "borderTopWidth",
        "fontFamily",
        "fontSize",
        "fontStyle",
        "fontVariant",
        "fontWeight",
        "letterSpacing",
        "lineHeight",
        "paddingBottom",
        "paddingLeft",
        "paddingRight",
        "paddingTop",
        "tabSize",
        "textIndent",
        "textTransform",
        "whiteSpace",
        "wordBreak",
        "wordSpacing",
        "wordWrap",
    ];
    for (const p of props) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mStyle as any)[p] = (style as any)[p];
    }
    mStyle.position = "absolute";
    mStyle.visibility = "hidden";
    mStyle.top = "0";
    mStyle.left = "-9999px";
    mStyle.overflow = "hidden";
    mStyle.whiteSpace = "pre-wrap";
    mStyle.wordWrap = "break-word";
    mStyle.width = style.width;

    const before = textarea.value.slice(0, index);
    // Replacing trailing spaces with a non-breaking sentinel avoids
    // the browser trimming them, which would misplace the caret
    // when the user paused after typing a space.
    mirror.textContent = before.replace(/ $/, " ");

    const marker = document.createElement("span");
    marker.textContent = "​"; // zero-width space
    mirror.appendChild(marker);

    document.body.appendChild(mirror);
    const markerRect = marker.getBoundingClientRect();
    const mirrorRect = mirror.getBoundingClientRect();
    document.body.removeChild(mirror);

    const taRect = textarea.getBoundingClientRect();
    const lineHeight =
        parseFloat(style.lineHeight) ||
        parseFloat(style.fontSize) * 1.2 ||
        20;

    return {
        left:
            taRect.left + (markerRect.left - mirrorRect.left) -
            textarea.scrollLeft,
        top:
            taRect.top + (markerRect.top - mirrorRect.top) -
            textarea.scrollTop,
        lineHeight,
    };
}
