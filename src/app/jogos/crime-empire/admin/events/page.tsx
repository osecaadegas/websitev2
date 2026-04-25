"use client";

import { useEffect, useState, useCallback } from "react";
import { CEToast } from "@/components/CEToast";

interface DrugItem { id: string; name: string; base_price: number; }
interface ActiveShip {
  id: string; name: string; drug_type: string; status: string;
  capacity_total: number; capacity_filled: number;
  arrival_time: string; departure_time: string;
  ship_class: string; price_per_unit: number; origin_country: string;
}
interface ActivePlane {
  id: string; location_name: string; status: string;
  scheduled_at: string; active_until: string; entry_cost: number;
  forced_drug_id: string | null; total_segments: number;
}

const ORIGINS: Record<string, string[]> = {
  normal:      ["Marrocos", "Argélia", "Holanda", "Espanha"],
  high_demand: ["Colômbia", "Venezuela", "Brasil", "Jamaica"],
  risky:       ["México", "El Salvador", "Guiné", "Panamá"],
};

const CLASS_LABELS: Record<string, string> = {
  normal: "Normal",
  high_demand: "Alta Procura",
  risky: "Arriscado",
};

const CLASS_COLORS: Record<string, string> = {
  normal: "text-blue-400",
  high_demand: "text-amber-400",
  risky: "text-red-400",
};

function fmt(n: number) { return n.toLocaleString("pt-PT"); }

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// ─── Input field component ────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-[#666] uppercase tracking-widest mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-[#444] mt-1">{hint}</p>}
    </div>
  );
}

const inputCls = "w-full bg-[#111] border border-[#252525] rounded-lg px-3 py-2 text-sm text-white placeholder-[#333] focus:outline-none focus:border-[#ff6a00]/50 transition-colors";
const selectCls = "w-full bg-[#111] border border-[#252525] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ff6a00]/50 transition-colors";

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    docked: "bg-green-900/40 text-green-400 border-green-700/40",
    scheduled: "bg-blue-900/40 text-blue-400 border-blue-700/40",
    preview: "bg-purple-900/40 text-purple-400 border-purple-700/40",
    active: "bg-green-900/40 text-green-400 border-green-700/40",
    upcoming: "bg-yellow-900/40 text-yellow-400 border-yellow-700/40",
  };
  const labels: Record<string, string> = {
    docked: "Atracado", scheduled: "Agendado", preview: "Preview",
    active: "Ativo", upcoming: "A Caminho",
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${map[status] ?? "bg-[#1a1a1a] text-[#555] border-[#222]"}`}>
      {labels[status] ?? status}
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EventsAdminPage() {
  const [tab, setTab] = useState<"ship" | "plane">("ship");
  const [drugs, setDrugs] = useState<DrugItem[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [activeShips, setActiveShips] = useState<ActiveShip[]>([]);
  const [activePlanes, setActivePlanes] = useState<ActivePlane[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // ── Ship form state ──────────────────────────────────────────────────────
  const [shipDrugId, setShipDrugId] = useState("");
  const [shipName, setShipName] = useState("");
  const [shipClass, setShipClass] = useState("normal");
  const [shipCapacity, setShipCapacity] = useState("25000");
  const [shipPrice, setShipPrice] = useState("");
  const [shipDuration, setShipDuration] = useState("8");
  const [shipOrigin, setShipOrigin] = useState("");
  const [shipInspection, setShipInspection] = useState("5");
  const [shipMaxDelivery, setShipMaxDelivery] = useState("5000");
  const [shipDockNow, setShipDockNow] = useState(true);
  const [shipDelay, setShipDelay] = useState("10");

  // ── Plane form state ─────────────────────────────────────────────────────
  const [planeLocation, setPlaneLocation] = useState("");
  const [planeDrugId, setPlaneDrugId] = useState("");
  const [planeEntryCost, setPlaneEntryCost] = useState("125000");
  const [planeActivateNow, setPlaneActivateNow] = useState(false);
  const [planeDelay, setPlaneDelay] = useState("30");
  const [planeDuration, setPlaneDuration] = useState("6");

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/crime-empire/events");
    if (!res.ok) return;
    const data = await res.json();
    setDrugs(data.drugs || []);
    setLocations(data.locations || []);
    setActiveShips(data.activeShips || []);
    setActivePlanes(data.activePlanes || []);
    if (data.drugs?.length > 0 && !shipDrugId) setShipDrugId(data.drugs[0].id);
    if (data.locations?.length > 0 && !planeLocation) setPlaneLocation(data.locations[0]);
    setLoading(false);
  }, [shipDrugId, planeLocation]);

  useEffect(() => { load(); }, []);

  // Auto-update price suggestion when drug or class changes
  useEffect(() => {
    const drug = drugs.find((d) => d.id === shipDrugId);
    if (!drug) return;
    const mult = shipClass === "high_demand" ? 2.1 : shipClass === "risky" ? 1.75 : 1.6;
    setShipPrice(String(Math.floor(drug.base_price * mult)));
  }, [shipDrugId, shipClass, drugs]);

  const handleSpawnShip = async () => {
    if (!shipDrugId) return showToast("Seleciona um drug", false);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/crime-empire/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "spawn_ship",
          drugItemId: shipDrugId,
          shipName: shipName || undefined,
          shipClass,
          capacityTotal: Number(shipCapacity),
          pricePerUnit: shipPrice ? Number(shipPrice) : undefined,
          durationHours: Number(shipDuration),
          originCountry: shipOrigin || undefined,
          inspectionChance: Number(shipInspection),
          maxDelivery: Number(shipMaxDelivery),
          dockImmediately: shipDockNow,
          delayMinutes: Number(shipDelay),
        }),
      });
      const data = await res.json();
      if (!res.ok) return showToast(data.error || "Erro", false);
      showToast(`✅ Navio "${data.ship?.name}" criado com sucesso!`, true);
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSpawnPlane = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/crime-empire/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "spawn_plane",
          location: planeLocation || undefined,
          forcedDrugId: planeDrugId || null,
          entryCost: Number(planeEntryCost),
          activateImmediately: planeActivateNow,
          delayMinutes: Number(planeDelay),
          durationHours: Number(planeDuration),
        }),
      });
      const data = await res.json();
      if (!res.ok) return showToast(data.error || "Erro", false);
      showToast(`✅ Acidente criado em "${data.crash?.location_name}"!`, true);
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleForceExpireShip = async (shipId: string, name: string) => {
    if (!confirm(`Forçar partida do navio "${name}"?`)) return;
    const res = await fetch("/api/admin/crime-empire/events", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "force_expire_ship", shipId }),
    });
    const data = await res.json();
    if (!res.ok) return showToast(data.error || "Erro", false);
    showToast(`Navio "${name}" foi forçado a partir.`, true);
    await load();
  };

  const handleForceExpirePlane = async (crashId: string, location: string) => {
    if (!confirm(`Expirar evento em "${location}"?`)) return;
    const res = await fetch("/api/admin/crime-empire/events", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "force_expire_plane", crashId }),
    });
    const data = await res.json();
    if (!res.ok) return showToast(data.error || "Erro", false);
    showToast(`Evento em "${location}" expirado.`, true);
    await load();
  };

  if (loading) return <p className="text-[#444] text-sm py-12 text-center">A carregar…</p>;

  return (
    <div className="space-y-6">
      {toast && <CEToast msg={toast.msg} ok={toast.ok} />}

      <div>
        <h1 className="text-2xl font-black text-white mb-1">🎯 Eventos Especiais</h1>
        <p className="text-[#555] text-sm">Cria e gere eventos de navios e acidentes de avião com configuração personalizada.</p>
      </div>

      {/* ── Current events ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Active ships */}
        <div className="bg-[#0e0e0e] border border-[#1e1e1e] rounded-xl p-4">
          <p className="text-[11px] font-bold text-[#444] uppercase tracking-widest mb-3">🚢 Navios Ativos</p>
          {activeShips.length === 0 ? (
            <p className="text-[#333] text-xs italic">Sem navios ativos</p>
          ) : (
            <div className="space-y-2">
              {activeShips.map((ship) => (
                <div key={ship.id} className="bg-[#111] border border-[#1a1a1a] rounded-lg p-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-white text-sm font-bold truncate">{ship.name}</span>
                      <StatusBadge status={ship.status} />
                      <span className={`text-[10px] font-bold ${CLASS_COLORS[ship.ship_class] ?? "text-[#555]"}`}>{CLASS_LABELS[ship.ship_class] ?? ship.ship_class}</span>
                    </div>
                    <p className="text-[#555] text-xs">{ship.drug_type} · {fmt(ship.price_per_unit)}$/u · {fmt(ship.capacity_filled)}/{fmt(ship.capacity_total)} cap</p>
                    <p className="text-[#444] text-[10px] mt-0.5">
                      {ship.status === "docked" ? `Parte: ${fmtTime(ship.departure_time)}` : `Chega: ${fmtTime(ship.arrival_time)}`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleForceExpireShip(ship.id, ship.name)}
                    className="text-[10px] font-bold text-red-400 border border-red-800/50 px-2 py-1 rounded-lg hover:bg-red-900/20 transition-colors flex-shrink-0"
                  >
                    Forçar Partida
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active planes */}
        <div className="bg-[#0e0e0e] border border-[#1e1e1e] rounded-xl p-4">
          <p className="text-[11px] font-bold text-[#444] uppercase tracking-widest mb-3">✈️ Acidentes Ativos</p>
          {activePlanes.length === 0 ? (
            <p className="text-[#333] text-xs italic">Sem acidentes ativos</p>
          ) : (
            <div className="space-y-2">
              {activePlanes.map((plane) => (
                <div key={plane.id} className="bg-[#111] border border-[#1a1a1a] rounded-lg p-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-white text-sm font-bold">{plane.location_name}</span>
                      <StatusBadge status={plane.status} />
                    </div>
                    <p className="text-[#555] text-xs">
                      {plane.forced_drug_id
                        ? `💊 ${drugs.find((d) => d.id === plane.forced_drug_id)?.name ?? "Drug especial"}`
                        : "💊 Aleatório"}
                      {" · "}{fmt(plane.entry_cost)} 💎 entrada
                    </p>
                    <p className="text-[#444] text-[10px] mt-0.5">
                      {plane.status === "active" ? `Expira: ${fmtTime(plane.active_until)}` : `Ativa em: ${fmtTime(plane.scheduled_at)}`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleForceExpirePlane(plane.id, plane.location_name)}
                    className="text-[10px] font-bold text-red-400 border border-red-800/50 px-2 py-1 rounded-lg hover:bg-red-900/20 transition-colors flex-shrink-0"
                  >
                    Expirar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Event creator ──────────────────────────────────────────────────── */}
      <div className="bg-[#0e0e0e] border border-[#1e1e1e] rounded-xl overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-[#1a1a1a]">
          {(["ship", "plane"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-bold transition-colors ${
                tab === t
                  ? "text-[#ff6a00] border-b-2 border-[#ff6a00] bg-[#ff6a00]/5"
                  : "text-[#555] hover:text-white"
              }`}
            >
              {t === "ship" ? "🚢 Navio Especial" : "✈️ Acidente Especial"}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* ── SHIP FORM ──────────────────────────────────────────────────── */}
          {tab === "ship" && (
            <div className="space-y-4 max-w-2xl">
              <p className="text-[#555] text-xs mb-2">Cria um navio especial com carregamento e características à tua escolha.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Droga do Carregamento" hint="O navio só vai aceitar este tipo de droga dos jogadores">
                  <select value={shipDrugId} onChange={(e) => setShipDrugId(e.target.value)} className={selectCls}>
                    {drugs.map((d) => (
                      <option key={d.id} value={d.id}>{d.name} (base: {fmt(d.base_price)}$)</option>
                    ))}
                  </select>
                </Field>

                <Field label="Nome do Navio" hint="Deixa em branco para nome aleatório">
                  <input type="text" value={shipName} onChange={(e) => setShipName(e.target.value)} placeholder="Ex: Shadow Serpent" className={inputCls} maxLength={40} />
                </Field>

                <Field label="Classe do Navio">
                  <select value={shipClass} onChange={(e) => setShipClass(e.target.value)} className={selectCls}>
                    <option value="normal">Normal — multiplicador 1.3–2×</option>
                    <option value="high_demand">Alta Procura — multiplicador 1.8–2.5×</option>
                    <option value="risky">Arriscado — boa margem, risco inspecção</option>
                  </select>
                </Field>

                <Field label="Origem" hint="País de origem do navio">
                  <select value={shipOrigin} onChange={(e) => setShipOrigin(e.target.value)} className={selectCls}>
                    <option value="">Aleatório para a classe</option>
                    {[...new Set(Object.values(ORIGINS).flat())].sort().map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Capacidade Total (gramas)" hint="Volume total de droga que o navio aceita">
                  <input type="number" value={shipCapacity} onChange={(e) => setShipCapacity(e.target.value)} min={1000} max={200000} step={1000} className={inputCls} />
                </Field>

                <Field label="Preço por Unidade ($)" hint="Preço pago ao jogador por grama entregue">
                  <input type="number" value={shipPrice} onChange={(e) => setShipPrice(e.target.value)} min={1} className={inputCls} />
                </Field>

                <Field label="Duração (horas)" hint="Quantas horas o navio permanece atracado">
                  <input type="number" value={shipDuration} onChange={(e) => setShipDuration(e.target.value)} min={1} max={72} className={inputCls} />
                </Field>

                <Field label="Chance de Inspecção (%)" hint="0 = sem inspecção · 100 = sempre inspeccionado">
                  <input type="number" value={shipInspection} onChange={(e) => setShipInspection(e.target.value)} min={0} max={100} className={inputCls} />
                </Field>

                <Field label="Máx. Entrega por Jogador (gramas)">
                  <input type="number" value={shipMaxDelivery} onChange={(e) => setShipMaxDelivery(e.target.value)} min={100} max={100000} step={100} className={inputCls} />
                </Field>

                <Field label="Chegada">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div
                        onClick={() => setShipDockNow(!shipDockNow)}
                        className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 cursor-pointer ${shipDockNow ? "bg-[#ff6a00]" : "bg-[#252525]"}`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${shipDockNow ? "translate-x-4" : "translate-x-0"}`} />
                      </div>
                      <span className="text-sm text-[#888]">{shipDockNow ? "Atracado imediatamente" : "Agendar chegada"}</span>
                    </label>
                    {!shipDockNow && (
                      <div className="flex items-center gap-2">
                        <input type="number" value={shipDelay} onChange={(e) => setShipDelay(e.target.value)} min={1} max={1440} className={`${inputCls} w-24`} />
                        <span className="text-[#555] text-xs">minutos a partir de agora</span>
                      </div>
                    )}
                  </div>
                </Field>
              </div>

              <button
                disabled={submitting || !shipDrugId}
                onClick={handleSpawnShip}
                className={`mt-2 px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-wide transition-all ${
                  submitting ? "bg-[#222] text-[#555] cursor-wait" : "bg-gradient-to-r from-[#ff6a00] to-orange-500 hover:from-orange-500 hover:to-[#ff6a00] text-black shadow-lg shadow-orange-900/20"
                }`}
              >
                {submitting ? "A criar…" : "🚢 Criar Navio Especial"}
              </button>
            </div>
          )}

          {/* ── PLANE FORM ─────────────────────────────────────────────────── */}
          {tab === "plane" && (
            <div className="space-y-4 max-w-2xl">
              <p className="text-[#555] text-xs mb-2">Cria um acidente de avião especial. Podes escolher que droga o avião transporta.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Localização">
                  <select value={planeLocation} onChange={(e) => setPlaneLocation(e.target.value)} className={selectCls}>
                    {locations.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </Field>

                <Field label="Droga no Carregamento" hint="Deixa em 'Aleatório' para sortear entre todas as drogas">
                  <select value={planeDrugId} onChange={(e) => setPlaneDrugId(e.target.value)} className={selectCls}>
                    <option value="">🎲 Aleatório</option>
                    {drugs.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Custo de Entrada (💎 Crypto)">
                  <input type="number" value={planeEntryCost} onChange={(e) => setPlaneEntryCost(e.target.value)} min={0} step={1000} className={inputCls} />
                </Field>

                <Field label="Duração Ativa (horas)" hint="Quantas horas o evento permanece ativo">
                  <input type="number" value={planeDuration} onChange={(e) => setPlaneDuration(e.target.value)} min={1} max={48} className={inputCls} />
                </Field>

                <Field label="Ativação" hint="Quando o evento começa">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div
                        onClick={() => setPlaneActivateNow(!planeActivateNow)}
                        className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 cursor-pointer ${planeActivateNow ? "bg-[#ff6a00]" : "bg-[#252525]"}`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${planeActivateNow ? "translate-x-4" : "translate-x-0"}`} />
                      </div>
                      <span className="text-sm text-[#888]">{planeActivateNow ? "Ativar imediatamente" : "Agendar ativação"}</span>
                    </label>
                    {!planeActivateNow && (
                      <div className="flex items-center gap-2">
                        <input type="number" value={planeDelay} onChange={(e) => setPlaneDelay(e.target.value)} min={1} max={10080} className={`${inputCls} w-24`} />
                        <span className="text-[#555] text-xs">minutos a partir de agora</span>
                      </div>
                    )}
                  </div>
                </Field>
              </div>

              <button
                disabled={submitting}
                onClick={handleSpawnPlane}
                className={`mt-2 px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-wide transition-all ${
                  submitting ? "bg-[#222] text-[#555] cursor-wait" : "bg-gradient-to-r from-[#ff6a00] to-orange-500 hover:from-orange-500 hover:to-[#ff6a00] text-black shadow-lg shadow-orange-900/20"
                }`}
              >
                {submitting ? "A criar…" : "✈️ Criar Acidente Especial"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
