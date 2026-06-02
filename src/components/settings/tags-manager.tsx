"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteTagAction, renameTagAction } from "@/actions/settings";
import { useLanguage } from "@/components/language-provider";
import { cn } from "@/lib/utils";

interface TagsManagerProps {
    tagCounts: Record<string, number>;
}

// One-row-per-tag manager. Clicking the pencil enters rename mode on
// that row; submitting calls the server action. Renaming to an
// existing tag is effectively a merge — the action dedupes.
export function TagsManager({ tagCounts }: TagsManagerProps) {
    const { t } = useLanguage();
    const [editingTag, setEditingTag] = useState<string | null>(null);
    const [draft, setDraft] = useState("");
    const [isPending, startTransition] = useTransition();

    const tags = useMemo(
        () =>
            Object.keys(tagCounts).sort((a, b) => {
                const diff = tagCounts[b]! - tagCounts[a]!;
                return diff !== 0 ? diff : a.localeCompare(b);
            }),
        [tagCounts],
    );

    const beginEdit = (tag: string) => {
        setEditingTag(tag);
        setDraft(tag);
    };

    const cancelEdit = () => {
        setEditingTag(null);
        setDraft("");
    };

    const submitRename = (tag: string) => {
        const next = draft.trim();
        if (!next) {
            cancelEdit();
            return;
        }
        if (next === tag) {
            cancelEdit();
            return;
        }
        startTransition(async () => {
            const result = await renameTagAction(tag, next);
            if (result?.error) {
                toast.error(t.tagManager.renameFailed, { description: result.error });
                return;
            }
            const willMerge = Boolean(tagCounts[next]);
            toast.success(
                willMerge
                    ? t.tagManager.mergedInto(next)
                    : t.tagManager.renamedTo(next),
                { description: t.tagManager.notesUpdated(result.updated ?? 0) },
            );
            cancelEdit();
        });
    };

    const submitDelete = (tag: string) => {
        startTransition(async () => {
            const result = await deleteTagAction(tag);
            if (result?.error) {
                toast.error(t.tagManager.deleteFailed, { description: result.error });
            } else {
                toast.success(t.tagManager.removed(tag), {
                    description: t.tagManager.notesUpdated(result.updated ?? 0),
                });
            }
        });
    };

    if (tags.length === 0) {
        return (
            <p className="text-sm text-muted-foreground italic">
                {t.tagManager.empty}
            </p>
        );
    }

    return (
        <ul className="divide-y divide-border/60 border border-border/60 rounded-md overflow-hidden">
            {tags.map((tag) => {
                const isEditing = editingTag === tag;
                const count = tagCounts[tag] ?? 0;
                return (
                    <li
                        key={tag}
                        className={cn(
                            "flex items-center gap-2 px-3 py-2 text-sm bg-card",
                            isEditing && "bg-muted/40",
                        )}
                    >
                        {isEditing ? (
                            <>
                                <Input
                                    autoFocus
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            submitRename(tag);
                                        } else if (e.key === "Escape") {
                                            e.preventDefault();
                                            cancelEdit();
                                        }
                                    }}
                                    className="h-8 flex-1 text-sm font-mono"
                                    disabled={isPending}
                                />
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                    onClick={() => submitRename(tag)}
                                    disabled={isPending}
                                    aria-label={t.tagManager.saveRename}
                                >
                                    <Check className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                    onClick={cancelEdit}
                                    disabled={isPending}
                                    aria-label={t.tagManager.cancelRename}
                                >
                                    <X className="h-3.5 w-3.5" />
                                </Button>
                            </>
                        ) : (
                            <>
                                <span className="flex-1 font-mono uppercase tracking-wider text-xs">
                                    #{tag}
                                </span>
                                <span className="font-mono text-[10px] text-muted-foreground tabular-nums mr-2">
                                    {count}
                                </span>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                    onClick={() => beginEdit(tag)}
                                    disabled={isPending}
                                    aria-label={t.tagManager.renameAria(tag)}
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                            disabled={isPending}
                                            aria-label={t.tagManager.deleteAria(tag)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>
                                                {t.tagManager.removeTitle(tag)}
                                            </AlertDialogTitle>
                                            <AlertDialogDescription>
                                                {t.tagManager.removeDesc(tag, count)}
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>
                                                {t.common.cancel}
                                            </AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={() => submitDelete(tag)}
                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                            >
                                                {t.tagManager.removeConfirm}
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}
