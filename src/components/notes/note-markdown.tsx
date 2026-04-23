"use client";

import { useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { updateNote } from "@/actions/notes";

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

interface NoteMarkdownProps {
    noteId: number;
    content: string;
    tags: string[];
}

// Markdown preview with interactive task-list checkboxes. Clicking a
// checkbox toggles it in the note content, updates local state
// optimistically, and persists the change via the updateNote server
// action. The checkbox is the only clickable target inside the
// preview — the surrounding prose container still inherits
// pointer-events-none from the card so clicks on the body text
// propagate to the card handler (which opens the edit modal).
export function NoteMarkdown({ noteId, content, tags }: NoteMarkdownProps) {
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
            }}
        >
            {localContent}
        </ReactMarkdown>
    );
}
