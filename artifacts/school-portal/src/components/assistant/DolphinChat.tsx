import { useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { ThinkingDots } from "./DolphinCharacter";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface DolphinChatProps {
  messages: ChatMessage[];
  inputValue: string;
  isLoading: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
}

export function DolphinChat({
  messages,
  inputValue,
  isLoading,
  onInputChange,
  onSend,
}: DolphinChatProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && inputValue.trim()) onSend();
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scroll-smooth">
        {messages.length === 0 && (
          <div className="text-center text-xs text-muted-foreground pt-4 px-4 leading-relaxed">
            <p className="font-semibold text-primary mb-1">¡Hola! Soy Ichi 👋</p>
            <p>Tu asistente del Portal Académico UAI. Puedo responder preguntas sobre docentes, planificación FCS, FICA y más.</p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5 overflow-hidden">
                <img
                  src={`${import.meta.env.BASE_URL}dolphin-assistant.png`}
                  alt=""
                  className="w-full h-full object-cover object-top"
                />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm ${
                msg.role === "user"
                  ? "bg-primary text-white rounded-tr-sm"
                  : "bg-white text-foreground rounded-tl-sm border border-border/40"
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
              <p
                className={`text-[10px] mt-1 text-right ${
                  msg.role === "user" ? "text-white/60" : "text-muted-foreground"
                }`}
              >
                {msg.timestamp.toLocaleTimeString("es-PE", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}

        {/* Thinking indicator */}
        {isLoading && (
          <div className="flex gap-2 justify-start">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5 overflow-hidden">
              <img
                src={`${import.meta.env.BASE_URL}dolphin-assistant.png`}
                alt=""
                className="w-full h-full object-cover object-top"
              />
            </div>
            <div className="bg-white border border-border/40 rounded-2xl rounded-tl-sm px-3 py-2 shadow-sm">
              <ThinkingDots />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-border/40 px-3 py-2.5 bg-white/80 backdrop-blur-sm">
        <div className="flex gap-2 items-end bg-muted/50 rounded-xl border border-border/40 px-3 py-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu pregunta…"
            rows={1}
            disabled={isLoading}
            className="flex-1 bg-transparent text-sm resize-none outline-none text-foreground placeholder:text-muted-foreground disabled:opacity-50 max-h-24 leading-relaxed"
            style={{ height: "auto" }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 96) + "px";
            }}
          />
          <button
            onClick={onSend}
            disabled={isLoading || !inputValue.trim()}
            className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center shrink-0 hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-1.5">
          Solo respondo con datos reales del sistema
        </p>
      </div>
    </div>
  );
}
