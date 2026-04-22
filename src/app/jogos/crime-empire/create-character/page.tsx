"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

/* ─────────────────────────── DATA ─────────────────────────── */
interface ClassDef {
  id: string;
  name: string;
  image: string;
  tagline: string;
  flavor: string;
  bonuses: { icon: string; text: string }[];
  stats: { money: number; combat: number; intelligence: number; risk: number };
  glowColor: string;
  accentColor: string;
}

const CLASSES: ClassDef[] = [
  {
    id: "thief",
    name: "Ladrão",
    image: "/images/crime_empire/characters/thief.png",
    tagline: "Vives nas sombras. Cada erro custa liberdade.",
    flavor:
      "Nasceste para roubar. Cada fechadura é um convite, cada câmara um obstáculo. A cidade é o teu cofre — e tu tens a chave.",
    bonuses: [
      { icon: "💰", text: "+15% sucesso em crimes pequenos" },
      { icon: "💵", text: "+10% ganho de dinheiro sujo" },
    ],
    stats: { money: 60, combat: 35, intelligence: 55, risk: 75 },
    glowColor: "#9333ea",
    accentColor: "#c084fc",
  },
  {
    id: "hooligan",
    name: "Hooligan",
    image: "/images/crime_empire/characters/hooligan.png",
    tagline: "O medo é a tua moeda. A força é a tua lei.",
    flavor:
      "Não negoceias — dominas. As ruas respeitam-te porque não têm alternativa. Um olhar teu vale mil palavras.",
    bonuses: [
      { icon: "🏆", text: "+20% ganho de Respeito" },
      { icon: "⚡", text: "+15% boost em todos os itens equipados" },
    ],
    stats: { money: 40, combat: 85, intelligence: 25, risk: 60 },
    glowColor: "#dc2626",
    accentColor: "#f87171",
  },
  {
    id: "businessman",
    name: "Empresário",
    image: "/images/crime_empire/characters/businessman.png",
    tagline: "O crime mais lucrativo usa gravata.",
    flavor:
      "Enquanto os outros usam armas, tu usas contratos. O poder real não se ouve nem se vê — apenas se sente nas contas bancárias.",
    bonuses: [
      { icon: "🏢", text: "+20% lucro em negócios regulares" },
      { icon: "👥", text: "+30% capacidade de empregados" },
    ],
    stats: { money: 90, combat: 15, intelligence: 80, risk: 30 },
    glowColor: "#2563eb",
    accentColor: "#60a5fa",
  },
  {
    id: "hitman",
    name: "Assassino",
    image: "/images/crime_empire/characters/hitman.png",
    tagline: "Um alvo. Uma bala. Sem testemunhas.",
    flavor:
      "Não existem heróis neste mundo — apenas alvos que ainda não receberam o contrato. Tu és o executor silencioso.",
    bonuses: [
      { icon: "🎯", text: "+15% sucesso em contratos" },
      { icon: "🔓", text: "-50% risco de prisão em contratos" },
    ],
    stats: { money: 55, combat: 75, intelligence: 70, risk: 40 },
    glowColor: "#475569",
    accentColor: "#94a3b8",
  },
  {
    id: "scammer",
    name: "Burlão",
    image: "/images/crime_empire/characters/scammer.png",
    tagline: "A mente é a arma mais perigosa que existe.",
    flavor:
      "Nunca levantas a voz. Apenas fazes os outros acreditarem no que queres. Um sorriso vale mais do que qualquer pistola.",
    bonuses: [
      { icon: "🧠", text: "+15% sucesso em scams" },
      { icon: "🏦", text: "+10% taxa de lavagem de dinheiro" },
    ],
    stats: { money: 75, combat: 20, intelligence: 90, risk: 65 },
    glowColor: "#d97706",
    accentColor: "#fbbf24",
  },
  {
    id: "brute",
    name: "Bruto",
    image: "/images/crime_empire/characters/brute.png",
    tagline: "Não há problema que um soco não resolva.",
    flavor:
      "A subtileza é para os fracos. Tu entras pela frente, pegas no que é teu e sais com o dobro. Ninguém te para.",
    bonuses: [
      { icon: "⚔️", text: "+50% poder em PvP" },
      { icon: "💥", text: "Domina qualquer oponente em combate" },
    ],
    stats: { money: 30, combat: 95, intelligence: 10, risk: 50 },
    glowColor: "#ea580c",
    accentColor: "#fb923c",
  },
  {
    id: "dealer",
    name: "Traficante",
    image: "/images/crime_empire/characters/dealer.png",
    tagline: "O mercado negro tem dono. Esse dono és tu.",
    flavor:
      "Sabes o que toda a gente quer mas ninguém admite. O teu negócio nunca fecha — mesmo quando devia.",
    bonuses: [
      { icon: "🌿", text: "Vende drogas nas ruas (até 100g)" },
      { icon: "🛡️", text: "Menor risco e maiores quantidades" },
    ],
    stats: { money: 80, combat: 45, intelligence: 55, risk: 85 },
    glowColor: "#16a34a",
    accentColor: "#4ade80",
  },
  {
    id: "pimp",
    name: "Chulo",
    image: "/images/crime_empire/characters/pimp.png",
    tagline: "Controla o prazer. Controla o mundo.",
    flavor:
      "O negócio mais antigo do mundo — e tu és o seu rei. Trabalhadores leais, rendimento garantido. Enquanto a noite durar, o dinheiro não para.",
    bonuses: [
      { icon: "💋", text: "+20% income de brothel" },
      { icon: "👑", text: "2x capacidade de workers" },
    ],
    stats: { money: 85, combat: 30, intelligence: 60, risk: 45 },
    glowColor: "#db2777",
    accentColor: "#f472b6",
  },
];

type Step = "browse" | "preview" | "confirm" | "creating" | "done";

/* ─────────────────────────── STAT BAR ─────────────────────── */
function StatBar({
  label,
  value,
  color,
  delay = 0,
}: {
  label: string;
  value: number;
  color: string;
  delay?: number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-[10px] tracking-widest uppercase text-[#555]">{label}</span>
        <span className="text-[11px] font-bold tabular-nums" style={{ color }}>
          {value}
        </span>
      </div>
      <div className="h-[3px] bg-[#1a1a1a] rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: `linear-gradient(90deg, ${color}88, ${color})`,
            boxShadow: `0 0 6px ${color}60`,
          }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.7, ease: "easeOut", delay }}
        />
      </div>
    </div>
  );
}

/* ─────────────────────── MAIN COMPONENT ───────────────────── */
export default function CreateCharacter() {
  const router = useRouter();
  const [activeIdx, setActiveIdx] = useState(0);
  const [step, setStep] = useState<Step>("browse");
  const [error, setError] = useState("");

  const active = CLASSES[activeIdx];
  const total = CLASSES.length;

  const go = useCallback(
    (dir: number) => {
      if (step !== "browse") return;
      setActiveIdx((prev) => (prev + dir + total) % total);
    },
    [step, total]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
      if (e.key === "Escape" && (step === "preview" || step === "confirm"))
        setStep("browse");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [go, step]);

  const handleCreate = async () => {
    setStep("creating");
    setError("");
    try {
      const res = await fetch("/api/crime-empire/player", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ class: active.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao criar personagem");
        setStep("confirm");
        return;
      }
      setStep("done");
      setTimeout(() => router.push("/jogos/crime-empire/dashboard"), 2200);
    } catch {
      setError("Erro de ligação. Tenta novamente.");
      setStep("confirm");
    }
  };

  /* Card transform for carousel position */
  const getTransform = (idx: number) => {
    let offset = idx - activeIdx;
    if (offset > total / 2) offset -= total;
    if (offset < -total / 2) offset += total;
    const abs = Math.abs(offset);
    if (abs > 2) return null;
    return {
      x: offset * 300,
      scale: abs === 0 ? 1 : abs === 1 ? 0.78 : 0.60,
      rotateY: offset * -22,
      opacity: abs === 0 ? 1 : abs === 1 ? 0.55 : 0.20,
      zIndex: 20 - abs * 6,
      isActive: abs === 0,
    };
  };

  return (
    <div className="flex-1 relative overflow-hidden bg-[#070707] flex flex-col" style={{ minHeight: "calc(100vh - 4rem)" }}>

      {/* ANIMATED BG GLOW */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{
          background: `radial-gradient(ellipse 80% 55% at 50% 20%, ${active.glowColor}1a 0%, transparent 65%)`,
        }}
        transition={{ duration: 0.9, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-64 pointer-events-none"
        animate={{
          background: `linear-gradient(to top, ${active.glowColor}10, transparent)`,
        }}
        transition={{ duration: 0.9, ease: "easeInOut" }}
      />
      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 130% 120% at 50% 50%, transparent 35%, rgba(0,0,0,0.85) 100%)",
        }}
      />
      {/* Noise grain */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "200px 200px",
        }}
      />

      {/* HEADER */}
      <div className="relative z-10 pt-5 pb-1 text-center px-6">
        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[10px] tracking-[0.4em] uppercase font-bold mb-2"
          style={{ color: active.glowColor }}
        >
          Crime Empire
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="text-3xl md:text-5xl font-black text-white tracking-tight leading-none"
        >
          ESCOLHE A TUA IDENTIDADE
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.18 }}
          className="text-[#444] mt-2 text-xs tracking-wider"
        >
          Esta decisão é permanente · Escolhe com cuidado
        </motion.p>
      </div>

      {/* 3D CAROUSEL */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center py-1">
        <div
          className="relative w-full flex items-center justify-center"
          style={{ perspective: "1200px", height: "400px" }}
        >
          {CLASSES.map((cls, idx) => {
            const t = getTransform(idx);
            if (!t) return null;

            return (
              <motion.div
                key={cls.id}
                animate={{
                  x: t.x,
                  scale: t.scale,
                  rotateY: t.rotateY,
                  opacity: t.opacity,
                  zIndex: t.zIndex,
                }}
                transition={{ type: "spring", stiffness: 280, damping: 32 }}
                onClick={() => {
                  if (t.isActive) {
                    setStep("preview");
                  } else {
                    setActiveIdx(idx);
                  }
                }}
                className="absolute cursor-pointer"
                style={{ transformStyle: "preserve-3d", width: 272 }}
              >
                <div
                  className="rounded-2xl overflow-hidden transition-shadow duration-500"
                  style={{
                    background:
                      "linear-gradient(160deg, rgba(255,255,255,0.045) 0%, rgba(0,0,0,0.55) 100%)",
                    backdropFilter: "blur(16px)",
                    border: `1px solid ${t.isActive ? cls.glowColor + "70" : "rgba(255,255,255,0.07)"}`,
                    boxShadow: t.isActive
                      ? `0 0 40px ${cls.glowColor}45, 0 0 90px ${cls.glowColor}18, inset 0 1px 0 rgba(255,255,255,0.08)`
                      : "0 8px 32px rgba(0,0,0,0.6)",
                  }}
                >
                  <div
                    className="h-[2px]"
                    style={{
                      background: `linear-gradient(90deg, transparent 0%, ${cls.glowColor} 50%, transparent 100%)`,
                    }}
                  />

                  <div className="px-5 pt-4 pb-5">
                    <div className="relative w-36 h-36 mx-auto mb-3">
                      {t.isActive && (
                        <motion.div
                          className="absolute inset-[-10px] rounded-full"
                          animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0.8, 0.5] }}
                          transition={{
                            duration: 3.2,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }}
                          style={{
                            background: `radial-gradient(circle, ${cls.glowColor}70 0%, transparent 70%)`,
                          }}
                        />
                      )}
                      <div
                        className="w-full h-full rounded-full overflow-hidden relative z-10 border-2"
                        style={{ borderColor: cls.glowColor }}
                      >
                        <Image
                          src={cls.image}
                          alt={cls.name}
                          width={144}
                          height={144}
                          className="w-full h-full object-contain bg-[#0a0a0a]"
                        />
                      </div>
                    </div>

                    <h2 className="text-xl font-black text-center text-white mb-1 leading-tight">
                      {cls.name}
                    </h2>
                    <p
                      className="text-[11px] text-center italic mb-4 leading-snug"
                      style={{ color: cls.accentColor }}
                    >
                      &quot;{cls.tagline}&quot;
                    </p>

                    {t.isActive && (
                      <motion.div
                        key={`stats-${cls.id}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-2.5 mb-5"
                      >
                        <StatBar label="Dinheiro" value={cls.stats.money} color={cls.accentColor} delay={0.05} />
                        <StatBar label="Combate" value={cls.stats.combat} color={cls.accentColor} delay={0.12} />
                        <StatBar label="Inteligência" value={cls.stats.intelligence} color={cls.accentColor} delay={0.19} />
                        <StatBar label="Risco" value={cls.stats.risk} color={cls.accentColor} delay={0.26} />
                      </motion.div>
                    )}

                    {t.isActive && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.35 }}
                        className="text-center"
                      >
                        <span
                          className="inline-block px-4 py-1.5 rounded-full text-[10px] font-bold tracking-[0.15em] uppercase"
                          style={{
                            background: `${cls.glowColor}25`,
                            border: `1px solid ${cls.glowColor}50`,
                            color: cls.accentColor,
                          }}
                        >
                          Clica para saber mais
                        </span>
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* NAVIGATION */}
        <div className="flex items-center gap-6 mt-2">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => go(-1)}
            className="w-11 h-11 rounded-full border border-[#2a2a2a] flex items-center justify-center text-white text-lg transition-colors hover:border-[#ff6a00] hover:text-[#ff6a00]"
          >
            ←
          </motion.button>

          <div className="flex gap-2 items-center">
            {CLASSES.map((_, i) => (
              <button
                key={i}
                onClick={() => { if (step === "browse") setActiveIdx(i); }}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === activeIdx ? 20 : 7,
                  height: 7,
                  background: i === activeIdx ? active.glowColor : "#2a2a2a",
                }}
              />
            ))}
          </div>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => go(1)}
            className="w-11 h-11 rounded-full border border-[#2a2a2a] flex items-center justify-center text-white text-lg transition-colors hover:border-[#ff6a00] hover:text-[#ff6a00]"
          >
            →
          </motion.button>
        </div>

        <p className="text-[#2a2a2a] text-[10px] mt-2 tracking-widest">
          USE ← → PARA NAVEGAR
        </p>
      </div>

      {/* NEW PLAYER BONUS */}
      <div className="relative z-10 px-6 pb-6 max-w-lg mx-auto w-full">
        <div className="rounded-xl border border-green-900/60 bg-green-950/25 px-4 py-3 flex items-center gap-3">
          <span className="text-green-400 text-base">⚡</span>
          <div>
            <p className="text-green-500 text-[10px] font-bold tracking-widest uppercase">
              Bónus de Novo Jogador — 2 horas
            </p>
            <p className="text-green-900 text-[10px] mt-0.5">
              +30% crimes · +20% XP · Risco de prisão reduzido
            </p>
          </div>
        </div>
      </div>

      {/* MODAL OVERLAY */}
      <AnimatePresence>
        {(step === "preview" ||
          step === "confirm" ||
          step === "creating" ||
          step === "done") && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.9)", backdropFilter: "blur(10px)" }}
          >
            <motion.div
              key="modal-card"
              initial={{ scale: 0.9, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 16 }}
              transition={{ type: "spring", stiffness: 280, damping: 28 }}
              className="relative w-full max-w-md rounded-3xl overflow-hidden"
              style={{
                background: "linear-gradient(160deg, #111116 0%, #0b0b10 100%)",
                border: `1px solid ${active.glowColor}55`,
                boxShadow: `0 0 60px ${active.glowColor}28, 0 0 140px ${active.glowColor}0e`,
              }}
            >
              <div
                className="h-[2px]"
                style={{
                  background: `linear-gradient(90deg, transparent, ${active.glowColor}, ${active.accentColor}, ${active.glowColor}, transparent)`,
                }}
              />

              {/* DONE STATE */}
              <AnimatePresence>
                {step === "done" && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-3xl"
                    style={{
                      background: `linear-gradient(160deg, ${active.glowColor}e0, #050505f0)`,
                    }}
                  >
                    <motion.div
                      initial={{ scale: 0, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 220, delay: 0.1 }}
                      className="text-8xl mb-5"
                    >
                      ✅
                    </motion.div>
                    <motion.h2
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="text-4xl font-black text-white text-center tracking-tight"
                    >
                      {active.name.toUpperCase()}
                    </motion.h2>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className="text-white/60 mt-2 text-sm text-center"
                    >
                      A tua identidade criminal foi selada.
                    </motion.p>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.85 }}
                      className="text-[10px] mt-5 tracking-[0.3em] uppercase"
                      style={{ color: active.accentColor }}
                    >
                      A entrar no jogo...
                    </motion.p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="p-7">
                {/* Portrait + name */}
                <div className="flex items-center gap-5 mb-5">
                  <div
                    className="w-20 h-20 rounded-2xl overflow-hidden border-2 flex-shrink-0"
                    style={{
                      borderColor: active.glowColor,
                      boxShadow: `0 0 24px ${active.glowColor}50`,
                    }}
                  >
                    <Image
                      src={active.image}
                      alt={active.name}
                      width={80}
                      height={80}
                      className="w-full h-full object-contain bg-[#0a0a0a]"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-2xl font-black text-white leading-tight">
                      {active.name}
                    </h2>
                    <p
                      className="text-xs italic mt-1 leading-snug"
                      style={{ color: active.accentColor }}
                    >
                      &quot;{active.tagline}&quot;
                    </p>
                  </div>
                </div>

                {/* Flavor */}
                <p
                  className="text-[#777] text-sm mb-5 leading-relaxed border-l-2 pl-4"
                  style={{ borderColor: active.glowColor }}
                >
                  {active.flavor}
                </p>

                {/* Bonuses */}
                <div className="mb-5">
                  <p className="text-[9px] font-bold tracking-[0.25em] uppercase text-[#3a3a3a] mb-3">
                    Habilidades
                  </p>
                  <div className="space-y-2">
                    {active.bonuses.map((b, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <span className="text-base w-6 text-center flex-shrink-0">{b.icon}</span>
                        <span className="text-white/80">{b.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stats */}
                <div className="mb-5">
                  <p className="text-[9px] font-bold tracking-[0.25em] uppercase text-[#3a3a3a] mb-3">
                    Atributos
                  </p>
                  <div className="space-y-3">
                    <StatBar label="Dinheiro" value={active.stats.money} color={active.accentColor} delay={0} />
                    <StatBar label="Combate" value={active.stats.combat} color={active.accentColor} delay={0.08} />
                    <StatBar label="Inteligência" value={active.stats.intelligence} color={active.accentColor} delay={0.16} />
                    <StatBar label="Risco" value={active.stats.risk} color={active.accentColor} delay={0.24} />
                  </div>
                </div>

                {/* Confirm warning */}
                <AnimatePresence>
                  {step === "confirm" && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      className="mb-5 p-4 rounded-xl border border-red-800/70 bg-red-950/35"
                    >
                      <p className="text-red-400 font-bold text-sm flex items-center gap-2">
                        <span>⚠️</span> Esta escolha é permanente.
                      </p>
                      <p className="text-red-700 text-xs mt-1">
                        Não pode ser alterada. Tens a certeza que queres ser{" "}
                        <strong className="text-red-500">{active.name}</strong>?
                      </p>
                      {error && (
                        <p className="text-red-300 text-xs mt-2 font-medium">{error}</p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Buttons */}
                <div className="space-y-3">
                  {step === "preview" && (
                    <>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setStep("confirm")}
                        className="w-full py-3.5 rounded-xl font-black text-sm tracking-widest uppercase text-white transition-all"
                        style={{
                          background: `linear-gradient(135deg, ${active.glowColor}, ${active.accentColor})`,
                          boxShadow: `0 4px 20px ${active.glowColor}55`,
                        }}
                      >
                        Escolher {active.name}
                      </motion.button>
                      <button
                        onClick={() => setStep("browse")}
                        className="w-full py-3 rounded-xl text-sm text-[#555] hover:text-white border border-[#1e1e1e] hover:border-[#333] transition-all"
                      >
                        ← Ver outros
                      </button>
                    </>
                  )}

                  {step === "confirm" && (
                    <>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={handleCreate}
                        className="w-full py-3.5 rounded-xl font-black text-sm tracking-widest uppercase text-white transition-all"
                        style={{
                          background: "linear-gradient(135deg, #dc2626, #991b1b)",
                          boxShadow: "0 4px 24px rgba(220,38,38,0.45)",
                        }}
                      >
                        ✓ Confirmar Personagem
                      </motion.button>
                      <button
                        onClick={() => setStep("preview")}
                        className="w-full py-3 rounded-xl text-sm text-[#555] hover:text-white border border-[#1e1e1e] hover:border-[#333] transition-all"
                      >
                        ← Voltar
                      </button>
                    </>
                  )}

                  {step === "creating" && (
                    <div className="flex flex-col items-center py-5">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                        className="w-9 h-9 rounded-full border-2 border-t-transparent mb-3"
                        style={{ borderColor: `${active.glowColor} transparent ${active.glowColor} ${active.glowColor}` }}
                      />
                      <p className="text-[#555] text-sm">A selar a tua identidade...</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

