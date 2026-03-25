import { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronDown, Sparkles } from "lucide-react";
import { UAIDelfinCharacter, UAIState } from "./DolphinCharacter";
import { DolphinChat, ChatMessage } from "./DolphinChat";

let msgCounter = 0;
function newId() { return `msg-${++msgCounter}-${Date.now()}`; }

const UAI_BLUE   = "#1e4a9b";
const UAI_MID    = "#2f5aa6";
const UAI_LIGHT  = "#4C9FFF";
const UAI_GLOW   = "rgba(76,159,255,0.22)";

export function DolphinAssistant() {
  const [isOpen, setIsOpen]             = useState(false);
  const [isMinimized, setIsMinimized]   = useState(false);
  const [messages, setMessages]         = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue]     = useState("");
  const [isLoading, setIsLoading]       = useState(false);
  const [charState, setCharState]       = useState<UAIState>("idle");
  const [attract, setAttract]           = useState(false);
  const [hovered, setHovered]           = useState(false);

  const greetTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const talkTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attractTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Periodic attract animation when closed */
  useEffect(() => {
    if (!isOpen) {
      attractTimer.current = setInterval(() => {
        setAttract(true);
        setTimeout(() => setAttract(false), 900);
      }, 8000);
    } else {
      if (attractTimer.current) clearInterval(attractTimer.current);
    }
    return () => { if (attractTimer.current) clearInterval(attractTimer.current); };
  }, [isOpen]);

  /* Greeting when opened */
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setCharState("greeting");
      greetTimer.current = setTimeout(() => setCharState("idle"), 2200);
    }
    return () => { if (greetTimer.current) clearTimeout(greetTimer.current); };
  }, [isOpen, isMinimized]);

  /* ── Send logic ── */
  const sendMessage = useCallback(async (text: string) => {
    const content = text.trim();
    if (!content || isLoading) return;

    const userMsg: ChatMessage = { id: newId(), role: "user", content, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsLoading(true);
    setCharState("thinking");

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: content }),
      });
      const data = await res.json();
      const reply = res.ok ? data.reply : (data.error ?? "Error al procesar tu consulta.");

      setMessages((prev) => [...prev, {
        id: newId(), role: "assistant", content: reply, timestamp: new Date(),
      }]);
      setCharState("talking");
      talkTimer.current = setTimeout(() => setCharState("idle"), 3000);
    } catch {
      setMessages((prev) => [...prev, {
        id: newId(), role: "assistant",
        content: "Lo siento, no pude conectarme al servidor. Intenta de nuevo.",
        timestamp: new Date(),
      }]);
      setCharState("idle");
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const handleSend = useCallback(() => sendMessage(inputValue), [inputValue, sendMessage]);

  const handleOpen  = () => { setIsOpen(true);  setIsMinimized(false); };
  const handleClose = () => { setIsOpen(false); setCharState("idle");  };
  const handleMinimize = () => setIsMinimized((v) => !v);

  /* ── Status text ── */
  const statusText =
    isLoading      ? "Procesando…"    :
    charState === "thinking" ? "Analizando…"  :
    charState === "talking"  ? "Respondiendo…":
    "En línea";

  const statusColor = isLoading ? "#f59e0b" : "#22c55e";

  /* ── Effective char state for the image (with attract override) ── */
  const effectiveState: UAIState =
    attract && !isOpen ? "greeting" : charState;

  /* ── Layout ── */
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 10,
        pointerEvents: "none",
      }}
    >
      {/* ════════════════════════════
          CHAT PANEL (above character)
          ════════════════════════════ */}
      {isOpen && (
        <div
          className="uai-panel-in"
          style={{
            width: 360,
            borderRadius: 20,
            overflow: "hidden",
            background: "rgba(255,255,255,0.97)",
            backdropFilter: "blur(24px)",
            boxShadow: [
              "0 32px 64px rgba(30,74,155,0.18)",
              "0 8px 24px rgba(0,0,0,0.10)",
              "0 0 0 1px rgba(255,255,255,0.6)",
            ].join(", "),
            display: "flex",
            flexDirection: "column",
            height: isMinimized ? 52 : 460,
            transition: "height 0.35s cubic-bezier(0.22,1,0.36,1)",
            pointerEvents: "all",
          }}
        >
          {/* ── Panel header ── */}
          <div
            style={{
              background: `linear-gradient(135deg, ${UAI_BLUE} 0%, ${UAI_MID} 55%, ${UAI_LIGHT} 100%)`,
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexShrink: 0,
            }}
          >
            {/* Logo badge */}
            <div
              style={{
                width: 32, height: 32,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.18)",
                border: "1.5px solid rgba(255,255,255,0.35)",
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              <img
                src={`${import.meta.env.BASE_URL}dolphin-assistant.png`}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
              />
            </div>

            {/* Title */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  fontWeight: 900, fontSize: 13, color: "white",
                  letterSpacing: "0.08em", fontFamily: "inherit",
                }}>
                  UAIDELFIN
                </span>
                <Sparkles size={11} color="rgba(255,255,255,0.7)" />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 1 }}>
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: statusColor,
                  display: "inline-block",
                  boxShadow: `0 0 6px ${statusColor}`,
                  animation: "pulse 2s ease-in-out infinite",
                }} />
                <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.72)" }}>{statusText}</span>
              </div>
            </div>

            {/* Controls */}
            <button
              onClick={handleMinimize}
              title={isMinimized ? "Expandir" : "Minimizar"}
              style={{
                width: 26, height: 26, borderRadius: 8,
                background: "rgba(255,255,255,0.12)",
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.25)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
            >
              <ChevronDown size={13} color="white" style={{ transform: isMinimized ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
            </button>
            <button
              onClick={handleClose}
              title="Cerrar"
              style={{
                width: 26, height: 26, borderRadius: 8,
                background: "rgba(255,255,255,0.12)",
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(220,50,50,0.4)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
            >
              <X size={13} color="white" />
            </button>
          </div>

          {/* ── Chat body ── */}
          {!isMinimized && (
            <DolphinChat
              messages={messages}
              inputValue={inputValue}
              isLoading={isLoading}
              onInputChange={setInputValue}
              onSend={handleSend}
              onSendText={sendMessage}
            />
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════
          CHARACTER STAGE — always visible, always free
          ════════════════════════════════════════════ */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: 180,
          cursor: "pointer",
          pointerEvents: "all",
          position: "relative",
        }}
        onClick={isOpen ? undefined : handleOpen}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        role="button"
        aria-label={isOpen ? undefined : "Abrir UAIDELFIN"}
        tabIndex={isOpen ? -1 : 0}
        onKeyDown={(e) => { if (e.key === "Enter" && !isOpen) handleOpen(); }}
      >
        {/* Glow aura behind character */}
        <div
          style={{
            position: "absolute",
            inset: "-20px -20px 10px",
            borderRadius: "50%",
            background: `radial-gradient(ellipse 120% 110% at 50% 55%, ${UAI_GLOW} 0%, rgba(47,90,166,0.08) 55%, transparent 75%)`,
            pointerEvents: "none",
          }}
          className="uai-glow-ring"
        />
        <div
          style={{
            position: "absolute",
            inset: "-35px -35px 5px",
            borderRadius: "50%",
            background: `radial-gradient(ellipse 130% 120% at 50% 55%, rgba(76,159,255,0.08) 0%, transparent 65%)`,
            pointerEvents: "none",
          }}
          className="uai-glow-ring2"
        />

        {/* Hover tooltip (only when closed) */}
        {!isOpen && hovered && (
          <div
            style={{
              position: "absolute",
              top: -44,
              left: "50%",
              transform: "translateX(-50%)",
              background: `linear-gradient(135deg, ${UAI_BLUE} 0%, ${UAI_LIGHT} 100%)`,
              color: "white",
              fontSize: 11.5,
              fontWeight: 600,
              padding: "6px 14px",
              borderRadius: 20,
              whiteSpace: "nowrap",
              boxShadow: "0 4px 16px rgba(47,90,166,0.35)",
              pointerEvents: "none",
              zIndex: 10,
            }}
          >
            ¡Hola! ¿En qué te ayudo? ✨
            {/* Caret */}
            <div style={{
              position: "absolute",
              bottom: -5, left: "50%",
              transform: "translateX(-50%)",
              width: 10, height: 10,
              background: UAI_LIGHT,
              clipPath: "polygon(0 0, 100% 0, 50% 100%)",
            }} />
          </div>
        )}

        {/* ── The character itself ── */}
        <UAIDelfinCharacter
          state={effectiveState}
          size={isOpen ? 140 : 160}
        />

        {/* UAIDELFIN identity label */}
        <div
          style={{
            marginTop: 6,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
          }}
        >
          <div
            style={{
              background: `linear-gradient(135deg, ${UAI_BLUE} 0%, ${UAI_LIGHT} 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              fontWeight: 900,
              fontSize: 11,
              letterSpacing: "0.22em",
              fontFamily: "inherit",
              textTransform: "uppercase",
            }}
          >
            UAIDELFIN
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: statusColor,
              boxShadow: `0 0 6px ${statusColor}`,
              display: "inline-block",
            }} />
            <span style={{ fontSize: 9.5, color: "#6b7280", fontWeight: 500 }}>
              {statusText}
            </span>
          </div>
        </div>

        {/* Click indicator dots (closed state only) */}
        {!isOpen && (
          <div
            style={{
              display: "flex",
              gap: 4,
              marginTop: 6,
              opacity: hovered ? 1 : 0.4,
              transition: "opacity 0.3s",
            }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 4, height: 4,
                  borderRadius: "50%",
                  background: UAI_MID,
                  opacity: 0.6,
                  animation: `uai-dot 1.3s ease-in-out infinite`,
                  animationDelay: `${i * 0.25}s`,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
