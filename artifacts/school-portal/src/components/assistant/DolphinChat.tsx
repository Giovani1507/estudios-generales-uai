import { useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { UAIThinkingDots } from "./DolphinCharacter";

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
  onSendText: (text: string) => void;
}

const SUGGESTIONS = [
  { icon: "👥", label: "¿Cuántos docentes hay en FCS?" },
  { icon: "🏫", label: "¿Qué sedes tiene FCS?" },
  { icon: "📚", label: "¿Cuántos docentes hay en FICA?" },
  { icon: "🎓", label: "¿Qué carreras tiene FICA?" },
  { icon: "🌙", label: "¿Cuántas sesiones nocturnas hay en FICA?" },
  { icon: "👤", label: "¿Cuántos usuarios tiene el sistema?" },
];

export function DolphinChat({
  messages,
  inputValue,
  isLoading,
  onInputChange,
  onSend,
  onSendText,
}: DolphinChatProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && inputValue.trim()) onSend();
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {/* ── Messages / Welcome area ── */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 12px 8px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          scrollBehavior: "smooth",
        }}
      >
        {/* Welcome state with suggestions */}
        {isEmpty && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Greeting text */}
            <div
              style={{
                textAlign: "center",
                padding: "8px 16px",
                background: "linear-gradient(135deg, rgba(76,159,255,0.08) 0%, rgba(47,90,166,0.04) 100%)",
                borderRadius: 14,
                border: "1px solid rgba(76,159,255,0.15)",
              }}
            >
              <p style={{ fontSize: 13, fontWeight: 700, color: "#1e4a9b", marginBottom: 4 }}>
                ¡Hola! Soy UAIDELFIN 👋
              </p>
              <p style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.5 }}>
                Tu asistente IA del Portal UAI. Tengo acceso a datos reales del sistema — prueba una de estas preguntas:
              </p>
            </div>

            {/* Suggestion chips */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  disabled={isLoading}
                  onClick={() => onSendText(s.label)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    background: "white",
                    border: "1.5px solid rgba(47,90,166,0.15)",
                    borderRadius: 12,
                    cursor: "pointer",
                    textAlign: "left",
                    fontSize: 11.5,
                    color: "#374151",
                    transition: "all 0.15s ease",
                    boxShadow: "0 1px 3px rgba(47,90,166,0.06)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(47,90,166,0.04)";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(47,90,166,0.35)";
                    (e.currentTarget as HTMLElement).style.color = "#1e4a9b";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "white";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(47,90,166,0.15)";
                    (e.currentTarget as HTMLElement).style.color = "#374151";
                  }}
                >
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{s.icon}</span>
                  <span style={{ lineHeight: 1.4 }}>{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message bubbles */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: "flex",
              gap: 8,
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            {msg.role === "assistant" && (
              <div
                style={{
                  width: 28, height: 28,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #1e4a9b 0%, #4C9FFF 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, marginTop: 2, overflow: "hidden",
                }}
              >
                <img
                  src={`${import.meta.env.BASE_URL}dolphin-assistant.png`}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
                />
              </div>
            )}
            <div
              style={{
                maxWidth: "78%",
                borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                padding: "9px 12px",
                fontSize: 12.5,
                lineHeight: 1.55,
                boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
                ...(msg.role === "user"
                  ? {
                      background: "linear-gradient(135deg, #2f5aa6 0%, #1e4a9b 100%)",
                      color: "white",
                    }
                  : {
                      background: "white",
                      color: "#1a1a2e",
                      border: "1px solid rgba(47,90,166,0.10)",
                    }),
              }}
            >
              <p style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{msg.content}</p>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 10,
                  textAlign: "right",
                  opacity: 0.55,
                }}
              >
                {msg.timestamp.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}

        {/* Thinking indicator */}
        {isLoading && (
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-start" }}>
            <div
              style={{
                width: 28, height: 28,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #1e4a9b 0%, #4C9FFF 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, marginTop: 2, overflow: "hidden",
              }}
            >
              <img
                src={`${import.meta.env.BASE_URL}dolphin-assistant.png`}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
              />
            </div>
            <div
              style={{
                background: "white",
                border: "1px solid rgba(47,90,166,0.10)",
                borderRadius: "18px 18px 18px 4px",
                padding: "9px 12px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
              }}
            >
              <UAIThinkingDots />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input area ── */}
      <div
        style={{
          borderTop: "1px solid rgba(47,90,166,0.10)",
          padding: "10px 12px 12px",
          background: "rgba(248,250,255,0.8)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-end",
            background: "white",
            borderRadius: 14,
            border: "1.5px solid rgba(47,90,166,0.18)",
            padding: "8px 8px 8px 12px",
            boxShadow: "0 2px 8px rgba(47,90,166,0.07)",
          }}
        >
          <textarea
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu pregunta a UAIDELFIN…"
            rows={1}
            disabled={isLoading}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: 12.5,
              resize: "none",
              color: "#1a1a2e",
              lineHeight: 1.5,
              maxHeight: 88,
              fontFamily: "inherit",
            }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 88) + "px";
            }}
          />
          <button
            onClick={onSend}
            disabled={isLoading || !inputValue.trim()}
            style={{
              width: 34, height: 34,
              borderRadius: 10,
              background: isLoading || !inputValue.trim()
                ? "rgba(47,90,166,0.15)"
                : "linear-gradient(135deg, #2f5aa6 0%, #1e4a9b 100%)",
              border: "none",
              cursor: isLoading || !inputValue.trim() ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
              transition: "all 0.2s ease",
              boxShadow: isLoading || !inputValue.trim() ? "none" : "0 3px 10px rgba(47,90,166,0.35)",
            }}
          >
            <Send
              size={14}
              color={isLoading || !inputValue.trim() ? "rgba(47,90,166,0.4)" : "white"}
            />
          </button>
        </div>
        <p style={{ fontSize: 10, color: "#9ca3af", textAlign: "center", marginTop: 6, margin: "6px 0 0" }}>
          Solo respondo con datos reales del sistema UAI
        </p>
      </div>
    </div>
  );
}
