"use client";

import { use, useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import RaidEscape from "@/components/crime-empire/raid/RaidEscape";
import {
  TRAIT_META, SKILL_META, PRODUCTION_META, STATUS_META, SHARED_BUSINESS_EVENTS,
  type ProductionLevel, type BusinessStatus, type BusinessTypeDef,
  type WorkerDef, type UpgradeDef, type EventDef,
} from "@/lib/business-defs";

// ── types ─────────────────────────────────────────────────────────────────────
interface HiredWorker {
  id: string; worker_def_id: string; name: string; skill: string; trait: string;
  salary: number; production_bonus: number; efficiency_bonus: number; stealth_bonus: number;
  description: string; hired_at: string;
}
interface ActiveEvent {
  id: string; event_def_id: string; created_at: string;
}
interface ManagementData {
  player_business: {
    id: string; employees: number; max_employees: number; production_level: ProductionLevel;
    status: BusinessStatus; heat: number; income_per_hour: number; heat_rate_per_hour: number;
    accumulated_income: number; hours_elapsed: number; last_collection: string;
    upgrade_level: number;
    launder_effective_cap: number; launder_remaining: number; launder_window_reset_at: string;
    drug_output_per_hour: number; accumulated_drug_qty: number; drug_item_name: string;
  };
  business: { id: string; name: string; type: string; base_income_per_hour: number; max_employees: number; launder_fee_percent?: number | null; };
  def: BusinessTypeDef | null;
  workers: HiredWorker[];
  owned_upgrade_ids: string[];
  active_events: ActiveEvent[];
  available_workers: WorkerDef[];
  available_upgrades: UpgradeDef[];
  player: { id: string; cash: number; dirty_cash: number; level: number; class: string; };
}

// ── helpers ───────────────────────────────────────────────────────────────────
function heatColor(h: number) {
  if (h < 30) return "#22c55e";
  if (h < 60) return "#eab308";
  if (h < 80) return "#f97316";
  return "#ef4444";
}
function heatLabel(h: number) {
  if (h < 30) return "Frio";
  if (h < 60) return "Morno";
  if (h < 80) return "Quente";
  if (h < 90) return "Perigoso";
  return "CRÍTICO";
}

// ── sub-components ────────────────────────────────────────────────────────────

function WorkerCard({ worker, onFire, processing }: { worker: HiredWorker; onFire: (id: string) => void; processing: boolean }) {
  const trait = TRAIT_META[worker.trait as keyof typeof TRAIT_META];
  const skill = SKILL_META[worker.skill as keyof typeof SKILL_META];
  const prodBonus = worker.production_bonus;
  return (
    <div className="rounded-xl p-3 border flex flex-col gap-2" style={{ background: "#111", borderColor: "rgba(255,255,255,0.08)" }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-bold text-white text-sm">{worker.name}</p>
          <p className="text-xs text-gray-500">{worker.description}</p>
        </div>
        <button
          onClick={() => onFire(worker.id)}
          disabled={processing}
          className="text-red-400 hover:text-red-300 text-xs px-2 py-0.5 rounded border border-red-400/20 hover:border-red-400/50 transition disabled:opacity-40"
        >Despedir</button>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="px-2 py-0.5 rounded-full bg-[#1a1a1a] border border-white/10 text-gray-300">
          {skill.icon} {skill.label}
        </span>
        <span className={`px-2 py-0.5 rounded-full bg-[#1a1a1a] border border-white/10 ${trait.color}`}>
          {trait.icon} {trait.label}
        </span>
        <span className="text-gray-400">${worker.salary}/hr</span>
      </div>
      <div className="grid grid-cols-3 gap-1 text-xs text-center">
        <div className="rounded bg-[#0d0d0d] px-1 py-0.5">
          <p className="text-gray-500">Produção</p>
          <p className={prodBonus >= 0 ? "text-green-400" : "text-red-400"}>
            {prodBonus >= 0 ? "+" : ""}{(prodBonus * 100).toFixed(0)}%
          </p>
        </div>
        <div className="rounded bg-[#0d0d0d] px-1 py-0.5">
          <p className="text-gray-500">Efic.</p>
          <p className="text-blue-400">+{(worker.efficiency_bonus * 100).toFixed(0)}%</p>
        </div>
        <div className="rounded bg-[#0d0d0d] px-1 py-0.5">
          <p className="text-gray-500">Stealth</p>
          <p className={worker.stealth_bonus >= 0 ? "text-purple-400" : "text-red-400"}>
            {worker.stealth_bonus >= 0 ? "-" : "+"}{Math.abs(worker.stealth_bonus * 100).toFixed(0)}% 🌡️
          </p>
        </div>
      </div>
    </div>
  );
}

function HirePanel({
  available, onHire, processing, onClose, playerCash,
}: {
  available: WorkerDef[]; onHire: (id: string) => void; processing: boolean;
  onClose: () => void; playerCash: number;
}) {
  if (available.length === 0) return (
    <div className="rounded-xl p-4 border text-center text-gray-500 text-sm" style={{ background: "#111", borderColor: "rgba(255,255,255,0.08)" }}>
      Todos os trabalhadores disponíveis já foram contratados.
      <button onClick={onClose} className="block mx-auto mt-3 text-xs text-orange-400 underline">Fechar</button>
    </div>
  );
  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "#0d0d0d", borderColor: "rgba(255,106,0,0.3)" }}>
      <div className="flex justify-between items-center px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        <p className="font-bold text-orange-400 text-sm">Contratar Trabalhador</p>
        <button onClick={onClose} className="text-gray-500 hover:text-white text-lg">×</button>
      </div>
      <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
        {available.map((w) => {
          const trait = TRAIT_META[w.trait as keyof typeof TRAIT_META];
          const cost = w.salary * 8;
          const canAfford = playerCash >= cost;
          return (
            <div key={w.id} className="flex items-center justify-between rounded-lg p-3" style={{ background: "#141414" }}>
              <div className="flex-1">
                <p className="font-bold text-white text-sm">{w.name} <span className={`text-xs ${trait.color}`}>{trait.icon} {trait.label}</span></p>
                <p className="text-xs text-gray-500">{w.description}</p>
                <p className="text-xs text-gray-400 mt-0.5">${w.salary}/hr · Adiantamento: <span className={canAfford ? "text-green-400" : "text-red-400"}>${cost.toLocaleString()}</span></p>
              </div>
              <button
                onClick={() => onHire(w.id)}
                disabled={processing || !canAfford}
                className="ml-3 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {canAfford ? "Contratar" : "Sem $"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventCard({
  event, defEvent, onResolve, processing,
}: {
  event: ActiveEvent; defEvent: EventDef; onResolve: (eventId: string, choiceId: string) => void; processing: boolean;
}) {
  const severityColor = defEvent.severity === "danger" ? "border-red-500/40 bg-red-500/5" : defEvent.severity === "warning" ? "border-yellow-500/40 bg-yellow-500/5" : "border-blue-500/40 bg-blue-500/5";
  const expiresAt = new Date(new Date(event.created_at).getTime() + defEvent.expires_hours * 3_600_000);
  const hoursLeft = Math.max(0, (expiresAt.getTime() - Date.now()) / 3_600_000);
  return (
    <div className={`rounded-xl p-4 border ${severityColor}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{defEvent.icon}</span>
          <div>
            <p className="font-bold text-white text-sm">{defEvent.title}</p>
            <p className={`text-xs ${defEvent.severity === "danger" ? "text-red-400" : defEvent.severity === "warning" ? "text-yellow-400" : "text-blue-400"}`}>
              Expira em {hoursLeft < 1 ? `${Math.floor(hoursLeft * 60)}min` : `${hoursLeft.toFixed(1)}h`}
            </p>
          </div>
        </div>
      </div>
      <p className="text-sm text-gray-300 mb-3">{defEvent.description}</p>
      <div className="flex flex-wrap gap-2">
        {defEvent.choices.map((c) => (
          <button
            key={c.id}
            onClick={() => onResolve(event.id, c.id)}
            disabled={processing}
            className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all disabled:opacity-40 ${
              defEvent.severity === "danger"
                ? "border-red-500/50 hover:bg-red-500/10 text-red-300"
                : defEvent.severity === "warning"
                ? "border-yellow-500/50 hover:bg-yellow-500/10 text-yellow-300"
                : "border-blue-500/50 hover:bg-blue-500/10 text-blue-300"
            }`}
          >
            {c.label}
            {c.cash_cost ? <span className="ml-1 text-red-400">-${c.cash_cost.toLocaleString()}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function UpgradeItem({
  upgradeDef, owned, onBuy, processing, playerCash,
}: {
  upgradeDef: UpgradeDef; owned: boolean; onBuy: (id: string) => void;
  processing: boolean; playerCash: number;
}) {
  const canAfford = playerCash >= upgradeDef.cost;
  const effects: string[] = [];
  if (upgradeDef.income_bonus > 0)    effects.push(`+${(upgradeDef.income_bonus * 100).toFixed(0)}% income`);
  if (upgradeDef.heat_reduction > 0)  effects.push(`-${(upgradeDef.heat_reduction * 100).toFixed(0)}% calor`);
  if (upgradeDef.capacity_bonus > 0)  effects.push(`+${upgradeDef.capacity_bonus} trabalhadores`);
  return (
    <div className={`flex items-center justify-between rounded-xl p-3 border transition-all ${owned ? "border-orange-500/30 bg-orange-500/5" : "border-white/5 bg-[#111]"}`}>
      <div className="flex items-center gap-3 flex-1">
        <span className="text-2xl">{upgradeDef.icon}</span>
        <div>
          <p className="font-bold text-sm text-white">{upgradeDef.name}</p>
          <p className="text-xs text-gray-500">{upgradeDef.description}</p>
          <p className="text-xs text-orange-400 mt-0.5">{effects.join(" · ")}</p>
        </div>
      </div>
      {owned ? (
        <span className="text-xs text-orange-400 font-bold px-2 py-1 rounded-lg border border-orange-500/30">✓ Instalado</span>
      ) : (
        <button
          onClick={() => onBuy(upgradeDef.id)}
          disabled={processing || !canAfford}
          className="ml-3 px-3 py-1.5 rounded-lg text-xs font-bold border border-orange-500/30 hover:border-orange-500/60 hover:bg-orange-500/10 text-orange-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {canAfford ? `$${upgradeDef.cost.toLocaleString()}` : `💸 $${upgradeDef.cost.toLocaleString()}`}
        </button>
      )}
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────
export default function BusinessManagementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<ManagementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" | "info" } | null>(null);
  const [showHirePanel, setShowHirePanel] = useState(false);
  const [pendingIncome, setPendingIncome] = useState(0);
  const [pendingDrugQty, setPendingDrugQty] = useState(0);
  const [currentHeat, setCurrentHeat] = useState(0);
  const [launderAmount, setLaunderAmount] = useState("");
  const [collectCooldownSecs, setCollectCooldownSecs] = useState(0);
  const [launderSecsLeft, setLaunderSecsLeft] = useState(0);
  const [raidActive, setRaidActive] = useState(false);
  const [raidCashAtRisk, setRaidCashAtRisk] = useState(0);
  const incomeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const drugIntervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const heatIntervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const collectTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  const showToast = useCallback((msg: string, type: "success" | "error" | "info" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`/api/crime-empire/businesses/${id}`);
      if (!res.ok) { showToast("Erro ao carregar negócio", "error"); return; }
      const json: ManagementData = await res.json();
      setData(json);
      setPendingIncome(json.player_business.accumulated_income);
      setPendingDrugQty(json.player_business.accumulated_drug_qty ?? 0);
      setCurrentHeat(json.player_business.heat);
    } catch {
      showToast("Erro de rede", "error");
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    if (!user) { router.push("/"); return; }
    loadData();
  }, [user, loadData, router]);

  // Live income ticker
  useEffect(() => {
    if (!data || data.def?.income_type === "drugs") return;
    const rate = data.player_business.income_per_hour / 3600;
    incomeIntervalRef.current = setInterval(() => {
      setPendingIncome((prev) => Math.floor(prev + rate));
    }, 1000);
    return () => { if (incomeIntervalRef.current) clearInterval(incomeIntervalRef.current); };
  }, [data?.player_business.income_per_hour, data?.player_business.accumulated_income, data?.def?.income_type]);

  // Live drug output ticker
  useEffect(() => {
    if (!data || data.def?.income_type !== "drugs") return;
    const rate = (data.player_business.drug_output_per_hour ?? 0) / 3600;
    drugIntervalRef.current = setInterval(() => {
      setPendingDrugQty((prev) => Math.floor(prev + rate));
    }, 1000);
    return () => { if (drugIntervalRef.current) clearInterval(drugIntervalRef.current); };
  }, [data?.player_business.drug_output_per_hour, data?.player_business.accumulated_drug_qty, data?.def?.income_type]);

  // Live heat ticker
  useEffect(() => {
    if (!data) return;
    const heatRate = data.player_business.heat_rate_per_hour / 3600;
    heatIntervalRef.current = setInterval(() => {
      setCurrentHeat((prev) => Math.min(100, prev + heatRate));
    }, 1000);
    return () => { if (heatIntervalRef.current) clearInterval(heatIntervalRef.current); };
  }, [data?.player_business.heat_rate_per_hour, data?.player_business.heat]);

  // Collect cooldown countdown
  useEffect(() => {
    if (!data) return;
    const lastCollect = new Date(data.player_business.last_collection).getTime();
    const cooldownMs = 3_600_000; // 1 hour
    const remaining = Math.max(0, Math.ceil((lastCollect + cooldownMs - Date.now()) / 1000));
    setCollectCooldownSecs(remaining);
    if (collectTimerRef.current) clearInterval(collectTimerRef.current);
    if (remaining > 0) {
      collectTimerRef.current = setInterval(() => {
        setCollectCooldownSecs((prev) => {
          if (prev <= 1) { clearInterval(collectTimerRef.current!); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (collectTimerRef.current) clearInterval(collectTimerRef.current); };
  }, [data?.player_business.last_collection]);

  // Live launder window countdown — must be before early returns
  useEffect(() => {
    if (!data) return;
    const pb = data.player_business;
    const windowActive = pb.launder_remaining < pb.launder_effective_cap && pb.launder_effective_cap > 0;
    if (!windowActive) return;
    setLaunderSecsLeft(Math.max(0, Math.ceil((new Date(pb.launder_window_reset_at).getTime() - Date.now()) / 1000)));
    const t = setInterval(() => {
      setLaunderSecsLeft((s) => {
        if (s <= 1) { clearInterval(t); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [data?.player_business.launder_window_reset_at, data?.player_business.launder_remaining, data?.player_business.launder_effective_cap]);

  const doAction = useCallback(async (body: object, refreshAfter = true) => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/crime-empire/businesses/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || json.error) { showToast(json.error || "Erro", "error"); return json; }
      if (refreshAfter) await loadData();
      return json;
    } catch {
      showToast("Erro de rede", "error");
    } finally {
      setProcessing(false);
    }
  }, [id, loadData, showToast]);

  const handleCollect = async () => {
    const result = await doAction({ action: "collect" });
    if (result?.success) {
      if (result.raided) showToast(`⚠️ ${result.message}`, "error");
      else if (result.drug_qty !== undefined) {
        const itemName = data?.player_business.drug_item_name || "unidades";
        showToast(`📦 +${result.drug_qty} ${itemName} coletados!`);
      } else {
        showToast(`💰 +$${result.earned?.toLocaleString()} dinheiro sujo coletado!`);
      }
    }
  };

  const handleSetProduction = async (level: ProductionLevel) => {
    const result = await doAction({ action: "set_production", production_level: level });
    if (result?.success) showToast(`Produção definida para ${PRODUCTION_META[level].label}`, "info");
  };

  const handleHireWorker = async (workerId: string) => {
    const result = await doAction({ action: "hire_worker", worker_def_id: workerId });
    if (result?.success) { showToast(result.message); setShowHirePanel(false); }
  };

  const handleFireWorker = async (workerDbId: string) => {
    const result = await doAction({ action: "fire_worker", worker_id: workerDbId });
    if (result?.success) showToast(result.message, "info");
  };

  const handleResolveEvent = async (eventId: string, choiceId: string) => {
    const result = await doAction({ action: "resolve_event", event_id: eventId, choice_id: choiceId });
    if (result?.success) showToast(result.outcome, result.event_success ? "success" : "error");
  };

  const handleBuyUpgrade = async (upgradeId: string) => {
    const result = await doAction({ action: "buy_upgrade", upgrade_id: upgradeId });
    if (result?.success) showToast(result.message);
  };

  const triggerRaid = () => {
    const atRisk = Math.max(0, pendingIncome);
    setRaidCashAtRisk(atRisk);
    setRaidActive(true);
  };

  const handleRaidEscape = async (cashSaved: number) => {
    setRaidActive(false);
    const result = await doAction({ action: "raid_result", escaped: true, cashAtRisk: cashSaved });
    if (result?.success) showToast(result.message || "Escapaste!");
  };

  const handleRaidArrested = async () => {
    setRaidActive(false);
    const result = await doAction({ action: "raid_result", escaped: false, cashAtRisk: raidCashAtRisk });
    if (result?.success) showToast(result.message || "Foste preso!", "error");
  };

  const handleLaunder = async () => {
    const amount = parseInt(launderAmount);
    if (!amount || amount <= 0) return;
    const result = await doAction({ action: "launder", amount });
    if (result?.success) {
      showToast(`✅ $${result.dirty_amount.toLocaleString()} lavados → $${result.clean_amount.toLocaleString()} limpos (${result.rate}%)`);
      setLaunderAmount("");
    }
  };

  // ── render ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex-1 flex items-center justify-center" style={{ background: "#0B0B0B" }}>
      <p className="text-white text-xl">A carregar...</p>
    </div>
  );

  if (!data) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4" style={{ background: "#0B0B0B" }}>
      <p className="text-red-400 text-xl">Negócio não encontrado.</p>
      <Link href="/jogos/crime-empire/businesses" className="text-orange-400 underline">← Voltar</Link>
    </div>
  );

  const { player_business: pb, business, def, workers, owned_upgrade_ids, active_events, available_workers, available_upgrades, player } = data;
  const heatPct = Math.min(100, currentHeat);
  const status = pb.status as BusinessStatus;
  const statusMeta = STATUS_META[status] ?? STATUS_META.running;
  const production = pb.production_level as ProductionLevel;
  const isLaunder = def?.income_type === "launder";
  const isDrug = def?.income_type === "drugs";
  const drugItemName = pb.drug_item_name || "droga";
  const maxLaunderThisAction = Math.min(pb.launder_remaining ?? 0, player.dirty_cash);

  const launderWindowActive = pb.launder_remaining < pb.launder_effective_cap && pb.launder_effective_cap > 0;

  const fmtLaunderCountdown = (secs: number) => {
    if (secs <= 0) return "A recarregar…";
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
  };

  // Build event + def pairs (check shared events as fallback for system-spawned events)
  const eventPairs = active_events
    .map((e) => ({ event: e, def: def?.events.find((d) => d.id === e.event_def_id) ?? SHARED_BUSINESS_EVENTS.find((d) => d.id === e.event_def_id) }))
    .filter((p) => p.def) as { event: ActiveEvent; def: EventDef }[];

  // Workers count with capacity
  const capacityUpgrades = (def?.upgrades ?? []).filter((u) => owned_upgrade_ids.includes(u.id));
  const capacityBonus = capacityUpgrades.reduce((s, u) => s + u.capacity_bonus, 0);
  const maxWorkers = pb.max_employees + capacityBonus;
  const salaryCostPerHour = workers.reduce((s, w) => s + w.salary, 0);

  return (
    <>
    <div className="flex-1 text-white min-h-screen" style={{ background: "#0B0B0B" }}>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium transition-all ${
          toast.type === "error" ? "bg-red-900/90 border-red-500/50 text-red-100" :
          toast.type === "info"  ? "bg-[#1a1a1a] border-white/10 text-gray-300" :
          "bg-[#1a1a1a] border-orange-500/40 text-white"
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="py-6 px-4 md:px-8 max-w-7xl mx-auto space-y-6">
        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div className="rounded-2xl p-5 border flex flex-col md:flex-row md:items-center gap-4 md:gap-6" style={{ background: "#111", borderColor: "rgba(255,255,255,0.07)" }}>
          {/* left: icon + name */}
          <div className="flex items-center gap-4">
            <span className="text-5xl">{def?.icon ?? "🏢"}</span>
            <div>
              <p className="text-2xl font-black text-white">{business.name}</p>
              <p className="text-sm text-gray-500">{def?.tagline}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${statusMeta.bg} ${statusMeta.color}`}>
                  ● {statusMeta.label}
                </span>
                <span className="text-xs text-gray-500">Nível {pb.upgrade_level}</span>
                <span className="text-xs text-gray-500">{def?.unique_mechanic}</span>
              </div>
            </div>
          </div>

          {/* right: income + heat */}
          <div className="md:ml-auto flex flex-col md:items-end gap-3">
            {/* Income / Drug output */}
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                {isDrug ? "Produção/hora" : "Rendimento/hora"}
              </p>
              <p className="text-2xl font-black" style={{ color: isDrug ? "#a78bfa" : "#ff6a00" }}>
                {isDrug ? `${(pb.drug_output_per_hour ?? 0).toFixed(1)} ud.` : `$${pb.income_per_hour.toLocaleString()}`}
              </p>
              {isDrug ? (
                <p className="text-xs text-gray-500">{drugItemName}</p>
              ) : (
                <p className="text-xs text-gray-500">Salários: -${salaryCostPerHour.toLocaleString()}/hr</p>
              )}
            </div>
            {/* Heat bar */}
            <div className="w-full md:w-56">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">🌡️ Calor Policial</span>
                <span style={{ color: heatColor(heatPct) }}>{heatLabel(heatPct)} ({heatPct.toFixed(1)}%)</span>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${heatPct >= 85 ? "animate-pulse" : ""}`}
                  style={{ width: `${heatPct}%`, background: heatColor(heatPct) }}
                />
              </div>
              <p className="text-xs text-gray-600 mt-0.5">+{pb.heat_rate_per_hour.toFixed(1)}/hr</p>
              {heatPct >= 50 && (
                <button
                  onClick={triggerRaid}
                  className="mt-1.5 w-full px-2 py-1.5 rounded-lg text-xs font-black bg-red-900/60 border border-red-500/60 text-red-300 hover:bg-red-800/70 transition-all animate-pulse"
                >
                  🚔 RAID!
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Action bar ──────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Collect / Launder */}
          {isLaunder ? (
            <div className="rounded-xl border p-4 space-y-3" style={{ background: "#111", borderColor: "rgba(255,255,255,0.07)" }}>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">💧 Lavandaria</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <div className="px-3 py-1.5 rounded-lg" style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-gray-500 uppercase tracking-wide" style={{ fontSize: "9px" }}>Dinheiro Sujo</p>
                  <p className="font-black text-white">${player.dirty_cash.toLocaleString()}</p>
                </div>
                <div className="px-3 py-1.5 rounded-lg" style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-gray-500 uppercase tracking-wide" style={{ fontSize: "9px" }}>Cap/Hora</p>
                  <p className="font-black text-blue-400">${pb.launder_effective_cap.toLocaleString()}</p>
                </div>
                <div className="px-3 py-1.5 rounded-lg" style={{ background: "#0a0a0a", border: "1px solid rgba(255,106,0,0.15)" }}>
                  <p className="text-gray-500 uppercase tracking-wide" style={{ fontSize: "9px" }}>Taxa da Casa</p>
                  <p className="font-black text-orange-400">{business.launder_fee_percent ?? 20}%</p>
                </div>
                <div className="px-3 py-1.5 rounded-lg" style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-gray-500 uppercase tracking-wide" style={{ fontSize: "9px" }}>Restante</p>
                  <p className={`font-black ${pb.launder_remaining > 0 ? "text-green-400" : "text-red-400"}`}>
                    ${pb.launder_remaining.toLocaleString()}
                  </p>
                </div>
                {launderWindowActive && (
                  <div className="px-3 py-1.5 rounded-lg" style={{
                    background: "#0a0a0a",
                    border: pb.launder_remaining <= 0
                      ? "1px solid rgba(239,68,68,0.35)"
                      : "1px solid rgba(255,255,255,0.06)",
                  }}>
                    <p className="text-gray-500 uppercase tracking-wide" style={{ fontSize: "9px" }}>
                      {pb.launder_remaining <= 0 ? "Recarrega em" : "Janela repõe em"}
                    </p>
                    <p className={`font-black tabular-nums ${pb.launder_remaining <= 0 ? "text-red-400" : "text-gray-300"}`}>
                      {fmtLaunderCountdown(launderSecsLeft)}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder={`Máx. $${maxLaunderThisAction.toLocaleString()}`}
                  value={launderAmount}
                  onChange={(e) => setLaunderAmount(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg text-sm bg-[#0a0a0a] border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
                />
                <button
                  onClick={() => setLaunderAmount(String(maxLaunderThisAction))}
                  disabled={maxLaunderThisAction <= 0}
                  className="px-2 py-2 rounded-lg text-xs text-gray-400 hover:text-white border border-white/10 bg-[#0a0a0a] transition-all disabled:opacity-30"
                >MAX</button>
                <button
                  onClick={handleLaunder}
                  disabled={processing || !launderAmount || parseInt(launderAmount) <= 0 || pb.launder_remaining <= 0 || player.dirty_cash <= 0}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                >
                  💧 Lavar
                </button>
              </div>
            </div>
          ) : isDrug ? (
            <div className="flex flex-col items-start gap-1">
              <button
                onClick={handleCollect}
                disabled={processing || status === "raided" || collectCooldownSecs > 0}
                className="px-6 py-3 rounded-xl font-black text-base bg-gradient-to-r from-purple-700 to-purple-500 hover:from-purple-600 hover:to-purple-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-900/20"
              >
                📦 Coletar{pendingDrugQty > 0 ? ` ${pendingDrugQty} ${drugItemName}` : ""}
              </button>
              {collectCooldownSecs > 0 && (
                <p className="text-xs text-gray-500 pl-1">
                  ⏳ Disponível em {Math.floor(collectCooldownSecs / 60)}m {collectCooldownSecs % 60}s
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-start gap-1">
              <button
                onClick={handleCollect}
                disabled={processing || status === "raided" || collectCooldownSecs > 0}
                className="px-6 py-3 rounded-xl font-black text-base bg-gradient-to-r from-[#ff6a00] to-[#ff8533] hover:from-[#ff8533] hover:to-[#ff6a00] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-orange-900/20"
              >
                💰 Coletar{pendingIncome > 0 ? ` $${pendingIncome.toLocaleString()}` : ""}
              </button>
              {collectCooldownSecs > 0 && (
                <p className="text-xs text-gray-500 pl-1">
                  ⏳ Disponível em {Math.floor(collectCooldownSecs / 60)}m {collectCooldownSecs % 60}s
                </p>
              )}
            </div>
          )}

          {/* Production control */}
          <div className="flex items-center gap-1 rounded-xl border p-1" style={{ background: "#111", borderColor: "rgba(255,255,255,0.07)" }}>
            {(["low", "normal", "overdrive"] as ProductionLevel[]).map((level) => {
              const m = PRODUCTION_META[level];
              const active = production === level;
              return (
                <button
                  key={level}
                  onClick={() => handleSetProduction(level)}
                  disabled={processing}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    active
                      ? "bg-[#1e1e1e] border border-white/20 text-white"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  <span className={m.color}>{m.label}</span>
                  <span className="block text-gray-600" style={{ fontSize: "9px" }}>×{m.income} income</span>
                </button>
              );
            })}
          </div>

          <Link
            href="/jogos/crime-empire/businesses"
            className="ml-auto px-4 py-2 rounded-xl text-sm border text-gray-400 hover:text-white transition-all"
            style={{ borderColor: "rgba(255,255,255,0.07)", background: "#111" }}
          >
            ← Negócios
          </Link>
        </div>

        {/* ── Raid warning ────────────────────────────────────────────────────── */}
        {status === "raided" && (
          <div className="rounded-xl p-4 border-2 border-red-500/50 bg-red-500/10 text-center animate-pulse">
            <p className="text-red-400 font-black text-lg">🚨 NEGÓCIO INVADIDO!</p>
            <p className="text-red-300 text-sm mt-1">Resolve o evento abaixo para retomar as operações.</p>
          </div>
        )}

        {/* ── Main 2-col layout ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* LEFT — Workforce */}
          <div className="space-y-3">
            <div className="rounded-2xl border overflow-hidden" style={{ background: "#111", borderColor: "rgba(255,255,255,0.07)" }}>
              <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                <div>
                  <p className="font-black text-white text-sm uppercase tracking-widest">Força de Trabalho</p>
                  <p className="text-xs text-gray-500">{workers.length}/{maxWorkers} trabalhadores</p>
                </div>
                {workers.length < maxWorkers && (
                  <button
                    onClick={() => setShowHirePanel((v) => !v)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-green-700 to-green-600 hover:from-green-600 hover:to-green-500 transition-all"
                  >
                    + Contratar
                  </button>
                )}
              </div>

              <div className="p-3 space-y-2">
                {showHirePanel && (
                  <HirePanel
                    available={available_workers}
                    onHire={handleHireWorker}
                    processing={processing}
                    onClose={() => setShowHirePanel(false)}
                    playerCash={player.cash}
                  />
                )}

                {workers.length === 0 && !showHirePanel ? (
                  <div className="py-6 text-center">
                    <p className="text-gray-600 text-sm">Sem trabalhadores contratados.</p>
                    <p className="text-gray-700 text-xs mt-1">Trabalhadores aumentam o rendimento e reduzem riscos.</p>
                  </div>
                ) : (
                  workers.map((w) => (
                    <WorkerCard key={w.id} worker={w} onFire={handleFireWorker} processing={processing} />
                  ))
                )}
              </div>
            </div>

            {/* Worker income summary */}
            {workers.length > 0 && (
              <div className="rounded-xl p-3 border grid grid-cols-3 gap-2 text-center text-xs" style={{ background: "#0d0d0d", borderColor: "rgba(255,255,255,0.05)" }}>
                <div>
                  <p className="text-gray-500">Bónus Prod.</p>
                  <p className="text-orange-400 font-bold">
                    +{(workers.reduce((s, w) => s + Math.max(0, w.production_bonus), 0) * 100).toFixed(0)}%
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Redução Calor</p>
                  <p className="text-purple-400 font-bold">
                    -{(Math.min(0.65, workers.reduce((s, w) => s + Math.max(0, w.stealth_bonus), 0)) * 100).toFixed(0)}%
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Salários/hr</p>
                  <p className="text-red-400 font-bold">-${salaryCostPerHour}/hr</p>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT — Events + Upgrades */}
          <div className="space-y-4">
            {/* Events */}
            {eventPairs.length > 0 && (
              <div className="rounded-2xl border overflow-hidden" style={{ background: "#111", borderColor: "rgba(255,255,255,0.07)" }}>
                <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                  <p className="font-black text-white text-sm uppercase tracking-widest">Eventos Ativos</p>
                  <span className="px-1.5 py-0.5 rounded-full text-xs font-bold text-red-400 bg-red-400/10 border border-red-400/20">{eventPairs.length}</span>
                </div>
                <div className="p-3 space-y-3">
                  {eventPairs.map(({ event, def: ed }) => (
                    <EventCard key={event.id} event={event} defEvent={ed} onResolve={handleResolveEvent} processing={processing} />
                  ))}
                </div>
              </div>
            )}

            {/* Upgrades */}
            <div className="rounded-2xl border overflow-hidden" style={{ background: "#111", borderColor: "rgba(255,255,255,0.07)" }}>
              <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                <p className="font-black text-white text-sm uppercase tracking-widest">Melhorias</p>
                <p className="text-xs text-gray-500">{owned_upgrade_ids.length}/{(def?.upgrades ?? []).length} instaladas</p>
              </div>
              <div className="p-3 space-y-2">
                {(def?.upgrades ?? []).map((u) => (
                  <UpgradeItem
                    key={u.id}
                    upgradeDef={u}
                    owned={owned_upgrade_ids.includes(u.id)}
                    onBuy={handleBuyUpgrade}
                    processing={processing}
                    playerCash={player.cash}
                  />
                ))}
                {(def?.upgrades ?? []).length === 0 && (
                  <p className="text-gray-600 text-sm text-center py-4">Sem melhorias disponíveis.</p>
                )}
              </div>
            </div>

            {/* Stats card */}
            <div className="rounded-2xl border p-4" style={{ background: "#111", borderColor: "rgba(255,255,255,0.07)" }}>
              <p className="font-black text-white text-sm uppercase tracking-widest mb-3">Estatísticas</p>

              {/* Income/hr highlight */}
              <div className="rounded-xl p-3 mb-3 border border-orange-500/20" style={{ background: "#0d0d0d" }}>
                {isDrug ? (
                  <>
                    <p className="text-xs text-gray-500 mb-0.5">📦 Produção Efectiva/hora</p>
                    <p className="font-black text-purple-400 text-2xl">{(pb.drug_output_per_hour ?? 0).toFixed(1)}<span className="text-sm font-normal text-gray-500"> ud./hr</span></p>
                    <p className="text-xs text-gray-600 mt-0.5">{drugItemName}</p>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-gray-500 mb-0.5">💰 Rendimento Efectivo/hora</p>
                    <p className="font-black text-orange-400 text-2xl">${pb.income_per_hour.toLocaleString()}<span className="text-sm font-normal text-gray-500">/hr</span></p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Base: ${business.base_income_per_hour.toLocaleString()}/hr
                      {salaryCostPerHour > 0 && <> · <span className="text-red-400/70">Salários: −${salaryCostPerHour.toLocaleString()}/hr</span></>}
                    </p>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl p-3" style={{ background: "#0d0d0d" }}>
                  <p className="text-xs text-gray-500">Acumulado</p>
                  {isDrug ? (
                    <p className="font-bold text-purple-400">{pendingDrugQty} ud.</p>
                  ) : (
                    <p className="font-bold text-orange-400">${pendingIncome.toLocaleString()}</p>
                  )}
                </div>
                <div className="rounded-xl p-3" style={{ background: "#0d0d0d" }}>
                  <p className="text-xs text-gray-500">Nível de Risco</p>
                  <p className={`font-bold ${def?.risk_level === "high" ? "text-red-400" : def?.risk_level === "medium" ? "text-yellow-400" : "text-green-400"}`}>
                    {def?.risk_level === "high" ? "🔴 Alto" : def?.risk_level === "medium" ? "🟡 Médio" : "🟢 Baixo"}
                  </p>
                </div>
                <div className="rounded-xl p-3" style={{ background: "#0d0d0d" }}>
                  <p className="text-xs text-gray-500">Teu Dinheiro Limpo</p>
                  <p className="font-bold text-green-400">${player.cash.toLocaleString()}</p>
                </div>
                <div className="rounded-xl p-3" style={{ background: "#0d0d0d" }}>
                  <p className="text-xs text-gray-500">Teu Dinheiro Sujo</p>
                  <p className="font-bold text-yellow-400">${player.dirty_cash.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* ── RAID ESCAPE OVERLAY ── */}
    {raidActive && (
      <RaidEscape
        businessValue={business.base_income_per_hour}
        cashAtRisk={raidCashAtRisk}
        onEscape={handleRaidEscape}
        onArrested={handleRaidArrested}
      />
    )}
    </>
  );
}
