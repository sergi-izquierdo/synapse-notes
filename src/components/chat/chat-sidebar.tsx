'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Plus, Send, Bot, Loader2, MessageCircle } from 'lucide-react'
import { useChat } from '@ai-sdk/react'
import type { UIMessage } from 'ai'
import { isToolUIPart, getToolName } from 'ai'
import ReactMarkdown from 'react-markdown'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import * as VisuallyHidden from '@radix-ui/react-visually-hidden'
import remarkGfm from 'remark-gfm'
import { toast } from 'sonner'
import type { Chat, Message } from '@/types/database'

export function ChatSidebar({ userId }: { userId: string }) {
    const [chatId, setChatId] = useState<string | null>(null)
    const [chatList, setChatList] = useState<Chat[]>([])
    const [input, setInput] = useState('')
    const [isMounted, setIsMounted] = useState(false)
    const [sheetOpen, setSheetOpen] = useState(false)

    const supabase = createClient()

    const { messages, status, sendMessage, setMessages } = useChat({
        onFinish: () => {
            // Re-fetch chats to pick up auto-generated titles
            fetchChats()
            // Title generation is async on the server, so re-fetch after a delay
            setTimeout(() => fetchChats(), 3000)
        },
        onError: (error) => {
            console.error("❌ Error al xat:", error)
            toast.error("Error al xat")
        }
    })

    const isLoading = status === 'submitted' || status === 'streaming'

    const fetchChats = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const { data, error } = await supabase.from('chats').select('*').order('created_at', { ascending: false })
        if (data) setChatList(data)
    }

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration guard
        setIsMounted(true)
        fetchChats()
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
                <div
                    className="w-48 border-r border-border/60 bg-muted/20 flex flex-col py-2 px-1 gap-0.5 overflow-y-auto hide-scrollbar"
                    role="list"
                    aria-label="Chat history"
                >
                    {chatList.map((chat, index) => {
                        const hasRealTitle = chat.title && chat.title !== 'Nova Conversa';
                        const displayTitle = hasRealTitle
                            ? chat.title
                            : `Untitled · ${String(chatList.length - index).padStart(2, '0')}`;
                        const isActive = chatId === chat.id;
                        return (
                            <button
                                key={chat.id}
                                role="listitem"
                                aria-current={isActive ? 'page' : undefined}
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
                            </button>
                        );
                    })}
                </div>

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
                                {messages.map((m) => (
                                    <div key={m.id} className={cn(
                                        "flex w-full",
                                        m.role === 'user' ? "justify-end" : "justify-start"
                                    )}>
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
                                                {m.parts ? (
                                                    m.parts.map((part, index) => {
                                                        // CASE 1: TEXT
                                                        if (part.type === 'text') {
                                                            return (
                                                                <ReactMarkdown key={index} remarkPlugins={[remarkGfm]}>
                                                                    {part.text}
                                                                </ReactMarkdown>
                                                            )
                                                        }

                                                        // CASE 2: TOOL INVOCATION
                                                        if (isToolUIPart(part)) {
                                                            const toolName = getToolName(part)
                                                            const isRunning = part.state !== 'output-available'

                                                            return (
                                                                <div key={index} className="flex flex-col gap-1 my-2 text-xs text-muted-foreground bg-muted/40 p-2 rounded-md font-mono border border-border/40">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={cn(isRunning ? "animate-pulse text-primary" : "text-secondary")}>
                                                                            {isRunning ? '\u26A1' : '\u2713'}
                                                                        </span>
                                                                        <span className="font-bold">
                                                                            {toolName}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            )
                                                        }
                                                        return null
                                                    })
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                ))}
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

                    {/* INPUT */}
                    <div className="p-3 border-t border-border/60 bg-background/80 backdrop-blur-sm">
                        <form onSubmit={handleSend} className="relative flex items-center">
                            <Input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Ask something..."
                                className="pr-10 h-10 rounded-lg border-border focus-visible:ring-primary bg-background"
                                aria-label="Chat message"
                            />
                            <Button
                                type="submit"
                                size="icon"
                                disabled={isLoading}
                                aria-label="Send message"
                                className="absolute right-1 h-8 w-8 rounded-md"
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