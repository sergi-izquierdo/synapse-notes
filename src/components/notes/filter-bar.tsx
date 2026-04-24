"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TagSelector } from "@/components/ui/tag-selector";
import { useLanguage } from "@/components/language-provider";
import { TagManagerDialog } from "./tag-manager-dialog";

interface FilterBarProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  selectedTags: string[];
  setSelectedTags: (tags: string[]) => void;
  availableTags: string[];
  tagCounts: Record<string, number>;
}

// Search + multi-tag filter. Tag selection is AND — a note must carry
// every selected tag to match. Each active tag appears as a removable
// chip to the left of the selector so the filter state is always
// scannable. Uses the shared TagSelector in filter-mode (no "Create
// ..." row) and sorts the list by frequency.
export function FilterBar({
  searchTerm,
  setSearchTerm,
  selectedTags,
  setSelectedTags,
  availableTags,
  tagCounts,
}: FilterBarProps) {
  const { t } = useLanguage();

  const hasActiveFilters = searchTerm || selectedTags.length > 0;

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedTags([]);
  };

  const removeTag = (tag: string) => {
    setSelectedTags(selectedTags.filter((t) => t !== tag));
  };

  return (
    <div className="mb-6 flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {/* Search Input */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-search-shortcut=""
            placeholder={t.common.search_placeholder}
            className="pl-9 bg-background/50 backdrop-blur-sm border-muted-foreground/20"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Multi-tag selector. Empty state reads "Filter by tags". */}
        <div className="flex w-full sm:w-auto items-center gap-1">
          <div className="w-full sm:w-[240px]">
            <TagSelector
              selectedTags={selectedTags}
              setSelectedTags={setSelectedTags}
              availableTags={availableTags}
              tagCounts={tagCounts}
              allowCreate={false}
              placeholder={t.common.filter_by_tag || "Filter by tags..."}
              triggerClassName="bg-background/50 backdrop-blur-sm"
            />
          </div>
          <TagManagerDialog
            availableTags={availableTags}
            tagCounts={tagCounts}
          />
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="h-4 w-4 mr-2" />
            {t.common.clear_filters}
          </Button>
        )}
      </div>

      {/* Active-tag chips. One-click removal. Kept on a separate row so
          the selector trigger stays a consistent height regardless of
          how many tags are selected. */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="gap-1 pr-1 font-mono text-[10px] uppercase tracking-wider"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                aria-label={`Remove ${tag} filter`}
                className="ml-0.5 rounded-sm hover:bg-muted-foreground/20 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
