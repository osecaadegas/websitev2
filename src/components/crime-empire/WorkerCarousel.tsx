"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { WorkerDef, RARITY_CONFIG, WorkerRarity } from "@/lib/crime-empire/worker-defs";

interface WorkerCarouselProps {
  workers: WorkerDef[];
  ownedSlugs: string[];
  playerCash: number;
  playerCrypto: number;
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
  onHire,
  onClose,
  hiring,
}: WorkerCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hireAnim, setHireAnim] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const active = workers[activeIndex];
  const rarityConf = active ? RARITY_CONFIG[active.rarity] : null;
  const isOwned = active ? ownedSlugs.includes(active.slug) : false;
  const canAfford = active
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
    const scrollLeft = cardLeft - trackWidth / 2 + cardWidth / 2;
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
    if (!active || isOwned || !canAfford || hiring) return;
    setHireAnim(true);
    setTimeout(() => { setHireAnim(false); onHire(active); }, 600);
  }, [active, isOwned, canAfford, hiring, onHire]);

  if (workers.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
        <div className="text-center p-12">
          <p className="text-4xl mb-4">🔒</p>
          <p className="text-white text-lg font-bold">Sem workers disponíveis</p>
          <p className="text-[#666] mt-2">Todas as workers já foram contratadas ou não há vagas.</p>
          <button onClick={onClose} className="mt-6 px-6 py-3 rounded-xl bg-pink-700 hover:bg-pink-600 text-white font-bold transition-all">
            Fechar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-md"
      ref={containerRef}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1a]">
        <div>
          <h2 className="text-2xl font-black text-white">💋 Contratar Worker</h2>
          <p className="text-sm text-[#666]">
            Saldo:{" "}
            <span className="text-green-400">${playerCash.toLocaleString()}</span>
            {" · "}
            <span className="text-yellow-400">🪙 {playerCrypto.toLocaleString()}</span>
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-[#1a1a1a] hover:bg-[#2a2a2a] text-[#888] hover:text-white transition-all text-lg"
        >
          ✕
        </button>
      </div>

      {/* Carousel track */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <div
          className="overflow-x-hidden py-8 select-none cursor-grab active:cursor-grabbing"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div
            ref={trackRef}
            className="flex items-center gap-5 px-[40vw]"
            style={{ willChange: "transform" }}
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
                    opacity: dist === 0 ? 1 : dist === 1 ? 0.72 : 0.35,
                    filter: dist > 1 ? "blur(1px)" : "none",
                    transition: "all 0.45s cubic-bezier(0.25, 0.1, 0.25, 1)",
                    zIndex: 10 - dist,
                    width: "220px",
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
                    <div className="relative h-[280px] overflow-hidden">
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
                    </div>

                    {/* Info */}
                    <div className="px-3 pb-3 pt-1">
                      <h3 className={`font-black text-base truncate ${rc.color}`}>{w.name}</h3>
                      <p className="text-green-400 text-sm font-bold">${w.earnings_per_hour.toLocaleString()}/h</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {w.traits.slice(0, 2).map((t) => (
                          <span key={t} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${rc.badge}`}>
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

        {/* Details panel */}
        {active && rarityConf && (
          <div
            className="mx-4 mb-4 rounded-2xl border overflow-hidden flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, #111 0%, #0d0d0d 100%)",
              borderColor:
                active.rarity === "elite"
                  ? "rgba(245,158,11,0.4)"
                  : active.rarity === "rare"
                  ? "rgba(59,130,246,0.35)"
                  : "rgba(60,60,60,0.5)",
            }}
          >
            <div className="p-4 flex gap-4">
              {/* Left: info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className={`text-xl font-black ${rarityConf.color}`}>{active.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${rarityConf.badge}`}>
                    {rarityConf.star} {rarityConf.label}
                  </span>
                </div>
                <p className="text-xs text-[#777] leading-relaxed mb-3 line-clamp-2">{active.description}</p>

                {/* Traits */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {active.traits.map((t) => (
                    <span key={t} className={`text-xs px-2 py-0.5 rounded-full font-medium ${rarityConf.badge}`}>
                      {t}
                    </span>
                  ))}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  <div>
                    <div className="flex justify-between text-[#888] mb-0.5">
                      <span>Atratividade</span><span className="text-pink-300">{active.stats.attractiveness}</span>
                    </div>
                    <StatBar value={active.stats.attractiveness} color="bg-pink-500" />
                  </div>
                  <div>
                    <div className="flex justify-between text-[#888] mb-0.5">
                      <span>Stamina</span><span className="text-blue-300">{active.stats.stamina}</span>
                    </div>
                    <StatBar value={active.stats.stamina} color="bg-blue-500" />
                  </div>
                  <div>
                    <div className="flex justify-between text-[#888] mb-0.5">
                      <span>Mood</span><span className="text-yellow-300">{active.stats.mood}</span>
                    </div>
                    <StatBar value={active.stats.mood} color="bg-yellow-500" />
                  </div>
                  <div>
                    <div className="flex justify-between text-[#888] mb-0.5">
                      <span>Carisma</span><span className="text-purple-300">{active.stats.charisma}</span>
                    </div>
                    <StatBar value={active.stats.charisma} color="bg-purple-500" />
                  </div>
                </div>
              </div>

              {/* Right: hire */}
              <div className="flex flex-col items-center justify-between gap-3 flex-shrink-0 w-36">
                {/* Earnings */}
                <div className="text-center">
                  <p className="text-xs text-[#666]">Rendimento</p>
                  <p className="text-2xl font-black text-green-400">${active.earnings_per_hour.toLocaleString()}</p>
                  <p className="text-xs text-[#555]">por hora</p>
                </div>

                {/* Price */}
                <div className="text-center">
                  <p className="text-xs text-[#666]">Contratação</p>
                  <p className={`text-lg font-black ${active.hire_uses_crypto ? "text-yellow-400" : "text-white"}`}>
                    {active.hire_uses_crypto ? "🪙" : "$"}{active.hire_price.toLocaleString()}
                  </p>
                </div>

                {/* Hire button */}
                {isOwned ? (
                  <div className="w-full py-2.5 rounded-xl bg-green-900/40 border border-green-500/40 text-green-400 text-sm font-bold text-center">
                    ✓ Contratada
                  </div>
                ) : (
                  <button
                    onClick={handleHire}
                    disabled={!canAfford || hiring}
                    className={`w-full py-2.5 rounded-xl text-sm font-black transition-all ${
                      canAfford && !hiring
                        ? active.rarity === "elite"
                          ? "bg-gradient-to-br from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                          : active.rarity === "rare"
                          ? "bg-gradient-to-br from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 hover:scale-105 active:scale-95"
                          : "bg-gradient-to-br from-pink-700 to-purple-700 hover:from-pink-600 hover:to-purple-600 hover:scale-105 active:scale-95"
                        : "bg-[#1a1a1a] text-[#444] cursor-not-allowed border border-[#222]"
                    }`}
                  >
                    {hiring ? "A contratar..." : !canAfford ? "Saldo insuficiente" : "💋 Contratar"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Nav arrows */}
      <button
        onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
        disabled={activeIndex === 0}
        className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-[#111]/80 border border-[#333] text-white disabled:opacity-20 hover:bg-[#222] transition-all text-xl z-20"
      >
        ‹
      </button>
      <button
        onClick={() => setActiveIndex((i) => Math.min(workers.length - 1, i + 1))}
        disabled={activeIndex === workers.length - 1}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-[#111]/80 border border-[#333] text-white disabled:opacity-20 hover:bg-[#222] transition-all text-xl z-20"
      >
        ›
      </button>

      {/* Counter */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-2 pointer-events-none">
        <span className="text-[#444] text-xs">
          {activeIndex + 1} / {workers.length}
        </span>
      </div>
    </div>
  );
}
