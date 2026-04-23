// Source: 21st.dev — Animated AI Input (chat-style composer)
// Dependencies: motion, lucide-react, @radix-ui/react-slot,
//   class-variance-authority, @radix-ui/react-dropdown-menu
// Companion: shadcn/{textarea, button, dropdown-menu} (already installed)
// Conflict with anti-patterns: none critical — uses neutral blacks/whites with
// a blue focus ring (easily swapped to Midnight Cartography parchment-gold).
// Model icons hard-code OpenAI/Gemini/Anthropic marks, also swappable.
//
// ✅ STRONG CANDIDATE. This is the most directly applicable of the six. Use
// cases at Synapse Notes:
//   - Replacement for the current "Ask something..." composer in the chat
//     panel (UI-3). Brings auto-resize, attachment handle, and model picker
//     in a single polished component.
//   - The DropdownMenu model picker could swap Haiku 4.5 variants, or — more
//     ambitious — become the surface where the user picks which MCP tools
//     the agent is allowed to call (UI-4 wiring).
// Adoption cost: ~1 hour to wire into the existing useChat hook, retune
// colours to MC tokens, and swap model labels to Haiku variants only.

"use client";

import { ArrowRight, Bot, Check, ChevronDown, Paperclip } from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";

interface UseAutoResizeTextareaProps {
    minHeight: number;
    maxHeight?: number;
}

function useAutoResizeTextarea({
    minHeight,
    maxHeight,
}: UseAutoResizeTextareaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const adjustHeight = useCallback(
        (reset?: boolean) => {
            const textarea = textareaRef.current;
            if (!textarea) return;

            if (reset) {
                textarea.style.height = `${minHeight}px`;
                return;
            }

            textarea.style.height = `${minHeight}px`;

            const newHeight = Math.max(
                minHeight,
                Math.min(
                    textarea.scrollHeight,
                    maxHeight ?? Number.POSITIVE_INFINITY,
                ),
            );

            textarea.style.height = `${newHeight}px`;
        },
        [minHeight, maxHeight],
    );

    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = `${minHeight}px`;
        }
    }, [minHeight]);

    useEffect(() => {
        const handleResize = () => adjustHeight();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [adjustHeight]);

    return { textareaRef, adjustHeight };
}

// See the full component on 21st.dev for the branded OpenAI/Gemini/Anthropic
// SVG icons inline. At Synapse we would swap the model list for
//   ["Claude Haiku 4.5", "Claude Sonnet 4.6"]
// and drop the other vendors.

export function AI_Prompt() {
    const [value, setValue] = useState("");
    const { textareaRef, adjustHeight } = useAutoResizeTextarea({
        minHeight: 72,
        maxHeight: 300,
    });
    const [selectedModel, setSelectedModel] = useState("Claude Haiku 4.5");

    const AI_MODELS = ["Claude Haiku 4.5", "Claude Sonnet 4.6"];

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey && value.trim()) {
            e.preventDefault();
            setValue("");
            adjustHeight(true);
            // Hook into the existing useChat onSubmit when integrated.
        }
    };

    return (
        <div className="w-4/6 py-4">
            <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-1.5">
                <div className="relative">
                    <div className="relative flex flex-col">
                        <div className="overflow-y-auto" style={{ maxHeight: "400px" }}>
                            <Textarea
                                id="ai-input-15"
                                value={value}
                                placeholder={"What can I do for you?"}
                                className={cn(
                                    "w-full rounded-xl rounded-b-none px-4 py-3 bg-black/5 dark:bg-white/5 border-none dark:text-white placeholder:text-black/70 dark:placeholder:text-white/70 resize-none focus-visible:ring-0 focus-visible:ring-offset-0",
                                    "min-h-[72px]",
                                )}
                                ref={textareaRef}
                                onKeyDown={handleKeyDown}
                                onChange={(e) => {
                                    setValue(e.target.value);
                                    adjustHeight();
                                }}
                            />
                        </div>

                        <div className="h-14 bg-black/5 dark:bg-white/5 rounded-b-xl flex items-center">
                            <div className="absolute left-3 right-3 bottom-3 flex items-center justify-between w-[calc(100%-24px)]">
                                <div className="flex items-center gap-2">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                className="flex items-center gap-1 h-8 pl-1 pr-2 text-xs rounded-md dark:text-white hover:bg-black/10 dark:hover:bg-white/10 focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:ring-blue-500"
                                            >
                                                <AnimatePresence mode="wait">
                                                    <motion.div
                                                        key={selectedModel}
                                                        initial={{ opacity: 0, y: -5 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: 5 }}
                                                        transition={{ duration: 0.15 }}
                                                        className="flex items-center gap-1"
                                                    >
                                                        <Bot className="w-4 h-4 opacity-50" />
                                                        {selectedModel}
                                                        <ChevronDown className="w-3 h-3 opacity-50" />
                                                    </motion.div>
                                                </AnimatePresence>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent
                                            className={cn(
                                                "min-w-[10rem]",
                                                "border-black/10 dark:border-white/10",
                                                "bg-gradient-to-b from-white via-white to-neutral-100 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-800",
                                            )}
                                        >
                                            {AI_MODELS.map((model) => (
                                                <DropdownMenuItem
                                                    key={model}
                                                    onSelect={() => setSelectedModel(model)}
                                                    className="flex items-center justify-between gap-2"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <Bot className="w-4 h-4 opacity-50" />
                                                        <span>{model}</span>
                                                    </div>
                                                    {selectedModel === model && (
                                                        <Check className="w-4 h-4 text-blue-500" />
                                                    )}
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    <div className="h-4 w-px bg-black/10 dark:bg-white/10 mx-0.5" />
                                    <label
                                        className={cn(
                                            "rounded-lg p-2 bg-black/5 dark:bg-white/5 cursor-pointer",
                                            "hover:bg-black/10 dark:hover:bg-white/10 focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:ring-blue-500",
                                            "text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white",
                                        )}
                                        aria-label="Attach file"
                                    >
                                        <input type="file" className="hidden" />
                                        <Paperclip className="w-4 h-4 transition-colors" />
                                    </label>
                                </div>
                                <button
                                    type="button"
                                    className={cn(
                                        "rounded-lg p-2 bg-black/5 dark:bg-white/5",
                                        "hover:bg-black/10 dark:hover:bg-white/10 focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:ring-blue-500",
                                    )}
                                    aria-label="Send message"
                                    disabled={!value.trim()}
                                    onClick={() => {
                                        if (!value.trim()) return;
                                        setValue("");
                                        adjustHeight(true);
                                    }}
                                >
                                    <ArrowRight
                                        className={cn(
                                            "w-4 h-4 dark:text-white transition-opacity duration-200",
                                            value.trim() ? "opacity-100" : "opacity-30",
                                        )}
                                    />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
