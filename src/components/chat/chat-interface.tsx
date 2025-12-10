"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, X, Send } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { motion, AnimatePresence } from "framer-motion";
import { useChat } from "@ai-sdk/react";
import ReactMarkdown from "react-markdown";

export function ChatInterface() {
  const [isOpen, setIsOpen] = useState(false);

  // 1. GESTIÓ MANUAL DE L'ESTAT
  const [input, setInput] = useState("");

  const { t } = useLanguage();

  // 2. HOOK useChat v5
  const { messages, status, sendMessage } = useChat();

  // 3. CALCULAR ESTAT DE CÀRREGA
  const isLoading = status === "submitted" || status === "streaming";

  // 4. FUNCIÓ DE SUBMIT MANUAL
  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;

    // Guardem el text temporalment
    const content = input;
    // Netegem l'input immediatament per UX
    setInput("");

    // Estructura estricta de la v5 (Multipart)
    sendMessage({
      role: "user",
      parts: [{ type: "text", text: content }],
    });
  };

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <Button
              size="lg"
              className="h-14 w-14 rounded-full shadow-lg"
              onClick={() => setIsOpen(true)}
            >
              <MessageCircle className="h-6 w-6" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 w-[90vw] sm:w-[400px]"
          >
            <Card className="h-[500px] flex flex-col shadow-2xl border-primary/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2 border-b">
                <CardTitle className="text-sm font-medium">
                  {t.chat.title}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>

              <CardContent className="flex-1 p-0 overflow-hidden">
                <ScrollArea className="h-full p-4">
                  <div className="flex flex-col gap-4">
                    {messages.length === 0 && (
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-muted p-3 text-sm">
                          {t.chat.welcome}
                        </div>
                      </div>
                    )}

                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={`flex ${
                          m.role === "user" ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`rounded-lg p-3 text-sm max-w-[80%] ${
                            m.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          {/* Renderitzem les parts del missatge */}
                          {m.parts.map((part, index) => {
                            if (part.type === "text") {
                              return (
                                <div
                                  key={index}
                                  className="prose prose-sm dark:prose-invert break-words"
                                >
                                  <ReactMarkdown>{part.text}</ReactMarkdown>
                                </div>
                              );
                            }
                            return null;
                          })}
                        </div>
                      </div>
                    ))}

                    {isLoading && (
                      <div className="text-xs text-muted-foreground ml-2 animate-pulse">
                        {t.chat.thinking}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>

              <CardFooter className="p-3 pt-0">
                <form
                  onSubmit={handleSend}
                  className="flex w-full items-center gap-2"
                >
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={t.chat.placeholder}
                    className="flex-1"
                  />
                  <Button type="submit" size="icon" disabled={isLoading}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </CardFooter>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
