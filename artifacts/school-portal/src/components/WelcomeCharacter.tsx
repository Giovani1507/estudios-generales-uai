import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback } from "react";

interface WelcomeCharacterProps {
  visible: boolean;
  firstName: string;
  saludo: string;
  onDone: () => void;
}

const SPARKLE_COUNT = 22;
const sparkles = Array.from({ length: SPARKLE_COUNT }, (_, i) => ({
  id: i,
  left: `${5 + Math.random() * 90}%`,
  top: `${5 + Math.random() * 70}%`,
  color: ["#FFD700", "#FF6B9D", "#4ECDC4", "#A78BFA", "#FFA500", "#7EE8A2"][i % 6],
  delay: Math.random() * 2.5,
  duration: 1.5 + Math.random() * 2,
  size: 6 + Math.random() * 10,
}));

type Phase = "enter" | "talking" | "exit";

export function WelcomeCharacter({ visible, firstName, saludo, onDone }: WelcomeCharacterProps) {
  const [phase, setPhase] = useState<Phase>("enter");
  const [showBubble, setShowBubble] = useState(false);
  const [displayedText, setDisplayedText] = useState("");

  const fullText = `¡${saludo}, ${firstName}! Bienvenido al portal.`;

  const handleDone = useCallback(() => {
    setPhase("exit");
    setTimeout(() => {
      onDone();
      setPhase("enter");
      setShowBubble(false);
      setDisplayedText("");
    }, 900);
  }, [onDone]);

  useEffect(() => {
    if (!visible) return;
    setPhase("enter");
    setShowBubble(false);
    setDisplayedText("");

    const t1 = setTimeout(() => setShowBubble(true), 900);
    const t2 = setTimeout(() => setPhase("talking"), 950);

    let idx = 0;
    const t3 = setTimeout(() => {
      const iv = setInterval(() => {
        idx++;
        setDisplayedText(fullText.slice(0, idx));
        if (idx >= fullText.length) {
          clearInterval(iv);
          setTimeout(handleDone, 2800);
        }
      }, 48);
      return () => clearInterval(iv);
    }, 1000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [visible]);

  const isTalking = phase === "talking";
  const isExiting = phase === "exit";

  const charSrc = `${import.meta.env.BASE_URL}character-nobg.png`;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-end justify-center overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.4 } }}
          onClick={isTalking || isExiting ? handleDone : undefined}
          style={{
            background:
              "radial-gradient(ellipse at 50% 110%, rgba(30,60,130,0.97) 0%, rgba(5,10,35,0.96) 70%)",
            cursor: "pointer",
          }}
        >
          {/* Sparkles */}
          {sparkles.map(s => (
            <motion.div
              key={s.id}
              className="absolute rounded-full pointer-events-none"
              style={{
                left: s.left,
                top: s.top,
                width: s.size,
                height: s.size,
                background: s.color,
                boxShadow: `0 0 ${s.size * 2}px ${s.color}`,
              }}
              animate={{ y: [0, -35, 0], opacity: [0, 1, 0], scale: [0, 1.2, 0] }}
              transition={{ duration: s.duration, repeat: Infinity, delay: s.delay, ease: "easeInOut" }}
            />
          ))}

          {/* Ground glow */}
          <motion.div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
            style={{
              width: 340,
              height: 40,
              background: "radial-gradient(ellipse, rgba(100,140,255,0.55) 0%, transparent 80%)",
              filter: "blur(8px)",
            }}
            animate={{ scaleX: [1, 1.12, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Character wrapper — entrance/exit */}
          <motion.div
            className="relative select-none"
            style={{ width: 310, marginBottom: -10 }}
            initial={{ y: 380, opacity: 0, scale: 0.7 }}
            animate={
              isExiting
                ? { y: 400, opacity: 0, scale: 0.8, transition: { duration: 0.7, ease: "easeIn" } }
                : { y: 0, opacity: 1, scale: 1, transition: { type: "spring", stiffness: 180, damping: 14 } }
            }
          >
            {/* ───── LAYER 1: Legs (bottom 38%) — gentle sway ───── */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{ clipPath: "polygon(15% 62%, 85% 62%, 85% 100%, 15% 100%)" }}
              animate={isTalking ? { x: [-4, 4, -4], rotate: [-1, 1, -1] } : { x: 0, rotate: 0 }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            >
              <img src={charSrc} alt="" className="w-full h-auto object-contain" draggable={false} />
            </motion.div>

            {/* ───── LAYER 2: Torso (30–70%) — breathing ───── */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{ clipPath: "polygon(5% 30%, 95% 30%, 95% 65%, 5% 65%)" }}
              animate={isTalking ? { scaleY: [1, 1.02, 1], scaleX: [1, 0.99, 1] } : {}}
              transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
            >
              <img src={charSrc} alt="" className="w-full h-auto object-contain" draggable={false} />
            </motion.div>

            {/* ───── LAYER 3: Hands (0–72%) — arms wave ───── */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                clipPath: "polygon(0% 20%, 28% 20%, 28% 68%, 72% 68%, 72% 20%, 100% 20%, 100% 72%, 0% 72%)",
                transformOrigin: "center 80%",
              }}
              animate={
                isTalking
                  ? { rotate: [-6, 6, -6], scale: [1, 1.04, 1] }
                  : { rotate: 0, scale: 1 }
              }
              transition={{ duration: 0.7, repeat: Infinity, ease: "easeInOut" }}
            >
              <img src={charSrc} alt="" className="w-full h-auto object-contain" draggable={false} />
            </motion.div>

            {/* ───── LAYER 4: Head (0–35%) — head nod ───── */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{ clipPath: "polygon(20% 0%, 80% 0%, 80% 32%, 20% 32%)", transformOrigin: "center 100%" }}
              animate={
                isTalking
                  ? { rotate: [-4, 4, -4], y: [-3, 3, -3] }
                  : { rotate: 0, y: 0 }
              }
              transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
            >
              <img src={charSrc} alt="" className="w-full h-auto object-contain" draggable={false} />
            </motion.div>

            {/* ───── BASE LAYER: Full image with body sway ───── */}
            <motion.div
              style={{ transformOrigin: "bottom center" }}
              animate={
                isTalking
                  ? { rotate: [-2.5, 2.5, -2.5], y: [0, -6, 0] }
                  : { rotate: 0, y: 0 }
              }
              transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
            >
              <img src={charSrc} alt="Personaje animado" className="w-full h-auto object-contain" draggable={false} />
            </motion.div>

            {/* Shadow under character */}
            <motion.div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full"
              style={{ width: 180, height: 18, background: "rgba(0,0,50,0.45)", filter: "blur(10px)" }}
              animate={isTalking ? { scaleX: [1, 1.1, 1] } : {}}
              transition={{ duration: 1.1, repeat: Infinity }}
            />

            {/* Speech bubble */}
            <AnimatePresence>
              {showBubble && (
                <motion.div
                  className="absolute right-0 top-4"
                  style={{ width: 220, transformOrigin: "bottom left" }}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 18 }}
                >
                  {/* Bubble tail */}
                  <div
                    className="absolute bottom-[-12px] left-10"
                    style={{
                      width: 0,
                      height: 0,
                      borderLeft: "12px solid transparent",
                      borderRight: "8px solid transparent",
                      borderTop: "14px solid white",
                    }}
                  />
                  <div className="bg-white rounded-2xl px-4 py-3 shadow-2xl">
                    <p className="text-sm font-bold text-gray-800 leading-snug min-h-[36px]">
                      {displayedText}
                      {displayedText.length < fullText.length && (
                        <motion.span
                          animate={{ opacity: [1, 0] }}
                          transition={{ duration: 0.5, repeat: Infinity }}
                          className="inline-block w-[2px] h-4 bg-blue-600 ml-0.5 align-middle"
                        />
                      )}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Skip hint */}
          <motion.p
            className="absolute bottom-6 text-white/40 text-xs pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2 }}
          >
            Clic para continuar
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
