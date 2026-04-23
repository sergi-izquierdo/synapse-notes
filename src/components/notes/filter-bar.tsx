"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/components/language-provider";

interface FilterBarProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  selectedTag: string | null; // Right now we filter by 1 tag at a time in the grid for simplicity
  setSelectedTag: (tag: string | null) => void;
  availableTags: string[];
}

export function FilterBar({
  searchTerm,
  setSearchTerm,
  selectedTag,
  setSelectedTag,
  availableTags,
}: FilterBarProps) {
  const { t } = useLanguage();

  const hasActiveFilters = searchTerm || selectedTag;

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedTag(null);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6 items-center">
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

      {/* Tag Filter Dropdown */}
      <Select
        value={selectedTag || "all"}
        onValueChange={(val) => setSelectedTag(val === "all" ? null : val)}
      >
        <SelectTrigger className="w-full sm:w-[180px] bg-background/50">
          <SelectValue placeholder={t.common.filter_by_tag} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Tags</SelectItem>
          {availableTags.map((tag) => (
            <SelectItem key={tag} value={tag}>
              #{tag}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear Button */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4 mr-2" />
          {t.common.clear_filters}
        </Button>
      )}
    </div>
  );
}
