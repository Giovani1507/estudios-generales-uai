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
        height: size * 1.25,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <img
        src={`${import.meta.env.BASE_URL}dolphin-assistant.png`}
        alt="Ichi — Asistente UAI"
        draggable={false}
        className={`dolphin-char dolphin-${state}`}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          objectPosition: "bottom",
          userSelect: "none",
          filter: "drop-shadow(0 8px 24px rgba(47,90,166,0.25))",
          transformOrigin: "bottom center",
        }}
      />
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
