"use client";

import { useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import { Hash, Link2 } from "lucide-react";
import { updateNote } from "@/actions/notes";

// Turn every `[[N]]` in a piece of markdown into a standard link so
// remark-gfm treats it as inline markdown. The visible label is
// resolved against the noteIndex: prefer the user-set title, fall
// back to the first-line excerpt, fall back to `[[N]]` when we
// have nothing (caller didn't provide an index, or the target was
// archived/deleted). The `#backlink` sentinel stays in the URL so
// the anchor renderer below can re-style it and route it via the
// Next.js client router instead of a full navigation.
//
// Brackets inside markdown link labels need balancing, so when we
// fall back to the `[[id]]` shape we escape the brackets. Titles or
// excerpts are used verbatim but any `[` / `]` / `\` in them also
// gets escaped to keep the markdown well-formed.
function renderBacklinksAsMarkdown(
    content: string,
    index?: NoteIndex,
): string {
    return content.replace(/\[\[\s*(\d+)\s*\]\]/g, (_, rawId) => {
        const id = Number(rawId);
        const entry = index?.get(id);
        const source =
            entry?.title?.trim() || entry?.excerpt?.trim() || null;
        const label = source
            ? escapeMarkdownLabel(source)
            : `\\[\\[${id}\\]\\]`;
        return `[${label}](/?note=${id}#backlink)`;
    });
}

// Inline `#Tag` references. The character class below matches
// Unicode letters + digits + `-` + `_` so Catalan/Spanish tags like
// `#Idees`, `#Política`, `#to-do` survive intact. The trigger must
// sit at a word boundary (start-of-text, whitespace, or common
// punctuation) so:
//   - markdown headings `# Heading` never match (space after #);
//   - hex colours `#ffcc00` don't match (purely numeric isn't a
//     useful tag anyway, but specifically we require at least one
//     letter in the tag name);
//   - URLs with fragments `/path#section` don't match (the `/` or
//     `.` before `#` isn't in the allowed boundary set).
//
// The sentinel href `#tag-ref` lets the anchor renderer below
// distinguish these pills from regular links and wire the click to
// `/?tag=<name>` instead of `/?note=<id>`.
function renderTagChipsAsMarkdown(content: string): string {
    return content.replace(
        /(^|[\s.,;:!?()[\]{}"'«»¿¡])#([\p{L}\p{N}][\p{L}\p{N}_-]*)/gu,
        (match, boundary, tag) => {
            if (!/\p{L}/u.test(tag)) return match;
            const safe = escapeMarkdownLabel(`#${tag}`);
            return `${boundary}[${safe}](/?tag=${encodeURIComponent(tag)}#tag-ref)`;
        },
    );
}

function escapeMarkdownLabel(s: string): string {
    return s.replace(/[\[\]\\]/g, (c) => `\\${c}`);
}

// Toggle the n-th occurrence of a GFM task-list checkbox in a
// markdown string. Matches `- [ ]`, `- [x]`, `- [X]` — exactly the
// syntax remark-gfm parses into <input type="checkbox"> at render.
function toggleMarkdownCheckbox(content: string, targetIndex: number): string {
    const pattern = /- \[[ xX]\]/g;
    let seen = 0;
    return content.replace(pattern, (match) => {
        if (seen++ === targetIndex) {
            return match.includes("x") || match.includes("X")
                ? "- [ ]"
                : "- [x]";
        }
        return match;
    });
}

// Lookup map handed down by NoteGrid: { id → { title, excerpt } }.
// Used by the backlink pill renderer below to substitute a raw id
// (`[[14]]`) with a human-readable label (the target's title or
// first-line excerpt), which is what makes a self-link visible as
// a self-link instead of looking like it should go somewhere else.
export type NoteIndex = Map<
    number,
    { title: string | null; excerpt: string }
>;

interface NoteMarkdownProps {
    noteId: number;
    content: string;
    tags: string[];
    /** Optional lookup for backlink label resolution. When omitted
     *  (e.g. a card rendered outside NoteGrid) the pill falls back
     *  to showing the numeric id. */
    noteIndex?: NoteIndex;
}

// Markdown preview with interactive task-list checkboxes. Clicking a
// checkbox toggles it in the note content, updates local state
// optimistically, and persists the change via the updateNote server
// action. The checkbox is the only clickable target inside the
// preview — the surrounding prose container still inherits
// pointer-events-none from the card so clicks on the body text
// propagate to the card handler (which opens the edit modal).
export function NoteMarkdown({
    noteId,
    content,
    tags,
    noteIndex,
}: NoteMarkdownProps) {
    // Seeded once from the prop. External prop updates (e.g. after
    // editing from the modal) are picked up by the parent passing
    // `key={note.content}` which remounts this component with the
    // fresh content as the new seed. Avoids a setState-in-effect and
    // keeps the optimistic toggle snappy.
    const [localContent, setLocalContent] = useState(content);
    const [, startTransition] = useTransition();

    let checkboxIndex = -1;

    const handleToggle = (index: number) => {
        const next = toggleMarkdownCheckbox(localContent, index);
        setLocalContent(next);
        // Tiny haptic tick on devices that support it (iOS Safari
        // ignores the API, Android Chrome/Firefox honour it). Feature-
        // detected so we don't fail in desktop browsers.
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            navigator.vibrate?.(10);
        }
        startTransition(async () => {
            await updateNote(noteId, next, tags);
        });
    };

    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                input: ({ type, checked, ...rest }) => {
                    if (type !== "checkbox") {
                        return <input type={type} {...rest} />;
                    }
                    const idx = ++checkboxIndex;
                    return (
                        <input
                            type="checkbox"
                            checked={Boolean(checked)}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => {
                                event.stopPropagation();
                                handleToggle(idx);
                            }}
                            className="pointer-events-auto cursor-pointer accent-primary"
                        />
                    );
                },
                // Backlink anchors are the ones produced by the
                // renderBacklinksAsMarkdown pass above (href carries
                // our `#backlink` sentinel). Render as a styled
                // Next Link that deep-links to the dashboard with
                // `?note=<id>` — the NoteGrid URL effect catches that
                // and opens the edit dialog. Everything else (real
                // external anchors a user might type) keeps its
                // default browser behaviour + opens in a new tab.
                a: ({ href, children, ...rest }) => {
                    const isBacklink =
                        typeof href === "string" &&
                        href.endsWith("#backlink");
                    const isTagRef =
                        typeof href === "string" &&
                        href.endsWith("#tag-ref");
                    if (isBacklink) {
                        const target = (href as string).replace(
                            "#backlink",
                            "",
                        );
                        return (
                            <Link
                                href={target}
                                scroll={false}
                                onClick={(e) => e.stopPropagation()}
                                className="pointer-events-auto inline-flex items-center gap-1 font-mono text-[0.85em] rounded-md px-1.5 py-0.5 bg-[rgba(185,154,224,0.12)] text-[#b99ae0] border border-[rgba(185,154,224,0.25)] no-underline hover:bg-[rgba(185,154,224,0.22)] hover:border-[rgba(185,154,224,0.45)] transition-colors align-middle"
                            >
                                <Link2
                                    className="h-3 w-3 opacity-70"
                                    aria-hidden
                                />
                                <span>{children}</span>
                            </Link>
                        );
                    }
                    if (isTagRef) {
                        const target = (href as string).replace(
                            "#tag-ref",
                            "",
                        );
                        // Strip the leading '#' from the visible
                        // label since the Hash icon already carries
                        // it. remark renders our label as a single
                        // text child so the string branch covers the
                        // common case; the array branch handles
                        // corner cases where a plugin splits it.
                        let label: React.ReactNode = children;
                        if (typeof children === "string") {
                            label = children.replace(/^#/, "");
                        } else if (
                            Array.isArray(children) &&
                            typeof children[0] === "string"
                        ) {
                            label = [
                                (children[0] as string).replace(/^#/, ""),
                                ...children.slice(1),
                            ];
                        }
                        return (
                            <Link
                                href={target}
                                scroll={false}
                                onClick={(e) => e.stopPropagation()}
                                className="pointer-events-auto inline-flex items-center gap-0.5 font-mono text-[0.8em] uppercase tracking-wider rounded px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/25 no-underline hover:bg-primary/20 hover:border-primary/50 transition-colors align-middle"
                            >
                                <Hash
                                    className="h-3 w-3 opacity-70"
                                    aria-hidden
                                />
                                <span>{label}</span>
                            </Link>
                        );
                    }
                    return (
                        <a
                            href={href}
                            rel="noreferrer"
                            target="_blank"
                            onClick={(e) => e.stopPropagation()}
                            className="pointer-events-auto underline"
                            {...rest}
                        >
                            {children}
                        </a>
                    );
                },
            }}
        >
            {renderTagChipsAsMarkdown(
                renderBacklinksAsMarkdown(localContent, noteIndex),
            )}
        </ReactMarkdown>
    );
}
