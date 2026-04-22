"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { CEToast } from "@/components/CEToast";

/* ── Types ── */
interface DrugItem {
  item_id: string;
  item_name: string;
  quantity: number;
  unit_value: number;
  image_url?: string | null;
}

interface CargoRow {
  id: string;
  boat_id: string;
  player_id: string;
  item_id: string;
  item_name: string;
  image_url?: string | null;
  quantity: number;
  unit_value: number;
  payout: number;
  paid: boolean;
  loaded_at: string;
}

interface Boat {
  id: string;
  week_number: number;
  week_year: number;
  boat_name: string;
  destination: string;
  docks_at: string;
  departs_by: string;
  departs_at: string | null;
  payment_at: string | null;
  max_cargo: number;
  current_cargo: number;
  status: "upcoming" | "docked" | "departed" | "paid";
}

interface Player {
  id: string;
  cash: number;
  dirty_cash: number;
  in_jail: boolean;
  hp: number;
}

/* ── Helpers ── */
function fmt(n: number) {
  return n.toLocaleString("pt-PT");
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-PT", {
    weekday: "short", day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const days = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (days > 0) {
    return `${days}d ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* ── Countdown hook ── */
function useCountdown(targetDate: string | null): number {
  const [remaining, setRemaining] = useState(() =>
    targetDate ? Math.max(0, new Date(targetDate).getTime() - Date.now()) : 0
  );
  useEffect(() => {
    if (!targetDate) return;
    const target = new Date(targetDate).getTime();
    const tick = () => setRemaining(Math.max(0, target - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);
  return remaining;
}

/* ── Status Badge ── */
function StatusBadge({ status }: { status: Boat["status"] }) {
  const cfg: Record<Boat["status"], { label: string; cls: string }> = {
    upcoming:  { label: "Em breve",    cls: "bg-[#1a1a1a] text-[#666] border border-[#2a2a2a]" },
    docked:    { label: "⚓ Atracado", cls: "bg-emerald-900/40 text-emerald-400 border border-emerald-700/50" },
    departed:  { label: "🌊 Em trânsito", cls: "bg-amber-900/40 text-amber-400 border border-amber-700/50" },
    paid:      { label: "✓ Pago",      cls: "bg-blue-900/40 text-blue-400 border border-blue-700/50" },
  };
  const { label, cls } = cfg[status];
  return <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cls}`}>{label}</span>;
}

/* ── Capacity Bar ── */
function CapacityBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0;
  const color = pct >= 80 ? "#ef4444" : pct >= 50 ? "#f59e0b" : "#10b981";
  const textColor = pct >= 80 ? "text-red-400" : pct >= 50 ? "text-amber-400" : "text-emerald-400";
  return (
    <div>
      <div className="flex justify-between text-xs text-[#666] mb-1.5">
        <span>Capacidade da carga</span>
        <span className={textColor}>
          {fmt(current)} / {fmt(max)} un{pct >= 100 ? " · CHEIO" : ""}
        </span>
      </div>
      <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

/* ── Load Drug Form ── */
function LoadDrugForm({
  boat,
  drugInventory,
  processing,
  onLoad,
}: {
  boat: Boat;
  drugInventory: DrugItem[];
  processing: boolean;
  onLoad: (itemId: string, quantity: number) => void;
}) {
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const remaining = boat.max_cargo - boat.current_cargo;

  if (remaining <= 0) {
    return (
      <div className="mt-4 p-3 rounded-xl bg-red-900/20 border border-red-700/40 text-center text-red-400 text-sm font-bold">
        🚢 Barco cheio — partiu!
      </div>
    );
  }

  if (drugInventory.length === 0) {
    return (
      <div className="mt-4 p-3 rounded-xl bg-[#0d0d0d] border border-[#1e1e1e] text-center text-[#555] text-sm">
        Sem drogas no inventário para carregar
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs text-[#555] uppercase tracking-widest font-bold mb-2">Carregar mercadoria</p>
      <p className="text-xs text-[#444] mb-3">
        Espaço restante: <span className="text-white font-semibold">{fmt(remaining)} unidades</span>
      </p>
      {drugInventory.map((drug) => {
        const inputVal = quantities[drug.item_id] ?? "";
        const qty = parseInt(inputVal) || 0;
        const maxQty = Math.min(drug.quantity, remaining);
        const payout = Math.floor(qty * drug.unit_value * 0.70);
        const unitPayout = Math.floor(drug.unit_value * 0.70);

        return (
          <div key={drug.item_id} className="flex items-center gap-3 bg-[#0c0c0c] rounded-xl p-3 border border-[#1c1c1c]">
            {drug.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={drug.image_url} alt={drug.item_name} className="w-9 h-9 object-contain rounded flex-shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded bg-[#1a1a1a] flex items-center justify-center text-lg flex-shrink-0">💊</div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold truncate">{drug.item_name}</p>
              <p className="text-[#555] text-xs">Tens: ×{fmt(drug.quantity)} · 💵 {fmt(unitPayout)}/un (–30%)</p>
              {qty > 0 && (
                <p className="text-emerald-400 text-xs font-semibold mt-0.5">Recebes: 💵 {fmt(payout)} em 3 dias</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <input
                type="number"
                min={0}
                max={maxQty}
                value={inputVal}
                placeholder="0"
                onChange={(e) => setQuantities((prev) => ({ ...prev, [drug.item_id]: e.target.value }))}
                className="w-20 bg-[#141414] border border-[#2a2a2a] text-white text-sm rounded-lg px-2.5 py-1.5 text-center focus:outline-none focus:border-emerald-700"
              />
              <button
                disabled={processing || qty <= 0 || qty > maxQty}
                onClick={() => {
                  onLoad(drug.item_id, qty);
                  setQuantities((prev) => ({ ...prev, [drug.item_id]: "" }));
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors"
              >
                Carregar
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Boat Card ── */
function BoatCard({
  boat,
  playerCargo,
  drugInventory,
  player,
  processing,
  onLoad,
}: {
  boat: Boat;
  playerCargo: CargoRow[];
  drugInventory: DrugItem[];
  player: Player;
  processing: boolean;
  onLoad: (boatId: string, itemId: string, quantity: number) => void;
}) {
  const myCargo = playerCargo.filter((c) => c.boat_id === boat.id);
  const myPayout = myCargo.reduce((s, c) => s + c.payout, 0);
  const alreadyPaid = myCargo.length > 0 && myCargo.every((c) => c.paid);

  const timerTarget =
    boat.status === "upcoming" ? boat.docks_at :
    boat.status === "docked" ? boat.departs_by :
    null;
  const timerMs = useCountdown(timerTarget);
  const paymentMs = useCountdown(boat.payment_at);

  const borderClass =
    boat.status === "docked"
      ? "border-emerald-700/50 shadow-lg shadow-emerald-900/10"
      : boat.status === "departed"
      ? "border-amber-700/40"
      : boat.status === "paid"
      ? "border-blue-700/30"
      : "border-[#1a1a1a]";

  const bgClass =
    boat.status === "docked"
      ? "bg-gradient-to-br from-[#071007] to-[#0e0e0e]"
      : boat.status === "departed"
      ? "bg-[#0e0e0e]"
      : boat.status === "paid"
      ? "bg-[#0a0c10]"
      : "bg-[#0a0a0a]";

  return (
    <div className={`rounded-2xl border p-5 transition-all ${borderClass} ${bgClass}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xl">⛵</span>
            <h3 className="text-white font-black text-base">{boat.boat_name}</h3>
          </div>
          <p className="text-[#555] text-sm">→ {boat.destination}</p>
        </div>
        <StatusBadge status={boat.status} />
      </div>

      {/* Capacity bar */}
      <CapacityBar current={boat.current_cargo} max={boat.max_cargo} />

      {/* Timing info */}
      <div className="mt-3 text-xs text-[#555] space-y-1">
        {boat.status === "upcoming" && (
          <div className="flex items-center justify-between bg-[#111] rounded-xl px-3 py-2 border border-[#1e1e1e]">
            <span className="text-[#444] uppercase tracking-wide font-bold">⏳ Atraca em</span>
            <span className="text-white font-black font-mono">{formatCountdown(timerMs)}</span>
          </div>
        )}
        {boat.status === "docked" && (
          <div className="flex items-center justify-between bg-amber-900/15 rounded-xl px-3 py-2 border border-amber-800/30">
            <span className="text-amber-500/70 uppercase tracking-wide font-bold text-xs">🚢 Parte em</span>
            <span className="text-amber-300 font-black font-mono">{formatCountdown(timerMs)}</span>
          </div>
        )}
        {boat.status === "docked" && (
          <p className="text-[#444]">Atracou: {formatDate(boat.docks_at)}</p>
        )}
        {(boat.status === "departed" || boat.status === "paid") && boat.departs_at && (
          <p className="text-[#444]">Partiu: <span className="text-[#666]">{formatDate(boat.departs_at)}</span></p>
        )}
        {boat.status === "departed" && boat.payment_at && (
          <div className="flex items-center justify-between bg-emerald-900/15 rounded-xl px-3 py-2 border border-emerald-800/30 mt-2">
            <span className="text-emerald-600/70 uppercase tracking-wide font-bold text-xs">💰 Pagamento em</span>
            <span className="text-emerald-400 font-black font-mono">{formatCountdown(paymentMs)}</span>
          </div>
        )}
        {boat.status === "paid" && boat.payment_at && (
          <p className="text-blue-400/60">Pago em: {formatDate(boat.payment_at)}</p>
        )}
      </div>

      {/* Player cargo summary */}
      {myCargo.length > 0 && (
        <div className="mt-4 rounded-xl bg-[#0d0d0d] border border-[#1e1e1e] p-3">
          <p className="text-xs text-[#444] uppercase tracking-widest font-bold mb-2.5">A tua carga</p>
          <div className="space-y-2">
            {myCargo.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  {c.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.image_url} alt={c.item_name} className="w-6 h-6 object-contain rounded flex-shrink-0" />
                  ) : (
                    <span className="text-base flex-shrink-0">💊</span>
                  )}
                  <span className="text-[#bbb] truncate">{c.item_name}</span>
                  <span className="text-[#444] flex-shrink-0">×{fmt(c.quantity)}</span>
                </div>
                <span className={`flex-shrink-0 font-bold ${c.paid ? "text-blue-400" : "text-emerald-400"}`}>
                  {c.paid ? "✓ " : ""}💵 {fmt(c.payout)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-[#1e1e1e] flex justify-between text-sm font-bold">
            <span className="text-[#555]">Total</span>
            <span className={alreadyPaid ? "text-blue-400" : "text-emerald-400"}>
              {alreadyPaid ? "✓ Recebido — " : ""}💵 {fmt(myPayout)}
            </span>
          </div>
        </div>
      )}

      {/* Notes */}
      {boat.status === "departed" && myCargo.length > 0 && (
        <p className="mt-3 text-xs text-amber-400/60 text-center">
          ⏳ Pagamento em dinheiro limpo creditado 3 dias após a partida
        </p>
      )}
      {(boat.status === "departed" || boat.status === "paid") && myCargo.length === 0 && (
        <p className="mt-3 text-[#333] text-sm text-center">Não carregaste nada neste barco</p>
      )}

      {/* Load form */}
      {boat.status === "docked" && !player.in_jail && player.hp > 0 && (
        <LoadDrugForm
          boat={boat}
          drugInventory={drugInventory}
          processing={processing}
          onLoad={(itemId, qty) => onLoad(boat.id, itemId, qty)}
        />
      )}

      {/* Blocked warnings */}
      {boat.status === "docked" && player.in_jail && (
        <div className="mt-4 p-3 rounded-xl bg-red-900/20 border border-red-700/40 text-center text-red-400 text-sm">
          🔒 Estás na prisão
        </div>
      )}
      {boat.status === "docked" && player.hp <= 0 && !player.in_jail && (
        <div className="mt-4 p-3 rounded-xl bg-red-900/20 border border-red-700/40 text-center text-red-400 text-sm">
          🏥 Estás no hospital
        </div>
      )}
    </div>
  );
}

/* ── Main Page ── */
export default function PortoPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<{
    boats: Boat[];
    playerCargo: CargoRow[];
    drugInventory: DrugItem[];
    player: Player;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4500);
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/crime-empire/porto");
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 401) { router.push("/api/auth/twitch"); return; }
        showToast(json.error || "Erro ao carregar dados", false);
        return;
      }
      setData(json);
    } catch {
      showToast("Erro de ligação", false);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!authLoading && !user) { router.push("/api/auth/twitch"); return; }
    if (!authLoading) load();
  }, [authLoading, user, load, router]);

  // Auto-refresh every 30s to sync statuses and process payments
  useEffect(() => {
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  async function handleLoad(boatId: string, itemId: string, quantity: number) {
    setProcessing(true);
    try {
      const res = await fetch("/api/crime-empire/porto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "load_drugs", boatId, itemId, quantity }),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error || "Erro ao carregar", false);
      } else {
        showToast(json.message || "Mercadoria carregada!", true);
        await load();
      }
    } catch {
      showToast("Erro de ligação", false);
    } finally {
      setProcessing(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const { boats, playerCargo, drugInventory, player } = data;
  const dockedBoats   = boats.filter((b) => b.status === "docked");
  const departedBoats = boats.filter((b) => b.status === "departed");
  const upcomingBoats = boats.filter((b) => b.status === "upcoming");
  const paidBoats     = boats.filter((b) => b.status === "paid");

  const pendingPayout = playerCargo
    .filter((c) => !c.paid)
    .reduce((s, c) => s + c.payout, 0);

  return (
    <div className="flex-1 p-4 md:p-6 max-w-2xl mx-auto w-full">
      {toast && <CEToast msg={toast.msg} ok={toast.ok} />}

      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <span className="text-4xl">⛵</span>
        <div>
          <h1 className="text-2xl font-black text-white">Porto</h1>
          <p className="text-[#444] text-sm">Contrabandeio marítimo · 4 barcos por semana</p>
        </div>
      </div>

      {/* Mechanics banner */}
      <div className="mb-6 rounded-2xl bg-[#090f09] border border-emerald-900/40 p-4">
        <p className="text-emerald-400 text-sm font-bold mb-2">Como funciona</p>
        <ul className="text-[#777] text-xs space-y-1.5">
          <li>⛵ Chegam <span className="text-white font-semibold">4 barcos por semana</span> em datas e horários aleatórios</li>
          <li>📦 Cada barco tem uma <span className="text-white font-semibold">capacidade partilhada</span> — quando enche, fecha para todos e parte imediatamente</li>
          <li>💰 Recebes <span className="text-white font-semibold">dinheiro limpo</span> a <span className="text-amber-400 font-semibold">–30% do valor de rua</span> por unidade</li>
          <li>⏳ O pagamento chega <span className="text-white font-semibold">3 dias após a partida</span> — o barco precisa de chegar ao destino</li>
        </ul>
      </div>

      {/* Stats */}
      <div className="mb-6 flex gap-3">
        <div className="flex-1 rounded-xl bg-[#0e0e0e] border border-[#1e1e1e] px-4 py-3">
          <p className="text-[#444] text-xs mb-0.5">Dinheiro Limpo</p>
          <p className="text-white font-black text-lg">💵 {fmt(player.cash)}</p>
        </div>
        {pendingPayout > 0 && (
          <div className="flex-1 rounded-xl bg-amber-900/20 border border-amber-700/40 px-4 py-3">
            <p className="text-amber-500/70 text-xs mb-0.5">A receber</p>
            <p className="text-amber-400 font-black text-lg">💵 {fmt(pendingPayout)}</p>
          </div>
        )}
      </div>

      {/* Docked boats */}
      {dockedBoats.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs text-[#444] uppercase tracking-widest font-bold mb-3">⚓ Atracados agora</h2>
          <div className="space-y-4">
            {dockedBoats.map((b) => (
              <BoatCard key={b.id} boat={b} playerCargo={playerCargo} drugInventory={drugInventory} player={player} processing={processing} onLoad={handleLoad} />
            ))}
          </div>
        </section>
      )}

      {/* Departed / in transit */}
      {departedBoats.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs text-[#444] uppercase tracking-widest font-bold mb-3">🌊 Em trânsito</h2>
          <div className="space-y-4">
            {departedBoats.map((b) => (
              <BoatCard key={b.id} boat={b} playerCargo={playerCargo} drugInventory={drugInventory} player={player} processing={processing} onLoad={handleLoad} />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming */}
      {upcomingBoats.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs text-[#444] uppercase tracking-widest font-bold mb-3">📅 Próximos barcos</h2>
          <div className="space-y-4">
            {upcomingBoats.map((b) => (
              <BoatCard key={b.id} boat={b} playerCargo={playerCargo} drugInventory={drugInventory} player={player} processing={processing} onLoad={handleLoad} />
            ))}
          </div>
        </section>
      )}

      {/* Paid history */}
      {paidBoats.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs text-[#444] uppercase tracking-widest font-bold mb-3">✓ Pagamentos efetuados</h2>
          <div className="space-y-4">
            {paidBoats.map((b) => (
              <BoatCard key={b.id} boat={b} playerCargo={playerCargo} drugInventory={drugInventory} player={player} processing={processing} onLoad={handleLoad} />
            ))}
          </div>
        </section>
      )}

      {boats.length === 0 && (
        <div className="text-center text-[#333] text-sm py-16">Nenhum barco disponível. Tenta mais tarde.</div>
      )}
    </div>
  );
}
