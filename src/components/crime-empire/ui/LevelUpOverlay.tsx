"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface LevelUpDetail {
  fromLevel: number;
  toLevel: number;
}

/**
 * Mounts once in the game shell. Listens for `ce:level-up` events
 * and shows a celebratory overlay with the new level.
 */
export function LevelUpOverlay() {
  const [event, setEvent] = useState<LevelUpDetail | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<LevelUpDetail>).detail;
      if (!detail) return;
      setEvent(detail);
      // auto-dismiss
      const t = setTimeout(() => setEvent(null), 3500);
      return () => clearTimeout(t);
    };
    window.addEventListener("ce:level-up", handler);
    return () => window.removeEventListener("ce:level-up", handler);
  }, []);

  return (
    <AnimatePresence>
      {event && (
        <motion.div
          key="lvlup"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[10000] flex items-center justify-center pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(255,140,40,0.18) 0%, rgba(0,0,0,0.55) 70%)",
            backdropFilter: "blur(2px)",
          }}
          onClick={() => setEvent(null)}
        >
          {/* Sun-burst rays */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={{ rotate: 0 }}
            animate={{ rotate: 360 }}
            transition={{ duration: 14, ease: "linear", repeat: Infinity }}
          >
            <div
              className="w-[640px] h-[640px] max-w-[120vw] max-h-[120vh] rounded-full opacity-30"
              style={{
                background:
                  "conic-gradient(from 0deg, transparent 0deg, rgba(255,170,60,0.45) 8deg, transparent 16deg, transparent 36deg, rgba(255,170,60,0.45) 44deg, transparent 52deg, transparent 72deg, rgba(255,170,60,0.45) 80deg, transparent 88deg, transparent 108deg, rgba(255,170,60,0.45) 116deg, transparent 124deg, transparent 144deg, rgba(255,170,60,0.45) 152deg, transparent 160deg, transparent 180deg, rgba(255,170,60,0.45) 188deg, transparent 196deg, transparent 216deg, rgba(255,170,60,0.45) 224deg, transparent 232deg, transparent 252deg, rgba(255,170,60,0.45) 260deg, transparent 268deg, transparent 288deg, rgba(255,170,60,0.45) 296deg, transparent 304deg, transparent 324deg, rgba(255,170,60,0.45) 332deg, transparent 340deg)",
                filter: "blur(2px)",
              }}
            />
          </motion.div>

          <motion.div
            className="relative ce-card ce-card--metal-gold rounded-3xl px-12 py-10 text-center pointer-events-auto"
            style={{
              background:
                "linear-gradient(160deg, #1a1408 0%, #0f0a04 60%, #050300 100%)",
              boxShadow:
                "0 0 80px rgba(251,191,36,0.35), 0 20px 60px rgba(0,0,0,0.7)",
              minWidth: 320,
            }}
            initial={{ scale: 0.4, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: -10 }}
            transition={{ type: "spring", stiffness: 320, damping: 18 }}
          >
            <motion.p
              className="text-[10px] font-black uppercase tracking-[0.4em] text-[#fbbf24]/70 mb-3"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              Subiste de nível
            </motion.p>
            <motion.div
              className="flex items-center justify-center gap-3 mb-4"
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.15, type: "spring", stiffness: 400, damping: 14 }}
            >
              <span className="text-2xl text-white/30 font-black tabular-nums">
                {event.fromLevel}
              </span>
              <motion.span
                className="text-white/40 text-3xl"
                animate={{ x: [0, 6, 0] }}
                transition={{ duration: 0.8, repeat: 2 }}
              >
                →
              </motion.span>
              <span
                className="text-7xl font-black tabular-nums"
                style={{
                  background:
                    "linear-gradient(180deg, #fef3c7 0%, #fbbf24 50%, #b45309 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  textShadow: "0 0 30px rgba(251,191,36,0.5)",
                }}
              >
                {event.toLevel}
              </span>
            </motion.div>
            <p className="text-xs text-white/50 max-w-xs mx-auto">
              Stamina restaurada. Novas operações desbloqueadas.
            </p>
            <motion.button
              onClick={() => setEvent(null)}
              className="ce-btn ce-btn-gold mt-6 px-6 py-2 text-xs uppercase tracking-widest"
              whileTap={{ scale: 0.96 }}
            >
              Continuar
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
