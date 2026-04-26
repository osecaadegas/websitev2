"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import WorkerCard, { Worker } from "@/components/crime-empire/WorkerCard";
import BrothelEventPopup, { BrothelEvent } from "@/components/crime-empire/BrothelEventPopup";
import WorkerCarousel from "@/components/crime-empire/WorkerCarousel";
import RaidEscape from "@/components/crime-empire/raid/RaidEscape";
import { WORKER_DEFS, WorkerDef } from "@/lib/crime-empire/worker-defs";

interface BrothelType {
  id: string; name: string; type: string; description: string;
  purchase_price: number; base_income_per_hour: number; max_employees: number;
  required_level: number; uses_crypto: boolean;
}

interface OwnedBrothel {
  id: string; brothel_type_id: string; max_employees: number;
  brothel_type: BrothelType;
  supply_drinks: number; supply_hygiene: number; supply_security: number;
  client_satisfaction: number; heat_level: number;
  upgrade_vip_rooms: boolean; upgrade_lighting: boolean;
  upgrade_security: boolean; upgrade_marketing: boolean;
  upgrade_premium_drinks: boolean;
  upgrade_luxury_decor: boolean;
  upgrade_private_lounge: boolean;
  upgrade_celebrity_endorsement: boolean;
  upgrade_high_class_clientele: boolean;
  upgrade_signature_brand: boolean;
  total_earned: number; last_collection: string | null;
}

function SupplyBar({ label, value, icon, onRefill, canAfford }: {
  label: string; value: number; icon: string;
  onRefill: () => void; canAfford: boolean;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const color = pct >= 60 ? "bg-green-500" : pct >= 30 ? "bg-yellow-500" : "bg-red-500";
  const pulse = pct < 30 ? "animate-pulse" : "";
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-xs">
        <span className="text-[#999]">{icon} {label}</span>
        <div className="flex items-center gap-2">
          <span className={pct < 30 ? "text-red-400 font-bold" : "text-[#ccc]"}>{pct}%</span>
          <button
            onClick={onRefill}
            disabled={!canAfford}
            className={`px-2 py-0.5 rounded text-xs font-bold transition-all
              ${canAfford ? "bg-pink-700 hover:bg-pink-600 text-white" : "bg-[#222] text-[#555] cursor-not-allowed"}`}
          >
            Reabastecer ($5k 💰sujo)
          </button>
        </div>
      </div>
      <div className={`w-full h-2 bg-[#222] rounded-full overflow-hidden ${pulse}`}>
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function FloatingIncome({ amount }: { amount: number }) {
  return (
    <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-green-400 font-bold text-sm animate-float pointer-events-none z-10">
      +${amount.toLocaleString()}
    </div>
  );
}

export default function BrothelManagePage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const brothelId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [brothel, setBrothel] = useState<OwnedBrothel | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [events, setEvents] = useState<BrothelEvent[]>([]);
  const [playerCash, setPlayerCash] = useState(0);
  const [playerCrypto, setPlayerCrypto] = useState(0);
  const [playerDirtyCash, setPlayerDirtyCash] = useState(0);
  const [playerLevel, setPlayerLevel] = useState(1);
  const [showCarousel, setShowCarousel] = useState(false);
  const [hiring, setHiring] = useState(false);
  const [workerDefs, setWorkerDefs] = useState<WorkerDef[]>(
    [...WORKER_DEFS].sort((a, b) => a.hire_price - b.hire_price)
  );
  const [toast, setToast] = useState<string | null>(null);
  const [floatingIncome, setFloatingIncome] = useState<number | null>(null);
  const [tab, setTab] = useState<"workers" | "supplies" | "upgrades">("workers");

  // Cooldown timer (ticks every second so countdown updates)
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const COLLECT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
  const lastCollectTs = brothel?.last_collection ? new Date(brothel.last_collection).getTime() : 0;
  const msSinceCollect = lastCollectTs ? nowTs - lastCollectTs : COLLECT_COOLDOWN_MS;
  const collectReady = msSinceCollect >= COLLECT_COOLDOWN_MS;
  const cooldownLeftMs = Math.max(0, COLLECT_COOLDOWN_MS - msSinceCollect);
  const cooldownMin = Math.floor(cooldownLeftMs / 60_000);
  const cooldownSec = Math.floor((cooldownLeftMs % 60_000) / 1000);
  const cooldownLabel = `${String(cooldownMin).padStart(2, "0")}:${String(cooldownSec).padStart(2, "0")}`;

  // Raid escape state
  const [raidActive, setRaidActive]       = useState(false);
  const [raidCashAtRisk, setRaidCashAtRisk] = useState(0);

  // Live income tick
  const [liveIncome, setLiveIncome] = useState(0);
  const [tickedSinceCollect, setTickedSinceCollect] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/crime-empire/brothels");
      const data = await res.json();
      const owned: OwnedBrothel[] = data.ownedBrothels || [];
      const found = owned.find((b) => b.id === brothelId);
      if (!found) { router.push("/jogos/crime-empire/rua-das-luzes"); return; }
      setBrothel(found);
      const bWorkers: Worker[] = (data.workers || []).filter((w: Worker) => w.player_brothel_id === brothelId);
      setWorkers(bWorkers);
      setEvents((data.events || []).filter((e: BrothelEvent) => e.player_brothel_id === brothelId));
      setPlayerCash(data.playerCash || 0);
      setPlayerCrypto(data.playerCrypto || 0);
      setPlayerDirtyCash(data.playerDirtyCash || 0);
      setPlayerLevel(data.playerLevel || 1);
    } finally {
      setLoading(false);
    }
  }, [brothelId, router]);

  useEffect(() => { if (!user) { router.push("/"); return; } fetchData(); }, [user, fetchData]);

  // Fetch worker defs from DB (falls back to static if unavailable)
  useEffect(() => {
    fetch("/api/crime-empire/brothel-defs")
      .then(r => r.json())
      .then(d => { if (d.defs && d.defs.length > 0) setWorkerDefs(d.defs); })
      .catch(() => {});
  }, []);

  // Compute live income per second
  useEffect(() => {
    const healthy = workers.filter((w) => w.status === "healthy");
    const perHour = healthy.reduce((s, w) => s + w.income_per_hour, 0);
    const supplyMod = brothel
      ? (0.7 + (brothel.supply_drinks / 100) * 0.3) *
        (0.7 + (brothel.supply_hygiene / 100) * 0.3) *
        (brothel.client_satisfaction / 100)
      : 1;
    let upMult = 1.0;
    if (brothel?.upgrade_vip_rooms) upMult += 0.25;
    if (brothel?.upgrade_lighting)  upMult += 0.10;
    if (brothel?.upgrade_marketing) upMult += 0.15;
    if (brothel?.upgrade_premium_drinks)        upMult += 0.10;
    if (brothel?.upgrade_luxury_decor)          upMult += 0.12;
    if (brothel?.upgrade_private_lounge)        upMult += 0.15;
    if (brothel?.upgrade_celebrity_endorsement) upMult += 0.20;
    if (brothel?.upgrade_high_class_clientele)  upMult += 0.25;
    if (brothel?.upgrade_signature_brand)       upMult += 0.30;
    setLiveIncome(Math.floor(perHour * supplyMod * upMult));
  }, [workers, brothel]);

  // Tick every 5 seconds
  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      if (liveIncome > 0) {
        const tick = Math.round((liveIncome / 3600) * 5);
        setTickedSinceCollect((p) => p + (liveIncome / 3600) * 5);
        if (tick > 0) {
          setFloatingIncome(tick);
          setTimeout(() => setFloatingIncome(null), 1200);
        }
      }
    }, 5000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [liveIncome]);

  const api = async (body: object) => {
    const res = await fetch("/api/crime-empire/brothels", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  };

  const handleCollect = async () => {
    const data = await api({ action: "collect", playerBrothelId: brothelId });
    if (data.success) {
      setFloatingIncome(data.collected);
      setTimeout(() => setFloatingIncome(null), 1500);
      setTickedSinceCollect(0);
      showToast(data.message);
      fetchData();
    } else showToast(data.error);
  };

  const handleHireFromCarousel = async (def: WorkerDef) => {
    setHiring(true);
    const data = await api({
      action: "hire",
      playerBrothelId: brothelId,
      workerName: def.name,
      workerSlug: def.slug,
      incomePerHour: def.earnings_per_hour,
      attractiveness: def.stats.attractiveness,
      stamina: def.stats.stamina,
      mood: def.stats.mood,
      trait1: def.traits[0] ?? null,
      trait2: def.traits[1] ?? null,
      hireCost: def.hire_price,
      hireCostCrypto: def.hire_uses_crypto,
    });
    setHiring(false);
    if (data.success) { showToast(data.message); fetchData(); }
    else showToast(data.error);
  };

  const handleFire = async (workerId: string) => {
    if (!confirm("Tens a certeza?")) return;
    const data = await api({ action: "fire", workerId });
    if (data.success) { showToast(data.message); fetchData(); }
    else showToast(data.error);
  };

  const handlePayBonus = async (workerId: string) => {
    const data = await api({ action: "pay_worker_bonus", workerId });
    if (data.success) { showToast(data.message); fetchData(); }
    else showToast(data.error);
  };

  const handlePayAllBonuses = async () => {
    const unhappy = workers.filter((w) => w.happiness < 80);
    if (unhappy.length === 0) { showToast("Todas as workers já estão felizes (≥80)."); return; }
    const cost = unhappy.length * 1500;
    if (!confirm(`Pagar bónus a ${unhappy.length} worker${unhappy.length > 1 ? "s" : ""} por $${cost.toLocaleString()} sujo?`)) return;
    const data = await api({ action: "pay_all_bonuses", playerBrothelId: brothelId });
    if (data.success) { showToast(data.message); fetchData(); }
    else showToast(data.error);
  };

  const handleRefill = async (supplyType: string) => {
    const data = await api({ action: "refill_supplies", playerBrothelId: brothelId, supplyType });
    if (data.success) { showToast(data.message); fetchData(); }
    else showToast(data.error);
  };

  const handleUpgrade = async (upgradeType: string) => {
    const data = await api({ action: "upgrade", playerBrothelId: brothelId, upgradeType });
    if (data.success) { showToast(data.message); fetchData(); }
    else showToast(data.error);
  };

  const triggerRaid = () => {
    const atRisk = Math.max(0, Math.floor(tickedSinceCollect));
    setRaidCashAtRisk(atRisk);
    setRaidActive(true);
  };

  const handleRaidEscape = async (cashSaved: number) => {
    setRaidActive(false);
    try {
      const data = await api({ action: "raid_result", playerBrothelId: brothelId, escaped: true, cashAtRisk: cashSaved });
      showToast(data.message || data.error || "Escapaste!");
      if (data.error) console.error("raid_result(escaped) error:", data.error);
    } catch (e) {
      console.error("raid_result(escaped) failed:", e);
      showToast("Escapaste!");
    }
    fetchData();
  };

  const handleRaidArrested = async () => {
    // Close modal IMMEDIATELY so the player is never stuck if the API fails.
    setRaidActive(false);
    try {
      const data = await api({ action: "raid_result", playerBrothelId: brothelId, escaped: false, cashAtRisk: raidCashAtRisk });
      showToast(data.message || data.error || "Foste preso!");
      if (data.error) console.error("raid_result(arrested) error:", data.error);
    } catch (e) {
      console.error("raid_result(arrested) failed:", e);
      showToast("Foste preso!");
    }
    fetchData();
  };

  const handleResolveEvent = async (eventId: string, choice: string) => {
    const data = await api({ action: "resolve_event", eventId, choice });
    if (data.success) { showToast(data.message); fetchData(); }
    else showToast(data.error);
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-pink-400 text-xl animate-pulse">A carregar...</div>
    </div>
  );
  if (!brothel) return null;

  const activeWorkers = workers.filter((w) => w.status === "healthy");
  const happiness = activeWorkers.length
    ? Math.floor(activeWorkers.reduce((s, w) => s + w.happiness, 0) / activeWorkers.length)
    : 0;
  const criticalSupply = brothel.supply_drinks < 30 || brothel.supply_hygiene < 30 || brothel.supply_security < 30;
  const cryptoType = ["brothel_luxury", "brothel_exclusive", "brothel_empire"].includes(brothel.brothel_type?.type);

  return (
    <div className="flex-1 text-white py-8 px-4 relative">
      {/* Event popup */}
      {events.length > 0 && (
        <BrothelEventPopup
          event={events[0]}
          onResolve={handleResolveEvent}
          cashAtRisk={brothel ? brothel.brothel_type.base_income_per_hour * 4 : 5000}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-xl bg-[#1a1a1a] border border-pink-500/50 text-white text-sm font-medium shadow-2xl animate-slideIn max-w-xs">
          {toast}
        </div>
      )}

      <div className="max-w-5xl mx-auto">
        {/* Back */}
        <Link href="/jogos/crime-empire/rua-das-luzes"
          className="text-sm text-[#777] hover:text-pink-400 mb-4 inline-block transition-colors">
          ← Voltar à Rua das Luzes
        </Link>

        {/* Title bar */}
        <div className="mb-6">
          <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-pink-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            {brothel.brothel_type?.name}
          </h1>
          <p className="text-[#777] text-sm mt-1">{brothel.brothel_type?.description}</p>
        </div>

        {/* ── LIVE STATUS BAR ── */}
        <div className={`mb-6 p-5 rounded-2xl bg-[#0f0f0f] border-2 transition-all ${
          criticalSupply ? "border-red-500/60 shadow-[0_0_20px_rgba(239,68,68,0.2)] animate-pulse-slow" : "border-pink-500/30"
        }`}>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {/* Live income */}
            <div className="relative">
              <p className="text-xs text-[#666] mb-1">Rendimento/hora</p>
              <p className="text-2xl font-black text-green-400">${liveIncome.toLocaleString()}/h</p>
              {floatingIncome && <FloatingIncome amount={floatingIncome} />}
              {tickedSinceCollect >= 1 && (
                <p className="text-xs text-green-300 mt-0.5">Acumulado: ~${Math.floor(tickedSinceCollect).toLocaleString()}</p>
              )}
            </div>
            {/* Occupancy */}
            <div>
              <p className="text-xs text-[#666] mb-1">Ocupação</p>
              <p className="text-2xl font-black text-pink-400">{activeWorkers.length}/{brothel.max_employees}</p>
              <p className="text-xs text-[#666]">workers ativas</p>
            </div>
            {/* Happiness */}
            <div>
              <p className="text-xs text-[#666] mb-1">Felicidade</p>
              <p className={`text-2xl font-black ${happiness >= 70 ? "text-green-400" : happiness >= 40 ? "text-yellow-400" : "text-red-400"}`}>
                {happiness}%
              </p>
              <p className="text-xs text-[#666]">{happiness >= 70 ? "😊 Ótima" : happiness >= 40 ? "😐 Razoável" : "😠 Crítica"}</p>
            </div>
            {/* Client satisfaction */}
            <div>
              <p className="text-xs text-[#666] mb-1">Satisfação Clientes</p>
              <p className={`text-2xl font-black ${brothel.client_satisfaction >= 60 ? "text-blue-400" : "text-orange-400"}`}>
                {brothel.client_satisfaction}%
              </p>
            </div>
            {/* Heat */}
            <div>
              <p className="text-xs text-[#666] mb-1">Nível de Calor 🚔</p>
              <p className={`text-2xl font-black ${brothel.heat_level < 40 ? "text-[#aaa]" : brothel.heat_level < 70 ? "text-yellow-400" : "text-red-400 animate-pulse"}`}>
                {brothel.heat_level}%
              </p>
              {brothel.heat_level >= 50 && (
                <button
                  onClick={triggerRaid}
                  className="mt-1 px-2 py-1 rounded text-[10px] font-black bg-red-900/60 border border-red-500/60 text-red-300 hover:bg-red-800/70 transition-all animate-pulse"
                >
                  🚔 RAID!
                </button>
              )}
            </div>
          </div>

          {/* Collect button */}
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleCollect}
              disabled={!collectReady}
              className={`flex-1 py-3 rounded-xl font-black text-base transition-all shadow-lg ${
                collectReady
                  ? "bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 hover:scale-[1.02] active:scale-95"
                  : "bg-[#1a1a1a] border border-[#333] text-[#666] cursor-not-allowed"
              }`}
            >
              {collectReady
                ? "💰 Recolher Rendimento"
                : `⏳ Próxima recolha em ${cooldownLabel}`}
            </button>
            {activeWorkers.length < brothel.max_employees && (
              <button
                onClick={() => setShowCarousel(true)}
                className="px-5 py-3 rounded-xl font-bold text-sm bg-[#1a1a1a] hover:bg-[#222] border border-pink-500/30 hover:border-pink-500 transition-all"
              >
                + Contratar
              </button>
            )}
          </div>

          {criticalSupply && (
            <div className="mt-3 px-4 py-2 rounded-lg bg-red-900/30 border border-red-500/40 text-red-300 text-xs font-bold animate-pulse">
              ⚠️ Supplies críticos! O rendimento está a sofrer penalizações.
            </div>
          )}
        </div>

        {/* ── TABS ── */}
        <div className="flex gap-1 mb-5 p-1 bg-[#0f0f0f] rounded-xl border border-[#222]">
          {(["workers", "supplies", "upgrades"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                tab === t ? "bg-gradient-to-r from-pink-700 to-purple-700 text-white" : "text-[#666] hover:text-[#aaa]"
              }`}>
              {t === "workers" ? `👩 Workers (${workers.length})` : t === "supplies" ? "📦 Supplies" : "⭐ Upgrades"}
            </button>
          ))}
        </div>

        {/* ── WORKERS TAB ── */}
        {tab === "workers" && (
          <div>
            {workers.length === 0 ? (
              <div className="p-10 rounded-xl bg-[#0f0f0f] border border-[#222] text-center">
                <p className="text-4xl mb-3">💋</p>
                <p className="text-[#666] mb-4">Nenhuma worker contratada ainda.</p>
                <button onClick={() => setShowCarousel(true)}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-pink-700 to-purple-700 font-bold hover:scale-105 transition-all">
                  + Contratar Primeira Worker
                </button>
              </div>
            ) : (
              <>
                {(() => {
                  const unhappy = workers.filter((w) => w.happiness < 80);
                  if (unhappy.length === 0) return null;
                  const totalCost = unhappy.length * 1500;
                  const canAfford = playerDirtyCash >= totalCost;
                  return (
                    <div className="mb-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between p-3 rounded-xl bg-gradient-to-r from-yellow-900/20 to-pink-900/20 border border-yellow-600/30">
                      <div className="text-xs sm:text-sm text-yellow-200/90">
                        <span className="font-bold text-yellow-300">{unhappy.length}</span>{" "}
                        worker{unhappy.length > 1 ? "s" : ""} com felicidade abaixo de 80.
                        <span className="text-[#999] ml-2">Custo total: <span className="font-bold text-yellow-300">${totalCost.toLocaleString()}</span> sujo</span>
                      </div>
                      <button
                        onClick={handlePayAllBonuses}
                        disabled={!canAfford}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap
                          ${canAfford
                            ? "bg-yellow-600 hover:bg-yellow-500 text-black hover:scale-[1.03] active:scale-95"
                            : "bg-[#222] text-[#555] cursor-not-allowed"}`}
                      >
                        💰 Pagar Bónus a Todas
                      </button>
                    </div>
                  );
                })()}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {workers.map((w) => (
                    <WorkerCard key={w.id} worker={w} onFire={handleFire} onPayBonus={handlePayBonus} />
                  ))}
                  {workers.length < brothel.max_employees && (
                    <button onClick={() => setShowCarousel(true)}
                      className="p-5 rounded-2xl border-2 border-dashed border-pink-500/30 hover:border-pink-500 text-pink-400 hover:text-pink-300 transition-all flex flex-col items-center justify-center gap-2 min-h-[180px]">
                      <span className="text-3xl">+</span>
                      <span className="font-bold">Contratar Worker</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── SUPPLIES TAB ── */}
        {tab === "supplies" && (
          <div className="p-6 rounded-2xl bg-[#0f0f0f] border border-[#222] space-y-5">
            <p className="text-sm text-[#666]">
              Supplies degradam ao longo do tempo. Baixo nível de supplies reduz o rendimento e a satisfação dos clientes.
            </p>
            <SupplyBar label="Bebidas" value={brothel.supply_drinks} icon="🍾"
              onRefill={() => handleRefill("drinks")} canAfford={playerDirtyCash >= 5000} />
            <SupplyBar label="Higiene" value={brothel.supply_hygiene} icon="🧴"
              onRefill={() => handleRefill("hygiene")} canAfford={playerDirtyCash >= 5000} />
            <SupplyBar label="Segurança" value={brothel.supply_security} icon="🔒"
              onRefill={() => handleRefill("security")} canAfford={playerDirtyCash >= 5000} />
            <div className="pt-2 border-t border-[#222] text-xs text-[#555]">
              Dinheiro sujo disponível: <span className="text-yellow-400">${playerDirtyCash.toLocaleString()}</span>
              {cryptoType && <span className="ml-3 text-yellow-400">🪙 {playerCrypto.toLocaleString()} crypto</span>}
            </div>
          </div>
        )}

        {/* ── UPGRADES TAB ── */}
        {tab === "upgrades" && (
          <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-[#666]">Compra pela ordem indicada. Cada upgrade desbloqueia o seguinte.</p>
            <span className="text-sm text-green-400 font-bold">${playerCash.toLocaleString()}</span>
          </div>
          <div className="flex flex-col gap-3">
            {[
              { key: "lighting",  title: "Iluminação Premium",  desc: "+10% rendimento. Ambiente mais sofisticado.", icon: "💡", cost: 30000, slots: 3, owned: brothel.upgrade_lighting,  prereq: null },
              { key: "marketing", title: "Marketing Discreto",  desc: "+15% rendimento. Mais clientes por hora.",  icon: "📢", cost: 40000, slots: 3, owned: brothel.upgrade_marketing, prereq: "upgrade_lighting" },
              { key: "security",  title: "Segurança Reforçada", desc: "Reduz atenção policial e heat.",             icon: "🛡️", cost: 50000, slots: 5, owned: brothel.upgrade_security,  prereq: "upgrade_marketing" },
              { key: "vip_rooms", title: "Quartos VIP",         desc: "+25% rendimento. Atrai clientes de alto valor.", icon: "👑", cost: 75000, slots: 10, owned: brothel.upgrade_vip_rooms, prereq: "upgrade_security" },
              { key: "premium_drinks",        title: "Bebidas Premium",        desc: "+10% rendimento. Champagne e bebidas raras para os clientes.", icon: "🍾", cost:  90000, slots: 0, owned: brothel.upgrade_premium_drinks,        prereq: "upgrade_vip_rooms" },
              { key: "luxury_decor",          title: "Decoração de Luxo",      desc: "+12% rendimento. Mobiliário e arte de alta gama.",            icon: "🏛️", cost: 130000, slots: 0, owned: brothel.upgrade_luxury_decor,          prereq: "upgrade_premium_drinks" },
              { key: "private_lounge",        title: "Salão Privado",          desc: "+15% rendimento. Sala discreta para clientes selectos.",      icon: "🛋️", cost: 200000, slots: 0, owned: brothel.upgrade_private_lounge,        prereq: "upgrade_luxury_decor" },
              { key: "celebrity_endorsement", title: "Endorsement de Celebridade", desc: "+20% rendimento. Uma figura pública recomenda em surdina.", icon: "⭐", cost: 300000, slots: 0, owned: brothel.upgrade_celebrity_endorsement, prereq: "upgrade_private_lounge" },
              { key: "high_class_clientele",  title: "Clientela de Elite",      desc: "+25% rendimento. Acesso restrito a clientes com fortuna.",    icon: "💎", cost: 450000, slots: 0, owned: brothel.upgrade_high_class_clientele,  prereq: "upgrade_celebrity_endorsement" },
              { key: "signature_brand",       title: "Marca Própria",          desc: "+30% rendimento. O teu bordel torna-se uma instituição.",    icon: "🏆", cost: 700000, slots: 0, owned: brothel.upgrade_signature_brand,       prereq: "upgrade_high_class_clientele" },
            ].map((upg, i) => {
              const prereqOwned = upg.prereq === null || brothel[upg.prereq as keyof OwnedBrothel];
              const locked = !upg.owned && !prereqOwned;
              return (
                <div key={upg.key} className={`p-4 rounded-xl border transition-all ${
                  upg.owned ? "border-green-500/40 bg-green-900/10" : locked ? "border-[#222] bg-[#0a0a0a] opacity-60" : "border-[#333] bg-[#111] hover:border-pink-500/40"
                }`}>
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 border-[#333] text-[#666]">
                      {i + 1}
                    </div>
                    <span className="text-2xl">{upg.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <h4 className="font-bold text-sm text-white">{upg.title}</h4>
                        {upg.owned && <span className="text-xs text-green-400 font-bold">✓ ATIVO</span>}
                        {locked && <span className="text-xs text-[#555] font-bold">🔒 BLOQUEADO</span>}
                      </div>
                      <p className="text-xs text-[#777]">{upg.desc}</p>
                      {upg.slots > 0 ? (
                        <p className="text-xs text-pink-400 font-bold mt-0.5">+{upg.slots} vagas de worker</p>
                      ) : (
                        <p className="text-xs text-yellow-400 font-bold mt-0.5">Bónus puro de rendimento</p>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      {upg.owned ? (
                        <div className="text-green-400 text-xs font-bold">✓</div>
                      ) : locked ? (
                        <div className="text-xs text-[#555]">Requer anterior</div>
                      ) : (
                        <button
                          onClick={() => handleUpgrade(upg.key)}
                          disabled={playerCash < upg.cost}
                          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                            playerCash >= upg.cost
                              ? "bg-gradient-to-r from-pink-700 to-purple-700 hover:from-pink-600 hover:to-purple-600 hover:scale-[1.02] active:scale-95"
                              : "bg-[#1a1a1a] text-[#555] cursor-not-allowed border border-[#222]"
                          }`}
                        >
                          ${upg.cost.toLocaleString()}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        )}

        {/* Total earned */}
        <div className="mt-6 text-center text-xs text-[#444]">
          Total ganho neste estabelecimento: <span className="text-[#666]">${brothel.total_earned.toLocaleString()}</span>
        </div>
      </div>

      {/* ── RAID ESCAPE OVERLAY ── */}
      {raidActive && (
        <RaidEscape
          businessValue={brothel.brothel_type?.base_income_per_hour ?? 3000}
          cashAtRisk={raidCashAtRisk}
          onEscape={handleRaidEscape}
          onArrested={handleRaidArrested}
        />
      )}

      {/* ── WORKER CAROUSEL ── */}
      {showCarousel && (
        <WorkerCarousel
          workers={workerDefs}
          ownedSlugs={workers.map((w) => w.slug).filter(Boolean) as string[]}
          playerCash={playerCash}
          playerCrypto={playerCrypto}
          playerLevel={playerLevel}
          onHire={handleHireFromCarousel}
          onClose={() => setShowCarousel(false)}
          hiring={hiring}
        />
      )}

      <style jsx global>{`
        @keyframes float {
          0% { opacity: 1; transform: translateX(-50%) translateY(0); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-30px); }
        }
        .animate-float { animation: float 1.2s ease-out forwards; }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-slideIn { animation: slideIn 0.3s ease-out; }
        .animate-pulse-slow { animation: pulse 3s ease-in-out infinite; }
        @keyframes fadeIn {
          from { opacity: 0; } to { opacity: 1; }
        }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
      `}</style>
    </div>
  );
}
