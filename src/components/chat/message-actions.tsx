"use client";

import { Check, Copy, GitBranch, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MessageActionsProps {
    role: "user" | "assistant";
    text: string;
    onCopy?: () => void;
    onEdit?: () => void;
    onRegenerate?: () => void;
    onBranch?: () => void;
    onDelete?: () => void;
    canAct: boolean;
}

// Per-bubble floating action strip. Appears on hover of the parent
// bubble (which owns the `group` class). Layout is inverted for user
// bubbles so the icons sit on the left edge of the right-aligned
// chip, and vice versa for assistant bubbles.
export function MessageActions({
    role,
    text,
    onCopy,
    onEdit,
    onRegenerate,
    onBranch,
    onDelete,
    canAct,
}: MessageActionsProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
            onCopy?.();
        } catch {
            toast.error("Clipboard blocked");
        }
    };

    const buttonClass = cn(
        "h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity",
        role === "user"
            ? "text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
    );

    return (
        <div
            className={cn(
                "absolute -bottom-2 flex items-center gap-0.5 rounded-md border bg-background px-0.5 py-0.5 shadow-sm",
                role === "user"
                    ? "right-2 border-primary/30"
                    : "left-2 border-border/60",
            )}
        >
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(buttonClass, "text-muted-foreground hover:text-foreground hover:bg-muted/60")}
                onClick={handleCopy}
                aria-label="Copy message"
                title="Copy"
            >
                {copied ? (
                    <Check className="h-3 w-3" />
                ) : (
                    <Copy className="h-3 w-3" />
                )}
            </Button>
            {onEdit && (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(buttonClass, "text-muted-foreground hover:text-foreground hover:bg-muted/60")}
                    onClick={onEdit}
                    disabled={!canAct}
                    aria-label="Edit message"
                    title="Edit and re-run"
                >
                    <Pencil className="h-3 w-3" />
                </Button>
            )}
            {onRegenerate && (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(buttonClass, "text-muted-foreground hover:text-foreground hover:bg-muted/60")}
                    onClick={onRegenerate}
                    disabled={!canAct}
                    aria-label="Regenerate response"
                    title="Regenerate"
                >
                    <RefreshCw className="h-3 w-3" />
                </Button>
            )}
            {onBranch && (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(buttonClass, "text-muted-foreground hover:text-foreground hover:bg-muted/60")}
                    onClick={onBranch}
                    disabled={!canAct}
                    aria-label="Branch chat from here"
                    title="Branch from here"
                >
                    <GitBranch className="h-3 w-3" />
                </Button>
            )}
            {onDelete && (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(buttonClass, "text-muted-foreground hover:text-destructive hover:bg-destructive/10")}
                    onClick={onDelete}
                    disabled={!canAct}
                    aria-label="Delete message"
                    title="Delete"
                >
                    <Trash2 className="h-3 w-3" />
                </Button>
            )}
        </div>
    );
}
