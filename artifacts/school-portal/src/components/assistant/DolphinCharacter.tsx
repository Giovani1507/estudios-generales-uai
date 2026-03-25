export type UAIState = "idle" | "greeting" | "thinking" | "talking" | "excited";

interface UAIDelfinCharacterProps {
  state: UAIState;
  size?: number;
}

export function UAIDelfinCharacter({ state, size = 180 }: UAIDelfinCharacterProps) {
  const isIdle = state === "idle";
  const imgClass = isIdle ? "uai-char" : `uai-char uai-${state}`;

  const img = (
    <img
      src={`${import.meta.env.BASE_URL}dolphin-assistant.png`}
      alt="UAIDELFIN — Asistente UAI"
      draggable={false}
      className={imgClass}
      style={{
        width: size,
        height: size * 1.3,
        objectFit: "contain",
        objectPosition: "bottom",
        userSelect: "none",
        transformOrigin: "bottom center",
        display: "block",
        filter: "drop-shadow(0 6px 20px rgba(47,90,166,0.28))",
      }}
    />
  );

  if (isIdle) {
    return (
      <div className="uai-float-layer" style={{ display: "flex", justifyContent: "center" }}>
        <div className="uai-breathe-layer">
          <div className="uai-sway-layer">
            {img}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      {img}
    </div>
  );
}

export function UAIThinkingDots() {
  return (
    <div style={{ display: "flex", gap: 5, alignItems: "center", padding: "2px 4px" }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="uai-thinking-dot"
          style={{
            width: 8, height: 8,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #4C9FFF, #2f5aa6)",
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </div>
  );
}

export type { UAIState as DolphinState };
export const DolphinCharacter = UAIDelfinCharacter;
