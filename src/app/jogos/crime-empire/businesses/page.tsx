"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { notifyPlayerUpdate } from "@/lib/crime-empire/player-context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BUSINESS_DEFS,
  STATUS_META,
  type BusinessStatus,
  type ProductionLevel,
  type RiskLevel,
} from "@/lib/business-defs";

// ── types ─────────────────────────────────────────────────────────────────────
interface Business {
  id: string; name: string; type: string; description: string;
  purchase_price: number; base_income_per_hour: number;
  max_employees: number; required_level: number;
  heat_per_hour?: number; risk_level?: string; tagline?: string;
  launder_cap_per_hour?: number | null; launder_fee_percent?: number | null;
}
interface OwnedBusiness {
  id: string; pb_id: string; business_id: string; employees: number;
  max_employees: number; last_collection: string; upgrade_level: number;
  production_level: ProductionLevel; status: BusinessStatus; heat: number;
  // drug fields
  drug_output_per_hour?: number | null;
  // launder fields
  launder_used?: number | null; launder_window_start?: string | null;
  // extra
  sick_workers?: number | null;
  business: Business & { income_type?: string; launder_cap_per_hour?: number | null; drug_output_per_hour?: number | null; };
}
interface Player { level: number; cash: number; dirty_cash: number; class: string; }

// ── helpers ───────────────────────────────────────────────────────────────────
function heatColor(h: number) {
  if (h < 30) return "#22c55e";
  if (h < 60) return "#eab308";
  if (h < 80) return "#f97316";
  return "#ef4444";
}
function riskBadge(risk?: string) {
  if (risk === "high")   return <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400">🔴 Alto</span>;
  if (risk === "medium") return <span className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400">🟡 Médio</span>;
  return <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-500/10 border border-green-500/30 text-green-400">🟢 Baixo</span>;
}

// ── Owned Business Card ───────────────────────────────────────────────────────
function OwnedCard({ ob, onView }: { ob: OwnedBusiness; onView: () => void }) {
  const def = BUSINESS_DEFS[ob.business.type];
  const status = ob.status ?? "running";
  const statusMeta = STATUS_META[status as BusinessStatus] ?? STATUS_META.running;
  const heatPct = Math.min(100, ob.heat ?? 0);

  const incomeType = ob.business.income_type ?? "dirty_cash";
  const isDrug = incomeType === "drugs";
  const isLaunder = incomeType === "launder";

  // Live tick — updates accumulated value every 10s
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);

  const hoursElapsed = (now - new Date(ob.last_collection).getTime()) / 3_600_000;

  // Cash accumulation
  const accumulated = (!isDrug && !isLaunder)
    ? Math.floor(hoursElapsed * ob.business.base_income_per_hour)
    : 0;

  // Drug quantity pending
  const drugRate = ob.business.drug_output_per_hour ?? ob.drug_output_per_hour ?? 0;
  const drugQty = isDrug ? Math.floor(hoursElapsed * drugRate) : 0;

  // Launder window remaining
  const launderCap = ob.business.launder_cap_per_hour ?? 0;
  const launderWindowExpired = !ob.launder_window_start ||
    (now - new Date(ob.launder_window_start).getTime()) >= 3_600_000;
  const launderUsed = launderWindowExpired ? 0 : (ob.launder_used ?? 0);
  const launderRemaining = Math.max(0, launderCap - launderUsed);
  const launderWindowResetAt = ob.launder_window_start
    ? new Date(new Date(ob.launder_window_start).getTime() + 3_600_000)
    : null;
  const launderSecsLeft = launderWindowResetAt && !launderWindowExpired
    ? Math.max(0, Math.ceil((launderWindowResetAt.getTime() - now) / 1000))
    : 0;

  const hasReady = (!isDrug && !isLaunder && accumulated >= ob.business.base_income_per_hour)
    || (isDrug && drugQty > 0)
    || (isLaunder && launderRemaining >= launderCap * 0.5);

  return (
    <div
      className="rounded-2xl border overflow-hidden flex flex-col transition-all hover:border-orange-500/30 cursor-pointer relative"
      style={{ background: "#111", borderColor: hasReady ? "rgba(255,106,0,0.40)" : "rgba(255,255,255,0.07)" }}
      onClick={onView}
    >
      {/* top gradient band */}
      <div className="h-1" style={{ background: status === "raided" ? "#ef4444" : status === "idle" ? "#eab308" : "#ff6a00" }} />

      {/* "ready" badge */}
      {hasReady && (
        <div className="absolute top-2 right-2 z-10">
          <span className="animate-pulse text-xs font-black px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/50 text-orange-400">
            ● Pronto
          </span>
        </div>
      )}

      <div className="p-4 flex gap-3">
        <span className="text-4xl flex-shrink-0">{def?.icon ?? "🏢"}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-black text-white truncate">{ob.business.name}</p>
            {!hasReady && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${statusMeta.bg} ${statusMeta.color}`}>
                ● {statusMeta.label}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{def?.tagline ?? ob.business.description}</p>
        </div>
      </div>

      {/* stats — type-aware */}
      <div className="px-4 pb-3 grid grid-cols-3 gap-2 text-center text-xs">
        {/* col 1: income/cap rate */}
        <div className="rounded-lg p-2" style={{ background: "#0d0d0d" }}>
          <p className="text-gray-500">{isLaunder ? "Cap/hora" : isDrug ? "Produção/hr" : "Income/hr"}</p>
          <p className={`font-bold ${isLaunder ? "text-blue-400" : isDrug ? "text-purple-400" : "text-orange-400"}`}>
            {isLaunder
              ? `$${launderCap.toLocaleString()}`
              : isDrug
              ? `${drugRate.toFixed(1)} ud.`
              : `$${ob.business.base_income_per_hour.toLocaleString()}`}
          </p>
        </div>

        {/* col 2: pending amount */}
        <div className="rounded-lg p-2" style={{ background: "#0d0d0d" }}>
          <p className="text-gray-500">{isLaunder ? "Disponível" : isDrug ? "Pendente" : "Acumulado"}</p>
          {isLaunder ? (
            <p className={`font-bold ${launderRemaining > 0 ? "text-green-400" : "text-red-400"}`}>
              ${launderRemaining.toLocaleString()}
            </p>
          ) : isDrug ? (
            <p className={`font-bold ${drugQty > 0 ? "text-purple-400" : "text-gray-500"}`}>
              {drugQty} ud.
            </p>
          ) : (
            <p className="text-yellow-400 font-bold">${accumulated.toLocaleString()}</p>
          )}
        </div>

        {/* col 3: workers or timer */}
        <div className="rounded-lg p-2" style={{ background: "#0d0d0d" }}>
          {isLaunder && launderSecsLeft > 0 ? (
            <>
              <p className="text-gray-500">Repõe em</p>
              <p className="text-orange-400 font-bold tabular-nums">
                {Math.floor(launderSecsLeft / 60)}m {(launderSecsLeft % 60).toString().padStart(2, "0")}s
              </p>
            </>
          ) : (
            <>
              <p className="text-gray-500">Trab.</p>
              <p className="text-blue-400 font-bold">{ob.employees}/{ob.max_employees}</p>
            </>
          )}
        </div>
      </div>

      {/* heat bar */}
      <div className="px-4 pb-4">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-600">🌡️ Calor</span>
          <span style={{ color: heatColor(heatPct) }}>{heatPct.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
          <div
            className={`h-full rounded-full ${heatPct >= 85 ? "animate-pulse" : ""}`}
            style={{ width: `${heatPct}%`, background: heatColor(heatPct) }}
          />
        </div>
      </div>

      {/* CTA */}
      <div className="px-4 pb-4">
        <button
          onClick={(e) => { e.stopPropagation(); onView(); }}
          className="w-full py-2.5 rounded-xl font-black text-sm bg-gradient-to-r from-[#ff6a00] to-[#ff8533] hover:from-[#ff8533] hover:to-[#ff6a00] transition-all shadow-lg shadow-orange-900/20"
        >
          ⚙️ Gerir Negócio
        </button>
      </div>
    </div>
  );
}

// ── Available Business Card ───────────────────────────────────────────────────
function AvailableCard({ business, playerLevel, playerCash, onBuy, processing }: {
  business: Business; playerLevel: number; playerCash: number;
  onBuy: (id: string) => void; processing: boolean;
}) {
  const def = BUSINESS_DEFS[business.type];
  const locked = playerLevel < business.required_level;
  const canAfford = playerCash >= business.purchase_price;

  return (
    <div
      className={`rounded-2xl border overflow-hidden flex flex-col transition-all ${locked ? "opacity-50 grayscale" : "hover:border-orange-500/20"}`}
      style={{ background: "#111", borderColor: "rgba(255,255,255,0.07)" }}
    >
      <div className="h-1" style={{ background: locked ? "#374151" : "rgba(255,106,0,0.4)" }} />

      <div className="p-4 flex gap-3">
        <span className="text-4xl flex-shrink-0">{def?.icon ?? "🏢"}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-black text-white truncate">{business.name}</p>
            {locked && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 border border-gray-600 text-gray-400 flex-shrink-0">
                🔒 Nv.{business.required_level}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{def?.tagline ?? business.description}</p>
        </div>
      </div>

      <div className="px-4 pb-3 flex flex-wrap gap-2 text-xs">
        {riskBadge(def?.risk_level ?? (business.risk_level as RiskLevel | undefined))}
        <span className="px-1.5 py-0.5 rounded-full bg-[#1a1a1a] border border-white/10 text-gray-400">
          👥 Máx {business.max_employees} trabalhadores
        </span>
        <span className="px-1.5 py-0.5 rounded-full bg-[#1a1a1a] border border-white/10 text-gray-400">
          Nv.{business.required_level}+
        </span>
      </div>

      <div className="px-4 pb-3 grid grid-cols-2 gap-2 text-xs text-center">
        {business.launder_cap_per_hour ? (
          <>
            <div className="rounded-lg p-2" style={{ background: "#0d0d0d" }}>
              <p className="text-gray-500">Cap/hora</p>
              <p className="text-blue-400 font-bold">${business.launder_cap_per_hour.toLocaleString()}</p>
            </div>
            <div className="rounded-lg p-2" style={{ background: "#0d0d0d" }}>
              <p className="text-gray-500">Taxa da casa</p>
              <p className="text-orange-400 font-bold">{business.launder_fee_percent ?? 20}%</p>
            </div>
          </>
        ) : (
          <div className="rounded-lg p-2" style={{ background: "#0d0d0d" }}>
            <p className="text-gray-500">Rendimento base</p>
            <p className="text-orange-400 font-bold">${business.base_income_per_hour.toLocaleString()}/hr</p>
          </div>
        )}
        <div className="rounded-lg p-2" style={{ background: "#0d0d0d" }}>
          <p className="text-gray-500">Preço</p>
          <p className={`font-bold ${canAfford ? "text-green-400" : "text-red-400"}`}>
            ${business.purchase_price.toLocaleString()}
          </p>
        </div>
      </div>

      {def?.unique_mechanic && (
        <p className="px-4 pb-2 text-xs text-gray-600 italic">{def.unique_mechanic}</p>
      )}

      <div className="px-4 pb-4 mt-auto">
        {locked ? (
          <div className="w-full py-2.5 rounded-xl text-sm font-bold text-center border border-gray-700 text-gray-600 cursor-not-allowed">
            Nível {business.required_level} necessário
          </div>
        ) : (
          <button
            onClick={() => onBuy(business.id)}
            disabled={processing || !canAfford}
            className={`w-full py-2.5 rounded-xl font-black text-sm transition-all ${
              canAfford
                ? "bg-gradient-to-r from-green-700 to-green-600 hover:from-green-600 hover:to-green-500 shadow-lg shadow-green-900/20"
                : "border border-gray-700 text-gray-500 cursor-not-allowed"
            } disabled:opacity-50`}
          >
            {canAfford ? `💰 Comprar por $${business.purchase_price.toLocaleString()}` : "Sem fundos suficientes"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────
export default function BusinessesPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [ownedBusinesses, setOwnedBusinesses] = useState<OwnedBusiness[]>([]);
  const [player, setPlayer] = useState<Player | null>(null);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/crime-empire/businesses");
      const data = await res.json();
      setBusinesses(data.businesses || []);
      setOwnedBusinesses(data.ownedBusinesses || []);
      setPlayer(data.player);
    } catch {
      showToast("Erro ao carregar negócios", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) { router.push("/"); return; }
    fetchData();
  }, [user, fetchData, router]);

  const handleBuy = async (businessId: string) => {
    setProcessing(true);
    try {
      const res = await fetch("/api/crime-empire/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "purchase", businessId }),
      });
      const data = await res.json();
      if (data.success) { showToast(data.message || "Negócio comprado!"); notifyPlayerUpdate(); await fetchData(); }
      else showToast(data.error || "Erro ao comprar", "error");
    } catch {
      showToast("Erro de rede", "error");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center" style={{ background: "#0B0B0B" }}>
      <p className="text-white text-xl">A carregar...</p>
    </div>
  );

  const ownedIds = new Set(ownedBusinesses.map((ob) => ob.business_id));
  const available = businesses.filter((b) => !ownedIds.has(b.id));

  return (
    <div className="flex-1 text-white min-h-screen" style={{ background: "#0B0B0B" }}>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium ${
          toast.type === "error" ? "bg-red-900/90 border-red-500/50 text-red-100" : "bg-[#1a1a1a] border-orange-500/40 text-white"
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="py-6 px-4 md:px-8 max-w-7xl mx-auto space-y-8">
        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-end gap-4 justify-between">
          <div>
            <p className="text-xs text-gray-600 uppercase tracking-widest mb-1">Crime Empire</p>
            <h1 className="text-3xl font-black text-white">Os Meus Negócios</h1>
            <p className="text-gray-500 text-sm mt-1">Gere o teu império criminoso. Contrata pessoal, controla a produção, evita a polícia.</p>
          </div>
          {player && (
            <div className="flex gap-3 text-sm flex-shrink-0">
              <div className="rounded-xl px-4 py-2 border text-center" style={{ background: "#111", borderColor: "rgba(255,255,255,0.07)" }}>
                <p className="text-gray-500 text-xs">Dinheiro Limpo</p>
                <p className="text-green-400 font-bold">${player.cash.toLocaleString()}</p>
              </div>
              <div className="rounded-xl px-4 py-2 border text-center" style={{ background: "#111", borderColor: "rgba(255,255,255,0.07)" }}>
                <p className="text-gray-500 text-xs">Dinheiro Sujo</p>
                <p className="text-yellow-400 font-bold">${player.dirty_cash.toLocaleString()}</p>
              </div>
              <div className="rounded-xl px-4 py-2 border text-center" style={{ background: "#111", borderColor: "rgba(255,255,255,0.07)" }}>
                <p className="text-gray-500 text-xs">Nível</p>
                <p className="text-orange-400 font-bold">{player.level}</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Owned businesses ─────────────────────────────────────────────────── */}
        {ownedBusinesses.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <p className="font-black text-white text-sm uppercase tracking-widest">Os Meus Negócios</p>
              <span className="px-2 py-0.5 rounded-full text-xs bg-orange-500/10 border border-orange-500/30 text-orange-400">
                {ownedBusinesses.length}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ownedBusinesses.map((ob) => (
                <OwnedCard
                  key={ob.id}
                  ob={ob}
                  onView={() => router.push(`/jogos/crime-empire/businesses/${ob.pb_id ?? ob.id}`)}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Empty owned ──────────────────────────────────────────────────────── */}
        {ownedBusinesses.length === 0 && (
          <div className="rounded-2xl border p-10 text-center" style={{ background: "#111", borderColor: "rgba(255,255,255,0.07)" }}>
            <p className="text-4xl mb-3">🏚️</p>
            <p className="text-white font-bold text-lg">Ainda não tens negócios</p>
            <p className="text-gray-500 text-sm mt-1">Compra o teu primeiro negócio abaixo para começar a acumular rendimento.</p>
          </div>
        )}

        {/* ── Divider ──────────────────────────────────────────────────────────── */}
        {available.length > 0 && (
          <div className="border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }} />
        )}

        {/* ── Available businesses ─────────────────────────────────────────────── */}
        {available.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <p className="font-black text-white text-sm uppercase tracking-widest">Mercado Negro</p>
              <span className="text-xs text-gray-500">{available.length} disponíveis</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {available.map((b) => (
                <AvailableCard
                  key={b.id}
                  business={b}
                  playerLevel={player?.level ?? 1}
                  playerCash={player?.cash ?? 0}
                  onBuy={handleBuy}
                  processing={processing}
                />
              ))}
            </div>
          </section>
        )}

        {available.length === 0 && ownedBusinesses.length > 0 && (
          <div className="rounded-2xl border p-8 text-center" style={{ background: "#111", borderColor: "rgba(255,255,255,0.07)" }}>
            <p className="text-3xl mb-2">🎉</p>
            <p className="text-white font-bold">Já tens todos os negócios disponíveis!</p>
          </div>
        )}
      </div>
    </div>
  );
}


