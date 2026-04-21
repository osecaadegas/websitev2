"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import type { SpinHistoryRow, WheelSegmentRow } from "@/lib/supabase";

/* ═══════════════════════════════════════════════════════════════════
   TYPES & CONFIG
   ═══════════════════════════════════════════════════════════════════ */

interface Reward {
  label: string;
  icon: string;
  color: string;
  glowColor: string;
  tier: "legendary" | "epic" | "rare" | "common" | "loss";
  weight: number;
}

/* Fallback rewards used until DB segments load */
const FALLBACK_REWARDS: Reward[] = [
  { label: "Jackpot",     icon: "👑", color: "#d4a843", glowColor: "rgba(212,168,67,0.6)",  tier: "legendary", weight: 5 },
  { label: "Free Spin",   icon: "🔄", color: "#cd7f32", glowColor: "rgba(205,127,50,0.5)",  tier: "rare",      weight: 10 },
  { label: "Bonus Coins", icon: "🪙", color: "#f0d78c", glowColor: "rgba(240,215,140,0.5)", tier: "common",    weight: 20 },
  { label: "XP Boost",    icon: "⚡", color: "#ff6f00", glowColor: "rgba(255,111,0,0.5)",   tier: "common",    weight: 20 },
  { label: "Mystery",     icon: "🎭", color: "#9c27b0", glowColor: "rgba(156,39,176,0.5)",  tier: "epic",      weight: 8 },
  { label: "Defeat",      icon: "💀", color: "#8b0000", glowColor: "rgba(139,0,0,0.5)",     tier: "loss",      weight: 15 },
  { label: "Bonus Coins", icon: "🪙", color: "#f0d78c", glowColor: "rgba(240,215,140,0.5)", tier: "common",    weight: 20 },
  { label: "Free Spin",   icon: "🔄", color: "#cd7f32", glowColor: "rgba(205,127,50,0.5)",  tier: "rare",      weight: 10 },
  { label: "XP Boost",    icon: "⚡", color: "#ff6f00", glowColor: "rgba(255,111,0,0.5)",   tier: "common",    weight: 20 },
  { label: "Defeat",      icon: "💀", color: "#8b0000", glowColor: "rgba(139,0,0,0.5)",     tier: "loss",      weight: 15 },
];

function segmentRowToReward(row: WheelSegmentRow): Reward {
  return {
    label: row.label,
    icon: row.icon,
    color: row.color,
    glowColor: row.glow_color,
    tier: row.tier,
    weight: row.weight,
  };
}

/** Pick a weighted-random index from the rewards array */
function weightedRandom(rewards: Reward[]): number {
  const totalWeight = rewards.reduce((sum, r) => sum + r.weight, 0);
  let roll = Math.random() * totalWeight;
  for (let i = 0; i < rewards.length; i++) {
    roll -= rewards[i].weight;
    if (roll <= 0) return i;
  }
  return rewards.length - 1;
}

const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const STORAGE_KEY = "arena-spin-last";

interface HistoryEntry {
  player: string;
  reward: string;
  icon: string;
  color: string;
  tier: string;
  time: number;
}

/* ═══════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════ */

function getLastSpin(): number | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? parseInt(stored, 10) : null;
}

function setLastSpin(time: number) {
  localStorage.setItem(STORAGE_KEY, time.toString());
}

function canSpin(): boolean {
  const last = getLastSpin();
  if (!last) return true;
  return Date.now() - last >= COOLDOWN_MS;
}

function getRemainingMs(): number {
  const last = getLastSpin();
  if (!last) return 0;
  return Math.max(0, COOLDOWN_MS - (Date.now() - last));
}

function formatCountdown(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

async function fetchHistory(): Promise<HistoryEntry[]> {
  const { data } = await supabase
    .from("spin_history")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (!data) return [];
  return (data as SpinHistoryRow[]).map((row) => ({
    player: row.player,
    reward: row.reward,
    icon: row.icon,
    color: row.color,
    tier: row.tier,
    time: new Date(row.created_at).getTime(),
  }));
}

async function addHistory(entry: HistoryEntry) {
  await supabase.from("spin_history").insert({
    player: entry.player,
    reward: entry.reward,
    icon: entry.icon,
    color: entry.color,
    tier: entry.tier,
  });
}

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

const GLADIATOR_NAMES = [
  "Maximus", "Spartacus", "Seca", "Crixus", "Flamma",
  "Commodus", "Verus", "Priscus", "Carpophorus", "Tetraites",
  "Hermes", "Tigris", "Spiculus", "Triumphus", "Gannicus",
];

function randomGladiator(): string {
  return GLADIATOR_NAMES[Math.floor(Math.random() * GLADIATOR_NAMES.length)];
}

/* ═══════════════════════════════════════════════════════════════════
   EMBER PARTICLES (ambient)
   ═══════════════════════════════════════════════════════════════════ */

function EmberCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      if (!canvas) return;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx!.scale(dpr, dpr);
    }
    resize();
    window.addEventListener("resize", resize);

    interface Particle { x: number; y: number; r: number; vx: number; vy: number; alpha: number; decay: number; hue: number }
    const particles: Particle[] = [];

    function spawnParticle() {
      if (!canvas) return;
      particles.push({
        x: Math.random() * canvas.offsetWidth,
        y: canvas.offsetHeight + 10,
        r: 1 + Math.random() * 2.5,
        vx: (Math.random() - 0.5) * 0.6,
        vy: -(0.3 + Math.random() * 0.8),
        alpha: 0.5 + Math.random() * 0.5,
        decay: 0.002 + Math.random() * 0.003,
        hue: 15 + Math.random() * 25,
      });
    }

    function loop() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      if (Math.random() < 0.15) spawnParticle();
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx + Math.sin(Date.now() * 0.001 + i) * 0.15;
        p.y += p.vy;
        p.alpha -= p.decay;
        if (p.alpha <= 0) { particles.splice(i, 1); continue; }
        ctx.beginPath();
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.5);
        grad.addColorStop(0, `hsla(${p.hue}, 100%, 60%, ${p.alpha})`);
        grad.addColorStop(1, `hsla(${p.hue}, 100%, 40%, 0)`);
        ctx.fillStyle = grad;
        ctx.arc(p.x, p.y, p.r * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      animId = requestAnimationFrame(loop);
    }
    loop();

    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 w-full h-full" style={{ opacity: 0.6 }} />;
}

/* ═══════════════════════════════════════════════════════════════════
   BURST CANVAS — victory sparks
   ═══════════════════════════════════════════════════════════════════ */

function BurstCanvas({ active, color }: { active: boolean; color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);

    const cxC = canvas.offsetWidth / 2;
    const cyC = canvas.offsetHeight / 2;

    interface Spark { x: number; y: number; vx: number; vy: number; r: number; alpha: number; decay: number }
    const sparks: Spark[] = [];
    for (let i = 0; i < 80; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 8;
      sparks.push({ x: cxC, y: cyC, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: 1.5 + Math.random() * 3, alpha: 1, decay: 0.01 + Math.random() * 0.012 });
    }

    let animId: number;
    function loop() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      let alive = false;
      for (const s of sparks) {
        s.x += s.vx; s.y += s.vy; s.vy += 0.06; s.alpha -= s.decay;
        if (s.alpha <= 0) continue;
        alive = true;
        ctx.beginPath();
        ctx.fillStyle = color.replace(")", `,${s.alpha})`).replace("rgb", "rgba");
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (alive) animId = requestAnimationFrame(loop);
    }
    loop();
    return () => cancelAnimationFrame(animId);
  }, [active, color]);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 w-full h-full" />;
}

/* ═══════════════════════════════════════════════════════════════════
   SVG WHEEL — vertical text in segments
   ═══════════════════════════════════════════════════════════════════ */

function WheelSVG({ rewards }: { rewards: Reward[] }) {
  const segCount = rewards.length;
  const segAngle = 360 / segCount;
  const size = 400;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 10;

  function segmentPath(index: number) {
    const startAngle = (index * segAngle - 90) * (Math.PI / 180);
    const endAngle = ((index + 1) * segAngle - 90) * (Math.PI / 180);
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = segAngle > 180 ? 1 : 0;
    return `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2} Z`;
  }

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full" aria-hidden="true">
      <defs>
        <radialGradient id="rimGrad" cx="50%" cy="50%" r="50%">
          <stop offset="82%" stopColor="#1a1a1a" />
          <stop offset="90%" stopColor="#2a2a2a" />
          <stop offset="95%" stopColor="#444" />
          <stop offset="100%" stopColor="#1a1a1a" />
        </radialGradient>
        <filter id="segShadow">
          <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000" floodOpacity="0.6" />
        </filter>
      </defs>

      {/* Outer metallic rim */}
      <circle cx={cx} cy={cy} r={r + 8} fill="url(#rimGrad)" stroke="#555" strokeWidth="1" />
      <circle cx={cx} cy={cy} r={r + 5} fill="none" stroke="#d4a843" strokeWidth="0.5" opacity="0.3" />

      {/* Rim tick marks */}
      {Array.from({ length: segCount * 3 }).map((_, i) => {
        const angle = (i * (360 / (segCount * 3)) - 90) * (Math.PI / 180);
        const isMajor = i % 3 === 0;
        const outerR = r + 6;
        const innerR = isMajor ? r - 2 : r + 1;
        return (
          <line
            key={`tick-${i}`}
            x1={cx + innerR * Math.cos(angle)} y1={cy + innerR * Math.sin(angle)}
            x2={cx + outerR * Math.cos(angle)} y2={cy + outerR * Math.sin(angle)}
            stroke={isMajor ? "#888" : "#555"} strokeWidth={isMajor ? 2 : 1}
          />
        );
      })}

      {/* Segments with vertical text */}
      {rewards.map((reward, i) => {
        const midAngleDeg = (i + 0.5) * segAngle;
        const midAngle = (midAngleDeg - 90) * (Math.PI / 180);
        const segColors = ["rgba(18,18,18,0.97)", "rgba(28,26,22,0.97)"];
        const letters = reward.label.toUpperCase().split("");

        const iconR = r * 0.85;
        const letterStartR = r * 0.73;
        const letterStep = Math.min((r * 0.40) / Math.max(letters.length, 1), 13);

        return (
          <g key={i}>
            <path d={segmentPath(i)} fill={segColors[i % 2]} stroke="rgba(80,70,50,0.35)" strokeWidth="1" filter="url(#segShadow)" />

            {/* Emoji icon at outer edge */}
            <text
              x={cx + iconR * Math.cos(midAngle)} y={cy + iconR * Math.sin(midAngle)}
              textAnchor="middle" dominantBaseline="central" fontSize="17"
              transform={`rotate(${midAngleDeg}, ${cx + iconR * Math.cos(midAngle)}, ${cy + iconR * Math.sin(midAngle)})`}
            >{reward.icon}</text>

            {/* Letters stacked along radial line inward */}
            {letters.map((letter, li) => {
              const lr = letterStartR - li * letterStep;
              const lx = cx + lr * Math.cos(midAngle);
              const ly = cy + lr * Math.sin(midAngle);
              return (
                <text
                  key={li} x={lx} y={ly}
                  textAnchor="middle" dominantBaseline="central"
                  fontSize="8" fontWeight="800" fill={reward.color}
                  fontFamily="'Cinzel', serif" opacity="0.85"
                  transform={`rotate(${midAngleDeg}, ${lx}, ${ly})`}
                >{letter}</text>
              );
            })}
          </g>
        );
      })}

      {/* Center hub ring */}
      <circle cx={cx} cy={cy} r={r * 0.24} fill="#141414" stroke="#555" strokeWidth="1.5" />
      <circle cx={cx} cy={cy} r={r * 0.23} fill="none" stroke="#d4a843" strokeWidth="0.5" opacity="0.25" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   POINTER
   ═══════════════════════════════════════════════════════════════════ */

function Pointer() {
  return (
    <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20" style={{ marginTop: "-28px" }}>
      <svg width="36" height="64" viewBox="0 0 36 64" fill="none">
        {/* Cross-guard */}
        <rect x="6" y="14" width="24" height="5" rx="1.5" fill="#b8860b" stroke="#8b6914" strokeWidth="0.8" />
        <rect x="10" y="14.5" width="16" height="4" rx="1" fill="url(#guardShine)" opacity="0.3" />
        {/* Grip / handle */}
        <rect x="14" y="2" width="8" height="14" rx="2" fill="#3a2a1a" stroke="#5a4a2a" strokeWidth="0.6" />
        {/* Grip wrap lines */}
        <line x1="14.5" y1="5" x2="21.5" y2="5" stroke="#6b5a3a" strokeWidth="0.5" />
        <line x1="14.5" y1="8" x2="21.5" y2="8" stroke="#6b5a3a" strokeWidth="0.5" />
        <line x1="14.5" y1="11" x2="21.5" y2="11" stroke="#6b5a3a" strokeWidth="0.5" />
        {/* Pommel */}
        <circle cx="18" cy="3" r="3" fill="#b8860b" stroke="#8b6914" strokeWidth="0.6" />
        <circle cx="18" cy="3" r="1.2" fill="#c62828" />
        {/* Blade */}
        <polygon points="18,19 12,21 18,62 24,21" fill="#c0c0c0" stroke="#888" strokeWidth="0.5" />
        {/* Blade center ridge */}
        <line x1="18" y1="21" x2="18" y2="58" stroke="#e8e8e8" strokeWidth="1" opacity="0.5" />
        {/* Blade edge highlights */}
        <polygon points="18,19 13,21 18,58" fill="rgba(255,255,255,0.12)" />
        {/* Blade tip glow */}
        <ellipse cx="18" cy="62" rx="2" ry="1.5" fill="#d4a843" opacity="0.4" />
        <defs>
          <linearGradient id="guardShine" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   WIN HISTORY PANEL
   ═══════════════════════════════════════════════════════════════════ */

function WinHistory({ history }: { history: HistoryEntry[] }) {
  return (
    <div className="flex flex-col h-full min-h-0">
      <h3 className="gladiator-label text-xs text-arena-gold/80 mb-3 shrink-0">
        ⚔ Histórico
      </h3>
      <div className="flex-1 overflow-y-auto space-y-1 min-h-0 pr-1">
        {history.length === 0 ? (
          <p className="text-[11px] text-arena-ash/50 italic">Nenhum gladiador girou ainda...</p>
        ) : (
          history.map((entry, i) => (
            <motion.div
              key={`${entry.time}-${i}`}
              initial={i === 0 ? { opacity: 0, x: 20 } : false}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05]"
            >
              <span className="text-sm shrink-0">{entry.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-arena-white truncate">{entry.player}</p>
                <p className="text-[10px] truncate" style={{ color: entry.color }}>{entry.reward}</p>
              </div>
              <span className="text-[9px] text-arena-ash/50 shrink-0">{timeAgo(entry.time)}</span>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */

export function SpinWheel() {
  const [rewards, setRewards] = useState<Reward[]>(FALLBACK_REWARDS);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<Reward | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [screenShake, setScreenShake] = useState(false);
  const [flash, setFlash] = useState(false);
  const [burstActive, setBurstActive] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [mounted, setMounted] = useState(false);

  const SEGMENT_COUNT = rewards.length;
  const SEGMENT_ANGLE = 360 / SEGMENT_COUNT;

  const tickAudioRef = useRef<AudioContext | null>(null);
  const lastSegmentRef = useRef(-1);
  const spinAnimRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
    setCooldown(getRemainingMs());
    fetchHistory().then(setHistory);

    // Fetch wheel segments from DB
    fetch("/api/wheel-segments")
      .then((r) => r.json())
      .then((d) => {
        if (d.segments && d.segments.length > 0) {
          const active = (d.segments as WheelSegmentRow[]).filter((s) => s.is_active);
          if (active.length > 0) setRewards(active.map(segmentRowToReward));
        }
      })
      .catch(() => {/* use fallback */});

    // Realtime: listen for new spins from other users
    const channel = supabase
      .channel("spin_history_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "spin_history" }, (payload) => {
        const row = payload.new as SpinHistoryRow;
        const entry: HistoryEntry = {
          player: row.player,
          reward: row.reward,
          icon: row.icon,
          color: row.color,
          tier: row.tier,
          time: new Date(row.created_at).getTime(),
        };
        setHistory((prev) => [entry, ...prev].slice(0, 50));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);
  useEffect(() => {
    const interval = setInterval(() => setCooldown(getRemainingMs()), 1000);
    return () => clearInterval(interval);
  }, []);

  const playTick = useCallback((frequency = 800, duration = 0.03) => {
    try {
      if (!tickAudioRef.current) tickAudioRef.current = new AudioContext();
      const ctx = tickAudioRef.current;
      if (ctx.state === "suspended") ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = frequency; osc.type = "square";
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + duration);
    } catch { /* noop */ }
  }, []);

  const playImpact = useCallback(() => {
    try {
      if (!tickAudioRef.current) tickAudioRef.current = new AudioContext();
      const ctx = tickAudioRef.current;
      if (ctx.state === "suspended") ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 120; osc.type = "sawtooth";
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.2);
    } catch { /* noop */ }
  }, []);

  const triggerShake = useCallback(() => {
    setScreenShake(true);
    setTimeout(() => setScreenShake(false), 300);
  }, []);

  const triggerFlash = useCallback(() => {
    setFlash(true);
    setTimeout(() => setFlash(false), 400);
  }, []);

  /* ── SPIN ────────────────────────────────────────────────── */
  const spin = useCallback(() => {
    if (spinning || !canSpin()) return;
    if (!tickAudioRef.current) tickAudioRef.current = new AudioContext();

    setResult(null); setShowResult(false); setBurstActive(false);
    setSpinning(true); setZoom(true);
    if (hapticsEnabled) vibrate([40, 20, 60]);

    const winnerIndex = weightedRandom(rewards);
    const extraSpins = 5 + Math.floor(Math.random() * 3);
    const targetSegAngle = winnerIndex * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
    const totalDelta = extraSpins * 360 + (360 - targetSegAngle);
    const startRotation = rotation % 360;

    const DURATION = 6000;
    const startTime = performance.now();
    lastSegmentRef.current = -1;

    function easeOutQuart(t: number) { return 1 - Math.pow(1 - t, 4); }

    function animate(now: number) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / DURATION, 1);
      const currentRotation = startRotation + totalDelta * easeOutQuart(t);
      setRotation(currentRotation);

      const normalised = ((currentRotation % 360) + 360) % 360;
      const currentSegment = Math.floor(normalised / SEGMENT_ANGLE) % rewards.length;
      if (currentSegment !== lastSegmentRef.current) {
        lastSegmentRef.current = currentSegment;
        playTick(600 + Math.random() * 400, 0.02 + t * 0.02);
        if (hapticsEnabled) vibrate([10]);
      }

      if (t < 1) {
        spinAnimRef.current = requestAnimationFrame(animate);
      } else {
        setSpinning(false); setZoom(false);
        setLastSpin(Date.now()); setCooldown(COOLDOWN_MS);

        const winner = rewards[winnerIndex];
        setResult(winner);
        playImpact(); triggerShake();
        if (hapticsEnabled) vibrate([80, 30, 120]);

        addHistory({ player: randomGladiator(), reward: winner.label, icon: winner.icon, color: winner.color, tier: winner.tier, time: Date.now() });

        setTimeout(() => {
          triggerFlash();
          if (winner.tier !== "loss") {
            setBurstActive(true);
            if (winner.tier === "legendary" || winner.tier === "epic") {
              if (hapticsEnabled) vibrate([50, 30, 50, 30, 100]);
            } else {
              if (hapticsEnabled) vibrate([60]);
            }
          } else {
            if (hapticsEnabled) vibrate([30, 50, 30]);
          }
          setShowResult(true);
        }, 300);
      }
    }

    spinAnimRef.current = requestAnimationFrame(animate);
  }, [spinning, rotation, hapticsEnabled, playTick, playImpact, triggerShake, triggerFlash, rewards, SEGMENT_ANGLE, SEGMENT_COUNT]);

  useEffect(() => { return () => { if (spinAnimRef.current) cancelAnimationFrame(spinAnimRef.current); }; }, []);

  const isOnCooldown = mounted && cooldown > 0 && !canSpin();

  const resultTitle = result
    ? result.tier === "loss" ? "DEFEAT"
    : result.tier === "legendary" ? "GLÓRIA SUPREMA!"
    : result.tier === "epic" ? "VITÓRIA ÉPICA!"
    : "GANHÁSTE GLÓRIA"
    : "";

  return (
    <div className={`h-full w-full flex flex-col items-center justify-center transition-transform duration-300 relative ${screenShake ? "animate-[shake_0.3s_ease-in-out]" : ""}`}>

      {/* ── FULL-AREA BACKGROUND ──────────────────────── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0"><EmberCanvas /></div>
      <div className="fixed inset-0 pointer-events-none z-0 bg-[radial-gradient(circle,transparent_30%,rgba(0,0,0,0.5)_100%)]" />

      {/* ── CENTER: Wheel + Controls ─────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center min-w-0 relative w-full">

        {/* Flash */}
        <AnimatePresence>
          {flash && (
            <motion.div initial={{ opacity: 0.7 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}
              className="absolute inset-0 z-40 pointer-events-none"
              style={{ background: result?.tier === "loss" ? "radial-gradient(circle, rgba(139,0,0,0.4), transparent 60%)" : "radial-gradient(circle, rgba(212,168,67,0.5), transparent 60%)" }}
            />
          )}
        </AnimatePresence>

        <div className="relative z-10 flex flex-col items-center">
          {/* Wheel */}
          <div className={`relative w-[min(85vw,420px)] lg:w-[min(60vh,480px)] aspect-square transition-transform duration-500 ${zoom ? "scale-[1.04]" : "scale-100"}`}>
            <Pointer />

            <div className="absolute inset-0 rounded-full transition-shadow duration-500"
              style={{ boxShadow: spinning ? "0 0 50px rgba(212,168,67,0.25), 0 0 100px rgba(139,0,0,0.15)" : "0 0 25px rgba(0,0,0,0.5)" }}
            />

            {/* Rotating wheel disc */}
            <div className="w-full h-full" style={{ transform: `rotate(${rotation}deg)`, willChange: spinning ? "transform" : "auto" }}>
              <WheelSVG rewards={rewards} />
            </div>

            {/* Static center mascot — does NOT rotate */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="w-[22%] h-[22%] rounded-full overflow-hidden border-2 border-arena-gold/30 shadow-[0_0_20px_rgba(212,168,67,0.15)] bg-arena-dark">
                <Image src="/images/superbruta.png" alt="Superbruta" width={120} height={120} className="w-full h-full object-cover" priority />
              </div>
            </div>

            {/* Burst */}
            {burstActive && result && (
              <div className="absolute inset-0 z-30 pointer-events-none">
                <BurstCanvas active={burstActive} color={result.color} />
              </div>
            )}

            {/* Win overlay ON TOP of wheel */}
            <AnimatePresence>
              {showResult && result && (
                <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="absolute inset-0 z-40 flex items-center justify-center"
                >
                  <div className="rounded-2xl px-5 py-4 text-center backdrop-blur-md border max-w-[75%]"
                    style={{
                      borderColor: result.tier === "loss" ? "rgba(139,0,0,0.5)" : "rgba(212,168,67,0.4)",
                      background: result.tier === "loss" ? "rgba(20,10,10,0.93)" : "rgba(20,18,14,0.93)",
                      boxShadow: `0 0 60px ${result.glowColor}, inset 0 0 30px rgba(0,0,0,0.3)`,
                    }}
                  >
                    <p className="gladiator-subtitle text-[9px] mb-1"
                      style={{ color: result.tier === "loss" ? "#8b0000" : "#cd7f32" }}
                    >{result.tier === "loss" ? "O gladiador caiu..." : "O coliseu aclama!"}</p>
                    <p className="text-3xl mb-1">{result.icon}</p>
                    <h3 className="gladiator-title text-lg" style={{ color: result.color }}>{resultTitle}</h3>
                    <p className="mt-0.5 text-sm font-bold" style={{ color: result.color }}>{result.label}</p>
                    <button onClick={() => setShowResult(false)} className="mt-2 text-[9px] uppercase tracking-widest text-arena-ash hover:text-arena-smoke transition-colors">Fechar</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Button + cooldown */}
          <div className="mt-3 flex flex-col items-center gap-1.5">
            <button onClick={spin} disabled={spinning || isOnCooldown}
              className={`arena-btn-press relative px-7 py-2.5 rounded-xl gladiator-label text-xs font-black transition-all duration-300 border-2 overflow-hidden ${
                spinning || isOnCooldown
                  ? "border-arena-steel/30 bg-arena-dark text-arena-ash/50 cursor-not-allowed"
                  : "border-arena-gold/40 bg-gradient-to-b from-arena-charcoal to-arena-dark text-arena-gold hover:border-arena-gold/70 hover:shadow-[0_0_30px_rgba(212,168,67,0.2)] active:scale-95"
              }`}
            >
              {!spinning && !isOnCooldown && <span className="absolute inset-0 bg-gradient-to-r from-transparent via-arena-gold/10 to-transparent animate-[shimmer_3s_infinite]" />}
              <span className="relative z-10">{spinning ? "A GIRAR..." : isOnCooldown ? "ARENA FECHADA" : "⚔ SPIN FOR GLORY ⚔"}</span>
            </button>

            {isOnCooldown && !spinning && (
              <div className="text-center">
                <p className="text-[9px] uppercase tracking-[0.2em] text-arena-ash">Próximo combate em</p>
                <p className="font-mono text-sm text-arena-gold font-bold tracking-wider">{formatCountdown(cooldown)}</p>
              </div>
            )}

            <button onClick={() => setHapticsEnabled(!hapticsEnabled)} className="text-[9px] text-arena-ash/50 hover:text-arena-smoke transition-colors">
              Vibrações: {hapticsEnabled ? "ON" : "OFF"}
            </button>
          </div>
        </div>
      </div>

      {/* ── HISTORY — below wheel on mobile, floating top-right on desktop ── */}
      <div className="relative z-30 mx-4 mt-3 max-h-[25vh] rounded-xl border border-arena-gold/10 bg-arena-dark/90 backdrop-blur-md p-2.5 flex flex-col overflow-hidden shadow-[0_4px_30px_rgba(0,0,0,0.5)] lg:absolute lg:top-4 lg:right-4 lg:mx-0 lg:mt-0 lg:w-52 lg:max-h-[35vh] lg:p-3">
        <WinHistory history={history} />
      </div>
    </div>
  );
}
