"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, History, Send, Bot } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

export function ChatSidebar({ userId }: { userId: string }) {
  // Ja no necessitem isOpen, sempre està obert
  const [chatId, setChatId] = useState<string | null>(null);
  const [chatList, setChatList] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [isMounted, setIsMounted] = useState(false);

  const supabase = createClient();

  const { messages, status, sendMessage, setMessages } = useChat({
    onFinish: () => {
      // Opcional: Refrescar llista si és el primer missatge
      if (!chatId) fetchChats();
    },
  });

  const isLoading = status === "submitted" || status === "streaming";

  const fetchChats = async () => {
    // Doble verificació de seguretat
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      console.log("Encara no hi ha sessió, esperant...");
      return;
    }

    console.log("🔄 Carregant xats amb token...");
    const { data, error } = await supabase
      .from("chats")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) console.error("Error fetch chats:", error);
    if (data) setChatList(data);
  };

  // Esperem a muntar i comprovem sessió
  useEffect(() => {
    setIsMounted(true);
    fetchChats();
  }, []);

  // Evitem renderitzar res complex fins que el client estigui llest
  if (!isMounted) return null;

  const loadChat = async (id: string) => {
    setChatId(id);
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", id)
      .order("created_at", { ascending: true });

    if (data) {
      const uiMessages = data.map((m: any) => ({
        id: m.id,
        role: m.role,
        parts: [{ type: "text", text: m.content }],
      }));
      setMessages(uiMessages as any);
    }
  };

  const createNewChat = async () => {
    // 1. Creem entrada a la BD
    const { data, error } = await supabase
      .from("chats")
      .insert({
        user_id: userId,
        title: "Nova Conversa",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creant xat a Supabase:", error);
      toast.error("Error creant la conversa");
      return null;
    }

    console.log("Xat creat amb ID:", data.id);

    // 2. Actualitzem l'estat local
    setMessages([]);
    setInput("");
    setChatId(data.id);
    setChatList([data, ...chatList]);

    return data.id;
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;

    let currentChatId = chatId;

    // Si no tenim ID, intentem crear el xat primer
    if (!currentChatId) {
      currentChatId = await createNewChat();
      if (!currentChatId) return; // Si falla, parem
    }

    const content = input;
    setInput("");

    // Passem el chatId al BODY perquè el backend el rebi
    console.log("Enviant missatge al backend pel xat:", currentChatId);

    await sendMessage(
      {
        role: "user",
        parts: [{ type: "text", text: content }],
      },
      {
        body: { chatId: currentChatId },
      }
    );
  };

  return (
    // CONTENIDOR PRINCIPAL (ASIDE)
    // Amplada fixa de 400px (o w-1/3), alçada completa, vora dreta
    <aside className="w-[400px] flex flex-col border-r bg-background/50 backdrop-blur-xl h-full shadow-xl z-20">
      {/* HEADER DEL XAT */}
      <div className="p-4 border-b flex items-center justify-between bg-background/80">
        <div className="flex items-center gap-2 font-semibold text-primary">
          <Bot className="h-5 w-5" />
          Synapse AI
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={createNewChat}
          className="h-8"
        >
          <Plus className="mr-2 h-3 w-3" /> Nou
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* HISTORIAL (Barra estreta) */}
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

        {/* ZONA DE MISSATGES */}
        <div className="flex-1 flex flex-col h-full bg-background/50">
          <ScrollArea className="flex-1 p-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-60">
                <Bot className="h-10 w-10 mb-3 text-muted-foreground/50" />
                <p className="text-sm font-medium">Sóc el teu segon cervell.</p>
                <p className="text-xs text-muted-foreground">
                  Pregunta sobre les teves notes.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-6 pb-4">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "flex w-full",
                      m.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[90%] rounded-2xl p-3 text-sm shadow-sm",
                        m.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-none"
                          : "bg-white dark:bg-muted border rounded-tl-none"
                      )}
                    >
                      <div className="prose prose-sm dark:prose-invert wrap-break-word leading-relaxed">
                        {m.parts ? (
                          m.parts.map(
                            (p, i) =>
                              p.type === "text" && (
                                <ReactMarkdown
                                  key={i}
                                  remarkPlugins={[remarkGfm]}
                                >
                                  {p.text}
                                </ReactMarkdown>
                              )
                          )
                        ) : (
                          <span>No content</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-2xl rounded-tl-none p-3 text-xs animate-pulse">
                      Pensant...
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* INPUT AREA */}
          <div className="p-3 border-t bg-background/80 backdrop-blur-sm">
            <form onSubmit={handleSend} className="relative flex items-center">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pregunta alguna cosa..."
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
  );
}
