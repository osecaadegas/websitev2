"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SpinParticipant {
  twitch_id: string;
  twitch_username: string;
}

interface GiveawaySpinProps {
  winner: { twitch_username: string; twitch_id: string } | null;
  participants: SpinParticipant[];
  prize?: string;
  onDismiss: () => void;
}

/* ── Twitch Avatar URL ───────────────────────────────────── */
function twitchAvatar(username: string) {
  // Use Twitch default-style avatar via DiceBear (deterministic, no API key needed)
  return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(username)}&backgroundColor=d4a843,cd7f32,b8860b&textColor=ffffff&fontSize=40`;
}

/* ── Confetti ────────────────────────────────────────────── */
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
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: `${p.x}%`, y: "-5%", rotate: 0, opacity: 1 }}
          animate={{
            y: "110%",
            rotate: p.rotation,
            x: `${p.x + (Math.random() - 0.5) * 20}%`,
            opacity: [1, 1, 0.5, 0],
          }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
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

/* ── Sound ───────────────────────────────────────────────── */
function playTickSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 800 + Math.random() * 400;
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  } catch { /* noop */ }
}

function playVictorySound() {
  try {
    const ctx = new AudioContext();
    const duration = 2;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < bufferSize; i++) {
        const t = i / ctx.sampleRate;
        const envelope = Math.exp(-t * 1.5) * Math.min(1, t * 10);
        data[i] = (Math.random() * 2 - 1) * 0.12 * envelope;
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
    if (navigator.vibrate) navigator.vibrate([100, 50, 200]);
  } catch { /* noop */ }
}

/* ── Constants ───────────────────────────────────────────── */
const ITEM_WIDTH = 100; // px per avatar slot
const ITEM_GAP = 12;    // px gap
const SLOT_SIZE = ITEM_WIDTH + ITEM_GAP;
const SPIN_DURATION = 5000; // ms total spin time
const MIN_ITEMS = 40;       // minimum items in the strip for good spin

/* ── Main Component ──────────────────────────────────────── */
export default function GiveawaySpin({ winner, participants, prize, onDismiss }: GiveawaySpinProps) {
  const [phase, setPhase] = useState<"idle" | "spinning" | "landed" | "celebration">("idle");
  const stripRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const lastTickSlot = useRef(-1);

  // Build the strip: repeat participants to fill MIN_ITEMS, place winner near end
  const strip = useMemo(() => {
    if (!winner || participants.length === 0) return [];

    const pool = participants.length > 0 ? participants : [{ twitch_id: "0", twitch_username: "?" }];

    // Build a long strip by repeating the pool
    const items: SpinParticipant[] = [];
    while (items.length < MIN_ITEMS) {
      // Shuffle each batch for randomness
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      items.push(...shuffled);
    }

    // Place the winner at a specific position near the end (e.g., position MIN_ITEMS - 5)
    const winnerIndex = items.length - 5;
    items[winnerIndex] = { twitch_id: winner.twitch_id, twitch_username: winner.twitch_username };

    return items;
  }, [winner, participants]);

  // The winner is at strip.length - 5
  const winnerIndex = strip.length - 5;

  // Reset on new winner
  useEffect(() => {
    if (winner && participants.length > 0) {
      setPhase("spinning");
    } else {
      setPhase("idle");
    }
  }, [winner, participants.length]);

  // Animate the spin using CSS transform for smooth easing
  useEffect(() => {
    if (phase !== "spinning" || !stripRef.current) return;

    const el = stripRef.current;
    const containerWidth = el.parentElement?.clientWidth ?? 600;
    const centerOffset = containerWidth / 2 - ITEM_WIDTH / 2;

    // Target: scroll so the winner is centered under the pointer
    const targetX = winnerIndex * SLOT_SIZE - centerOffset;

    // Start position
    el.style.transition = "none";
    el.style.transform = `translateX(${centerOffset}px)`;

    // Force reflow
    el.getBoundingClientRect();

    // Start spin — use a custom cubic-bezier for slot-machine feel (fast start, slow end)
    requestAnimationFrame(() => {
      el.style.transition = `transform ${SPIN_DURATION}ms cubic-bezier(0.15, 0.85, 0.25, 1)`;
      el.style.transform = `translateX(${-targetX}px)`;
    });

    // Tick sounds during spin
    const startTime = Date.now();
    const tickLoop = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed >= SPIN_DURATION) return;

      // Calculate current position
      const progress = elapsed / SPIN_DURATION;
      // Approximate the cubic-bezier easing
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentX = eased * targetX;
      const currentSlot = Math.floor(currentX / SLOT_SIZE);

      if (currentSlot !== lastTickSlot.current && currentSlot >= 0) {
        lastTickSlot.current = currentSlot;
        playTickSound();
      }

      animFrameRef.current = requestAnimationFrame(tickLoop);
    };
    animFrameRef.current = requestAnimationFrame(tickLoop);

    // When spin ends
    const timeout = setTimeout(() => {
      setPhase("landed");
      // Brief pause then celebration
      setTimeout(() => {
        playVictorySound();
        setPhase("celebration");
      }, 800);
    }, SPIN_DURATION + 100);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [phase, winnerIndex]);

  // Cleanup on dismiss
  const handleDismiss = useCallback(() => {
    setPhase("idle");
    lastTickSlot.current = -1;
    onDismiss();
  }, [onDismiss]);

  if (!winner || phase === "idle") return null;

  return (
    <AnimatePresence>
      <motion.div
        key="spin-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        className="fixed inset-0 z-[55] flex flex-col items-center justify-center"
        onClick={phase === "celebration" ? handleDismiss : undefined}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />

        {/* Confetti — only after landing */}
        {phase === "celebration" && <Confetti />}

        {/* Content */}
        <div className="relative z-10 w-full max-w-3xl px-4">
          {/* Title */}
          <motion.h2
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center text-xl sm:text-2xl text-arena-gold/80 font-[family-name:var(--font-display)] tracking-[0.2em] uppercase mb-8"
          >
            {phase === "celebration" ? "Victor da Arena" : "A Sortear..."}
          </motion.h2>

          {/* Sword pointer — centered above the strip */}
          <div className="flex justify-center mb-1 relative z-20">
            <div className="flex flex-col items-center">
              <span className="text-3xl" style={{ filter: "drop-shadow(0 2px 6px rgba(212,168,67,0.6))" }}>⚔️</span>
              <div className="w-0.5 h-4 bg-arena-gold/60" />
            </div>
          </div>

          {/* Spin strip container */}
          <div className="relative overflow-hidden rounded-xl border-2 border-arena-gold/30 bg-black/60 backdrop-blur-md py-4">
            {/* Edge fade overlays */}
            <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-black/90 to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-black/90 to-transparent z-10 pointer-events-none" />

            {/* Scrolling strip */}
            <div
              ref={stripRef}
              className="flex will-change-transform"
              style={{ gap: `${ITEM_GAP}px` }}
            >
              {strip.map((p, i) => {
                const isWinner = phase !== "spinning" && i === winnerIndex;
                return (
                  <div
                    key={`${p.twitch_id}-${i}`}
                    className={`flex-shrink-0 flex flex-col items-center transition-all duration-300 ${
                      isWinner ? "scale-110" : ""
                    }`}
                    style={{ width: ITEM_WIDTH }}
                  >
                    {/* Avatar */}
                    <div
                      className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 transition-all duration-500 ${
                        isWinner
                          ? "border-arena-gold shadow-[0_0_20px_rgba(212,168,67,0.6)] ring-2 ring-arena-gold/40"
                          : "border-white/20"
                      }`}
                    >
                      <img
                        src={twitchAvatar(p.twitch_username)}
                        alt={p.twitch_username}
                        className="w-full h-full object-cover"
                        draggable={false}
                      />
                    </div>
                    {/* Name */}
                    <p
                      className={`mt-1.5 text-xs font-medium truncate w-full text-center font-[family-name:var(--font-display)] tracking-wide ${
                        isWinner ? "text-arena-gold" : "text-arena-smoke/70"
                      }`}
                    >
                      {p.twitch_username}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Winner reveal after landing */}
          <AnimatePresence>
            {phase === "celebration" && (
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, type: "spring" }}
                className="text-center mt-8"
              >
                <h1
                  className="text-4xl sm:text-5xl font-bold text-arena-gold font-[family-name:var(--font-display)] tracking-wider mb-3"
                  style={{
                    textShadow: "0 0 30px rgba(212,168,67,0.6), 0 0 60px rgba(212,168,67,0.3), 0 4px 8px rgba(0,0,0,0.5)",
                  }}
                >
                  {winner.twitch_username}
                </h1>

                {prize && (
                  <p className="text-lg text-arena-smoke font-[family-name:var(--font-display)] tracking-wide">
                    Prémio: <span className="text-arena-gold-light">{prize}</span>
                  </p>
                )}

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.5 }}
                  transition={{ delay: 2 }}
                  className="mt-6 text-xs text-arena-smoke/50 font-[family-name:var(--font-display)] tracking-wider"
                >
                  Clica para fechar
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
