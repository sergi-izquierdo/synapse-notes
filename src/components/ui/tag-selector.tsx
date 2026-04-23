"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/components/language-provider";

interface TagSelectorProps {
  selectedTags: string[];
  setSelectedTags: (tags: string[]) => void;
  availableTags: string[];
  /** Frequency map tag → count. When present, the list is sorted by
   *  count desc (then alpha) and each row renders the count badge. */
  tagCounts?: Record<string, number>;
  /** When false, hides the "Create ..." row — useful in a filter
   *  context where you can only select existing tags. */
  allowCreate?: boolean;
  placeholder?: string;
  triggerClassName?: string;
}

export function TagSelector({
  selectedTags,
  setSelectedTags,
  availableTags,
  tagCounts,
  allowCreate = true,
  placeholder,
  triggerClassName,
}: TagSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  const { t } = useLanguage();

  const handleSelect = (currentValue: string) => {
    if (selectedTags.includes(currentValue)) {
      setSelectedTags(selectedTags.filter((tag) => tag !== currentValue));
    } else {
      setSelectedTags([...selectedTags, currentValue]);
    }
  };

  const handleCreate = () => {
    if (inputValue && !selectedTags.includes(inputValue)) {
      setSelectedTags([...selectedTags, inputValue]);
      setInputValue("");
    }
  };

  const sortedTags = React.useMemo(() => {
    if (!tagCounts) return availableTags;
    return [...availableTags].sort((a, b) => {
      const diff = (tagCounts[b] ?? 0) - (tagCounts[a] ?? 0);
      return diff !== 0 ? diff : a.localeCompare(b);
    });
  }, [availableTags, tagCounts]);

  const filteredTags = sortedTags.filter((tag) =>
    tag.toLowerCase().includes(inputValue.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between text-muted-foreground bg-transparent border-input/50 h-auto min-h-[2.5rem] py-2",
              triggerClassName,
            )}
          >
            {selectedTags.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {selectedTags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="mr-1">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : (
              placeholder || t.common.add_tag || "Add tag..."
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          {/* 
             ⚠️ CRITICAL FIX: `shouldFilter={false}` prevents cmdk from auto-hiding items.
             We handle filtering manually with `filteredTags`.
          */}
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={t.common.search_placeholder || "Search tags..."}
              onValueChange={setInputValue}
              value={inputValue}
            />
            <CommandList>
              {/* Option to create new tag if it doesn't exist */}
              {allowCreate &&
                inputValue &&
                !availableTags.some(
                  (t) => t.toLowerCase() === inputValue.toLowerCase()
                ) && (
                  <CommandGroup>
                    <CommandItem
                      value={inputValue}
                      onSelect={handleCreate}
                      className="cursor-pointer"
                    >
                      <Plus className="mr-2 h-4 w-4" /> Create &ldquo;{inputValue}&rdquo;
                    </CommandItem>
                  </CommandGroup>
                )}

              {/* Show empty state only if no existing tags match and no input */}
              {filteredTags.length === 0 && !inputValue && (
                <CommandEmpty>No existing tags found.</CommandEmpty>
              )}

              <CommandGroup heading="Existing Tags">
                {filteredTags.map((tag) => {
                  const count = tagCounts?.[tag];
                  return (
                    <CommandItem
                      key={tag}
                      value={tag}
                      onSelect={() => handleSelect(tag)}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedTags.includes(tag)
                            ? "opacity-100"
                            : "opacity-0",
                        )}
                      />
                      <span className="flex-1">{tag}</span>
                      {count !== undefined && (
                        <span className="ml-2 font-mono text-[10px] text-muted-foreground tabular-nums">
                          {count}
                        </span>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
