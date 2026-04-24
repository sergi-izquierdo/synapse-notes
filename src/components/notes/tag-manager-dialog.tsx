"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Pencil, Settings2, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { deleteTagAction, renameTagAction } from "@/actions/tags";

interface TagManagerDialogProps {
    availableTags: string[];
    tagCounts: Record<string, number>;
}

// Per-row editing state. Only one tag can be in rename mode at a time
// — the component keeps the active tag name as the key. Any other
// tag row is displayed in read mode.
type EditingState = { tag: string; draft: string } | null;
type PendingDelete = { tag: string; count: number } | null;

// Central place to manage every tag the user owns. Rename triggers a
// single atomic RPC that rewrites every affected note (with merge
// dedup); delete strips the tag from every note it appears on. Both
// paths revalidate the dashboard + graph routes so the UI catches up
// instantly. Access point: the "Manage tags" gear button in the
// filter bar.
export function TagManagerDialog({
    availableTags,
    tagCounts,
}: TagManagerDialogProps) {
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<EditingState>(null);
    const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
    const [isPending, startTransition] = useTransition();

    const startEdit = (tag: string) =>
        setEditing({ tag, draft: tag });

    const cancelEdit = () => setEditing(null);

    const confirmRename = () => {
        if (!editing) return;
        const from = editing.tag;
        const to = editing.draft.trim();
        if (!to) {
            toast.error("Tag can't be empty");
            return;
        }
        if (to === from) {
            setEditing(null);
            return;
        }
        startTransition(async () => {
            const result = await renameTagAction({ from, to });
            if ("error" in result && result.error) {
                toast.error("Rename failed", { description: result.error });
                return;
            }
            toast.success(
                `Renamed “${from}” → “${to}”`,
                result.updated
                    ? {
                          description: `${result.updated} note${result.updated === 1 ? "" : "s"} updated`,
                      }
                    : undefined,
            );
            setEditing(null);
        });
    };

    const confirmDelete = () => {
        if (!pendingDelete) return;
        const tag = pendingDelete.tag;
        startTransition(async () => {
            const result = await deleteTagAction({ tag });
            if ("error" in result && result.error) {
                toast.error("Delete failed", { description: result.error });
                return;
            }
            toast.success(
                `Removed “${tag}”`,
                result.updated
                    ? {
                          description: `Cleared from ${result.updated} note${result.updated === 1 ? "" : "s"}`,
                      }
                    : undefined,
            );
            setPendingDelete(null);
        });
    };

    const sortedTags = [...availableTags].sort((a, b) => {
        const diff = (tagCounts[b] ?? 0) - (tagCounts[a] ?? 0);
        return diff !== 0 ? diff : a.localeCompare(b);
    });

    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-foreground"
                        aria-label="Manage tags"
                    >
                        <Settings2 className="h-4 w-4" />
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle>Manage tags</DialogTitle>
                        <DialogDescription>
                            Rename or delete tags. Changes apply to every note
                            that uses the tag.
                        </DialogDescription>
                    </DialogHeader>

                    {sortedTags.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic py-8 text-center">
                            No tags yet. Add one to a note to see it here.
                        </p>
                    ) : (
                        <ul className="max-h-[50vh] overflow-y-auto divide-y divide-border/60 -mx-6">
                            {sortedTags.map((tag) => {
                                const count = tagCounts[tag] ?? 0;
                                const isEditing = editing?.tag === tag;
                                return (
                                    <li
                                        key={tag}
                                        className={cn(
                                            "flex items-center gap-2 px-6 py-2.5",
                                            isEditing && "bg-muted/30",
                                        )}
                                    >
                                        {isEditing ? (
                                            <>
                                                <Input
                                                    value={editing.draft}
                                                    onChange={(e) =>
                                                        setEditing({
                                                            ...editing,
                                                            draft: e.target.value,
                                                        })
                                                    }
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter")
                                                            confirmRename();
                                                        if (e.key === "Escape")
                                                            cancelEdit();
                                                    }}
                                                    autoFocus
                                                    className="h-8 flex-1 text-sm"
                                                />
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                                    onClick={confirmRename}
                                                    disabled={isPending}
                                                    aria-label="Save rename"
                                                >
                                                    {isPending ? (
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    ) : (
                                                        <Check className="h-3.5 w-3.5" />
                                                    )}
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                                    onClick={cancelEdit}
                                                    disabled={isPending}
                                                    aria-label="Cancel rename"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                <span className="flex-1 text-sm font-medium">
                                                    {tag}
                                                </span>
                                                <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                                                    {count}
                                                </span>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                                    onClick={() => startEdit(tag)}
                                                    aria-label={`Rename ${tag}`}
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                    onClick={() =>
                                                        setPendingDelete({
                                                            tag,
                                                            count,
                                                        })
                                                    }
                                                    aria-label={`Delete ${tag}`}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </DialogContent>
            </Dialog>

            <AlertDialog
                open={!!pendingDelete}
                onOpenChange={(o) => !o && setPendingDelete(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Delete tag “{pendingDelete?.tag}”?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove the tag from{" "}
                            <span className="font-semibold text-foreground">
                                {pendingDelete?.count ?? 0}
                            </span>{" "}
                            note
                            {(pendingDelete?.count ?? 0) === 1 ? "" : "s"}. The
                            notes themselves are kept.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isPending}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            disabled={isPending}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isPending && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
