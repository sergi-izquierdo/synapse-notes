"use client";

import { useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  type SortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Copy, Star, Archive, GripVertical } from "lucide-react";
import {
  archiveNote,
  deleteNote,
  duplicateNote,
  restoreNote,
  swapNotePositions,
  toggleNoteStarred,
  unarchiveNote,
} from "@/actions/notes";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";
import { NoteMarkdown } from "./note-markdown";
import { formatRelative } from "@/lib/format-relative";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EditNoteDialog } from "./edit-note-dialog";
import { FilterBar } from "./filter-bar";

interface GridNote {
  id: number;
  content: string;
  created_at: string;
  tags: string[] | null;
  starred?: boolean;
  position?: string | null;
}

// Custom dnd-kit sortable strategy that implements SWAP instead of
// the default insert-shift of `rectSortingStrategy`. While a card is
// being dragged, only the hover target moves — it slides into the
// dragged card's origin slot. Every other card stays put. On drop
// the two cards exchange positions outright (see swapNotePositions
// in src/actions/notes.ts).
const swapSortingStrategy: SortingStrategy = ({
  activeIndex,
  index,
  overIndex,
  rects,
}) => {
  if (activeIndex === -1 || overIndex === -1) return null;
  if (activeIndex === overIndex) return null;
  if (index === activeIndex) return null; // dragged item — DragOverlay handles it
  if (index !== overIndex) return null; // not the hover target — stay put
  const activeRect = rects[activeIndex];
  const thisRect = rects[index];
  if (!activeRect || !thisRect) return null;
  return {
    x: activeRect.left - thisRect.left,
    y: activeRect.top - thisRect.top,
    scaleX: 1,
    scaleY: 1,
  };
};

// Sort rule that mirrors the server ORDER BY so the optimistic view
// can re-shuffle locally the moment a drag lands — otherwise the
// reordered card snaps back to its original slot until the server
// revalidates. Starred first, then fractional position ASC (NULLs
// last), with created_at DESC as a tiebreak for any legacy NULLs.
function sortNotes(notes: GridNote[]): GridNote[] {
  return [...notes].sort((a, b) => {
    const sa = a.starred ? 1 : 0;
    const sb = b.starred ? 1 : 0;
    if (sa !== sb) return sb - sa;
    const pa = a.position ?? null;
    const pb = b.position ?? null;
    if (pa !== null && pb !== null)
      return pa < pb ? -1 : pa > pb ? 1 : 0;
    if (pa === null && pb !== null) return 1;
    if (pa !== null && pb === null) return -1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

interface NoteGridProps {
  notes: GridNote[];
  availableTags: string[];
}

// Optimistic mutation payload. `patch` merges fields into the matching
// note; `remove` filters the note out so archive/delete hide it at
// once. The real server state replaces the optimistic one as soon as
// revalidatePath re-renders the page.
type OptimisticAction =
  | { type: "patch"; id: number; patch: Partial<GridNote> }
  | { type: "remove"; id: number };

export function NoteGrid({ notes, availableTags }: NoteGridProps) {
  const { t, language } = useLanguage();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [editingNote, setEditingNote] = useState<{
    id: number;
    content: string;
    tags: string[];
  } | null>(null);
  // Currently-dragged note id, used by DragOverlay to render a
  // floating clone while the cursor moves. Set on DragStart, cleared
  // on DragEnd / DragCancel.
  const [activeDragId, setActiveDragId] = useState<number | null>(null);

  // Optimistic layer on top of the server-sourced `notes` prop. Each
  // card action (star / archive / delete) paints its intended next
  // state right away instead of waiting for the supabase round-trip +
  // revalidatePath. React 19 discards the optimistic state when the
  // wrapping transition resolves and the server-rendered props flow
  // back in.
  const [optimisticNotes, applyOptimistic] = useOptimistic<
    GridNote[],
    OptimisticAction
  >(notes, (state, action) => {
    switch (action.type) {
      case "patch":
        return state.map((n) =>
          n.id === action.id ? { ...n, ...action.patch } : n,
        );
      case "remove":
        return state.filter((n) => n.id !== action.id);
    }
  });

  const [, startMutation] = useTransition();

  // Frequency map used by the filter selector, the top-3 keyboard
  // shortcuts, and (when we want to surface popular tags) any UI.
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const note of optimisticNotes) {
      for (const tag of note.tags ?? []) {
        counts[tag] = (counts[tag] ?? 0) + 1;
      }
    }
    return counts;
  }, [optimisticNotes]);

  // Top 3 tags by usage, alpha-sorted as a tie-break. Consumed by the
  // 1/2/3 quick-filter shortcut below.
  const topTags = useMemo(
    () =>
      availableTags
        .slice()
        .sort((a, b) => {
          const diff = (tagCounts[b] ?? 0) - (tagCounts[a] ?? 0);
          return diff !== 0 ? diff : a.localeCompare(b);
        })
        .slice(0, 3),
    [availableTags, tagCounts],
  );

  // Toggle a tag in the active filter set — shared between the card
  // badge click and the 1/2/3 custom event listener.
  const toggleTagFilter = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  // 1/2/3 quick-filter: GlobalShortcuts dispatches notes-filter-top-tag
  // with detail.index (1-based). We translate the index into the
  // current top tag and toggle its filter.
  useEffect(() => {
    const handler = (e: Event) => {
      const index = (e as CustomEvent<{ index: number }>).detail?.index;
      if (!index) return;
      const tag = topTags[index - 1];
      if (tag) toggleTagFilter(tag);
    };
    document.addEventListener("notes-filter-top-tag", handler);
    return () =>
      document.removeEventListener("notes-filter-top-tag", handler);
  }, [topTags]);

  // Sort the optimistic view with the same rule as the server so
  // drag-reorder lands visually the moment the optimistic patch
  // fires. Sort BEFORE filtering so the section order stays
  // consistent regardless of which tag is active.
  const sortedOptimistic = useMemo(
    () => sortNotes(optimisticNotes),
    [optimisticNotes],
  );

  // AND filter: a note must carry every selected tag to match. Uses
  // optimisticNotes so toggles feel instant; archive/delete
  // effectively filter themselves out via the optimistic remove.
  const filteredNotes = sortedOptimistic.filter((note) => {
    const matchesSearch = note.content
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const noteTags = note.tags ?? [];
    const matchesTags =
      selectedTags.length === 0 ||
      selectedTags.every((t) => noteTags.includes(t));
    return matchesSearch && matchesTags;
  });

  // Split into independent drag sections. dnd-kit's SortableContext
  // is scoped to its own item list — rendering two separate contexts
  // is what prevents a starred card from being dropped into the
  // un-starred grid (and vice versa). Cross-section state changes
  // still happen via the Star button, not the drag.
  const starredNotes = filteredNotes.filter((n) => n.starred);
  const restNotes = filteredNotes.filter((n) => !n.starred);

  // Each handler paints its optimistic state first (inside a
  // transition, which is a requirement of useOptimistic) and then
  // awaits the server action. On error we show a toast; the
  // optimistic state is discarded automatically once the transition
  // finishes and the real props flow back in.

  const handleDelete = (id: number) => {
    startMutation(async () => {
      applyOptimistic({ type: "remove", id });
      try {
        const snapshot = await deleteNote(id);
        toast.success("Note deleted", {
          duration: 5000,
          action: snapshot
            ? {
                label: "Undo",
                onClick: async () => {
                  const result = await restoreNote(
                    snapshot.content,
                    snapshot.tags,
                  );
                  if (result?.error) {
                    toast.error("Restore failed", {
                      description: result.error,
                    });
                  } else {
                    toast.success("Note restored");
                  }
                },
              }
            : undefined,
        });
      } catch {
        toast.error("Error deleting note");
      }
    });
  };

  // Duplicate doesn't get an optimistic slot because the new note's
  // id is assigned server-side and we'd have to fake one. Embedding
  // generation is the slow step anyway, so the toast loading state
  // is the right feedback here.
  const handleDuplicate = async (id: number) => {
    const result = await duplicateNote(id);
    if (result?.error) {
      toast.error("Duplicate failed", { description: result.error });
    } else {
      toast.success("Note duplicated");
    }
  };

  const handleToggleStar = (id: number, current: boolean) => {
    startMutation(async () => {
      applyOptimistic({
        type: "patch",
        id,
        patch: { starred: !current },
      });
      const result = await toggleNoteStarred(id, !current);
      if (result?.error) {
        toast.error(result.error);
      }
    });
  };

  const sensors = useSensors(
    // Listeners live on a dedicated GripVertical button (see
    // SortableNoteCard below), so there's no click-vs-drag ambiguity
    // to disambiguate — dropping the activationConstraint lets drag
    // start on the first pointer movement, which kills the "micro
    // pause" feel users see with a distance threshold.
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(Number(event.active.id));
  };

  const handleDragCancel = () => {
    setActiveDragId(null);
  };

  // onDragEnd: swap positions between the dragged card and the hover
  // target. The two rows exchange their fractional keys outright,
  // which keeps both sides of the swap in valid canonical form and
  // matches what rendered on screen during the drag (only the hover
  // target moved, everything else stayed put).
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = Number(active.id);
    const overId = Number(over.id);

    // Both ids must live in the same section; dnd-kit's two-context
    // setup enforces this by construction, but guard anyway.
    const sameSection =
      (starredNotes.some((n) => n.id === activeId) &&
        starredNotes.some((n) => n.id === overId)) ||
      (restNotes.some((n) => n.id === activeId) &&
        restNotes.some((n) => n.id === overId));
    if (!sameSection) return;

    const activeNote = optimisticNotes.find((n) => n.id === activeId);
    const overNote = optimisticNotes.find((n) => n.id === overId);
    if (!activeNote?.position || !overNote?.position) return;
    if (activeNote.position === overNote.position) return;

    const activePos = activeNote.position;
    const overPos = overNote.position;

    startMutation(async () => {
      // Double optimistic patch — both rows swap their positions in
      // the client view the moment the drop happens.
      applyOptimistic({
        type: "patch",
        id: activeId,
        patch: { position: overPos },
      });
      applyOptimistic({
        type: "patch",
        id: overId,
        patch: { position: activePos },
      });
      const result = await swapNotePositions(activeId, overId);
      if (result?.error) {
        toast.error("Reorder failed", { description: result.error });
      }
    });
  };

  // Archive is a soft-delete: the row stays in the DB (with its
  // embedding intact), the dashboard query just hides it. Undo is a
  // single unarchive call — cheaper than the hard-delete restore
  // path because the embedding doesn't need regenerating.
  const handleArchive = (id: number) => {
    startMutation(async () => {
      applyOptimistic({ type: "remove", id });
      const result = await archiveNote(id);
      if (result?.error) {
        toast.error("Archive failed", { description: result.error });
        return;
      }
      toast.success("Note archived", {
        duration: 5000,
        action: {
          label: "Undo",
          onClick: async () => {
            const restore = await unarchiveNote(id);
            if (restore?.error) {
              toast.error("Restore failed", { description: restore.error });
            } else {
              toast.success("Note restored");
            }
          },
        },
      });
    });
  };

  return (
    <>
      <FilterBar
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedTags={selectedTags}
        setSelectedTags={setSelectedTags}
        availableTags={availableTags}
        tagCounts={tagCounts}
      />

      {/* GRID — three states: zero notes (illustrated), zero matches
          (concise filter hint), or the two sortable sections. Uses
          the optimistic view so archiving/deleting the last note
          shows the empty state straight away. */}
      {optimisticNotes.length === 0 ? (
        <EmptyNotesState />
      ) : filteredNotes.length === 0 ? (
        <div className="text-center text-muted-foreground py-10 opacity-50">
          {t.common.no_results}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          {/* STARRED SECTION — independent SortableContext so
              starred cards can't be dropped into the unstarred grid.
              Only rendered when there's at least one starred note so
              we don't leave an empty band above. */}
          {starredNotes.length > 0 && (
            <SortableContext
              items={starredNotes.map((n) => n.id)}
              strategy={swapSortingStrategy}
            >
              <motion.div
                className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8"
                initial="hidden"
                animate="show"
                variants={{
                  show: { transition: { staggerChildren: 0.04 } },
                }}
              >
                {starredNotes.map((note) => (
                  <SortableNoteCard
                    key={note.id}
                    note={note}
                    language={language}
                    selectedTags={selectedTags}
                    onOpenEdit={() =>
                      setEditingNote({ ...note, tags: note.tags || [] })
                    }
                    onToggleStar={() =>
                      handleToggleStar(note.id, Boolean(note.starred))
                    }
                    onToggleTagFilter={toggleTagFilter}
                    onDuplicate={() => handleDuplicate(note.id)}
                    onArchive={() => handleArchive(note.id)}
                    onDelete={() => handleDelete(note.id)}
                  />
                ))}
              </motion.div>
            </SortableContext>
          )}

          {/* REST SECTION — always rendered (even when only starred
              notes exist it's harmlessly empty). */}
          <SortableContext
            items={restNotes.map((n) => n.id)}
            strategy={swapSortingStrategy}
          >
            <motion.div
              className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
              initial="hidden"
              animate="show"
              variants={{
                show: { transition: { staggerChildren: 0.04 } },
              }}
            >
              {restNotes.map((note) => (
                <SortableNoteCard
                  key={note.id}
                  note={note}
                  language={language}
                  selectedTags={selectedTags}
                  onOpenEdit={() =>
                    setEditingNote({ ...note, tags: note.tags || [] })
                  }
                  onToggleStar={() =>
                    handleToggleStar(note.id, Boolean(note.starred))
                  }
                  onToggleTagFilter={toggleTagFilter}
                  onDuplicate={() => handleDuplicate(note.id)}
                  onArchive={() => handleArchive(note.id)}
                  onDelete={() => handleDelete(note.id)}
                />
              ))}
            </motion.div>
          </SortableContext>

          {/* DRAG OVERLAY — floats a clone under the cursor while
              the original stays in the grid (faded). Sidesteps the
              fight between dnd-kit's transform and Framer Motion's
              variants/layout on the in-place card. dropAnimation is
              disabled so the overlay vanishes the moment we finish
              the optimistic patch (otherwise it flies back to the
              start position before the new slot takes over). */}
          <DragOverlay dropAnimation={null}>
            {activeDragId != null
              ? (() => {
                  const activeNote = optimisticNotes.find(
                    (n) => n.id === activeDragId,
                  );
                  return activeNote ? (
                    <NoteCardPreview note={activeNote} language={language} />
                  ) : null;
                })()
              : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* EDIT DIALOG */}
      {editingNote && (
        <EditNoteDialog
          open={!!editingNote}
          onOpenChange={(open) => !open && setEditingNote(null)}
          note={editingNote}
          availableTags={availableTags}
        />
      )}
    </>
  );
}

// Per-card component extracted so it can consume dnd-kit's
// `useSortable` hook. Wraps the existing editorial card with the
// drag transform + a `GripVertical` handle at top-left (hover-reveal
// on desktop, always-visible on mobile to match the action cluster).
// Every behaviour except the drag handle is copied verbatim from the
// previous inline render.
function SortableNoteCard({
  note,
  language,
  selectedTags,
  onOpenEdit,
  onToggleStar,
  onToggleTagFilter,
  onDuplicate,
  onArchive,
  onDelete,
}: {
  note: GridNote;
  language: "en" | "es" | "ca";
  selectedTags: string[];
  onOpenEdit: () => void;
  onToggleStar: () => void;
  onToggleTagFilter: (tag: string) => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: note.id });

  return (
    <motion.div
      ref={setNodeRef}
      // Variants intentionally kept to opacity only. If `y` appears
      // here, Motion binds a motion value to translateY and keeps
      // rewriting the element's transform on every render, which
      // erases the shift transform dnd-kit assigns to neighbours
      // while a sibling is being dragged. That's what was making
      // the reorder feel like a swap instead of an insert. The
      // parent's staggerChildren still produces a nice cascading
      // fade-in on mount without touching transform.
      variants={{
        hidden: { opacity: 0 },
        show: { opacity: 1 },
      }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      style={{
        // When this specific card is the one being dragged, the
        // DragOverlay portal handles its visual position; the
        // in-place node just acts as a persistent drop-target
        // placeholder in the grid. Skip dnd-kit's translate so the
        // placeholder doesn't also float with the cursor.
        transform: isDragging ? undefined : CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 0,
      }}
    >
            {isDragging ? (
              // Drop-zone preview: primary-tinted dashed outline at
              // the slot the dragged card will fall back into if the
              // drag is cancelled, and the pivot around which
              // dnd-kit's neighbour shifts are computed. Matches the
              // Card's 340 px height so the grid layout doesn't
              // shuffle as the card goes airborne.
              <div className="h-[340px] rounded-lg border-2 border-dashed border-primary/60 bg-primary/5" />
            ) : (
            <Card
              className={cn(
                // Fixed height so every card is the same size across
                // rows. Long content clips via mask-gradient-b on the
                // body; short notes just pad out the space. Keeps
                // the grid scan-friendly at the cost of some density.
                "group relative flex flex-col h-[340px] overflow-hidden border-border/60 bg-card transition-colors duration-200 hover:border-primary/40 hover:shadow-md cursor-pointer",
                // Starred cards get a solid amber-tinted background
                // (color-mix blends primary into card so we don't get
                // a transparent bg that lets the animated background
                // bleed through). Border echoes the accent.
                note.starred &&
                  "border-primary/40 bg-[color-mix(in_oklch,var(--primary)_7%,var(--card))]",
              )}
              onClick={onOpenEdit}
              role="button"
              tabIndex={0}
              aria-label={`Edit note from ${new Date(note.created_at).toLocaleDateString()}`}
            >
              {/* DRAG HANDLE — top-left. Only this element receives
                  dnd-kit's listeners so the card body stays freely
                  clickable. activationConstraint: distance 6 on the
                  pointer sensor means a normal click never starts a
                  drag. Keyboard users focus the handle and press
                  Space to pick up, arrows to move, Space to drop,
                  Escape to cancel. */}
              <button
                type="button"
                {...attributes}
                {...listeners}
                onClick={(e) => e.stopPropagation()}
                aria-label="Drag to reorder"
                title="Drag to reorder"
                className="absolute top-2 left-2 h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground cursor-grab active:cursor-grabbing opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:bg-muted/40 z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <GripVertical className="h-3.5 w-3.5" />
              </button>

              {/* ACTION CLUSTER — top-right. On desktop hover reveals
                  the cluster; on mobile (no hover) the icons stay
                  visible so every action is reachable via tap. Star
                  sits LAST in the row so when the others are hidden
                  on desktop its own visible icon still anchors to
                  the card's top-right corner. */}
              <div
                className="absolute top-2 right-2 flex gap-0.5 z-10"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                  onClick={onDuplicate}
                  aria-label="Duplicate note"
                  title="Duplicate"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                  onClick={onArchive}
                  aria-label="Archive note"
                  title="Archive"
                >
                  <Archive className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  onClick={onDelete}
                  aria-label="Delete note"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-7 w-7 transition-opacity",
                    note.starred
                      ? "opacity-100 text-amber-500 hover:text-amber-500"
                      : "opacity-100 md:opacity-0 md:group-hover:opacity-100 text-muted-foreground hover:text-amber-500",
                  )}
                  onClick={onToggleStar}
                  aria-label={note.starred ? "Unstar note" : "Star note"}
                  aria-pressed={Boolean(note.starred)}
                  title={note.starred ? "Unstar" : "Star"}
                >
                  <Star
                    className={cn(
                      "h-3.5 w-3.5",
                      note.starred && "fill-amber-500",
                    )}
                  />
                </Button>
              </div>

              {/* Card Content — editorial body. Task-list checkboxes
                  are the only interactive target here (see
                  NoteMarkdown); clicks on plain text propagate up to
                  the card and open the edit modal. */}
              <CardContent className="flex-1 min-h-0 p-5 pb-2 overflow-hidden mask-gradient-b">
                <div className="prose prose-sm dark:prose-invert wrap-break-word text-card-foreground pointer-events-none">
                  <NoteMarkdown
                    key={note.content}
                    noteId={note.id}
                    content={note.content}
                    tags={note.tags || []}
                  />
                </div>
              </CardContent>

              {/* TAGS — click toggles a filter on that tag. */}
              {note.tags && note.tags.length > 0 && (
                <div
                  className="px-5 pb-2 flex flex-wrap gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  {note.tags.map((tag) => {
                    const active = selectedTags.includes(tag);
                    return (
                      <Badge
                        key={tag}
                        asChild
                        variant="outline"
                        className={cn(
                          "text-[10px] px-1.5 py-0 uppercase tracking-wider font-mono cursor-pointer transition-colors",
                          active
                            ? "border-primary/60 text-primary bg-primary/10"
                            : "border-border/60 text-muted-foreground bg-muted/30 hover:border-primary/40 hover:text-primary",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => onToggleTagFilter(tag)}
                          aria-pressed={active}
                          aria-label={
                            active
                              ? `Remove ${tag} from filter`
                              : `Filter by ${tag}`
                          }
                        >
                          {tag}
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}

              {/* FOOTER — proceedings-style timestamp. */}
              <CardFooter className="border-t border-border/60 bg-muted/20 px-5 py-2.5 mt-2">
                <span
                  className="text-[10px] text-muted-foreground font-mono"
                  title={new Date(note.created_at).toLocaleString(language)}
                >
                  {formatRelative(note.created_at, language)}
                </span>
              </CardFooter>
            </Card>
            )}
    </motion.div>
  );
}

// Visual-only clone of a note card for the DragOverlay portal. No
// drag listeners, no action buttons, no click handlers — it's purely
// there to float under the cursor while the original card fades in
// place. Ring + shadow accent read as "lifted" at a glance.
function NoteCardPreview({
  note,
  language,
}: {
  note: GridNote;
  language: "en" | "es" | "ca";
}) {
  return (
    <Card
      className={cn(
        "flex flex-col h-[340px] overflow-hidden border-border/60 bg-card shadow-2xl ring-2 ring-primary/40 cursor-grabbing",
        note.starred &&
          "border-primary/40 bg-[color-mix(in_oklch,var(--primary)_7%,var(--card))]",
      )}
    >
      <CardContent className="flex-1 min-h-0 p-5 pb-2 overflow-hidden mask-gradient-b">
        <div className="prose prose-sm dark:prose-invert wrap-break-word text-card-foreground pointer-events-none">
          <NoteMarkdown
            noteId={note.id}
            content={note.content}
            tags={note.tags || []}
          />
        </div>
      </CardContent>
      {note.tags && note.tags.length > 0 && (
        <div className="px-5 pb-2 flex flex-wrap gap-1">
          {note.tags.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="text-[10px] px-1.5 py-0 uppercase tracking-wider font-mono border-border/60 text-muted-foreground bg-muted/30"
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}
      <CardFooter className="border-t border-border/60 bg-muted/20 px-5 py-2.5 mt-2">
        <span
          className="text-[10px] text-muted-foreground font-mono"
          title={new Date(note.created_at).toLocaleString(language)}
        >
          {formatRelative(note.created_at, language)}
        </span>
      </CardFooter>
    </Card>
  );
}

// Illustrated empty state — only rendered when the user has truly
// zero notes (not when a filter pared them down). The SVG is inline
// so we don't ship a separate asset round-trip. Strokes use currentColor
// so the mark follows the foreground theme.
function EmptyNotesState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <svg
        width="120"
        height="120"
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-muted-foreground/40"
        aria-hidden
      >
        <rect
          x="22"
          y="16"
          width="56"
          height="72"
          rx="6"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
        <rect
          x="34"
          y="26"
          width="60"
          height="72"
          rx="6"
          stroke="currentColor"
          strokeWidth="2"
          fill="currentColor"
          fillOpacity="0.06"
        />
        <line
          x1="44"
          y1="44"
          x2="82"
          y2="44"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.5"
        />
        <line
          x1="44"
          y1="56"
          x2="74"
          y2="56"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.4"
        />
        <line
          x1="44"
          y1="68"
          x2="78"
          y2="68"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.3"
        />
        <line
          x1="44"
          y1="80"
          x2="64"
          y2="80"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.2"
        />
      </svg>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          Your second brain is empty.
        </p>
        <p className="text-xs text-muted-foreground">
          Write your first note above — press{" "}
          <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
            N
          </kbd>{" "}
          to focus the compose box.
        </p>
      </div>
    </div>
  );
}
