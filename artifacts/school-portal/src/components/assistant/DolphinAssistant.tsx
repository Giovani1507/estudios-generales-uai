import { useState, useEffect, useCallback, useRef } from "react";
import { X, Minimize2, MessageCircle } from "lucide-react";
import { DolphinCharacter, DolphinState } from "./DolphinCharacter";
import { DolphinChat, ChatMessage } from "./DolphinChat";

const API_BASE = "";

let msgCounter = 0;
function newId() { return `msg-${++msgCounter}-${Date.now()}`; }

export function DolphinAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [dolpState, setDolpState] = useState<DolphinState>("idle");
  const [showBadge, setShowBadge] = useState(true);
  const greetingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const talkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Play greeting when opened
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setShowBadge(false);
      setDolpState("greeting");
      greetingTimerRef.current = setTimeout(() => setDolpState("idle"), 2000);
    }
    return () => {
      if (greetingTimerRef.current) clearTimeout(greetingTimerRef.current);
    };
  }, [isOpen, isMinimized]);

  // Badge pulse after 3s of being closed
  useEffect(() => {
    if (!isOpen) {
      const t = setTimeout(() => setShowBadge(true), 3000);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: newId(),
      role: "user",
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsLoading(true);
    setDolpState("thinking");

    try {
      const res = await fetch(`${API_BASE}/api/assistant/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: userMsg.content }),
      });

      const data = await res.json();
      const reply = res.ok ? data.reply : (data.error ?? "Error al procesar tu consulta.");

      const assistantMsg: ChatMessage = {
        id: newId(),
        role: "assistant",
        content: reply,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setDolpState("talking");
      talkTimerRef.current = setTimeout(() => setDolpState("idle"), 2500);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          content: "Lo siento, no pude conectarme al servidor. Intenta de nuevo.",
          timestamp: new Date(),
        },
      ]);
      setDolpState("idle");
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading]);

  const handleOpen = () => {
    setIsOpen(true);
    setIsMinimized(false);
  };

  const handleClose = () => {
    setIsOpen(false);
    setDolpState("idle");
  };

  const handleMinimize = () => {
    setIsMinimized((v) => !v);
  };

  return (
    <>
      {/* ── Floating button (closed state) ── */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className="fixed bottom-6 right-6 z-50 group"
          aria-label="Abrir asistente UAI"
        >
          <div className="relative w-16 h-16 rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden bg-white border-2 border-primary/20">
            <img
              src={`${import.meta.env.BASE_URL}dolphin-assistant.png`}
              alt="Ichi"
              className="w-full h-full object-cover object-top dolphin-idle"
              draggable={false}
            />
          </div>
          {showBadge && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold animate-bounce">
              !
            </span>
          )}
          <span className="absolute -top-10 right-0 bg-primary text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-md pointer-events-none">
            ¡Pregúntame algo!
          </span>
        </button>
      )}

      {/* ── Assistant panel (open state) ── */}
      {isOpen && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl shadow-2xl border border-border/40 overflow-hidden transition-all duration-300 origin-bottom-right ${
            isMinimized ? "w-72 h-14" : "w-80 h-[560px]"
          }`}
          style={{ background: "linear-gradient(135deg, #f0f4ff 0%, #ffffff 60%)" }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2.5 bg-primary text-white shrink-0">
            <div className="w-7 h-7 rounded-full bg-white/20 overflow-hidden shrink-0">
              <img
                src={`${import.meta.env.BASE_URL}dolphin-assistant.png`}
                alt=""
                className="w-full h-full object-cover object-top"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-none">Ichi — Asistente UAI</p>
              <p className="text-[10px] text-white/70 mt-0.5">
                {isLoading ? "Pensando…" : dolpState === "talking" ? "Respondiendo…" : "En línea"}
              </p>
            </div>
            <button
              onClick={handleMinimize}
              className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/20 transition-colors"
              title={isMinimized ? "Expandir" : "Minimizar"}
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleClose}
              className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/20 transition-colors"
              title="Cerrar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Body (hidden when minimized) */}
          {!isMinimized && (
            <>
              {/* Dolphin character */}
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <DolphinCharacter state={dolpState} size={120} />
              </div>

              {/* Status label */}
              <div className="text-center pb-2 shrink-0">
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-white/70 px-2.5 py-0.5 rounded-full border border-border/30">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isLoading ? "bg-amber-400 animate-pulse" : "bg-green-400"
                    }`}
                  />
                  {isLoading ? "Procesando consulta…" : "Listo para ayudarte"}
                </span>
              </div>

              {/* Divider */}
              <div className="h-px bg-border/30 mx-3 shrink-0" />

              {/* Chat */}
              <DolphinChat
                messages={messages}
                inputValue={inputValue}
                isLoading={isLoading}
                onInputChange={setInputValue}
                onSend={handleSend}
              />
            </>
          )}
        </div>
      )}
    </>
  );
}
