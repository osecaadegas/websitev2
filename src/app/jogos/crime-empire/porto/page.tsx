"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { CEToast } from "@/components/CEToast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Ship {
  id: string;
  name: string;
  drug_type: string;
  drug_item_id: string | null;
  capacity_total: number;
  capacity_filled: number;
  price_per_unit: number;
  arrival_time: string;
  departure_time: string;
  departed_at: string | null;
  status: "scheduled" | "docked" | "departed";
  ship_class: "normal" | "high_demand" | "risky";
  origin_country: string | null;
  inspection_chance: number;
  max_delivery: number;
  top_bonus_pct: number;
}

interface Contributor {
  player_id: string;
  player_name: string;
  quantity: number;
  earned: number;
}

interface MyContribution {
  quantity: number;
  earned: number;
  top_bonus: number;
}

interface DrugItem {
  item_id: string;
  item_name: string;
  quantity: number;
  unit_value: number;
  image_url: string | null;
}

interface ActivityEntry {
  id: string;
  event_type: string;
  message: string;
  quantity: number | null;
  earned: number | null;
  created_at: string;
  player_name: string | null;
}

interface NextShipPreviewData {
  id: string;
  name: string;
  arrival_time: string;
  departure_time: string;
  ship_class: "normal" | "high_demand" | "risky";
  capacity_total: number;
  drug_type: string | null;
  price_per_unit: number | null;
}

interface PageData {
  currentShip: Ship | null;
  nextShip: NextShipPreviewData | null;
  nextShipRevealed: boolean;
  topContributors: Contributor[];
  myContribution: MyContribution | null;
  drugInventory: DrugItem[];
  activityFeed: ActivityEntry[];
  player: { id: string; dirty_cash: number; in_jail: boolean; hp: number; crypto: number };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("pt-PT");
}

function formatArrivalDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86400000);
  if (d.toDateString() === today.toDateString()) return "Hoje";
  if (d.toDateString() === tomorrow.toDateString()) return "Amanhã";
  return d.toLocaleDateString("pt-PT", { weekday: "short", day: "numeric", month: "short" });
}

function formatArrivalHour(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s atras`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m atras`;
  return `${Math.floor(minutes / 60)}h atras`;
}

function useCountdown(targetIso: string | null): number {
  const [remaining, setRemaining] = useState(() =>
    targetIso ? Math.max(0, new Date(targetIso).getTime() - Date.now()) : 0
  );
  useEffect(() => {
    if (!targetIso) return;
    const target = new Date(targetIso).getTime();
    const tick = () => setRemaining(Math.max(0, target - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso]);
  return remaining;
}

// ─── Class metadata ───────────────────────────────────────────────────────────

const CLASS_META: Record<Ship["ship_class"], { label: string; border: string; glow: string; badge: string }> = {
  normal:      { label: "Normal",       border: "border-slate-700/60",   glow: "shadow-slate-900/20",  badge: "bg-slate-800/80 text-slate-400" },
  high_demand: { label: "Alta Procura", border: "border-amber-700/70",   glow: "shadow-amber-900/30",  badge: "bg-amber-900/60 text-amber-300" },
  risky:       { label: "Arriscado",    border: "border-red-700/70",     glow: "shadow-red-900/30",    badge: "bg-red-900/60 text-red-300" },
};

// ─── Captain Barbosa dialogue ─────────────────────────────────────────────────

function getCaptainDialogue(ship: Ship | null): string {
  if (!ship) return "...nenhum navio no horizonte. Aguarda.";
  const fillPct = ship.capacity_total > 0 ? (ship.capacity_filled / ship.capacity_total) * 100 : 0;
  if (ship.status === "scheduled") {
    const ms = Math.max(0, new Date(ship.arrival_time).getTime() - Date.now());
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const timeStr = h > 0 ? `${h}h ${m}m` : `${m} minutos`;
    return `Proximo navio chega em ${timeStr}. Querem ${ship.drug_type}. Prepara o que tens.`;
  }
  if (ship.status === "departed") {
    return "E isso. Partiu. Prepara-te para o proximo - nao vou esperar muito.";
  }
  if (fillPct >= 90) return "Despacha-te. Esta quase tudo cheio. Perdes o barco se nao andas.";
  if (fillPct >= 60) return "Ja esta mais de metade cheio. Nao deixes para os outros.";
  if (fillPct >= 30) return `Ja esta a encher. ${fmt(ship.capacity_total - ship.capacity_filled)}g ainda disponiveis.`;
  return `Navio atracado. ${fmt(ship.capacity_total)}g de capacidade. Querem ${ship.drug_type}. Entra.`;
}

// ─── Capacity Bar ─────────────────────────────────────────────────────────────

function CapacityBar({ filled, total }: { filled: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (filled / total) * 100) : 0;
  const color = pct >= 90 ? "#ef4444" : pct >= 60 ? "#f59e0b" : "#0ea5e9";
  const textColor = pct >= 90 ? "text-red-400" : pct >= 60 ? "text-amber-400" : "text-sky-400";
  return (
    <div>
      <div className="flex justify-between text-xs mb-2">
        <span className="text-[#666]">Capacidade</span>
        <span className={`font-bold ${textColor}`}>
          {fmt(filled)} / {fmt(total)}g{pct >= 100 ? " CHEIO" : ` ${Math.floor(pct)}%`}
        </span>
      </div>
      <div className="h-3 bg-[#111] rounded-full overflow-hidden border border-[#1a1a1a]">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}88` }}
        />
      </div>
    </div>
  );
}

// ─── Delivery Form ────────────────────────────────────────────────────────────

function DeliveryForm({
  ship,
  drugInventory,
  processing,
  onDeliver,
}: {
  ship: Ship;
  drugInventory: DrugItem[];
  processing: boolean;
  onDeliver: (itemId: string, quantity: number) => void;
}) {
  const [qty, setQty] = useState("");
  const matchingDrug = useMemo(
    () => drugInventory.find((d) => d.item_name === ship.drug_type || d.item_id === ship.drug_item_id),
    [drugInventory, ship]
  );
  const available = matchingDrug?.quantity ?? 0;
  const remaining = ship.capacity_total - ship.capacity_filled;
  const maxQty = Math.min(available, remaining, ship.max_delivery);
  const parsedQty = parseInt(qty) || 0;
  const preview = parsedQty > 0 ? parsedQty * ship.price_per_unit : 0;

  if (!matchingDrug) {
    return (
      <div className="mt-4 p-4 rounded-xl bg-[#0c0c0c] border border-[#1e1e1e] text-center">
        <p className="text-[#555] text-sm">Sem <span className="text-white font-bold">{ship.drug_type}</span> no inventario</p>
        <p className="text-[#333] text-xs mt-1">Produz ou compra {ship.drug_type} para entregar</p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center gap-3 bg-[#0c0c0c] rounded-xl p-3 border border-[#1c1c1c]">
        {matchingDrug.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={matchingDrug.image_url} alt={matchingDrug.item_name} className="w-10 h-10 object-contain rounded flex-shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded bg-[#1a1a1a] flex items-center justify-center text-xl flex-shrink-0">💊</div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-bold">{matchingDrug.item_name}</p>
          <p className="text-[#555] text-xs">Tens: {fmt(available)}g · Max por entrega: {fmt(ship.max_delivery)}g</p>
          {parsedQty > 0 && parsedQty <= maxQty && (
            <p className="text-sky-400 text-xs font-semibold mt-0.5">
              Recebes: 💵 {fmt(preview)} imediatamente
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <input
            type="number"
            min={1}
            max={maxQty}
            value={qty}
            placeholder="0"
            onChange={(e) => setQty(e.target.value)}
            className="w-24 bg-[#141414] border border-[#2a2a2a] text-white text-sm rounded-lg px-2.5 py-2 text-center focus:outline-none focus:border-sky-700"
          />
          <button
            disabled={processing || parsedQty <= 0 || parsedQty > maxQty}
            onClick={() => { onDeliver(matchingDrug.item_id, parsedQty); setQty(""); }}
            className="px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black transition-colors whitespace-nowrap"
          >
            Entregar
          </button>
        </div>
      </div>
      {ship.inspection_chance > 0 && (
        <p className="text-xs text-[#444] text-center">
          ⚠ {ship.inspection_chance}% de chance de inspecao e confisco
        </p>
      )}
    </div>
  );
}

// ─── Captain Panel ────────────────────────────────────────────────────────────

function CaptainPanel({ ship }: { ship: Ship | null }) {
  const dialogue = getCaptainDialogue(ship);
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-[#0a0a0a] border border-[#1c1c1c] overflow-hidden">
        <div className="bg-gradient-to-b from-[#0d1117] to-[#0a0a0a] px-4 py-5 border-b border-[#1c1c1c] text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/personagem/capitan_avatar.jpg"
            alt="Capitao Barbosa"
            className="w-20 h-20 mx-auto mb-3 rounded-full object-cover border-2 border-[#3a3a3a]"
          />
          <p className="text-white font-black text-sm">Capitao Barbosa</p>
          <p className="text-[#444] text-xs mt-0.5">Porto Antigo · Contrabandista</p>
        </div>
        <div className="p-4">
          <div className="relative bg-[#111] rounded-xl p-4 border border-[#1e1e1e]">
            <div className="absolute -top-2 left-5 w-3 h-3 bg-[#111] border-t border-l border-[#1e1e1e] rotate-45" />
            <p className="text-[#aaa] text-sm leading-relaxed italic">{dialogue}</p>
          </div>
        </div>
      </div>
      {ship && (
        <div className="rounded-2xl bg-[#0a0a0a] border border-[#1c1c1c] p-4 space-y-3">
          <p className="text-xs text-[#444] uppercase tracking-widest font-bold">Detalhes</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[#555]">Classe</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${CLASS_META[ship.ship_class].badge}`}>
                {CLASS_META[ship.ship_class].label}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#555]">Origem</span>
              <span className="text-white font-semibold">{ship.origin_country ?? "Desconhecida"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#555]">Preco/g</span>
              <span className="text-sky-400 font-bold">💵 {fmt(ship.price_per_unit)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#555]">Max. por entrega</span>
              <span className="text-white font-semibold">{fmt(ship.max_delivery)}g</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#555]">Bonus top contribuidor</span>
              <span className="text-amber-400 font-semibold">+{ship.top_bonus_pct}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Activity Feed ────────────────────────────────────────────────────────────

function ActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  const iconMap: Record<string, string> = {
    delivery:       "📦",
    ship_docked:    "⚓",
    ship_departed:  "🌊",
    inspection_fail:"🚨",
  };
  return (
    <div className="rounded-2xl bg-[#0a0a0a] border border-[#1c1c1c] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#1c1c1c]">
        <p className="text-xs text-[#444] uppercase tracking-widest font-bold">Atividade do Porto</p>
      </div>
      <div className="divide-y divide-[#111] max-h-64 overflow-y-auto">
        {entries.length === 0 && (
          <div className="p-4 text-center text-[#333] text-sm">Sem atividade recente</div>
        )}
        {entries.map((e) => (
          <div key={e.id} className="px-4 py-2.5 flex items-start gap-2.5">
            <span className="text-base flex-shrink-0 mt-0.5">{iconMap[e.event_type] ?? "📌"}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[#888] text-xs leading-relaxed">{e.message}</p>
              <p className="text-[#333] text-xs mt-0.5">{timeAgo(e.created_at)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
// ─── Next Ship Preview ────────────────────────────────────────────────────────────────

function NextShipPreview({
  nextShip,
  revealed,
  playerCrypto,
  processing,
  onReveal,
}: {
  nextShip: NextShipPreviewData;
  revealed: boolean;
  playerCrypto: number;
  processing: boolean;
  onReveal: () => void;
}) {
  const meta = CLASS_META[nextShip.ship_class];
  const arrivalDay = formatArrivalDay(nextShip.arrival_time);
  const arrivalHour = formatArrivalHour(nextShip.arrival_time);
  const canAfford = playerCrypto >= 1000;
  return (
    <div className={`rounded-2xl border p-4 bg-[#06080f] ${meta.border}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-[#444] uppercase tracking-widest font-bold">Próximo Navio</p>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${meta.badge}`}>{meta.label}</span>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🚢</span>
        <p className="text-white font-black text-sm">{nextShip.name}</p>
      </div>
      <div className="space-y-2 text-sm mb-4">
        <div className="flex justify-between">
          <span className="text-[#555]">Chega</span>
          <span className="text-white font-semibold">{arrivalDay}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#555]">Hora</span>
          {revealed ? (
            <span className="text-sky-400 font-bold">{arrivalHour}</span>
          ) : (
            <span className="text-[#333] font-bold tracking-widest select-none">██:██</span>
          )}
        </div>
        <div className="flex justify-between">
          <span className="text-[#555]">Droga</span>
          {revealed && nextShip.drug_type ? (
            <span className="text-sky-300 font-bold">{nextShip.drug_type}</span>
          ) : (
            <span className="text-[#333] font-bold">🔒 Desconhecido</span>
          )}
        </div>
        <div className="flex justify-between">
          <span className="text-[#555]">Capacidade</span>
          <span className="text-white font-semibold">{fmt(nextShip.capacity_total)}g</span>
        </div>
      </div>
      {!revealed && (
        <>
          <button
            disabled={processing || !canAfford}
            onClick={onReveal}
            className="w-full py-2.5 rounded-xl bg-violet-900/60 hover:bg-violet-800/70 border border-violet-700/50 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black transition-colors flex items-center justify-center gap-2"
          >
            <span>💎</span>
            <span>Pagar 1000 ao Capitão</span>
          </button>
          {!canAfford && (
            <p className="text-[#444] text-xs text-center mt-2">Crypto insuficiente ({fmt(playerCrypto)}💎)</p>
          )}
        </>
      )}
      {revealed && (
        <p className="text-violet-400 text-xs text-center">✓ Intel confirmado pelo Capitão</p>
      )}
    </div>
  );
}
// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PortoShipsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4500);
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/crime-empire/porto/ships");
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 401) { router.push("/api/auth/twitch"); return; }
        showToast(json.error || "Erro ao carregar dados", false);
        return;
      }
      setData(json);
    } catch {
      showToast("Erro de ligacao", false);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!authLoading && !user) { router.push("/api/auth/twitch"); return; }
    if (!authLoading) load();
  }, [authLoading, user, load, router]);

  useEffect(() => {
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, [load]);

  async function handleDeliver(itemId: string, quantity: number) {
    if (!data?.currentShip) return;
    setProcessing(true);
    try {
      const res = await fetch("/api/crime-empire/porto/ships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deliver",
          shipId: data.currentShip.id,
          itemId,
          quantity,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error || "Erro na entrega", false);
      } else if (json.inspected) {
        showToast(`Inspecao! ${fmt(json.quantity)}g confiscados - sem recompensa.`, false);
        await load();
      } else {
        showToast(`${fmt(json.quantity)}g entregues · +💵 ${fmt(json.earned)}`, true);
        await load();
      }
    } catch {
      showToast("Erro de ligacao", false);
    } finally {
      setProcessing(false);
    }
  }

  async function handleReveal() {
    setProcessing(true);
    try {
      const res = await fetch("/api/crime-empire/porto/ships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reveal_ship" }),
      });
      const json = await res.json();
      if (!res.ok) showToast(json.error || "Erro ao revelar", false);
      else {
        showToast(json.message || "Informações reveladas! -1000💎", true);
        await load();
      }
    } catch {
      showToast("Erro de ligação", false);
    } finally {
      setProcessing(false);
    }
  }

  const ship = data?.currentShip ?? null;
  const timerTarget = ship?.status === "docked" ? ship.departure_time : ship?.arrival_time ?? null;
  const timerMs = useCountdown(timerTarget);

  if (authLoading || loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const { currentShip, topContributors, myContribution, drugInventory, activityFeed, player } = data;
  const classMeta = currentShip ? CLASS_META[currentShip.ship_class] : null;

  return (
    <div className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full">
      {toast && <CEToast msg={toast.msg} ok={toast.ok} />}

      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">⚓</span>
          <div>
            <h1 className="text-2xl font-black text-white">Porto Antigo</h1>
            <p className="text-[#444] text-sm">Contrabando maritimo · Eventos competitivos</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#0e0e0e] border border-[#1e1e1e] rounded-xl px-4 py-2">
            <span className="text-[#555] text-xs">Dinheiro Sujo</span>
            <span className="text-white font-black text-sm">💵 {fmt(player.dirty_cash)}</span>
          </div>
          <div className="flex items-center gap-2 bg-[#0e0e0e] border border-[#1e1e1e] rounded-xl px-4 py-2">
            <span className="text-[#555] text-xs">Crypto</span>
            <span className="text-violet-300 font-black text-sm">💎 {fmt(player.crypto ?? 0)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] gap-5">

        <CaptainPanel ship={currentShip} />

        <div className="space-y-4">
          {currentShip ? (
            <div className={`rounded-2xl border-2 p-5 transition-all shadow-xl ${classMeta?.border ?? "border-[#1c1c1c]"} bg-gradient-to-br from-[#0a0f1a] to-[#080808]`}>
              <div className="flex items-start justify-between gap-3 mb-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">🚢</span>
                    <h2 className="text-xl font-black text-white">{currentShip.name}</h2>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${classMeta?.badge}`}>
                      {classMeta?.label}
                    </span>
                    <span className="text-xs bg-sky-900/40 text-sky-300 border border-sky-700/40 px-2.5 py-1 rounded-full font-bold">
                      {currentShip.drug_type}
                    </span>
                    {currentShip.origin_country && (
                      <span className="text-xs text-[#444]">🌍 {currentShip.origin_country}</span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {currentShip.status === "scheduled" && (
                    <div className="bg-[#111] border border-[#222] rounded-xl px-3 py-2 text-center">
                      <p className="text-[#444] text-xs uppercase tracking-wide font-bold mb-0.5">Chega em</p>
                      <p className="text-white font-black font-mono text-lg">{formatCountdown(timerMs)}</p>
                    </div>
                  )}
                  {currentShip.status === "docked" && (
                    <div className="bg-amber-950/40 border border-amber-700/50 rounded-xl px-3 py-2 text-center">
                      <p className="text-amber-600 text-xs uppercase tracking-wide font-bold mb-0.5">Parte em</p>
                      <p className="text-amber-300 font-black font-mono text-lg">{formatCountdown(timerMs)}</p>
                    </div>
                  )}
                  {currentShip.status === "departed" && (
                    <div className="bg-[#111] border border-[#222] rounded-xl px-3 py-2 text-center">
                      <p className="text-[#555] font-bold text-sm">🌊 Partiu</p>
                    </div>
                  )}
                </div>
              </div>

              <CapacityBar filled={currentShip.capacity_filled} total={currentShip.capacity_total} />

              {myContribution && myContribution.quantity > 0 && (
                <div className="mt-4 rounded-xl bg-sky-950/30 border border-sky-800/40 p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sky-400 text-xs font-bold uppercase tracking-wide">A tua contribuicao</p>
                    <p className="text-white font-black text-sm mt-0.5">{fmt(myContribution.quantity)}g entregues</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sky-300 font-bold text-sm">💵 {fmt(myContribution.earned)}</p>
                    {myContribution.top_bonus > 0 && (
                      <p className="text-amber-400 text-xs font-bold mt-0.5">+{fmt(myContribution.top_bonus)} bonus</p>
                    )}
                  </div>
                </div>
              )}

              {currentShip.status === "docked" && !player.in_jail && player.hp > 0 && (
                <DeliveryForm
                  ship={currentShip}
                  drugInventory={drugInventory}
                  processing={processing}
                  onDeliver={handleDeliver}
                />
              )}

              {currentShip.status === "docked" && player.in_jail && (
                <div className="mt-4 p-3 rounded-xl bg-red-900/20 border border-red-700/40 text-center text-red-400 text-sm">
                  🔒 Estas na prisao
                </div>
              )}
              {currentShip.status === "docked" && player.hp <= 0 && !player.in_jail && (
                <div className="mt-4 p-3 rounded-xl bg-red-900/20 border border-red-700/40 text-center text-red-400 text-sm">
                  🏥 Estas no hospital
                </div>
              )}

              {currentShip.status === "scheduled" && (
                <div className="mt-4 p-4 rounded-xl bg-[#0c0c0c] border border-[#1c1c1c] text-center">
                  <p className="text-[#666] text-sm">O navio ainda nao atracou.</p>
                  <p className="text-[#444] text-xs mt-1">
                    Procura: <span className="text-white font-bold">{currentShip.drug_type}</span> ·
                    Capacidade: <span className="text-sky-400 font-bold">{fmt(currentShip.capacity_total)}g</span>
                  </p>
                </div>
              )}

              {currentShip.status === "departed" && (
                <div className="mt-4 p-4 rounded-xl bg-[#0c0c0c] border border-[#1c1c1c] text-center">
                  <p className="text-[#555] text-sm">O navio partiu. O proximo esta a ser preparado.</p>
                  {myContribution && myContribution.quantity > 0 && (
                    <p className="text-sky-400 text-sm font-bold mt-2">
                      Entregaste {fmt(myContribution.quantity)}g · Recebeste 💵 {fmt(myContribution.earned + myContribution.top_bonus)}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-[#1c1c1c] p-8 text-center bg-[#080808]">
              <p className="text-4xl mb-4">🌊</p>
              <p className="text-white font-black text-lg mb-2">Nenhum navio no porto</p>
              <p className="text-[#444] text-sm">O proximo estara disponivel em breve.</p>
            </div>
          )}

          <div className="rounded-2xl bg-[#080808] border border-[#131313] p-4">
            <p className="text-xs text-[#333] uppercase tracking-widest font-bold mb-3">Como funciona</p>
            <ul className="text-[#444] text-xs space-y-2">
              <li>🚢 Navios chegam com uma droga especifica e capacidade partilhada</li>
              <li>💵 Recebes dinheiro sujo imediatamente por cada entrega</li>
              <li>🏆 O maior contribuidor recebe bonus de +{currentShip?.top_bonus_pct ?? 25}% no final</li>
              <li>⚠ Navios arriscados tem chance de inspecao e confisco</li>
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-[#0a0a0a] border border-[#1c1c1c] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1c1c1c] flex items-center gap-2">
              <span className="text-base">🏆</span>
              <p className="text-xs text-[#444] uppercase tracking-widest font-bold flex-1">Top Contribuidores</p>
              {currentShip && (
                <span className="text-[#333] text-xs truncate">{currentShip.name}</span>
              )}
            </div>
            <div className="divide-y divide-[#0e0e0e]">
              {topContributors.length === 0 && (
                <div className="p-4 text-center text-[#333] text-sm">
                  {currentShip?.status === "docked" ? "Se o primeiro a entregar" : "Sem contribuicoes"}
                </div>
              )}
              {topContributors.map((c, i) => {
                const isMe = c.player_id === player.id;
                const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                return (
                  <div
                    key={c.player_id}
                    className={`px-4 py-3 flex items-center gap-3 ${isMe ? "bg-sky-950/20" : ""}`}
                  >
                    <span className="text-base w-6 text-center flex-shrink-0">
                      {medal ?? <span className="text-[#333] text-xs font-bold">{i + 1}</span>}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${isMe ? "text-sky-400" : "text-[#ccc]"}`}>
                        {c.player_name}{isMe ? " (tu)" : ""}
                      </p>
                      <p className="text-[#444] text-xs">{fmt(c.quantity)}g</p>
                    </div>
                    <p className="text-sky-400 text-xs font-semibold flex-shrink-0">
                      💵 {fmt(c.earned)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <ActivityFeed entries={activityFeed} />

          {data.nextShip && (
            <NextShipPreview
              nextShip={data.nextShip}
              revealed={data.nextShipRevealed}
              playerCrypto={player.crypto ?? 0}
              processing={processing}
              onReveal={handleReveal}
            />
          )}
        </div>
      </div>
    </div>
  );
}
