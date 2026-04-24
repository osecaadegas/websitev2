"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { WorkerDef, RARITY_CONFIG, WorkerRarity } from "@/lib/crime-empire/worker-defs";

interface WorkerCarouselProps {
  workers: WorkerDef[];
  ownedSlugs: string[];
  playerCash: number;
  playerCrypto: number;
  playerLevel: number;
  onHire: (def: WorkerDef) => void;
  onClose: () => void;
  hiring: boolean;
}

function StatBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
}

function RarityGlowBorder({ rarity, active }: { rarity: WorkerRarity; active: boolean }) {
  if (rarity === "elite") {
    return (
      <div
        className={`absolute inset-0 rounded-2xl pointer-events-none transition-all duration-500 ${
          active ? "opacity-100" : "opacity-0"
        }`}
        style={{
          background: "linear-gradient(135deg, rgba(245,158,11,0.4), rgba(251,191,36,0.1), rgba(245,158,11,0.4))",
          boxShadow: "0 0 80px rgba(245,158,11,0.6), inset 0 0 30px rgba(245,158,11,0.1)",
        }}
      />
    );
  }
  if (rarity === "rare") {
    return (
      <div
        className={`absolute inset-0 rounded-2xl pointer-events-none transition-all duration-500 ${
          active ? "opacity-100" : "opacity-0"
        }`}
        style={{
          boxShadow: "0 0 60px rgba(59,130,246,0.5), inset 0 0 20px rgba(59,130,246,0.1)",
        }}
      />
    );
  }
  return null;
}

function EliteParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-amber-400 animate-ping"
          style={{
            left: `${15 + i * 14}%`,
            top: `${10 + (i % 3) * 30}%`,
            animationDelay: `${i * 0.3}s`,
            animationDuration: "2s",
            opacity: 0.6,
          }}
        />
      ))}
    </div>
  );
}

export default function WorkerCarousel({
  workers,
  ownedSlugs,
  playerCash,
  playerCrypto,
  playerLevel,
  onHire,
  onClose,
  hiring,
}: WorkerCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hireAnim, setHireAnim] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const active = workers[activeIndex];
  const rarityConf = active ? RARITY_CONFIG[active.rarity] : null;
  const isOwned = active ? ownedSlugs.includes(active.slug) : false;
  const isLocked = active ? playerLevel < active.required_level : false;
  const canAfford = active && !isLocked
    ? active.hire_uses_crypto
      ? playerCrypto >= active.hire_price
      : playerCash >= active.hire_price
    : false;

  // Scroll track to active item
  useEffect(() => {
    if (!trackRef.current) return;
    const card = trackRef.current.children[activeIndex] as HTMLElement;
    if (!card) return;
    const trackWidth = trackRef.current.parentElement?.offsetWidth ?? 0;
    const cardLeft = card.offsetLeft;
    const cardWidth = card.offsetWidth;
    const scrollLeft = cardLeft + cardWidth / 2 - trackWidth / 2;
    trackRef.current.parentElement?.scrollTo({ left: scrollLeft, behavior: "smooth" });
  }, [activeIndex]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setActiveIndex((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setActiveIndex((i) => Math.min(workers.length - 1, i + 1));
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [workers.length, onClose]);

  // Mouse drag
  const onMouseDown = (e: React.MouseEvent) => {
    setDragStart(e.clientX);
    setIsDragging(false);
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (dragStart === null) return;
    if (Math.abs(e.clientX - dragStart) > 5) setIsDragging(true);
  };
  const onMouseUp = (e: React.MouseEvent) => {
    if (dragStart === null) return;
    const delta = dragStart - e.clientX;
    if (Math.abs(delta) > 60) {
      setActiveIndex((i) =>
        delta > 0 ? Math.min(workers.length - 1, i + 1) : Math.max(0, i - 1)
      );
    }
    setDragStart(null);
    setIsDragging(false);
  };

  // Touch drag
  const touchStart = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current === null) return;
    const delta = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 60) {
      setActiveIndex((i) =>
        delta > 0 ? Math.min(workers.length - 1, i + 1) : Math.max(0, i - 1)
      );
    }
    touchStart.current = null;
  };

  const handleHire = useCallback(() => {
    if (!active || isOwned || !canAfford || hiring || isLocked) return;
    setHireAnim(true);
    setTimeout(() => { setHireAnim(false); onHire(active); }, 600);
  }, [active, isOwned, canAfford, hiring, onHire]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  if (workers.length === 0) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm">
        <div className="text-center p-12">
          <p className="text-4xl mb-4">🔒</p>
          <p className="text-white text-lg font-bold">Sem workers disponíveis</p>
          <p className="text-[#666] mt-2">Todas as workers já foram contratadas ou não há vagas.</p>
          <button onClick={onClose} className="mt-6 px-6 py-3 rounded-xl bg-pink-700 hover:bg-pink-600 text-white font-bold transition-all">
            Fechar
          </button>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-black/95 backdrop-blur-md"
      ref={containerRef}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 sm:px-5 sm:py-2.5 border-b border-[#1a1a1a]">
        <div>
          <h2 className="text-lg sm:text-2xl font-black text-white">💋 Contratar Worker</h2>
          <p className="text-xs sm:text-sm text-[#666]">
            Saldo:{" "}
            <span className="text-green-400">${playerCash.toLocaleString()}</span>
            {" · "}
            <span className="text-yellow-400">🪙 {playerCrypto.toLocaleString()}</span>
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-[#1a1a1a] hover:bg-[#2a2a2a] text-[#888] hover:text-white transition-all text-lg flex-shrink-0"
        >
          ✕
        </button>
      </div>

      {/* Carousel track */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <div
          className="flex-1 overflow-x-hidden py-4 select-none cursor-grab active:cursor-grabbing min-h-0"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div
            ref={trackRef}
            className="flex items-center gap-4 sm:gap-6"
            style={{ willChange: "transform", paddingLeft: isMobile ? "calc(50vw - 130px)" : "38vw", paddingRight: isMobile ? "calc(50vw - 130px)" : "38vw" }}
          >
            {workers.map((w, i) => {
              const dist = Math.abs(i - activeIndex);
              const rc = RARITY_CONFIG[w.rarity];
              const owned = ownedSlugs.includes(w.slug);

              return (
                <div
                  key={w.slug}
                  onClick={() => { if (!isDragging) setActiveIndex(i); }}
                  className="relative flex-shrink-0 cursor-pointer"
                  style={{
                    transform: `scale(${dist === 0 ? 1 : dist === 1 ? 0.88 : 0.75}) translateY(${dist === 0 ? 0 : dist === 1 ? 8 : 20}px)`,
                    opacity: dist === 0 ? 1 : dist === 1 ? 0.72 : dist === 2 ? 0.35 : 0,
                    filter: dist > 1 ? "blur(1px)" : "none",
                    pointerEvents: dist > 2 ? "none" : "auto",
                    transition: "all 0.45s cubic-bezier(0.25, 0.1, 0.25, 1)",
                    zIndex: 10 - dist,
                    width: isMobile ? "260px" : "300px",
                  }}
                >
                  {/* Card */}
                  <div
                    className={`relative rounded-2xl overflow-hidden border-2 transition-all duration-500 ${
                      dist === 0 ? rc.border : "border-[#222]"
                    } ${dist === 0 ? rc.glow : ""} ${hireAnim && dist === 0 ? "scale-95 opacity-0" : ""}`}
                    style={{
                      background: "linear-gradient(180deg, #111 0%, #0a0a0a 100%)",
                      transition: hireAnim && dist === 0 ? "all 0.5s ease" : "all 0.45s cubic-bezier(0.25, 0.1, 0.25, 1)",
                    }}
                  >
                    {/* Rarity glow overlay */}
                    <RarityGlowBorder rarity={w.rarity} active={dist === 0} />
                    {w.rarity === "elite" && dist === 0 && <EliteParticles />}

                    {/* Image */}
                    <div className={`relative overflow-hidden ${isMobile ? "h-[320px]" : "h-[460px]"}`}>
                      <img
                        src={w.image}
                        alt={w.name}
                        className="w-full h-full object-cover object-top"
                        draggable={false}
                        style={{ userSelect: "none" }}
                      />
                      {/* Bottom gradient */}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/30 to-transparent" />

                      {/* Rarity badge */}
                      <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-bold ${rc.badge}`}>
                        {rc.star} {rc.label}
                      </div>

                      {/* Owned overlay */}
                      {owned && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <div className="bg-green-600 text-white font-black px-4 py-2 rounded-xl text-sm rotate-[-8deg]">
                            ✓ CONTRATADA
                          </div>
                        </div>
                      )}
                      {/* Locked overlay */}
                      {!owned && playerLevel < w.required_level && (
                        <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-2 backdrop-blur-[2px]">
                          <span className="text-3xl">🔒</span>
                          <div className="text-center px-2">
                            <p className="text-white font-black text-sm">Bloqueada</p>
                            <p className="text-[#bbb] text-xs">Nível {w.required_level} necessário</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="px-3 pb-3 pt-1.5">
                      <h3 className={`font-black text-lg truncate ${rc.color}`}>{w.name}</h3>
                      <p className="text-green-400 text-sm font-bold">${w.earnings_per_hour.toLocaleString()}/h</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {w.traits.slice(0, 2).map((t) => (
                          <span key={t} className={`text-xs px-2 py-0.5 rounded-full font-semibold ${rc.badge}`}>
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dot indicators */}
        <div className="flex justify-center gap-1.5 pb-3">
          {workers.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={`rounded-full transition-all duration-300 ${
                i === activeIndex
                  ? "w-5 h-1.5 bg-pink-500"
                  : "w-1.5 h-1.5 bg-[#333] hover:bg-[#555]"
              }`}
            />
          ))}
        </div>

        {/* Details panel — compact bottom strip */}
        {active && rarityConf && (
          <div className="flex-shrink-0 flex justify-center pb-3 px-3">
            <div
              className="rounded-2xl border overflow-hidden w-full max-w-xl"
              style={{
                background: "linear-gradient(135deg, #111 0%, #0d0d0d 100%)",
                borderColor:
                  active.rarity === "elite" ? "rgba(245,158,11,0.4)"
                  : active.rarity === "rare" ? "rgba(59,130,246,0.35)"
                  : "rgba(50,50,50,0.6)",
              }}
            >
              <div className="px-4 py-3 flex flex-col gap-2">
                {/* Row 1: name + rarity + traits */}
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className={`text-lg font-black ${rarityConf.color}`}>{active.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${rarityConf.badge}`}>
                    {rarityConf.star} {rarityConf.label}
                  </span>
                  {active.traits.slice(0, 3).map((t) => (
                    <span key={t} className={`text-xs px-2 py-0.5 rounded-full font-semibold ${rarityConf.badge}`}>{t}</span>
                  ))}
                </div>

                {/* Row 2: description */}
                {active.description && (
                  <p className="text-xs text-[#aaa] leading-relaxed line-clamp-2">
                    {active.description}
                  </p>
                )}

                {/* Row 3: stats + price/hire */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Stats mini grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs flex-1">
                    {[
                      { label: "Atrat.", val: active.stats.attractiveness, color: "bg-pink-500", text: "text-pink-300" },
                      { label: "Stamina", val: active.stats.stamina, color: "bg-blue-500", text: "text-blue-300" },
                      { label: "Mood", val: active.stats.mood, color: "bg-yellow-500", text: "text-yellow-300" },
                      { label: "Carisma", val: active.stats.charisma, color: "bg-purple-500", text: "text-purple-300" },
                    ].map(({ label, val, color, text }) => (
                      <div key={label}>
                        <div className="flex justify-between text-[#999] mb-0.5 font-medium">
                          <span>{label}</span><span className={`font-bold ${text}`}>{val}</span>
                        </div>
                        <StatBar value={val} color={color} />
                      </div>
                    ))}
                  </div>

                  {/* Earnings + price + hire */}
                  <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 sm:gap-1.5 flex-shrink-0 pt-1 sm:pt-0 border-t border-[#1e1e1e] sm:border-0">
                    <div className="text-right">
                      <span className="text-green-400 font-black text-lg">${active.earnings_per_hour.toLocaleString()}</span>
                      <span className="text-[#555] text-xs">/h</span>
                    </div>
                    <div className={`text-sm font-bold ${active.hire_uses_crypto ? "text-yellow-400" : "text-white"}`}>
                      {active.hire_uses_crypto ? "🪙" : "$"}{active.hire_price.toLocaleString()}
                    </div>
                    {isOwned ? (
                      <div className="px-4 py-1.5 rounded-xl bg-green-900/40 border border-green-500/40 text-green-400 text-xs font-bold">
                        ✓ Contratada
                      </div>
                    ) : isLocked ? (
                      <div className="px-4 py-2 rounded-xl bg-[#111] border border-[#333] text-center">
                        <p className="text-[#888] text-xs font-bold">🔒 Requer Nível {active.required_level}</p>
                        <p className="text-[#555] text-[10px]">Estás no nível {playerLevel} ({active.required_level - playerLevel} em falta)</p>
                      </div>
                    ) : (
                      <button
                        onClick={handleHire}
                        disabled={!canAfford || hiring}
                        className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all ${
                          canAfford && !hiring
                            ? active.rarity === "elite"
                              ? "bg-gradient-to-br from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 hover:scale-105 active:scale-95 shadow-[0_0_16px_rgba(245,158,11,0.3)]"
                              : active.rarity === "rare"
                              ? "bg-gradient-to-br from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 hover:scale-105 active:scale-95"
                              : "bg-gradient-to-br from-pink-700 to-purple-700 hover:from-pink-600 hover:to-purple-600 hover:scale-105 active:scale-95"
                            : "bg-[#1a1a1a] text-[#444] cursor-not-allowed border border-[#222]"
                        }`}
                      >
                        {hiring ? "A contratar..." : !canAfford ? "Sem saldo" : "💋 Contratar"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Nav arrows */}
      <button
        onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
        disabled={activeIndex === 0}
        className="absolute left-1 sm:left-3 top-[40%] -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-[#111]/80 border border-[#333] text-white disabled:opacity-20 hover:bg-[#222] transition-all text-lg sm:text-xl z-[10000]"
      >
        ‹
      </button>
      <button
        onClick={() => setActiveIndex((i) => Math.min(workers.length - 1, i + 1))}
        disabled={activeIndex === workers.length - 1}
        className="absolute right-1 sm:right-3 top-[40%] -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-[#111]/80 border border-[#333] text-white disabled:opacity-20 hover:bg-[#222] transition-all text-lg sm:text-xl z-[10000]"
      >
        ›
      </button>

      {/* Counter */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-2 pointer-events-none">
        <span className="text-[#444] text-xs">
          {activeIndex + 1} / {workers.length}
        </span>
      </div>
    </div>,
    document.body
  );
}
