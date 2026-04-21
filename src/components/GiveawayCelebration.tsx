"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface GiveawayCelebrationProps {
  winner: { twitch_username: string; twitch_id: string } | null;
  prize?: string;
  onDismiss: () => void;
}

/* ── Gold Confetti Particle ──────────────────────────────── */
function Confetti({ count = 80 }: { count?: number }) {
  const particles = useRef(
    Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 1.5,
      duration: 2 + Math.random() * 3,
      size: 4 + Math.random() * 8,
      rotation: Math.random() * 720 - 360,
      color: ["#d4a843", "#f0d78c", "#cd7f32", "#ffcc00", "#e8c252"][Math.floor(Math.random() * 5)],
      shape: Math.random() > 0.5 ? "rect" : "circle",
    }))
  ).current;

  return (
    <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: `${p.x}vw`, y: "-10vh", rotate: 0, opacity: 1 }}
          animate={{
            y: "110vh",
            rotate: p.rotation,
            x: `${p.x + (Math.random() - 0.5) * 20}vw`,
            opacity: [1, 1, 0.5, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: "easeIn",
          }}
          className="absolute"
          style={{
            width: p.size,
            height: p.shape === "rect" ? p.size * 2 : p.size,
            backgroundColor: p.color,
            borderRadius: p.shape === "circle" ? "50%" : "1px",
          }}
        />
      ))}
    </div>
  );
}

/* ── Fire Embers ─────────────────────────────────────────── */
function FireEmbers({ count = 30 }: { count?: number }) {
  const embers = useRef(
    Array.from({ length: count }, (_, i) => ({
      id: i,
      x: 40 + Math.random() * 20,
      delay: Math.random() * 2,
      duration: 2 + Math.random() * 2,
      size: 2 + Math.random() * 4,
    }))
  ).current;

  return (
    <div className="fixed inset-0 pointer-events-none z-[59]">
      {embers.map((e) => (
        <motion.div
          key={e.id}
          initial={{ x: `${e.x}vw`, y: "60vh", scale: 1, opacity: 0.8 }}
          animate={{
            y: "-20vh",
            x: `${e.x + (Math.random() - 0.5) * 30}vw`,
            scale: 0,
            opacity: [0.8, 1, 0.6, 0],
          }}
          transition={{ duration: e.duration, delay: e.delay, ease: "easeOut" }}
          className="absolute rounded-full"
          style={{
            width: e.size,
            height: e.size,
            background: "radial-gradient(circle, #ff6f00, #d4a843, transparent)",
            boxShadow: "0 0 6px #ff6f00",
          }}
        />
      ))}
    </div>
  );
}

/* ── Screen Shake ────────────────────────────────────────── */
function useScreenShake(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const body = document.body;
    body.style.transition = "transform 0.1s";
    let frame = 0;
    const shake = () => {
      if (frame > 15) {
        body.style.transform = "";
        return;
      }
      const x = (Math.random() - 0.5) * 6;
      const y = (Math.random() - 0.5) * 4;
      body.style.transform = `translate(${x}px, ${y}px)`;
      frame++;
      requestAnimationFrame(shake);
    };
    shake();
    return () => {
      body.style.transform = "";
    };
  }, [active]);
}

/* ── Sound Manager ───────────────────────────────────────── */
function playVictorySound() {
  try {
    const ctx = new AudioContext();
    // Crowd cheer: white noise burst
    const duration = 2.5;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < bufferSize; i++) {
        const t = i / ctx.sampleRate;
        const envelope = Math.exp(-t * 1.5) * Math.min(1, t * 10);
        data[i] = (Math.random() * 2 - 1) * 0.15 * envelope;
        // Add harmonic resonance for "metal clash" feel
        data[i] += Math.sin(t * 220 * Math.PI * 2) * 0.05 * Math.exp(-t * 8);
        data[i] += Math.sin(t * 440 * Math.PI * 2) * 0.03 * Math.exp(-t * 6);
      }
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = 0.3;
    source.connect(gain).connect(ctx.destination);
    source.start();

    // Haptic feedback (mobile)
    if (navigator.vibrate) navigator.vibrate([100, 50, 200]);
  } catch {
    // Audio not supported
  }
}

/* ── Main Celebration Component ──────────────────────────── */
export default function GiveawayCelebration({ winner, prize, onDismiss }: GiveawayCelebrationProps) {
  const [visible, setVisible] = useState(false);
  const [showName, setShowName] = useState(false);
  const soundPlayed = useRef(false);

  useScreenShake(visible);

  useEffect(() => {
    if (winner) {
      setVisible(true);
      if (!soundPlayed.current) {
        playVictorySound();
        soundPlayed.current = true;
      }
      // Delay name reveal for dramatic effect
      const t = setTimeout(() => setShowName(true), 800);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
      setShowName(false);
      soundPlayed.current = false;
    }
  }, [winner]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    setShowName(false);
    soundPlayed.current = false;
    onDismiss();
  }, [onDismiss]);

  return (
    <AnimatePresence>
      {visible && winner && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[55] flex items-center justify-center"
          onClick={handleDismiss}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

          {/* Glow burst */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 3, opacity: [0, 0.6, 0.2] }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="absolute w-64 h-64 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(212,168,67,0.4), rgba(212,168,67,0.1), transparent)",
              filter: "blur(40px)",
            }}
          />

          {/* Confetti */}
          <Confetti />
          <FireEmbers />

          {/* Winner Card */}
          <motion.div
            initial={{ scale: 0.5, y: 50, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-[61] text-center px-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Crown/Trophy icon */}
            <motion.div
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.5, delay: 0.5, type: "spring" }}
              className="text-7xl mb-6"
            >
              ⚔️
            </motion.div>

            {/* Title */}
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="text-xl sm:text-2xl text-arena-gold/80 font-[family-name:var(--font-display)] tracking-[0.2em] uppercase mb-4"
            >
              Victor da Arena
            </motion.h2>

            {/* Winner name */}
            <AnimatePresence>
              {showName && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.6, type: "spring" }}
                >
                  <h1 className="text-4xl sm:text-6xl font-bold text-arena-gold font-[family-name:var(--font-display)] tracking-wider mb-4"
                    style={{
                      textShadow: "0 0 30px rgba(212,168,67,0.6), 0 0 60px rgba(212,168,67,0.3), 0 4px 8px rgba(0,0,0,0.5)",
                    }}
                  >
                    {winner.twitch_username}
                  </h1>

                  {prize && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="text-lg text-arena-smoke font-[family-name:var(--font-display)] tracking-wide"
                    >
                      Prémio: <span className="text-arena-gold-light">{prize}</span>
                    </motion.p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Dismiss hint */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              transition={{ delay: 3 }}
              className="mt-8 text-xs text-arena-smoke/50 font-[family-name:var(--font-display)] tracking-wider"
            >
              Clica para fechar
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
