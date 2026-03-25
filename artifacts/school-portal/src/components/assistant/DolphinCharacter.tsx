export type DolphinState = "idle" | "greeting" | "thinking" | "talking";

interface DolphinCharacterProps {
  state: DolphinState;
  size?: number;
}

export function DolphinCharacter({ state, size = 160 }: DolphinCharacterProps) {
  return (
    <div
      style={{
        width: size,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-end",
        flexShrink: 0,
        gap: 0,
      }}
    >
      <img
        src={`${import.meta.env.BASE_URL}dolphin-assistant.png`}
        alt="Ichi — Asistente UAI"
        draggable={false}
        className={`dolphin-char dolphin-${state}`}
        style={{
          width: "100%",
          height: size * 1.25,
          objectFit: "contain",
          objectPosition: "bottom",
          userSelect: "none",
          filter: "drop-shadow(0 4px 12px rgba(47,90,166,0.20))",
          transformOrigin: "bottom center",
          display: "block",
        }}
      />
      {/* Dynamic shadow that squashes/stretches with the hop */}
      {state === "idle" && (
        <div
          className="dolphin-shadow"
          style={{ marginTop: -4 }}
        />
      )}
    </div>
  );
}

/* Thinking dots */
export function ThinkingDots() {
  return (
    <div className="flex gap-1 items-center px-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-primary/60 thinking-dot"
          style={{ animationDelay: `${i * 0.18}s` }}
        />
      ))}
    </div>
  );
}
