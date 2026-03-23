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
}

export function TagSelector({
  selectedTags,
  setSelectedTags,
  availableTags,
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

  // Manual filtering logic to have full control
  const filteredTags = availableTags.filter((tag) =>
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
            className="w-full justify-between text-muted-foreground bg-transparent border-input/50 h-auto min-h-[2.5rem] py-2"
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
              t.common.add_tag || "Add tag..."
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
              {inputValue &&
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
                {filteredTags.map((tag) => (
                  <CommandItem
                    key={tag}
                    value={tag}
                    onSelect={() => handleSelect(tag)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedTags.includes(tag) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {tag}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
