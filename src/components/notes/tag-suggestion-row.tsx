"use client";

import { Loader2, Plus, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TagSuggestions } from "@/hooks/use-tag-suggestions";

type Status = "idle" | "loading" | "ready" | "error";

interface TagSuggestionRowProps {
    status: Status;
    suggestions: TagSuggestions;
    selectedTags: string[];
    onAdd: (tag: string) => void;
    onDismiss: () => void;
    className?: string;
}

// Compact row of suggestion chips. Existing-tag chips appear first
// (only those the user hasn't already selected); an optional new-tag
// chip uses the Plus icon to signal "this will create a fresh tag".
// The row hides itself when there's nothing actionable to show.
export function TagSuggestionRow({
    status,
    suggestions,
    selectedTags,
    onAdd,
    onDismiss,
    className,
}: TagSuggestionRowProps) {
    const actionable = suggestions.existing.filter(
        (t) => !selectedTags.includes(t),
    );
    const newTag =
        suggestions.newTag && !selectedTags.includes(suggestions.newTag)
            ? suggestions.newTag
            : null;
    const hasAnything = actionable.length > 0 || newTag !== null;

    // Collapse when there's nothing to show AND no progress to show.
    // `error` still renders so the user sees the failure instead of a
    // silent no-op.
    if (status === "idle") return null;
    if (status === "ready" && !hasAnything) return null;

    return (
        <div
            className={cn(
                "flex flex-wrap items-center gap-1.5 text-xs",
                className,
            )}
            role="region"
            aria-label="AI tag suggestions"
        >
            <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80">
                <Sparkles className="h-3 w-3" aria-hidden />
                {status === "loading"
                    ? "thinking"
                    : status === "error"
                      ? "error"
                      : "suggested"}
            </span>

            {status === "loading" && (
                <Loader2
                    className="h-3 w-3 animate-spin text-muted-foreground"
                    aria-hidden
                />
            )}

            {status === "error" && (
                <span className="text-muted-foreground/60 italic">
                    couldn&apos;t generate suggestions
                </span>
            )}

            {actionable.map((tag) => (
                <button
                    key={tag}
                    type="button"
                    onClick={() => onAdd(tag)}
                    className="transition-transform hover:scale-[1.03] active:scale-95"
                >
                    <Badge
                        variant="secondary"
                        className="cursor-pointer gap-1 border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10"
                    >
                        <Plus className="h-3 w-3" aria-hidden />
                        {tag}
                    </Badge>
                </button>
            ))}

            {newTag && (
                <button
                    type="button"
                    onClick={() => onAdd(newTag)}
                    className="transition-transform hover:scale-[1.03] active:scale-95"
                >
                    <Badge
                        variant="outline"
                        className="cursor-pointer gap-1 border-dashed border-amber-500/50 bg-amber-500/5 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
                    >
                        <Sparkles className="h-3 w-3" aria-hidden />
                        new: {newTag}
                    </Badge>
                </button>
            )}

            {hasAnything && status !== "loading" && (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="ml-auto h-5 w-5 text-muted-foreground hover:text-foreground"
                    onClick={onDismiss}
                    aria-label="Dismiss suggestions"
                >
                    <X className="h-3 w-3" />
                </Button>
            )}
        </div>
    );
}
