'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Plus, History, Send, Bot, Loader2 } from 'lucide-react'
import { useChat } from '@ai-sdk/react'
import type { UIMessage } from 'ai'
import { isToolUIPart, getToolName } from 'ai'
import ReactMarkdown from 'react-markdown'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import remarkGfm from 'remark-gfm'
import { toast } from 'sonner'
import type { Chat, Message } from '@/types/database'

export function ChatSidebar({ userId }: { userId: string }) {
    const [chatId, setChatId] = useState<string | null>(null)
    const [chatList, setChatList] = useState<Chat[]>([])
    const [input, setInput] = useState('')
    const [isMounted, setIsMounted] = useState(false)

    const supabase = createClient()

    const { messages, status, sendMessage, setMessages } = useChat({
        onFinish: () => {
            if (!chatId) fetchChats()
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

    return (
        <aside className="w-[400px] flex flex-col border-r bg-background/50 backdrop-blur-xl h-full shadow-xl z-20">

            {/* HEADER */}
            <div className="p-4 border-b flex items-center justify-between bg-background/80">
                <div className="flex items-center gap-2 font-semibold text-primary">
                    <Bot className="h-5 w-5" />
                    Synapse AI
                </div>
                <Button variant="outline" size="sm" onClick={createNewChat} className="h-8">
                    <Plus className="mr-2 h-3 w-3" /> Nou
                </Button>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* HISTORIAL */}
                <div className="w-14 border-r bg-muted/10 flex flex-col items-center py-4 gap-2 overflow-y-auto hide-scrollbar">
                    {chatList.map((chat) => (
                        <Button
                            key={chat.id}
                            variant={chatId === chat.id ? "default" : "ghost"}
                            size="icon"
                            className="h-9 w-9 rounded-full transition-all hover:scale-110"
                            onClick={() => loadChat(chat.id)}
                            title={new Date(chat.created_at).toLocaleDateString()}
                        >
                            <History className="h-4 w-4" />
                        </Button>
                    ))}
                </div>

                {/* ZONA XAT */}
                <div className="flex-1 flex flex-col h-full bg-background/50">
                    <ScrollArea className="flex-1 p-4">
                        {messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-60">
                                <Bot className="h-10 w-10 mb-3 text-muted-foreground/50" />
                                <p className="text-sm font-medium">I'm your second brain.</p>
                                <p className="text-xs text-muted-foreground">Ask me about your notes.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-6 pb-4">
                                {messages.map((m) => (
                                    <div key={m.id} className={cn(
                                        "flex w-full",
                                        m.role === 'user' ? "justify-end" : "justify-start"
                                    )}>
                                        <div className={cn(
                                            "max-w-[90%] rounded-2xl p-3 text-sm shadow-sm",
                                            m.role === 'user'
                                                ? "bg-primary text-primary-foreground rounded-tr-none"
                                                : "bg-white dark:bg-muted border rounded-tl-none"
                                        )}>
                                            <div className="prose prose-sm dark:prose-invert break-words leading-relaxed">
                                                {/* ✅ RENDERITZAT ROBUST DE PARTS */}
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
                                                                <div key={index} className="flex flex-col gap-1 my-2 text-xs text-muted-foreground bg-black/5 dark:bg-white/10 p-2 rounded-md font-mono border border-black/5">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={cn(isRunning ? "animate-pulse text-amber-500" : "text-green-500")}>
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
                                        <div className="bg-muted rounded-2xl rounded-tl-none p-3 text-xs flex items-center gap-2">
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            Thinking...
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </ScrollArea>

                    {/* INPUT */}
                    <div className="p-3 border-t bg-background/80 backdrop-blur-sm">
                        <form onSubmit={handleSend} className="relative flex items-center">
                            <Input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Ask something..."
                                className="pr-10 py-5 rounded-full shadow-sm border-muted-foreground/20 focus-visible:ring-primary bg-background"
                            />
                            <Button
                                type="submit"
                                size="icon"
                                disabled={isLoading}
                                className="absolute right-1 h-8 w-8 rounded-full"
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        </form>
                    </div>
                </div>
            </div>
        </aside>
    )
}