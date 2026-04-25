"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { CEToast } from "@/components/CEToast";

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface LootItem {
  item_id: string;
  item_name: string;
  quantity: number;
  unit_value: number;
  category: string;
  rarity: string;
  image_url?: string | null;
}

interface PlaneCrash {
  id: string;
  week_number: number;
  week_year: number;
  scheduled_at: string;
  active_until: string;
  location_name: string;
  status: "upcoming" | "active" | "expired";
  total_segments: number;
  entry_cost: number;
  loot_seed: number;
}

interface CrashSession {
  id: string;
  shots_left: number;
  hits: number;
  misses: number;
  heat_level: number;
  revealed_tiles: Record<string, "hit" | "near" | "miss">;
  completed: boolean;
  extracted: boolean;
  final_coverage: number | null;
  loot_received: LootItem[] | null;
  raid_triggered: boolean;
  intel_hint: string | null;
}

interface Player {
  id: string;
  dirty_cash: number;
  in_jail: boolean;
  hp: number;
  crypto: number;
}

// â”€â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const RARITY: Record<string, { color: string; label: string; bg: string }> = {
  common:    { color: "#9ca3af", label: "Comum",    bg: "rgba(156,163,175,0.12)" },
  rare:      { color: "#3b82f6", label: "Raro",     bg: "rgba(59,130,246,0.12)" },
  epic:      { color: "#a855f7", label: "Ã‰pico",    bg: "rgba(168,85,247,0.12)" },
  legendary: { color: "#f59e0b", label: "LendÃ¡rio", bg: "rgba(245,158,11,0.12)" },
};

const ROWS = ["A","B","C","D","E","F","G","H","I","J"];

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function fmt(n: number) { return n.toLocaleString("pt-PT"); }

function formatCountdown(ms: number) {
  if (ms <= 0) return "00:00:00";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-PT", { weekday:"short", day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" });
}

function useCountdown(targetDate: string) {
  const [remaining, setRemaining] = useState(() => Math.max(0, new Date(targetDate).getTime() - Date.now()));
  useEffect(() => {
    const target = new Date(targetDate).getTime();
    const tick = () => setRemaining(Math.max(0, target - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);
  return remaining;
}

// â”€â”€â”€ Extract Result Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ExtractModal({
  items,
  coverage,
  onClose,
}: {
  items: LootItem[];
  coverage: number;
  onClose: () => void;
}) {
  const totalValue = items.reduce((s, i) => s + i.unit_value * i.quantity, 0);
  const pct = Math.round(coverage * 100);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#0e0e0e] border border-orange-700/60 rounded-2xl p-6 max-w-md w-full shadow-2xl shadow-orange-900/30"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-5">
          <div className="text-5xl mb-3">âœˆï¸</div>
          <h2 className="text-xl font-black text-white">Saque ExtraÃ­do!</h2>
          <p className="text-[#888] text-sm mt-1">Cobertura dos destroÃ§os: <span className="text-orange-400 font-bold">{pct}%</span></p>
        </div>

        <div className="space-y-2 mb-5 max-h-64 overflow-y-auto">
          {items.map((item, i) => {
            const rar = RARITY[item.rarity] ?? RARITY.common;
            return (
              <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5 border border-[#222]" style={{ background: rar.bg }}>
                {item.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image_url} alt={item.item_name} className="w-9 h-9 object-contain flex-shrink-0 rounded" />
                ) : (
                  <div className="w-9 h-9 rounded bg-[#1a1a1a] flex items-center justify-center text-base flex-shrink-0">
                    {item.category === "drug" ? "ðŸ’Š" : "â­"}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{item.item_name}</p>
                  <p className="text-xs font-bold" style={{ color: rar.color }}>{rar.label}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-white font-black text-sm">Ã—{item.quantity}</p>
                  <p className="text-[#555] text-xs">ðŸ’µ {fmt(item.unit_value * item.quantity)}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between bg-[#0a0a0a] rounded-xl px-4 py-3 mb-4 border border-[#1e1e1e]">
          <span className="text-[#888] text-sm">Valor total</span>
          <span className="text-green-400 font-black text-lg">ðŸ’µ {fmt(totalValue)}</span>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-orange-700 hover:bg-orange-600 text-white font-bold text-sm transition-colors"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}

// â”€â”€â”€ Upcoming Crash Card (simple) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function UpcomingCrashCard({ crash }: { crash: PlaneCrash }) {
  const remaining = useCountdown(crash.scheduled_at);
  return (
    <div className="bg-[#0e0e0e] border border-[#222] rounded-2xl p-4 flex items-center gap-4">
      <div className="text-3xl grayscale">âœˆï¸</div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-bold text-sm">PrÃ³ximo Acidente</p>
        <p className="text-[#555] text-xs">{formatDate(crash.scheduled_at)}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-[#666] text-[10px] uppercase tracking-wider">Em</p>
        <p className="text-orange-400 font-black text-base tabular-nums">{formatCountdown(remaining)}</p>
      </div>
    </div>
  );
}

// â”€â”€â”€ Grid â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function BattleGrid({
  revealedTiles,
  firing,
  disabled,
  onFire,
}: {
  revealedTiles: Record<string, "hit" | "near" | "miss">;
  firing: boolean;
  disabled: boolean;
  onFire: (x: number, y: number) => void;
}) {
  return (
    <div className="w-full overflow-x-auto">
      <div className="inline-block min-w-[300px] w-full max-w-[440px] mx-auto select-none">
        {/* Column headers */}
        <div className="flex mb-0.5">
          <div className="w-6 flex-shrink-0" />
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="flex-1 text-center text-[10px] font-bold text-[#444] leading-5">{i + 1}</div>
          ))}
        </div>
        {/* Rows */}
        {ROWS.map((row, y) => (
          <div key={row} className="flex mb-0.5">
            <div className="w-6 flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-[#444]">{row}</div>
            {Array.from({ length: 10 }, (_, x) => {
              const key = `${x},${y}`;
              const state = revealedTiles[key];
              const isClicked = !!state;
              let bg = "bg-[#141414] hover:bg-[#1e1e1e] border-[#252525]";
              let inner: React.ReactNode = <div className="w-1.5 h-1.5 rounded-full bg-[#333]" />;

              if (state === "hit") {
                bg = "bg-red-900/50 border-red-700/60";
                inner = <span className="text-xs">ðŸ”¥</span>;
              } else if (state === "near") {
                bg = "bg-orange-900/40 border-orange-700/50";
                inner = <div className="w-2 h-2 rounded-full bg-orange-400/70" />;
              } else if (state === "miss") {
                bg = "bg-[#111] border-[#1c1c1c]";
                inner = <span className="text-[10px] text-[#444] font-bold">Ã—</span>;
              }

              return (
                <button
                  key={x}
                  disabled={disabled || isClicked || firing}
                  onClick={() => onFire(x, y)}
                  className={`flex-1 aspect-square border rounded flex items-center justify-center transition-all
                    ${bg}
                    ${!isClicked && !disabled ? "cursor-pointer active:scale-95" : "cursor-default"}
                    ${firing && !isClicked ? "animate-pulse" : ""}
                  `}
                  style={{ minWidth: 0 }}
                >
                  {inner}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// â”€â”€â”€ Heat Bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function HeatBar({ heat }: { heat: number }) {
  const danger = heat >= 80;
  const warning = heat >= 50;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-widest font-bold text-[#555]">Calor</span>
        <span className={`text-sm font-black tabular-nums ${danger ? "text-red-400" : warning ? "text-orange-400" : "text-[#888]"}`}>
          {heat}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-[#111] overflow-hidden border border-[#1e1e1e]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            danger ? "bg-red-500" : warning ? "bg-orange-500" : "bg-green-600"
          }`}
          style={{ width: `${Math.min(100, heat)}%` }}
        />
      </div>
      {danger && (
        <p className="text-red-400 text-[10px] font-bold mt-1 animate-pulse">âš ï¸ ZONA DE RISCO â€” extrai agora</p>
      )}
    </div>
  );
}

// â”€â”€â”€ Scoring Table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ScoringTable() {
  const rows = [
    { label: "â‰¥ 90% cobertura", pct: "100%", color: "#f59e0b" },
    { label: "â‰¥ 60% cobertura", pct: "70%",  color: "#3b82f6" },
    { label: "â‰¥ 30% cobertura", pct: "40%",  color: "#a855f7" },
    { label: "< 30% cobertura", pct: "15%",  color: "#6b7280" },
  ];
  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl overflow-hidden">
      <div className="px-3 py-2 border-b border-[#1a1a1a]">
        <p className="text-[10px] uppercase tracking-widest text-[#444] font-bold">Melhores Resultados</p>
      </div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between px-3 py-1.5 border-b border-[#111] last:border-0">
          <span className="text-[#555] text-xs">{r.label}</span>
          <span className="text-xs font-black" style={{ color: r.color }}>{r.pct} saque</span>
        </div>
      ))}
    </div>
  );
}

// â”€â”€â”€ Main Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function AcidenteDeAviaoPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [crashes, setCrashes] = useState<PlaneCrash[]>([]);
  const [activeCrash, setActiveCrash] = useState<PlaneCrash | null>(null);
  const [session, setSession] = useState<CrashSession | null>(null);
  const [weekCrashCount, setWeekCrashCount] = useState(0);
  const [player, setPlayer] = useState<Player | null>(null);

  const [processing, setProcessing] = useState(false);
  const [firing, setFiring] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [extractResult, setExtractResult] = useState<{ items: LootItem[]; coverage: number } | null>(null);
  const [lastShotResult, setLastShotResult] = useState<"hit" | "near" | "miss" | null>(null);

  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, ok: boolean) => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    setToast({ msg, ok });
    toastTimeout.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/crime-empire/plane-crash");
    if (!res.ok) return;
    const data = await res.json();
    setCrashes(data.crashes || []);
    setActiveCrash(data.activeCrash ?? null);
    setWeekCrashCount(data.weekCrashCount ?? 0);
    setPlayer(data.player ?? null);
    if (data.activeSession) {
      setSession({
        ...data.activeSession,
        revealed_tiles: data.activeSession.revealed_tiles ?? {},
      });
    } else {
      setSession(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) { router.push("/"); return; }
    fetchData();
  }, [user, fetchData, router]);

  // Auto-refresh when active crash expires
  const remaining = useCountdown(activeCrash?.active_until ?? new Date().toISOString());
  const didExpire = useRef(false);
  useEffect(() => {
    if (activeCrash && remaining === 0 && !didExpire.current) {
      didExpire.current = true;
      setTimeout(fetchData, 3000);
    }
  }, [activeCrash, remaining, fetchData]);

  // â”€â”€ Start session â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleStartSession = async () => {
    if (!activeCrash) return;
    setProcessing(true);
    try {
      const res = await fetch("/api/crime-empire/plane-crash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start_session", crashId: activeCrash.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Erro", false);
      } else {
        await fetchData();
        if (!data.alreadyStarted) showToast("ðŸ›¡ï¸ Acesso ao mapa concedido. Boa caÃ§a!", true);
      }
    } finally {
      setProcessing(false);
    }
  };

  // â”€â”€ Fire shot â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleFire = async (x: number, y: number) => {
    if (!activeCrash || !session || firing) return;
    setFiring(true);
    setLastShotResult(null);
    try {
      const res = await fetch("/api/crime-empire/plane-crash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fire_shot", crashId: activeCrash.id, x, y }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Erro", false);
      } else {
        setLastShotResult(data.result);
        // Optimistic update
        setSession((prev) => {
          if (!prev) return prev;
          const tiles = { ...prev.revealed_tiles, [`${x},${y}`]: data.result };
          return {
            ...prev,
            revealed_tiles: tiles,
            shots_left: data.newShotsLeft,
            hits: data.hits,
            heat_level: data.newHeat,
            completed: data.completed,
          };
        });
        if (data.raidTriggered && !session.raid_triggered) {
          showToast("ðŸš¨ Calor elevado! Extrai o saque antes que seja tarde!", false);
        }
        if (data.result === "hit") showToast("ðŸ’¥ ACERTO! DestroÃ§o encontrado!", true);
        else if (data.result === "near") showToast("ðŸ”¶ Perto... algo nas proximidades", true);
      }
    } finally {
      setFiring(false);
    }
  };

  // â”€â”€ Extract loot â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleExtract = async () => {
    if (!activeCrash || !session) return;
    setProcessing(true);
    try {
      const res = await fetch("/api/crime-empire/plane-crash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "extract", crashId: activeCrash.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Erro", false);
      } else {
        setExtractResult({ items: data.items, coverage: data.coverage });
        await fetchData();
      }
    } finally {
      setProcessing(false);
    }
  };

  // â”€â”€ Derived â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const upcomingCrashes = crashes.filter((c) => c.status === "upcoming");
  const hasSession = !!session && !session.extracted;
  const canFire = hasSession && !session.completed && session.shots_left > 0;
  const canExtract = hasSession && (session.shots_left === 0 || session.hits > 0);
  const shotsUsed = session ? (10 - session.shots_left) : 0;
  const canAffordEntry = (player?.crypto ?? 0) >= (activeCrash?.entry_cost ?? 125000);
  const blocked = !!(player?.in_jail) || (player?.hp ?? 1) <= 0;

  // â”€â”€â”€ Loading â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh] text-white">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse">âœˆï¸</div>
          <p className="text-[#888]">A carregar relatÃ³rios de acidentes...</p>
        </div>
      </div>
    );
  }

  // â”€â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  return (
    <div className="flex-1 text-white py-6 px-3 md:px-6">
      {toast && <CEToast msg={toast.msg} ok={toast.ok} />}
      {extractResult && (
        <ExtractModal
          items={extractResult.items}
          coverage={extractResult.coverage}
          onClose={() => setExtractResult(null)}
        />
      )}

      <div className="max-w-6xl mx-auto space-y-4">

        {/* â”€â”€ Top bar â”€â”€ */}
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight uppercase">âœˆï¸ ACIDENTE DE AVIÃƒO</h1>
            {activeCrash && (
              <span className="text-[10px] font-bold uppercase tracking-widest bg-orange-900/40 border border-orange-700/50 text-orange-400 px-2 py-0.5 rounded-full">
                ATIVO
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {activeCrash && (
              <div className="bg-[#111] border border-[#222] rounded-lg px-3 py-1.5 text-center">
                <p className="text-[9px] uppercase tracking-widest text-[#555] mb-0">Janela expira</p>
                <p className="font-black text-orange-400 text-sm tabular-nums">{formatCountdown(remaining)}</p>
              </div>
            )}
            <div className="bg-[#111] border border-[#222] rounded-lg px-3 py-1.5 text-center">
              <p className="text-[9px] uppercase tracking-widest text-[#555] mb-0">Semana</p>
              <p className="font-black text-white text-sm">{weekCrashCount}/3</p>
            </div>
            {player && (
              <div className="bg-[#111] border border-[#222] rounded-lg px-3 py-1.5 text-center">
                <p className="text-[9px] uppercase tracking-widest text-[#555] mb-0">Crypto</p>
                <p className="font-black text-cyan-400 text-sm">ðŸ’Ž {fmt(player.crypto)}</p>
              </div>
            )}
          </div>
        </div>

        {/* â”€â”€ Blocked banners â”€â”€ */}
        {player?.in_jail && (
          <div className="p-3 rounded-xl bg-yellow-900/20 border border-yellow-700/60 text-yellow-400 text-sm font-semibold">
            ðŸš” EstÃ¡s na prisÃ£o. NÃ£o podes participar em eventos.
          </div>
        )}
        {player && player.hp <= 0 && !player.in_jail && (
          <div className="p-3 rounded-xl bg-red-900/20 border border-red-700/60 text-red-400 text-sm font-semibold">
            ðŸ¥ EstÃ¡s no hospital. Vai ao Hospital para te curar primeiro.
          </div>
        )}

        {/* â”€â”€ No active crash â”€â”€ */}
        {!activeCrash && (
          <div className="p-8 rounded-2xl bg-[#0e0e0e] border border-[#1e1e1e] text-center">
            <p className="text-5xl mb-4">ðŸŒ™</p>
            <p className="text-white font-black text-lg mb-1">Nenhum acidente ativo</p>
            <p className="text-[#555] text-sm">Aguarda o prÃ³ximo acidente para jogar</p>
            {upcomingCrashes.length > 0 && (
              <div className="mt-6 max-w-sm mx-auto space-y-2">
                {upcomingCrashes.slice(0, 2).map((c) => <UpcomingCrashCard key={c.id} crash={c} />)}
              </div>
            )}
          </div>
        )}

        {/* â”€â”€ Active crash â€” 3 column layout â”€â”€ */}
        {activeCrash && (
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_260px] gap-4">

            {/* â”€â”€ LEFT: Torre de Controlo â”€â”€ */}
            <div className="space-y-3">
              <div className="bg-[#0e0e0e] border border-[#1e1e1e] rounded-2xl p-4">
                <p className="text-[10px] uppercase tracking-widest text-[#444] font-bold mb-3">CONTROLE DA TORRE</p>

                {/* Operator avatar */}
                <div className="flex flex-col items-center mb-4">
                  <div className="w-16 h-16 rounded-full bg-[#141414] border-2 border-[#2a2a2a] flex items-center justify-center text-3xl mb-2">
                    ðŸ§‘â€âœˆï¸
                  </div>
                  <p className="text-white font-bold text-sm">Controlador</p>
                  <p className="text-[#555] text-xs">{activeCrash.location_name}</p>
                </div>

                {!hasSession && !session?.extracted && (
                  <>
                    <div className="bg-[#111] border border-[#1a1a1a] rounded-xl px-3 py-3 mb-3 text-center">
                      <p className="text-[#666] text-xs mb-1">Pagamento exigido</p>
                      <p className={`font-black text-lg ${canAffordEntry ? "text-cyan-400" : "text-red-400"}`}>
                        ðŸ’Ž {fmt(activeCrash.entry_cost ?? 125000)}
                      </p>
                      <p className="text-[#444] text-[10px] mt-1">Crypto</p>
                    </div>

                    <button
                      disabled={processing || blocked || !canAffordEntry}
                      onClick={handleStartSession}
                      className={`w-full py-2.5 rounded-xl text-sm font-black uppercase tracking-wide transition-all ${
                        processing
                          ? "bg-[#222] text-[#555] cursor-wait"
                          : blocked
                          ? "bg-[#1a1a1a] text-[#444] cursor-not-allowed"
                          : canAffordEntry
                          ? "bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-400 text-black shadow-lg shadow-yellow-900/30"
                          : "bg-[#1a1a1a] text-[#444] cursor-not-allowed"
                      }`}
                    >
                      {processing ? "A processar..." : !canAffordEntry ? "ðŸ’Ž Crypto insuficiente" : "PAGAR E OBTER INFORMAÃ‡ÃƒO"}
                    </button>

                    <p className="text-[#333] text-[10px] text-center mt-2">
                      O pagamento nÃ£o Ã© reembolsÃ¡vel. 10 disparos incluÃ­dos.
                    </p>
                  </>
                )}

                {session?.extracted && (
                  <div className="bg-green-900/20 border border-green-700/40 rounded-xl p-3 text-center">
                    <p className="text-green-400 font-bold text-sm">âœ“ Saque extraÃ­do</p>
                    <p className="text-[#555] text-xs mt-1">Cobertura: {Math.round((session.final_coverage ?? 0) * 100)}%</p>
                  </div>
                )}

                {hasSession && (
                  <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-3 text-center">
                    <p className="text-green-400 text-xs font-bold">âœ“ Acesso concedido</p>
                    <p className="text-[#555] text-xs mt-0.5">SessÃ£o ativa</p>
                  </div>
                )}
              </div>

              {/* Upcoming crashes */}
              {upcomingCrashes.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-widest text-[#444] font-bold px-1">PrÃ³ximos</p>
                  {upcomingCrashes.slice(0, 2).map((c) => <UpcomingCrashCard key={c.id} crash={c} />)}
                </div>
              )}
            </div>

            {/* â”€â”€ CENTER: Grid â”€â”€ */}
            <div className="bg-[#0e0e0e] border border-[#1e1e1e] rounded-2xl p-4 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-widest text-[#444] font-bold">MAPA DE BUSCA â€” 10Ã—10</p>
                {lastShotResult && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    lastShotResult === "hit" ? "bg-red-900/50 text-red-400 border border-red-700/40"
                    : lastShotResult === "near" ? "bg-orange-900/50 text-orange-400 border border-orange-700/40"
                    : "bg-[#111] text-[#555] border border-[#222]"
                  }`}>
                    {lastShotResult === "hit" ? "ðŸ’¥ ACERTO" : lastShotResult === "near" ? "ðŸ”¶ PERTO" : "âœ• FALHOU"}
                  </span>
                )}
              </div>

              {!hasSession && !session?.extracted ? (
                <div className="flex-1 flex items-center justify-center min-h-[280px]">
                  <div className="text-center">
                    <p className="text-4xl mb-3 grayscale">ðŸ—ºï¸</p>
                    <p className="text-[#444] text-sm">Paga ao controlador para aceder ao mapa</p>
                  </div>
                </div>
              ) : session?.extracted ? (
                <div className="flex-1 flex items-center justify-center min-h-[280px]">
                  <div className="text-center">
                    <p className="text-4xl mb-3">âœ…</p>
                    <p className="text-white font-bold">MissÃ£o completa</p>
                    <p className="text-[#555] text-sm mt-1">Cobertura: {Math.round((session.final_coverage ?? 0) * 100)}%</p>
                  </div>
                </div>
              ) : (
                <BattleGrid
                  revealedTiles={session?.revealed_tiles ?? {}}
                  firing={firing}
                  disabled={!canFire || blocked}
                  onFire={handleFire}
                />
              )}

              {/* Grid legend */}
              {hasSession && !session?.extracted && (
                <div className="flex flex-wrap gap-3 text-[10px] text-[#555]">
                  <span className="flex items-center gap-1"><span>ðŸ”¥</span> Acerto</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-400/70 inline-block" /> Perto</span>
                  <span className="flex items-center gap-1"><span className="font-bold text-[#444]">Ã—</span> Falhou</span>
                </div>
              )}

              {/* Loot preview */}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#444] font-bold mb-2">SAQUE POSSÃVEL</p>
                <div className="bg-[#080808] border border-[#151515] rounded-xl p-3">
                  {hasSession ? (
                    <p className="text-[#555] text-xs italic text-center">
                      {session.hits > 0
                        ? `${session.hits} segmento(s) encontrado(s) â€” extrai para receber o saque`
                        : "Dispara no mapa para encontrar destroÃ§os"}
                    </p>
                  ) : (
                    <p className="text-[#444] text-xs italic text-center">
                      Paga ao controlador para ver informaÃ§Ãµes do saque
                    </p>
                  )}
                </div>
                <div className="mt-2">
                  <ScoringTable />
                </div>
              </div>
            </div>

            {/* â”€â”€ RIGHT: Painel de Intel + disparos + heat â”€â”€ */}
            <div className="space-y-3">

              {/* Intel */}
              <div className="bg-[#0e0e0e] border border-[#1e1e1e] rounded-2xl p-4">
                <p className="text-[10px] uppercase tracking-widest text-[#444] font-bold mb-2">INFORMAÃ‡ÃƒO RECEBIDA</p>
                <div className="bg-[#080808] border border-[#151515] rounded-xl p-3 min-h-[72px] flex items-center">
                  {session?.intel_hint ? (
                    <p className="text-green-400 text-xs italic leading-relaxed">{session.intel_hint}</p>
                  ) : (
                    <p className="text-[#333] text-xs italic">Paga ao controlador para receber informaÃ§Ãµes sobre a localizaÃ§Ã£o dos destroÃ§os.</p>
                  )}
                </div>
              </div>

              {/* Shots */}
              {hasSession && (
                <div className="bg-[#0e0e0e] border border-[#1e1e1e] rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-widest text-[#444] font-bold">DISPAROS RESTANTES</p>
                    <p className="text-white font-black text-lg tabular-nums">
                      {session.shots_left}<span className="text-[#444] text-sm font-normal">/10</span>
                    </p>
                  </div>

                  {/* Shot dots */}
                  <div className="flex gap-1 flex-wrap">
                    {Array.from({ length: 10 }, (_, i) => (
                      <div
                        key={i}
                        className={`w-5 h-5 rounded-sm flex items-center justify-center text-[9px] font-bold ${
                          i < shotsUsed ? "bg-red-900/60 border border-red-700/40 text-red-500" : "bg-[#141414] border border-[#222] text-[#333]"
                        }`}
                      >
                        {i < shotsUsed ? "Ã—" : "â—‹"}
                      </div>
                    ))}
                  </div>

                  <HeatBar heat={session.heat_level} />

                  {session.heat_level >= 80 && (
                    <p className="text-red-400 text-xs text-center">
                      Zona de risco. Extrai jÃ¡ ou perdes tudo!
                    </p>
                  )}
                </div>
              )}

              {/* Extract button */}
              {hasSession && !session.extracted && (
                <button
                  disabled={!canExtract || processing || blocked}
                  onClick={handleExtract}
                  className={`w-full py-3 rounded-xl text-sm font-black uppercase tracking-wide transition-all ${
                    processing
                      ? "bg-[#222] text-[#555] cursor-wait"
                      : canExtract && !blocked
                      ? "bg-gradient-to-r from-green-700 to-emerald-600 hover:from-green-600 hover:to-emerald-500 text-white shadow-lg shadow-green-900/30"
                      : "bg-[#1a1a1a] text-[#444] cursor-not-allowed"
                  }`}
                >
                  {processing ? "A extrair..." : canExtract ? "ðŸ“¦ EXTRAIR SAQUE" : session.hits === 0 ? "Sem acertos para extrair" : "Disparos em curso..."}
                </button>
              )}

              {!hasSession && !session && (
                <div className="bg-[#0e0e0e] border border-[#1e1e1e] rounded-2xl p-4 text-center">
                  <p className="text-[#333] text-xs">Acede ao mapa para comeÃ§ar a busca</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* â”€â”€ Tips bar â”€â”€ */}
        <div className="p-3 rounded-xl bg-[#0a0a0a] border border-[#141414] text-[10px] text-[#3a3a3a] flex flex-wrap gap-x-4 gap-y-1">
          <span>ðŸŽ¯ 10 disparos por evento Â· EstratÃ©gia Ã© tudo</span>
          <span>ðŸ”¥ Calor sobe com cada disparo â€” extrai antes de 80%</span>
          <span>ðŸ’Ž Pagamento em crypto Â· 125.000 por acesso</span>
          <span>ðŸ“¦ Saque proporcional Ã  cobertura dos destroÃ§os</span>
        </div>
      </div>
    </div>
  );
}
