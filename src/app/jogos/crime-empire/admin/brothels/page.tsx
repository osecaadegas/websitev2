"use client";

import { useEffect, useState, useCallback } from "react";
import { CEToast } from "@/components/CEToast";

/* ── Types ─────────────────────────────────────────────────── */
type WorkerDef = {
  id: string; slug: string; name: string; description: string;
  rarity: "common" | "rare" | "elite";
  hire_price: number; hire_uses_crypto: boolean; earnings_per_hour: number;
  traits: string[]; stat_attractiveness: number; stat_stamina: number;
  stat_mood: number; stat_charisma: number; sort_order: number; enabled: boolean;
};

type PlayerBrothel = {
  id: string; player_id: string; brothel_type_id: string;
  supply_drinks: number; supply_hygiene: number; supply_security: number;
  client_satisfaction: number; heat_level: number;
  upgrade_vip_rooms: boolean; upgrade_lighting: boolean;
  upgrade_security: boolean; upgrade_marketing: boolean;
  total_earned: number; last_collection: string | null;
  max_employees: number; created_at: string; worker_count: number;
  crime_players: { id: string; username: string; display_name: string; avatar_url: string } | null;
};

type BrothelWorker = {
  id: string; name: string; slug: string | null; status: string;
  income_per_hour: number; attractiveness: number; stamina: number;
  mood: number; happiness: number; charisma_bonus: number;
  trait_1: string | null; trait_2: string | null; assigned_room: number | null;
};

/* ── Constants ──────────────────────────────────────────────── */
const RARITY_CONFIG = {
  common: { label: "Comum",   cls: "text-gray-400   bg-gray-400/10   border-gray-400/30"   },
  rare:   { label: "Rara",    cls: "text-blue-400   bg-blue-400/10   border-blue-400/30"   },
  elite:  { label: "Elite",   cls: "text-orange-400 bg-orange-400/10 border-orange-400/30" },
};

const inputCls = "w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-pink-500/60 transition-colors";
const labelCls = "text-[10px] uppercase tracking-widest text-[#555] mb-1 block font-semibold";

function StatRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className={labelCls}>{label} <span className="text-pink-400 normal-case">{value}</span></label>
      <input type="range" min={0} max={100} value={value} onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-pink-500" />
    </div>
  );
}

const BLANK_DEF: Partial<WorkerDef> = {
  id: "", slug: "", name: "", description: "", rarity: "common",
  hire_price: 10000, hire_uses_crypto: false, earnings_per_hour: 300,
  traits: [], stat_attractiveness: 50, stat_stamina: 50, stat_mood: 50, stat_charisma: 50,
  sort_order: 0, enabled: true,
};

/* ══════════════════════════════════════════════════════════════ */
export default function BrothelsAdminPage() {
  const [tab, setTab]       = useState<"defs" | "brothels">("defs");
  const [toast, setToast]   = useState<{ msg: string; ok: boolean } | null>(null);
  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); };

  /* ── Worker Defs state ─────────────────────────────────────── */
  const [defs, setDefs]       = useState<WorkerDef[]>([]);
  const [defsQ, setDefsQ]     = useState("");
  const [defModal, setDefModal] = useState<"create" | "edit" | null>(null);
  const [defForm, setDefForm] = useState<Partial<WorkerDef>>(BLANK_DEF);
  const [defSaving, setDefSaving] = useState(false);
  const [defLoading, setDefLoading] = useState(false);
  const [confirmDeleteDef, setConfirmDeleteDef] = useState<WorkerDef | null>(null);

  const loadDefs = useCallback(async () => {
    setDefLoading(true);
    const res = await fetch("/api/admin/crime-empire/brothels/defs");
    const data = await res.json();
    setDefs(data.defs || []); setDefLoading(false);
  }, []);

  useEffect(() => { if (tab === "defs") loadDefs(); }, [tab, loadDefs]);

  const filteredDefs = defs.filter(d =>
    d.name.toLowerCase().includes(defsQ.toLowerCase()) ||
    d.slug.toLowerCase().includes(defsQ.toLowerCase()) ||
    d.rarity.toLowerCase().includes(defsQ.toLowerCase())
  );

  const openCreateDef = () => { setDefForm({ ...BLANK_DEF }); setDefModal("create"); };
  const openEditDef   = (d: WorkerDef) => { setDefForm({ ...d, traits: [...(d.traits || [])] }); setDefModal("edit"); };
  const closeDefModal = () => { setDefModal(null); setDefForm(BLANK_DEF); };

  const handleSaveDef = async () => {
    setDefSaving(true);
    const isEdit = defModal === "edit";
    const url    = isEdit ? `/api/admin/crime-empire/brothels/defs/${defForm.id}` : "/api/admin/crime-empire/brothels/defs";
    const method = isEdit ? "PUT" : "POST";
    const res    = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(defForm) });
    const data   = await res.json();
    setDefSaving(false);
    if (!res.ok) { showToast(data.error || "Erro ao guardar", false); return; }
    showToast(isEdit ? "Worker atualizada!" : "Worker criada!");
    closeDefModal(); loadDefs();
  };

  const handleDeleteDef = async (d: WorkerDef) => {
    const res = await fetch(`/api/admin/crime-empire/brothels/defs/${d.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || "Erro ao eliminar", false); return; }
    showToast(`${d.name} eliminada.`);
    setConfirmDeleteDef(null); loadDefs();
  };

  /* ── Player Brothels state ─────────────────────────────────── */
  const [brothels, setBrothels]         = useState<PlayerBrothel[]>([]);
  const [brothelQ, setBrothelQ]         = useState("");
  const [brothelLoading, setBrothelLoading] = useState(false);
  const [expandedBrothel, setExpandedBrothel] = useState<string | null>(null);
  const [brothelWorkers, setBrothelWorkers] = useState<Record<string, BrothelWorker[]>>({});
  const [brothelForm, setBrothelForm]   = useState<Partial<PlayerBrothel> | null>(null);
  const [brothelSaving, setBrothelSaving] = useState(false);
  const [workerEditModal, setWorkerEditModal] = useState<BrothelWorker | null>(null);
  const [workerForm, setWorkerForm]     = useState<Partial<BrothelWorker>>({});
  const [workerSaving, setWorkerSaving] = useState(false);
  const [confirmFireWorker, setConfirmFireWorker] = useState<BrothelWorker | null>(null);

  const loadBrothels = useCallback(async () => {
    setBrothelLoading(true);
    const res = await fetch("/api/admin/crime-empire/brothels/player-brothels");
    const data = await res.json();
    setBrothels(data.brothels || []); setBrothelLoading(false);
  }, []);

  useEffect(() => { if (tab === "brothels") loadBrothels(); }, [tab, loadBrothels]);

  const filteredBrothels = brothels.filter(b =>
    (b.crime_players?.username || "").toLowerCase().includes(brothelQ.toLowerCase()) ||
    b.brothel_type_id.toLowerCase().includes(brothelQ.toLowerCase())
  );

  const toggleExpand = async (brothelId: string) => {
    if (expandedBrothel === brothelId) { setExpandedBrothel(null); setBrothelForm(null); return; }
    setExpandedBrothel(brothelId);
    const brothel = brothels.find(b => b.id === brothelId);
    if (brothel) setBrothelForm({ ...brothel });
    // Load workers
    const res = await fetch(`/api/admin/crime-empire/brothels/player-brothels/${brothelId}`);
    const data = await res.json();
    setBrothelWorkers(prev => ({ ...prev, [brothelId]: data.workers || [] }));
  };

  const handleSaveBrothel = async (id: string) => {
    if (!brothelForm) return;
    setBrothelSaving(true);
    const res = await fetch(`/api/admin/crime-empire/brothels/player-brothels/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(brothelForm),
    });
    const data = await res.json(); setBrothelSaving(false);
    if (!res.ok) { showToast(data.error || "Erro ao guardar", false); return; }
    showToast("Bordel atualizado!"); loadBrothels();
  };

  const openEditWorker = (w: BrothelWorker) => {
    setWorkerForm({
      name: w.name, status: w.status, income_per_hour: w.income_per_hour,
      attractiveness: w.attractiveness, stamina: w.stamina, mood: w.mood,
      happiness: w.happiness, charisma_bonus: w.charisma_bonus,
      trait_1: w.trait_1 ?? "", trait_2: w.trait_2 ?? "",
    });
    setWorkerEditModal(w);
  };

  const handleSaveWorker = async () => {
    if (!workerEditModal) return;
    setWorkerSaving(true);
    const res = await fetch(`/api/admin/crime-empire/brothels/workers/${workerEditModal.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(workerForm),
    });
    const data = await res.json(); setWorkerSaving(false);
    if (!res.ok) { showToast(data.error || "Erro ao guardar", false); return; }
    showToast("Worker atualizada!");
    setWorkerEditModal(null);
    // Refresh workers for the expanded brothel
    if (expandedBrothel) {
      const rRes = await fetch(`/api/admin/crime-empire/brothels/player-brothels/${expandedBrothel}`);
      const rData = await rRes.json();
      setBrothelWorkers(prev => ({ ...prev, [expandedBrothel]: rData.workers || [] }));
    }
  };

  const handleFireWorker = async (w: BrothelWorker) => {
    const res = await fetch(`/api/admin/crime-empire/brothels/workers/${w.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || "Erro ao despedir", false); return; }
    showToast(`${w.name} despedida.`);
    setConfirmFireWorker(null);
    if (expandedBrothel) {
      setBrothelWorkers(prev => ({
        ...prev, [expandedBrothel]: (prev[expandedBrothel] || []).filter(x => x.id !== w.id),
      }));
    }
  };

  /* ══════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-[#0B0B0B] text-white p-6">
      {toast && <CEToast msg={toast.msg} ok={toast.ok} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">💋 Bordéis</h1>
          <p className="text-xs text-[#555] mt-1">Gerir catálogo de workers e bordéis dos jogadores</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[#111] p-1 rounded-xl w-fit">
        {[
          { key: "defs",    icon: "💋", label: "Modelos"  },
          { key: "brothels", icon: "🏠", label: "Bordéis"  },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as "defs" | "brothels")}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t.key ? "bg-pink-500/20 text-pink-400 border border-pink-500/30" : "text-[#666] hover:text-white"
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ─── TAB: Worker Defs ─────────────────────────────────── */}
      {tab === "defs" && (
        <div>
          <div className="flex gap-3 mb-5">
            <input value={defsQ} onChange={e => setDefsQ(e.target.value)}
              placeholder="Pesquisar nome, slug ou raridade…"
              className="flex-1 bg-[#111] border border-[#222] rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-pink-500/50" />
            <button onClick={openCreateDef}
              className="px-4 py-2 bg-pink-500/20 border border-pink-500/40 text-pink-400 rounded-lg text-sm hover:bg-pink-500/30 transition-colors font-semibold">
              + Nova
            </button>
          </div>

          {defLoading ? (
            <p className="text-[#555] text-sm">A carregar…</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
              {filteredDefs.map(d => (
                <div key={d.id} onClick={() => openEditDef(d)}
                  className={`group relative bg-[#111] border rounded-xl overflow-hidden cursor-pointer hover:border-pink-500/50 transition-all hover:scale-[1.02] ${
                    !d.enabled ? "opacity-40" : ""
                  } border-[#222]`}>
                  {/* Image */}
                  <div className="relative h-[140px] bg-[#0a0a0a]">
                    <img src={`/images/hooker/${d.slug}.jpg`} alt={d.name}
                      className="w-full h-full object-cover object-top" onError={e => {
                        (e.target as HTMLImageElement).style.opacity = "0";
                      }} />
                    {/* Rarity badge */}
                    <span className={`absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${RARITY_CONFIG[d.rarity].cls}`}>
                      {RARITY_CONFIG[d.rarity].label.toUpperCase()}
                    </span>
                    {!d.enabled && (
                      <span className="absolute top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                        OFF
                      </span>
                    )}
                  </div>
                  {/* Info */}
                  <div className="p-2">
                    <p className="text-white text-xs font-bold truncate">{d.name}</p>
                    <p className="text-[#888] text-[10px] truncate">{d.slug}</p>
                    <p className="text-pink-400 text-[10px] font-semibold mt-1">
                      {d.hire_uses_crypto ? "₿" : "$"}{d.hire_price.toLocaleString()}
                    </p>
                    <p className="text-green-400 text-[10px]">{d.earnings_per_hour.toLocaleString()}/h</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: Player Brothels ─────────────────────────────── */}
      {tab === "brothels" && (
        <div>
          <div className="flex gap-3 mb-5">
            <input value={brothelQ} onChange={e => setBrothelQ(e.target.value)}
              placeholder="Pesquisar jogador ou tipo…"
              className="flex-1 bg-[#111] border border-[#222] rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-pink-500/50" />
            <button onClick={loadBrothels}
              className="px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] rounded-lg text-sm hover:text-white transition-colors">
              ↻ Atualizar
            </button>
          </div>

          {brothelLoading ? (
            <p className="text-[#555] text-sm">A carregar…</p>
          ) : filteredBrothels.length === 0 ? (
            <p className="text-[#555] text-sm">Nenhum bordel encontrado.</p>
          ) : (
            <div className="space-y-2">
              {filteredBrothels.map(b => (
                <div key={b.id} className="bg-[#111] border border-[#222] rounded-xl overflow-hidden">
                  {/* Row */}
                  <div className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-[#1a1a1a] transition-colors"
                    onClick={() => toggleExpand(b.id)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-semibold">
                          {b.crime_players?.display_name || b.crime_players?.username || "—"}
                        </span>
                        <span className="text-[#555] text-xs">@{b.crime_players?.username}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1a1a1a] text-[#888] border border-[#2a2a2a]">
                          {b.brothel_type_id}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-xs text-[#888] shrink-0">
                      <span>👩 {b.worker_count}/{b.max_employees}</span>
                      <span className={`${b.heat_level > 70 ? "text-red-400" : b.heat_level > 40 ? "text-orange-400" : "text-green-400"}`}>
                        🌡 {b.heat_level}
                      </span>
                      <span className="text-yellow-400">💰 ${b.total_earned?.toLocaleString() || 0}</span>
                      <span className="text-[#444]">{expandedBrothel === b.id ? "▲" : "▼"}</span>
                    </div>
                  </div>

                  {/* Expanded */}
                  {expandedBrothel === b.id && brothelForm && (
                    <div className="border-t border-[#1a1a1a] p-4 bg-[#0d0d0d]">
                      {/* Brothel edit */}
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                        {(["supply_drinks","supply_hygiene","supply_security"] as const).map(k => (
                          <div key={k}>
                            <label className={labelCls}>{k.replace("supply_","")}</label>
                            <input type="number" min={0} max={100}
                              value={(brothelForm as any)[k] ?? 0}
                              onChange={e => setBrothelForm(f => ({ ...f!, [k]: Number(e.target.value) }))}
                              className={inputCls} />
                          </div>
                        ))}
                        <div>
                          <label className={labelCls}>heat_level</label>
                          <input type="number" min={0} max={100}
                            value={brothelForm.heat_level ?? 0}
                            onChange={e => setBrothelForm(f => ({ ...f!, heat_level: Number(e.target.value) }))}
                            className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>max_employees</label>
                          <input type="number" min={1} max={20}
                            value={brothelForm.max_employees ?? 5}
                            onChange={e => setBrothelForm(f => ({ ...f!, max_employees: Number(e.target.value) }))}
                            className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>client_satisfaction</label>
                          <input type="number" min={0} max={100}
                            value={brothelForm.client_satisfaction ?? 50}
                            onChange={e => setBrothelForm(f => ({ ...f!, client_satisfaction: Number(e.target.value) }))}
                            className={inputCls} />
                        </div>
                      </div>

                      {/* Upgrades */}
                      <div className="flex flex-wrap gap-3 mb-4">
                        {(["upgrade_vip_rooms","upgrade_lighting","upgrade_security","upgrade_marketing"] as const).map(k => (
                          <label key={k} className="flex items-center gap-2 cursor-pointer text-xs text-[#888]">
                            <input type="checkbox"
                              checked={!!(brothelForm as any)[k]}
                              onChange={e => setBrothelForm(f => ({ ...f!, [k]: e.target.checked }))}
                              className="accent-pink-500 w-3.5 h-3.5" />
                            {k.replace("upgrade_","").replace("_"," ")}
                          </label>
                        ))}
                      </div>

                      <button onClick={() => handleSaveBrothel(b.id)} disabled={brothelSaving}
                        className="px-4 py-1.5 bg-pink-500/20 border border-pink-500/40 text-pink-400 rounded-lg text-xs font-semibold hover:bg-pink-500/30 transition-colors mb-4 disabled:opacity-50">
                        {brothelSaving ? "A guardar…" : "💾 Guardar Bordel"}
                      </button>

                      {/* Workers */}
                      <p className="text-[10px] uppercase tracking-widest text-[#444] mb-2 font-bold">Workers</p>
                      {(brothelWorkers[b.id] || []).length === 0 ? (
                        <p className="text-[#555] text-xs">Sem workers neste bordel.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {(brothelWorkers[b.id] || []).map(w => (
                            <div key={w.id}
                              className="flex items-center gap-3 bg-[#111] border border-[#1a1a1a] rounded-lg px-3 py-2">
                              {/* Image */}
                              {w.slug && (
                                <img src={`/images/hooker/${w.slug}.jpg`} alt={w.name}
                                  className="w-8 h-8 rounded-full object-cover object-top bg-[#0a0a0a]"
                                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-white text-xs font-semibold">{w.name}</span>
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                                    w.status === "working" ? "text-green-400 bg-green-400/10" :
                                    w.status === "resting" ? "text-blue-400  bg-blue-400/10"  :
                                    "text-red-400 bg-red-400/10"
                                  }`}>{w.status}</span>
                                </div>
                                <div className="flex gap-2 text-[10px] text-[#666] mt-0.5">
                                  <span>💰 {w.income_per_hour}/h</span>
                                  <span>💋 {w.attractiveness}</span>
                                  <span>🏃 {w.stamina}</span>
                                  <span>😊 {w.mood}</span>
                                  <span>❤️ {w.happiness}</span>
                                </div>
                              </div>
                              <div className="flex gap-1.5 shrink-0">
                                <button onClick={() => openEditWorker(w)}
                                  className="px-2 py-1 bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] rounded text-[10px] hover:text-white transition-colors">
                                  ✏️ Editar
                                </button>
                                <button onClick={() => setConfirmFireWorker(w)}
                                  className="px-2 py-1 bg-red-500/10 border border-red-500/30 text-red-400 rounded text-[10px] hover:bg-red-500/20 transition-colors">
                                  🔥 Despedir
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL: Edit / Create Worker Def
      ═══════════════════════════════════════════════════════ */}
      {defModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111] border border-[#222] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
              <div className="flex items-center gap-3">
                {defForm.slug && (
                  <img src={`/images/hooker/${defForm.slug}.jpg`} alt={defForm.name}
                    className="w-10 h-10 rounded-full object-cover object-top bg-[#0a0a0a]"
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                )}
                <h2 className="text-lg font-bold text-white">
                  {defModal === "create" ? "Nova Worker" : `Editar — ${defForm.name}`}
                </h2>
              </div>
              <button onClick={closeDefModal} className="text-[#555] hover:text-white text-xl">×</button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Identity */}
              <div className="grid grid-cols-2 gap-3">
                {defModal === "create" && (
                  <div>
                    <label className={labelCls}>ID (único)</label>
                    <input value={defForm.id || ""} onChange={e => setDefForm(f => ({ ...f, id: e.target.value }))} className={inputCls} />
                  </div>
                )}
                <div>
                  <label className={labelCls}>Slug (imagem)</label>
                  <input value={defForm.slug || ""} onChange={e => setDefForm(f => ({ ...f, slug: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Nome</label>
                  <input value={defForm.name || ""} onChange={e => setDefForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className={labelCls}>Descrição</label>
                <textarea rows={2} value={defForm.description || ""}
                  onChange={e => setDefForm(f => ({ ...f, description: e.target.value }))}
                  className={inputCls + " resize-none"} />
              </div>

              {/* Rarity + flags */}
              <div className="grid grid-cols-3 gap-3 items-end">
                <div>
                  <label className={labelCls}>Raridade</label>
                  <select value={defForm.rarity || "common"}
                    onChange={e => setDefForm(f => ({ ...f, rarity: e.target.value as WorkerDef["rarity"] }))}
                    className={inputCls}>
                    <option value="common">Comum</option>
                    <option value="rare">Rara</option>
                    <option value="elite">Elite</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm text-[#888] cursor-pointer pb-2">
                  <input type="checkbox" checked={defForm.hire_uses_crypto ?? false}
                    onChange={e => setDefForm(f => ({ ...f, hire_uses_crypto: e.target.checked }))}
                    className="accent-pink-500 w-4 h-4" />
                  Pagar em Crypto
                </label>
                <label className="flex items-center gap-2 text-sm text-[#888] cursor-pointer pb-2">
                  <input type="checkbox" checked={defForm.enabled ?? true}
                    onChange={e => setDefForm(f => ({ ...f, enabled: e.target.checked }))}
                    className="accent-pink-500 w-4 h-4" />
                  Ativa
                </label>
              </div>

              {/* Economy */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Preço de contratação</label>
                  <input type="number" min={0} value={defForm.hire_price ?? 10000}
                    onChange={e => setDefForm(f => ({ ...f, hire_price: Number(e.target.value) }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Ganhos / hora ($)</label>
                  <input type="number" min={0} value={defForm.earnings_per_hour ?? 300}
                    onChange={e => setDefForm(f => ({ ...f, earnings_per_hour: Number(e.target.value) }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Ordem</label>
                  <input type="number" value={defForm.sort_order ?? 0}
                    onChange={e => setDefForm(f => ({ ...f, sort_order: Number(e.target.value) }))} className={inputCls} />
                </div>
              </div>

              {/* Traits */}
              <div>
                <label className={labelCls}>Traits (separados por vírgula)</label>
                <input value={(defForm.traits || []).join(", ")}
                  onChange={e => setDefForm(f => ({
                    ...f, traits: e.target.value.split(",").map(t => t.trim()).filter(Boolean),
                  }))} className={inputCls} placeholder="Ex: Premium, Elegante, Carismática" />
              </div>

              {/* Stats */}
              <div className="bg-[#0d0d0d] rounded-xl p-4 space-y-3">
                <p className={labelCls}>Stats</p>
                <StatRow label="Atratividade" value={defForm.stat_attractiveness ?? 50}
                  onChange={v => setDefForm(f => ({ ...f, stat_attractiveness: v }))} />
                <StatRow label="Resistência" value={defForm.stat_stamina ?? 50}
                  onChange={v => setDefForm(f => ({ ...f, stat_stamina: v }))} />
                <StatRow label="Humor" value={defForm.stat_mood ?? 50}
                  onChange={v => setDefForm(f => ({ ...f, stat_mood: v }))} />
                <StatRow label="Carisma" value={defForm.stat_charisma ?? 50}
                  onChange={v => setDefForm(f => ({ ...f, stat_charisma: v }))} />
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-between px-5 py-4 border-t border-[#1a1a1a]">
              <div>
                {defModal === "edit" && (
                  <button onClick={() => setConfirmDeleteDef(defForm as WorkerDef)}
                    className="px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm hover:bg-red-500/20 transition-colors">
                    🗑 Eliminar
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={closeDefModal}
                  className="px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] rounded-lg text-sm hover:text-white transition-colors">
                  Cancelar
                </button>
                <button onClick={handleSaveDef} disabled={defSaving}
                  className="px-5 py-2 bg-pink-500/20 border border-pink-500/40 text-pink-400 rounded-lg text-sm font-semibold hover:bg-pink-500/30 transition-colors disabled:opacity-50">
                  {defSaving ? "A guardar…" : "💾 Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL: Edit Worker (in brothel)
      ═══════════════════════════════════════════════════════ */}
      {workerEditModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111] border border-[#222] rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
              <h2 className="text-lg font-bold text-white">Editar Worker — {workerEditModal.name}</h2>
              <button onClick={() => setWorkerEditModal(null)} className="text-[#555] hover:text-white text-xl">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Nome</label>
                  <input value={workerForm.name || ""}
                    onChange={e => setWorkerForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <select value={workerForm.status || "idle"}
                    onChange={e => setWorkerForm(f => ({ ...f, status: e.target.value }))}
                    className={inputCls}>
                    <option value="idle">idle</option>
                    <option value="working">working</option>
                    <option value="resting">resting</option>
                    <option value="sick">sick</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Ganhos / hora</label>
                  <input type="number" min={0} value={workerForm.income_per_hour ?? 0}
                    onChange={e => setWorkerForm(f => ({ ...f, income_per_hour: Number(e.target.value) }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Happiness</label>
                  <input type="number" min={0} max={100} value={workerForm.happiness ?? 50}
                    onChange={e => setWorkerForm(f => ({ ...f, happiness: Number(e.target.value) }))} className={inputCls} />
                </div>
              </div>
              <div className="bg-[#0d0d0d] rounded-xl p-4 space-y-3">
                <p className={labelCls}>Stats</p>
                <StatRow label="Atratividade" value={workerForm.attractiveness ?? 50}
                  onChange={v => setWorkerForm(f => ({ ...f, attractiveness: v }))} />
                <StatRow label="Resistência" value={workerForm.stamina ?? 50}
                  onChange={v => setWorkerForm(f => ({ ...f, stamina: v }))} />
                <StatRow label="Humor" value={workerForm.mood ?? 50}
                  onChange={v => setWorkerForm(f => ({ ...f, mood: v }))} />
                <StatRow label="Carisma" value={workerForm.charisma_bonus ?? 0}
                  onChange={v => setWorkerForm(f => ({ ...f, charisma_bonus: v }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Trait 1</label>
                  <input value={workerForm.trait_1 || ""}
                    onChange={e => setWorkerForm(f => ({ ...f, trait_1: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Trait 2</label>
                  <input value={workerForm.trait_2 || ""}
                    onChange={e => setWorkerForm(f => ({ ...f, trait_2: e.target.value }))} className={inputCls} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-[#1a1a1a]">
              <button onClick={() => setWorkerEditModal(null)}
                className="px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] rounded-lg text-sm hover:text-white transition-colors">
                Cancelar
              </button>
              <button onClick={handleSaveWorker} disabled={workerSaving}
                className="px-5 py-2 bg-pink-500/20 border border-pink-500/40 text-pink-400 rounded-lg text-sm font-semibold hover:bg-pink-500/30 transition-colors disabled:opacity-50">
                {workerSaving ? "A guardar…" : "💾 Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          CONFIRM: Delete Def
      ═══════════════════════════════════════════════════════ */}
      {confirmDeleteDef && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111] border border-red-500/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-white font-bold text-lg mb-2">Eliminar {confirmDeleteDef.name}?</h3>
            <p className="text-[#888] text-sm mb-5">Esta ação é permanente e não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteDef(null)}
                className="flex-1 px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] rounded-lg text-sm hover:text-white transition-colors">
                Cancelar
              </button>
              <button onClick={() => handleDeleteDef(confirmDeleteDef)}
                className="flex-1 px-4 py-2 bg-red-500/20 border border-red-500/40 text-red-400 rounded-lg text-sm font-semibold hover:bg-red-500/30 transition-colors">
                🗑 Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          CONFIRM: Fire Worker
      ═══════════════════════════════════════════════════════ */}
      {confirmFireWorker && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111] border border-orange-500/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-white font-bold text-lg mb-2">Despedir {confirmFireWorker.name}?</h3>
            <p className="text-[#888] text-sm mb-5">O jogador perderá esta worker permanentemente.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmFireWorker(null)}
                className="flex-1 px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] rounded-lg text-sm hover:text-white transition-colors">
                Cancelar
              </button>
              <button onClick={() => handleFireWorker(confirmFireWorker)}
                className="flex-1 px-4 py-2 bg-orange-500/20 border border-orange-500/40 text-orange-400 rounded-lg text-sm font-semibold hover:bg-orange-500/30 transition-colors">
                🔥 Despedir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
