'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Plus, Send, Bot, Loader2, MessageCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { useChat } from '@ai-sdk/react'
import type { UIMessage } from 'ai'
import { isToolUIPart, getToolName } from 'ai'
import ReactMarkdown from 'react-markdown'
import { createClient } from '@/lib/supabase/client'
import { regenerateStaleTitlesAction } from '@/actions/chats'
import { cn } from '@/lib/utils'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import * as VisuallyHidden from '@radix-ui/react-visually-hidden'
import remarkGfm from 'remark-gfm'
import { toast } from 'sonner'
import type { Chat, Message } from '@/types/database'

// Grow the chat textarea from 40px up to 160px as content fills it.
// Kept local to this file; if we need this anywhere else we can lift
// it to src/lib/hooks.
function useAutoResize(minHeight = 40, maxHeight = 160) {
    const ref = useRef<HTMLTextAreaElement>(null)
    const adjust = useCallback(
        (reset = false) => {
            const el = ref.current
            if (!el) return
            if (reset) {
                el.style.height = `${minHeight}px`
                return
            }
            el.style.height = `${minHeight}px`
            el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
        },
        [minHeight, maxHeight],
    )
    return { ref, adjust }
}

export function ChatSidebar({ userId }: { userId: string }) {
    const [chatId, setChatId] = useState<string | null>(null)
    const [chatList, setChatList] = useState<Chat[]>([])
    const [input, setInput] = useState('')
    const [isMounted, setIsMounted] = useState(false)
    const [sheetOpen, setSheetOpen] = useState(false)
    const { ref: inputRef, adjust: adjustInputHeight } = useAutoResize(40, 160)

    const supabase = createClient()

    const { messages, status, sendMessage, setMessages } = useChat({
        onFinish: () => {
            // Re-fetch chats to pick up auto-generated titles
            fetchChats()
            // Title generation is async on the server, so re-fetch after a delay
            setTimeout(() => fetchChats(), 3000)
        },
        onError: (error) => {
            console.error("Error al xat:", error)
            toast.error("Error al xat")
        }
    })

    const isLoading = status === 'submitted' || status === 'streaming'

    const fetchChats = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const { data } = await supabase.from('chats').select('*').order('created_at', { ascending: false })
        if (data) setChatList(data)
    }

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration guard
        setIsMounted(true)
        fetchChats()

        // One-time-per-session backfill for chats still titled "Nova Conversa".
        // Runs in the background and re-fetches when done so the sidebar
        // flips from fallback mono labels to real Haiku-generated titles.
        if (typeof window !== 'undefined' && !sessionStorage.getItem('synapse-titles-backfilled')) {
            sessionStorage.setItem('synapse-titles-backfilled', '1')
            regenerateStaleTitlesAction()
                .then((result) => {
                    if (result.ok && result.updated > 0) {
                        fetchChats()
                    } else if (!result.ok) {
                        // Reset so the user can retry next session.
                        sessionStorage.removeItem('synapse-titles-backfilled')
                    }
                })
                .catch((err) => {
                    console.error('[chat] title backfill threw:', err)
                    sessionStorage.removeItem('synapse-titles-backfilled')
                })
        }
    }, [])

    if (!isMounted) return null

    const loadChat = async (id: string) => {
        setChatId(id)
        const { data } = await supabase.from('messages').select('*').eq('chat_id', id).order('created_at', { ascending: true })

        if (data) {
            const uiMessages = data.map((m: Message) => ({
                id: m.id,
                role: m.role as 'user' | 'assistant',
                parts: [{ type: 'text' as const, text: m.content }]
            }))
            setMessages(uiMessages as UIMessage[])
        }
    }

    const createNewChat = async () => {
        const { data, error } = await supabase.from('chats').insert({
            user_id: userId,
            title: 'Nova Conversa'
        }).select().single()

        if (error) {
            console.error("Error DB:", error)
            return null
        }

        setMessages([])
        setInput('')
        setChatId(data.id)
        setChatList([data, ...chatList])
        return data.id
    }

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault()
        if (!input.trim()) return

        let currentChatId = chatId
        if (!currentChatId) {
            currentChatId = await createNewChat()
            if (!currentChatId) return
        }

        const content = input
        setInput('')
        adjustInputHeight(true)

        await sendMessage(
            { role: 'user', parts: [{ type: 'text', text: content }] },
            { body: { chatId: currentChatId } }
        )
    }

    const sidebarContent = (
        <>
            {/* HEADER */}
            <div className="p-4 border-b border-border/60 flex items-center justify-between bg-background/80">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                    <Bot className="h-5 w-5 text-primary" />
                    Synapse AI
                </div>
                <Button variant="outline" size="sm" onClick={createNewChat} className="h-8">
                    <Plus className="mr-2 h-3 w-3" /> Nou
                </Button>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* HISTORIAL */}
                <motion.div
                    className="w-48 border-r border-border/60 bg-muted/20 flex flex-col py-2 px-1 gap-0.5 overflow-y-auto hide-scrollbar"
                    role="list"
                    aria-label="Chat history"
                    initial="hidden"
                    animate="show"
                    variants={{
                        show: { transition: { staggerChildren: 0.03 } },
                    }}
                >
                    {chatList.map((chat, index) => {
                        const hasRealTitle = chat.title && chat.title !== 'Nova Conversa';
                        const displayTitle = hasRealTitle
                            ? chat.title
                            : `Untitled · ${String(chatList.length - index).padStart(2, '0')}`;
                        const isActive = chatId === chat.id;
                        return (
                            <motion.button
                                key={chat.id}
                                role="listitem"
                                aria-current={isActive ? 'page' : undefined}
                                variants={{
                                    hidden: { opacity: 0, y: -4 },
                                    show: { opacity: 1, y: 0 },
                                }}
                                transition={{ duration: 0.18, ease: 'easeOut' }}
                                className={cn(
                                    "flex items-center gap-2 w-full px-2.5 py-1.5 text-left text-xs rounded-md transition-colors truncate",
                                    isActive
                                        ? "bg-primary/15 text-foreground font-medium border-l-2 border-primary"
                                        : "hover:bg-muted/60 text-muted-foreground border-l-2 border-transparent",
                                    !hasRealTitle && "font-mono"
                                )}
                                onClick={() => loadChat(chat.id)}
                                title={displayTitle}
                            >
                                <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{displayTitle}</span>
                            </motion.button>
                        );
                    })}
                </motion.div>

                {/* ZONA XAT */}
                <div className="flex-1 flex flex-col h-full bg-background/50">
                    <ScrollArea className="flex-1 p-4">
                        {messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center p-6 gap-2">
                                <Bot className="h-10 w-10 text-muted-foreground/40" aria-hidden />
                                <p className="text-sm font-medium text-foreground">I&apos;m your second brain.</p>
                                <p className="text-xs text-muted-foreground">Ask me about your notes.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-5 pb-4">
                                {messages.map((m) => {
                                    const parts = m.parts ?? []
                                    const textParts = parts.filter((p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text')
                                    const toolParts = parts.filter(isToolUIPart)

                                    return (
                                        <div
                                            key={m.id}
                                            className={cn(
                                                "flex w-full",
                                                m.role === 'user' ? "justify-end" : "justify-start"
                                            )}
                                        >
                                            <div className={cn(
                                                "max-w-[90%] rounded-xl px-3.5 py-2.5 text-sm",
                                                m.role === 'user'
                                                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                                                    : "bg-card border border-border/60 rounded-tl-sm text-card-foreground"
                                            )}>
                                                <div className={cn(
                                                    "prose prose-sm dark:prose-invert break-words leading-relaxed max-w-none",
                                                    m.role === 'assistant' && "font-body"
                                                )}>
                                                    {textParts.map((part, index) => (
                                                        <ReactMarkdown key={`text-${index}`} remarkPlugins={[remarkGfm]}>
                                                            {part.text}
                                                        </ReactMarkdown>
                                                    ))}
                                                </div>

                                                {/* Editorial footnotes for tool invocations. Numbered with § so the
                                                    message reads like a short paper: body above, sources below. */}
                                                {toolParts.length > 0 && (
                                                    <aside
                                                        className={cn(
                                                            "mt-3 pt-2 border-t space-y-1 font-mono text-[10px] not-prose",
                                                            m.role === 'user'
                                                                ? "border-primary-foreground/20 text-primary-foreground/80"
                                                                : "border-border/60 text-muted-foreground"
                                                        )}
                                                        aria-label="Tool invocations"
                                                    >
                                                        {toolParts.map((part, index) => {
                                                            const toolName = getToolName(part)
                                                            const isRunning = part.state !== 'output-available'
                                                            const toolInput = 'input' in part ? (part as { input?: unknown }).input : undefined
                                                            const toolOutput = 'output' in part ? (part as { output?: unknown }).output : undefined

                                                            // Try to pretty-print the output. Most tool handlers return
                                                            // JSON strings; parse + re-stringify for readability, fall
                                                            // back to the raw string/value otherwise.
                                                            let prettyOutput: string | null = null
                                                            if (!isRunning && toolOutput !== undefined && toolOutput !== null) {
                                                                if (typeof toolOutput === 'string') {
                                                                    try {
                                                                        prettyOutput = JSON.stringify(JSON.parse(toolOutput), null, 2)
                                                                    } catch {
                                                                        prettyOutput = toolOutput
                                                                    }
                                                                } else {
                                                                    prettyOutput = JSON.stringify(toolOutput, null, 2)
                                                                }
                                                            }

                                                            const header = (
                                                                <>
                                                                    <span className={cn(
                                                                        "font-semibold tabular-nums shrink-0",
                                                                        m.role === 'user'
                                                                            ? "text-primary-foreground"
                                                                            : "text-primary",
                                                                        isRunning && "animate-pulse"
                                                                    )}>
                                                                        §{index + 1}
                                                                    </span>
                                                                    <span className="break-words">
                                                                        <span className={cn(
                                                                            m.role === 'user'
                                                                                ? "text-primary-foreground/90"
                                                                                : "text-foreground/85"
                                                                        )}>
                                                                            {toolName}
                                                                        </span>
                                                                        {toolInput ? (
                                                                            <span className="opacity-70">
                                                                                {' · '}
                                                                                {JSON.stringify(toolInput)}
                                                                            </span>
                                                                        ) : null}
                                                                        <span className={cn(
                                                                            "opacity-70",
                                                                            !isRunning && (m.role === 'user'
                                                                                ? "text-primary-foreground"
                                                                                : "text-secondary")
                                                                        )}>
                                                                            {' · '}
                                                                            {isRunning ? 'pending' : 'done'}
                                                                        </span>
                                                                        {prettyOutput !== null && (
                                                                            <span className="ml-1 opacity-60 inline-block transition-transform group-open:rotate-90">
                                                                                ▸
                                                                            </span>
                                                                        )}
                                                                    </span>
                                                                </>
                                                            )

                                                            if (prettyOutput === null) {
                                                                return (
                                                                    <div
                                                                        key={`tool-${index}`}
                                                                        className="flex items-baseline gap-1.5"
                                                                    >
                                                                        {header}
                                                                    </div>
                                                                )
                                                            }

                                                            return (
                                                                <details
                                                                    key={`tool-${index}`}
                                                                    className="group"
                                                                >
                                                                    <summary className="flex items-baseline gap-1.5 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                                                                        {header}
                                                                    </summary>
                                                                    <pre
                                                                        className={cn(
                                                                            "mt-1 ml-5 px-2 py-1.5 rounded text-[10px] whitespace-pre-wrap break-words max-h-48 overflow-auto border",
                                                                            m.role === 'user'
                                                                                ? "bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground/80"
                                                                                : "bg-muted/30 border-border/40 text-muted-foreground"
                                                                        )}
                                                                    >
                                                                        {prettyOutput}
                                                                    </pre>
                                                                </details>
                                                            )
                                                        })}
                                                    </aside>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                                {isLoading && (
                                    <div className="flex justify-start">
                                        <div className="bg-card border border-border/60 rounded-xl rounded-tl-sm px-3.5 py-2.5 text-xs flex items-center gap-2 text-muted-foreground">
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            Thinking...
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </ScrollArea>

                    {/* INPUT — auto-resizing textarea. Enter (no shift/modifier)
                        sends; Shift+Enter inserts a newline. */}
                    <div className="p-3 border-t border-border/60 bg-background/80 backdrop-blur-sm">
                        <form onSubmit={handleSend} className="relative flex items-end">
                            <Textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => {
                                    setInput(e.target.value)
                                    adjustInputHeight()
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault()
                                        handleSend()
                                    }
                                }}
                                rows={1}
                                placeholder="Ask something..."
                                className="pr-10 min-h-[40px] max-h-[160px] resize-none rounded-lg border-border focus-visible:ring-primary bg-background py-2 text-sm"
                                aria-label="Chat message"
                            />
                            <Button
                                type="submit"
                                size="icon"
                                disabled={isLoading}
                                aria-label="Send message"
                                className="absolute right-1 bottom-1 h-8 w-8 rounded-md"
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        </form>
                    </div>
                </div>
            </div>
        </>
    )

    return (
        <>
            {/* DESKTOP: visible aside at md+ */}
            <aside className="hidden md:flex w-[520px] flex-col border-r bg-background/50 backdrop-blur-xl h-full shadow-xl z-20">
                {sidebarContent}
            </aside>

            {/* MOBILE: floating button + Sheet */}
            <Button
                variant="default"
                size="icon"
                className="md:hidden fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg"
                onClick={() => setSheetOpen(true)}
            >
                <MessageCircle className="h-6 w-6" />
            </Button>

            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent side="left" className="w-[85vw] sm:max-w-[400px] p-0 flex flex-col">
                    <VisuallyHidden.Root>
                        <SheetTitle>Synapse AI Chat</SheetTitle>
                    </VisuallyHidden.Root>
                    {sidebarContent}
                </SheetContent>
            </Sheet>
        </>
    )
}
