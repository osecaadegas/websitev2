"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import WorkerCard, { Worker } from "@/components/crime-empire/WorkerCard";
import BrothelEventPopup, { BrothelEvent } from "@/components/crime-empire/BrothelEventPopup";

interface BrothelType {
  id: string; name: string; type: string; description: string;
  purchase_price: number; base_income_per_hour: number; max_employees: number;
  required_level: number; uses_crypto: boolean; sort_order: number;
}

interface OwnedBrothel {
  id: string; brothel_type_id: string; max_employees: number;
  brothel_type: BrothelType;
  supply_drinks: number; supply_hygiene: number; supply_security: number;
  client_satisfaction: number; heat_level: number;
  upgrade_vip_rooms: boolean; upgrade_lighting: boolean;
  upgrade_security: boolean; upgrade_marketing: boolean;
  total_earned: number; last_collection: string | null;
}

const CRYPTO_TYPES = ["brothel_luxury", "brothel_exclusive", "brothel_empire"];

function SupplyMini({ value, icon }: { value: number; icon: string }) {
  const pct = Math.max(0, Math.min(100, value ?? 100));
  const color = pct >= 60 ? "bg-green-500" : pct >= 30 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span>{icon}</span>
      <div className="flex-1 h-1.5 bg-[#222] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} ${pct < 30 ? "animate-pulse" : ""}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`w-6 text-right ${pct < 30 ? "text-red-400" : "text-[#777]"}`}>{pct}</span>
    </div>
  );
}

function OwnedBrothelCard({
  brothel, workers, onCollect, collecting,
}: {
  brothel: OwnedBrothel;
  workers: Worker[];
  onCollect: (id: string) => void;
  collecting: string | null;
}) {
  const active = workers.filter((w) => w.status === "healthy");
  const happiness = active.length
    ? Math.floor(active.reduce((s, w) => s + w.happiness, 0) / active.length)
    : 0;

  const perHour = active.reduce((s, w) => s + w.income_per_hour, 0);
  const drinkMod = 0.7 + ((brothel.supply_drinks ?? 100) / 100) * 0.3;
  const hygieneMod = 0.7 + ((brothel.supply_hygiene ?? 100) / 100) * 0.3;
  const clientMod = (brothel.client_satisfaction ?? 75) / 100;
  let upMult = 1.0;
  if (brothel.upgrade_vip_rooms) upMult += 0.25;
  if (brothel.upgrade_lighting) upMult += 0.10;
  if (brothel.upgrade_marketing) upMult += 0.15;
  const effective = Math.floor(perHour * drinkMod * hygieneMod * clientMod * upMult);

  const criticalSupply = (brothel.supply_drinks ?? 100) < 30 ||
    (brothel.supply_hygiene ?? 100) < 30 || (brothel.supply_security ?? 100) < 30;

  const borderColor = criticalSupply ? "border-red-500/60" :
    happiness < 40 ? "border-orange-500/40" : "border-pink-500/30 hover:border-pink-500/60";

  return (
    <div className={`p-5 rounded-2xl bg-[#111] border-2 ${borderColor} transition-all`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-black text-pink-300 text-lg">{brothel.brothel_type?.name}</h3>
          <p className="text-xs text-[#666] mt-0.5">{brothel.brothel_type?.description}</p>
        </div>
        {brothel.heat_level >= 70 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/60 text-red-300 border border-red-700/40 animate-pulse font-bold">
            🚔 {brothel.heat_level}%
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4 text-center">
        <div className="p-2 rounded-lg bg-[#0f0f0f]">
          <p className="text-xs text-[#555]">$/h</p>
          <p className="font-bold text-green-400 text-sm">${effective.toLocaleString()}</p>
        </div>
        <div className="p-2 rounded-lg bg-[#0f0f0f]">
          <p className="text-xs text-[#555]">Workers</p>
          <p className="font-bold text-pink-400 text-sm">{active.length}/{brothel.max_employees}</p>
        </div>
        <div className="p-2 rounded-lg bg-[#0f0f0f]">
          <p className="text-xs text-[#555]">Felicidade</p>
          <p className={`font-bold text-sm ${happiness >= 70 ? "text-green-400" : happiness >= 40 ? "text-yellow-400" : "text-red-400"}`}>
            {happiness}%
          </p>
        </div>
      </div>

      <div className="space-y-1.5 mb-4">
        <SupplyMini value={brothel.supply_drinks ?? 100} icon="🍾" />
        <SupplyMini value={brothel.supply_hygiene ?? 100} icon="🧴" />
        <SupplyMini value={brothel.supply_security ?? 100} icon="🔒" />
      </div>

      {(brothel.upgrade_vip_rooms || brothel.upgrade_lighting || brothel.upgrade_marketing || brothel.upgrade_security) && (
        <div className="flex flex-wrap gap-1 mb-3">
          {brothel.upgrade_vip_rooms && <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-900/40 text-yellow-300">👑 VIP</span>}
          {brothel.upgrade_lighting && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300">💡 Luz</span>}
          {brothel.upgrade_marketing && <span className="text-xs px-1.5 py-0.5 rounded bg-pink-900/40 text-pink-300">📢 Mkt</span>}
          {brothel.upgrade_security && <span className="text-xs px-1.5 py-0.5 rounded bg-green-900/40 text-green-300">🛡️ Seg</span>}
        </div>
      )}

      {criticalSupply && (
        <div className="mb-3 px-3 py-1.5 rounded-lg bg-red-900/30 border border-red-500/40 text-red-300 text-xs animate-pulse font-bold">
          ⚠️ Supplies críticos! Rendimento penalizado.
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => onCollect(brothel.id)}
          disabled={collecting === brothel.id}
          className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${
            collecting === brothel.id
              ? "bg-[#1a1a1a] text-[#555]"
              : "bg-gradient-to-r from-pink-700 to-purple-700 hover:from-pink-600 hover:to-purple-600 hover:scale-[1.02] active:scale-95"
          }`}
        >
          {collecting === brothel.id ? "A coletar..." : "💰 Coletar"}
        </button>
        <Link
          href={`/jogos/crime-empire/rua-das-luzes/${brothel.id}`}
          className="flex-1 py-2.5 rounded-xl font-bold text-sm text-center bg-[#1a1a1a] hover:bg-[#222] border border-pink-500/20 hover:border-pink-500/50 transition-all"
        >
          ⚙️ Gerir
        </Link>
      </div>
    </div>
  );
}

export default function RuaDasLuzesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [brothelTypes, setBrothelTypes] = useState<BrothelType[]>([]);
  const [ownedBrothels, setOwnedBrothels] = useState<OwnedBrothel[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [events, setEvents] = useState<BrothelEvent[]>([]);
  const [playerClass, setPlayerClass] = useState("");
  const [playerLevel, setPlayerLevel] = useState(0);
  const [playerCash, setPlayerCash] = useState(0);
  const [playerCrypto, setPlayerCrypto] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [collecting, setCollecting] = useState<string | null>(null);
  const [liveTotal, setLiveTotal] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/crime-empire/brothels");
      const data = await res.json();
      setBrothelTypes(data.brothelTypes || []);
      setOwnedBrothels(data.ownedBrothels || []);
      setWorkers(data.workers || []);
      setEvents(data.events || []);
      setPlayerClass(data.playerClass || "");
      setPlayerLevel(data.playerLevel || 0);
      setPlayerCash(data.playerCash || 0);
      setPlayerCrypto(data.playerCrypto || 0);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) { router.push("/"); return; }
    fetchData();
  }, [user, fetchData]);

  useEffect(() => {
    const healthy = workers.filter((w) => w.status === "healthy");
    const total = healthy.reduce((s, w) => s + w.income_per_hour, 0);
    setLiveTotal(playerClass === "pimp" ? Math.floor(total * 1.2) : total);
  }, [workers, playerClass]);

  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(fetchData, 30000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [fetchData]);

  const api = async (body: object) => {
    const res = await fetch("/api/crime-empire/brothels", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  };

  const handlePurchase = async (brothelTypeId: string) => {
    const data = await api({ action: "purchase", brothelTypeId });
    if (data.success) { showToast(data.message); fetchData(); }
    else showToast(data.error);
  };

  const handleCollect = async (playerBrothelId: string) => {
    setCollecting(playerBrothelId);
    const data = await api({ action: "collect", playerBrothelId });
    setCollecting(null);
    if (data.success) { showToast(data.message); fetchData(); }
    else showToast(data.error);
  };

  const handleResolveEvent = async (eventId: string, choice: string) => {
    const data = await api({ action: "resolve_event", eventId, choice });
    if (data.success) { showToast(data.message); fetchData(); }
    else showToast(data.error);
  };

  const availableBrothels = brothelTypes.filter(
    (b) => !ownedBrothels.find((ob) => ob.brothel_type_id === b.id)
  );
  const unhappyWorkers = workers.filter((w) => w.happiness < 40).length;
  const totalEvents = events.length;

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-pink-400 text-2xl animate-pulse">💋 A carregar...</div>
    </div>
  );

  return (
    <div className="flex-1 text-white py-8 px-4">
      {totalEvents > 0 && (
        <BrothelEventPopup event={events[0]} onResolve={handleResolveEvent} />
      )}

      {toast && (
        <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-xl bg-[#1a1a1a] border border-pink-500/50 text-white text-sm font-medium shadow-2xl animate-slideIn max-w-xs">
          {toast}
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        <Link href="/jogos/crime-empire/dashboard"
          className="text-sm text-[#777] hover:text-[#ff6a00] mb-4 inline-block transition-colors">
          ← Voltar ao Dashboard
        </Link>

        <div className="mb-8">
          <h1 className="text-5xl md:text-6xl font-black bg-gradient-to-r from-pink-500 via-purple-400 to-pink-500 bg-clip-text text-transparent">
            💋 RUA DAS LUZES
          </h1>
          <p className="text-[#888] mt-2">
            Gere os teus estabelecimentos do prazer e maximiza o rendimento
            {playerClass === "pimp" && (
              <span className="ml-2 text-pink-400 font-bold">👑 PIMP: +20% Rendimento</span>
            )}
          </p>
          <div className="flex flex-wrap gap-6 mt-3 text-sm">
            <span className="text-[#777]">Dinheiro: <span className="text-green-400 font-bold">${playerCash.toLocaleString()}</span></span>
            <span className="text-[#777]">Crypto: <span className="text-yellow-400 font-bold">🪙 {playerCrypto.toLocaleString()}</span></span>
            <span className="text-[#777]">Nível: <span className="text-orange-400 font-bold">{playerLevel}</span></span>
          </div>
        </div>

        {(totalEvents > 0 || unhappyWorkers > 0) && (
          <div className="mb-6 space-y-2">
            {totalEvents > 0 && (
              <div className="px-5 py-3 rounded-xl bg-purple-900/30 border border-purple-500/50 text-purple-200 text-sm font-bold animate-pulse flex items-center gap-2">
                ⚡ {totalEvents} evento{totalEvents > 1 ? "s" : ""} a aguardar resolução!
              </div>
            )}
            {unhappyWorkers > 0 && (
              <div className="px-5 py-3 rounded-xl bg-orange-900/30 border border-orange-500/50 text-orange-200 text-sm font-bold flex items-center gap-2">
                😠 {unhappyWorkers} worker{unhappyWorkers > 1 ? "s estão" : " está"} infeliz!
              </div>
            )}
          </div>
        )}

        {ownedBrothels.length > 0 && (
          <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-[#0f0f0f] border border-pink-500/20 text-center">
              <p className="text-xs text-[#555] mb-1">Rendimento/hora</p>
              <p className="text-2xl font-black text-green-400">${liveTotal.toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-xl bg-[#0f0f0f] border border-pink-500/20 text-center">
              <p className="text-xs text-[#555] mb-1">Estabelecimentos</p>
              <p className="text-2xl font-black text-pink-400">{ownedBrothels.length}</p>
            </div>
            <div className="p-4 rounded-xl bg-[#0f0f0f] border border-pink-500/20 text-center">
              <p className="text-xs text-[#555] mb-1">Workers Ativas</p>
              <p className="text-2xl font-black text-purple-400">{workers.filter((w) => w.status === "healthy").length}</p>
            </div>
            <div className="p-4 rounded-xl bg-[#0f0f0f] border border-pink-500/20 text-center">
              <p className="text-xs text-[#555] mb-1">Média Felicidade</p>
              <p className={`text-2xl font-black ${
                workers.length ? (workers.reduce((s, w) => s + w.happiness, 0) / workers.length >= 70 ? "text-green-400" : "text-yellow-400") : "text-[#555]"
              }`}>
                {workers.length ? Math.floor(workers.reduce((s, w) => s + w.happiness, 0) / workers.length) : 0}%
              </p>
            </div>
          </div>
        )}

        {ownedBrothels.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-black mb-4 text-white">Os Teus Estabelecimentos</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {ownedBrothels.filter((ob) => ob.brothel_type).map((ob) => (
                <OwnedBrothelCard
                  key={ob.id} brothel={ob}
                  workers={workers.filter((w) => w.player_brothel_id === ob.id)}
                  onCollect={handleCollect} collecting={collecting}
                />
              ))}
            </div>
          </section>
        )}

        {workers.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-black mb-4 text-white">Workers</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {workers.map((w) => (
                <WorkerCard key={w.id} worker={w}
                  onFire={async (id) => {
                    if (!confirm("Despedir?")) return;
                    const d = await api({ action: "fire", workerId: id });
                    if (d.success) { showToast(d.message); fetchData(); } else showToast(d.error);
                  }}
                  onPayBonus={async (id) => {
                    const d = await api({ action: "pay_worker_bonus", workerId: id });
                    if (d.success) { showToast(d.message); fetchData(); } else showToast(d.error);
                  }}
                  compact
                />
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-2xl font-black mb-4 text-white">Estabelecimentos Disponíveis</h2>
          {availableBrothels.length === 0 ? (
            <div className="p-8 rounded-xl bg-[#0f0f0f] border border-[#222] text-center">
              <p className="text-4xl mb-3">🏆</p>
              <p className="text-[#666]">Já adquiriste todos os estabelecimentos disponíveis!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {availableBrothels.map((bt) => {
                const locked = playerLevel < bt.required_level;
                const isCrypto = CRYPTO_TYPES.includes(bt.type);
                const canAfford = isCrypto ? playerCrypto >= bt.purchase_price : playerCash >= bt.purchase_price;
                return (
                  <div key={bt.id}
                    className={`p-5 rounded-2xl border-2 transition-all ${
                      locked ? "border-[#222] bg-[#0a0a0a] opacity-60" : "border-pink-500/30 bg-[#111] hover:border-pink-500/60"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-black text-xl text-pink-300">{bt.name}</h3>
                      {locked && <span className="text-xs px-2 py-0.5 rounded-full bg-[#1a1a1a] text-[#555] border border-[#333]">🔒 Nível {bt.required_level}</span>}
                      {isCrypto && !locked && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-400 border border-yellow-700/40">🪙 Crypto</span>}
                    </div>
                    <p className="text-xs text-[#666] mb-4">{bt.description}</p>
                    <div className="space-y-1.5 mb-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[#666]">Preço</span>
                        <span className="text-yellow-400 font-bold">{isCrypto ? `🪙 ${bt.purchase_price.toLocaleString()}` : `$${bt.purchase_price.toLocaleString()}`}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#666]">Rendimento base</span>
                        <span className="text-green-400">${bt.base_income_per_hour.toLocaleString()}/h</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#666]">Capacidade</span>
                        <span className="text-pink-400">{playerClass === "pimp" ? bt.max_employees * 2 : bt.max_employees} workers{playerClass === "pimp" ? " (2x)" : ""}</span>
                      </div>
                    </div>
                    {locked ? (
                      <div className="w-full py-3 rounded-xl bg-[#111] border border-[#222] text-center text-[#444] text-sm font-bold">
                        🔒 Nível {bt.required_level} necessário
                      </div>
                    ) : (
                      <button
                        onClick={() => handlePurchase(bt.id)}
                        disabled={!canAfford}
                        className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                          canAfford
                            ? "bg-gradient-to-r from-pink-700 to-purple-700 hover:from-pink-600 hover:to-purple-600 hover:scale-[1.02] active:scale-95"
                            : "bg-[#1a1a1a] text-[#444] border border-[#222] cursor-not-allowed"
                        }`}
                      >
                        {canAfford ? (isCrypto ? "🪙 Comprar com Crypto" : "💰 Comprar") : "Saldo insuficiente"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <style jsx global>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-slideIn { animation: slideIn 0.3s ease-out; }
      `}</style>
    </div>
  );
}
