import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback, useRef } from "react";

interface WelcomeCharacterProps {
  visible: boolean;
  firstName: string;
  saludo: string;
  onDone: () => void;
}

// Stable sparkles — generated once
const sparkles = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  left: `${8 + (i * 5.2) % 84}%`,
  top: `${10 + (i * 7.3) % 60}%`,
  color: ["#FFD700", "#FF6B9D", "#4ECDC4", "#A78BFA", "#FFA07A", "#7EE8A2"][i % 6],
  delay: (i * 0.37) % 2.8,
  duration: 1.6 + (i % 4) * 0.5,
  size: 6 + (i % 5) * 2,
}));

type Phase = "idle" | "enter" | "wave" | "talk" | "exit";

export function WelcomeCharacter({ visible, firstName, saludo, onDone }: WelcomeCharacterProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [showBubble, setShowBubble] = useState(false);
  const [displayedText, setDisplayedText] = useState("");
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const fullText = `¡${saludo}, ${firstName}! Bienvenido al portal.`;

  const clear = () => timersRef.current.forEach(clearTimeout);
  const after = (ms: number, fn: () => void) => {
    const t = setTimeout(fn, ms);
    timersRef.current.push(t);
    return t;
  };

  const handleDone = useCallback(() => {
    setPhase("exit");
    clear();
    after(800, () => {
      onDone();
      setPhase("idle");
      setShowBubble(false);
      setDisplayedText("");
    });
  }, [onDone]);

  useEffect(() => {
    if (!visible) return;
    clear();
    timersRef.current = [];
    setPhase("enter");
    setShowBubble(false);
    setDisplayedText("");

    // 1. Enter: bounce in (0 → 1.2s)
    // 2. Wave: hand wave greeting (1.2s → 2.8s)
    after(1200, () => setPhase("wave"));

    // 3. Talk: bubble appears, text types out (2.8s)
    after(2800, () => {
      setPhase("talk");
      setShowBubble(true);
    });

    // 4. Typewriter
    after(3000, () => {
      let idx = 0;
      const iv = setInterval(() => {
        idx++;
        setDisplayedText(fullText.slice(0, idx));
        if (idx >= fullText.length) {
          clearInterval(iv);
          after(2600, handleDone);
        }
      }, 55);
      timersRef.current.push(iv as unknown as ReturnType<typeof setTimeout>);
    });

    return clear;
  }, [visible]);

  const charSrc = `${import.meta.env.BASE_URL}character-nobg.png`;

  const isWaving = phase === "wave";
  const isTalking = phase === "talk";
  const isExiting = phase === "exit";
  const isEntering = phase === "enter";

  // ── BODY: entrance spring, idle sway when talking ──
  const bodyVariants = {
    idle: { rotate: 0, y: 0, scaleX: 1, scaleY: 1 },
    enter: { y: 0, scaleX: 1, scaleY: 1, rotate: 0,
              transition: { type: "spring" as const, stiffness: 200, damping: 15 } },
    wave: { rotate: [0, -3, 3, -2, 2, 0], scaleX: [1, 1.02, 0.99, 1.01, 1],
            transition: { duration: 1.4, ease: "easeInOut", times: [0, 0.2, 0.5, 0.75, 1] } },
    talk: { rotate: [-1.5, 1.5, -1.5], y: [0, -4, 0],
            transition: { duration: 1.3, repeat: Infinity, ease: "easeInOut" } },
    exit: { y: 380, scaleY: 0.8, opacity: 0,
            transition: { duration: 0.65, ease: "easeIn" } },
  };

  // ── ARMS/HANDS: rapid wave during wave phase ──
  const handsVariants = {
    idle: { rotate: 0, y: 0 },
    wave: {
      rotate: [-20, 20, -20, 20, -20, 20, -10, 0],
      y: [-8, 8, -8, 8, -8, 8, -4, 0],
      transition: { duration: 1.5, ease: "easeInOut", times: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1] },
    },
    talk: { rotate: [-5, 5, -5], scale: [1, 1.03, 1],
            transition: { duration: 0.85, repeat: Infinity, ease: "easeInOut" } },
    exit: {},
  };

  // ── HEAD: nod while talking ──
  const headVariants = {
    idle: { rotate: 0, y: 0 },
    wave: { rotate: [-4, 4, -4, 4, 0],
            transition: { duration: 1.4, ease: "easeInOut" } },
    talk: { rotate: [-3, 3, -3], y: [-2, 2, -2],
            transition: { duration: 0.7, repeat: Infinity, ease: "easeInOut" } },
    exit: {},
  };

  // ── LEGS: subtle weight shift ──
  const legsVariants = {
    idle: { x: 0 },
    wave: { x: [-3, 3, -3, 3, 0], transition: { duration: 1.5, ease: "easeInOut" } },
    talk: { x: [-3, 3, -3], transition: { duration: 1.6, repeat: Infinity, ease: "easeInOut" } },
    exit: {},
  };

  const currentAnim = isExiting ? "exit" : isWaving ? "wave" : isTalking ? "talk" : "idle";

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-end justify-center overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.35 } }}
          onClick={!isEntering ? handleDone : undefined}
          style={{
            background:
              "radial-gradient(ellipse at 50% 115%, rgba(20,50,120,0.97) 0%, rgba(4,8,30,0.97) 68%)",
            cursor: isEntering ? "default" : "pointer",
          }}
        >
          {/* Sparkles */}
          {sparkles.map(s => (
            <motion.div
              key={s.id}
              className="absolute rounded-full pointer-events-none"
              style={{
                left: s.left, top: s.top,
                width: s.size, height: s.size,
                background: s.color,
                boxShadow: `0 0 ${s.size * 2}px ${s.color}88`,
              }}
              animate={{ y: [0, -38, 0], opacity: [0, 1, 0], scale: [0, 1.3, 0] }}
              transition={{ duration: s.duration, repeat: Infinity, delay: s.delay, ease: "easeInOut" }}
            />
          ))}

          {/* Ground glow pulse */}
          <motion.div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
            style={{
              width: 360, height: 44,
              background: "radial-gradient(ellipse, rgba(80,130,255,0.5) 0%, transparent 80%)",
              filter: "blur(12px)",
            }}
            animate={{ scaleX: [1, 1.15, 1], opacity: [0.5, 0.9, 0.5] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* ── CHARACTER WRAPPER: entrance bounce ── */}
          <motion.div
            className="relative select-none"
            style={{ width: 320, marginBottom: -8, transformOrigin: "bottom center" }}
            initial={{ y: 420, scaleX: 0.6, scaleY: 0.5, opacity: 0 }}
            animate={
              isExiting
                ? { y: 420, scaleX: 0.8, scaleY: 0.8, opacity: 0,
                    transition: { duration: 0.65, ease: "easeIn" } }
                : { y: 0, scaleX: 1, scaleY: 1, opacity: 1,
                    transition: { type: "spring", stiffness: 190, damping: 13, mass: 0.9 } }
            }
          >
            {/* Shadow */}
            <motion.div
              className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
              style={{ width: 200, height: 20, background: "rgba(0,5,40,0.55)", filter: "blur(12px)" }}
              animate={isTalking ? { scaleX: [1, 1.12, 1] } : {}}
              transition={{ duration: 1.3, repeat: Infinity }}
            />

            {/* ── LAYER: Legs — weight shift ── */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{ clipPath: "polygon(18% 63%, 82% 63%, 82% 100%, 18% 100%)" }}
              variants={legsVariants}
              animate={currentAnim}
            >
              <img src={charSrc} alt="" className="w-full h-auto object-contain" draggable={false} />
            </motion.div>

            {/* ── LAYER: Torso — breathing ── */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{ clipPath: "polygon(8% 32%, 92% 32%, 92% 66%, 8% 66%)" }}
              animate={
                isTalking
                  ? { scaleY: [1, 1.018, 1], scaleX: [1, 0.988, 1] }
                  : isWaving
                  ? { scaleY: [1, 1.01, 0.995, 1] }
                  : {}
              }
              transition={{ duration: 1.1, repeat: isTalking ? Infinity : 0, ease: "easeInOut" }}
            >
              <img src={charSrc} alt="" className="w-full h-auto object-contain" draggable={false} />
            </motion.div>

            {/* ── LAYER: Hands/Arms — wave greeting then talk ── */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                clipPath: "polygon(0% 18%, 30% 18%, 30% 70%, 70% 70%, 70% 18%, 100% 18%, 100% 70%, 0% 70%)",
                transformOrigin: "center 75%",
              }}
              variants={handsVariants}
              animate={currentAnim}
            >
              <img src={charSrc} alt="" className="w-full h-auto object-contain" draggable={false} />
            </motion.div>

            {/* ── LAYER: Head — nod ── */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{ clipPath: "polygon(22% 0%, 78% 0%, 78% 33%, 22% 33%)", transformOrigin: "center 95%" }}
              variants={headVariants}
              animate={currentAnim}
            >
              <img src={charSrc} alt="" className="w-full h-auto object-contain" draggable={false} />
            </motion.div>

            {/* ── BASE LAYER: full image with body sway ── */}
            <motion.div
              style={{ transformOrigin: "bottom center" }}
              variants={bodyVariants}
              animate={isExiting ? "exit" : isWaving ? "wave" : isTalking ? "talk" : "idle"}
            >
              <img
                src={charSrc}
                alt="Personaje animado"
                className="w-full h-auto object-contain"
                draggable={false}
              />
            </motion.div>

            {/* ── SPEECH BUBBLE ── */}
            <AnimatePresence>
              {showBubble && (
                <motion.div
                  className="absolute"
                  style={{ right: -10, top: 10, width: 230, transformOrigin: "bottom left" }}
                  initial={{ scale: 0, opacity: 0, rotate: -5 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 280, damping: 20 }}
                >
                  {/* Tail */}
                  <div
                    className="absolute"
                    style={{
                      bottom: -13, left: 28,
                      width: 0, height: 0,
                      borderLeft: "10px solid transparent",
                      borderRight: "10px solid transparent",
                      borderTop: "14px solid white",
                    }}
                  />
                  <div className="bg-white rounded-2xl px-4 py-3 shadow-2xl border border-gray-100">
                    <p className="text-sm font-bold text-gray-800 leading-snug" style={{ minHeight: 38 }}>
                      {displayedText}
                      {displayedText.length < fullText.length && (
                        <motion.span
                          animate={{ opacity: [1, 0] }}
                          transition={{ duration: 0.45, repeat: Infinity }}
                          className="inline-block w-[2px] h-[14px] bg-blue-500 ml-0.5 align-middle rounded-full"
                        />
                      )}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Skip */}
          <motion.p
            className="absolute bottom-5 text-white/35 text-xs pointer-events-none tracking-wide"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.5 }}
          >
            Clic para continuar
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
