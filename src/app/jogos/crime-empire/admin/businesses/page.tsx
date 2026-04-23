"use client";

import { useEffect, useState, useCallback } from "react";
import { CEToast } from "@/components/CEToast";

/* ── Types ─────────────────────────────────────────────────── */
type Business = {
  id: string; name: string; type: string; description: string;
  purchase_price: number; base_income_per_hour: number;
  max_employees: number; employee_cost_per_hour: number;
  required_level: number; required_items: any[]; raid_risk: number; enabled: boolean;
  risk_level: string; heat_per_hour: number; tagline: string;
  launder_cap_per_hour: number | null;
  drug_output_item_id: string | null;
  drug_output_per_hour: number;
  drug_item?: { name: string } | null;
  output_items?: { id: string; items: { name: string } }[];
};

type OutputItem = {
  id: string; item_id: string; quantity_per_hour: number;
  drop_chance: number; worker_drop_bonus_per_worker: number;
  items: { id: string; name: string; category: string };
};

type Item = { id: string; name: string; category: string };

const BLANK: Partial<Business> = {
  name: "", type: "", description: "", purchase_price: 0, base_income_per_hour: 0,
  max_employees: 5, employee_cost_per_hour: 0, required_level: 1,
  required_items: [], raid_risk: 0.05, enabled: true,
  risk_level: "medium", heat_per_hour: 5, tagline: "",
  launder_cap_per_hour: null, drug_output_item_id: null, drug_output_per_hour: 0,
};

const RISK_LEVELS = ["low", "medium", "high", "extreme"];
const RISK_COLORS: Record<string, string> = {
  low: "text-green-400 bg-green-400/10",
  medium: "text-yellow-400 bg-yellow-400/10",
  high: "text-orange-400 bg-orange-400/10",
  extreme: "text-red-400 bg-red-400/10",
};

function bizTypeLabel(b: Business) {
  if (b.drug_output_item_id)  return { label: "Drogas",  cls: "text-purple-400 bg-purple-400/10" };
  if (b.launder_cap_per_hour) return { label: "Lavagem", cls: "text-blue-400   bg-blue-400/10"   };
  return { label: "Cash", cls: "text-yellow-400 bg-yellow-400/10" };
}

const inputCls  = "w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ff6a00]/60 transition-colors";
const labelCls  = "text-[10px] uppercase tracking-widest text-[#555] mb-1 block font-semibold";
const sectionCls = "text-[10px] uppercase tracking-widest text-[#444] pt-4 pb-1 border-b border-[#1a1a1a] mb-3 font-bold";

export default function BusinessesAdminPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [q, setQ]                   = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "cash" | "launder" | "drug">("all");
  const [loading, setLoading]       = useState(false);
  const [modal, setModal]           = useState<"create" | "edit" | null>(null);
  const [activeTab, setActiveTab]   = useState<"settings" | "drops">("settings");
  const [form, setForm]             = useState<Partial<Business>>(BLANK);
  const [saving, setSaving]         = useState(false);
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Business | null>(null);

  const [outputs, setOutputs]           = useState<OutputItem[]>([]);
  const [items, setItems]               = useState<Item[]>([]);
  const [dropForm, setDropForm]         = useState({ item_id: "", quantity_per_hour: 1, drop_chance: 0.5, worker_drop_bonus_per_worker: 0.02 });
  const [dropsLoading, setDropsLoading] = useState(false);

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); };

  /* ── Load businesses ─────────────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), q });
    const res = await fetch(`/api/admin/crime-empire/businesses?${params}`);
    const data = await res.json();
    setBusinesses(data.businesses || []); setTotal(data.total || 0); setLoading(false);
  }, [page, q]);

  useEffect(() => { load(); }, [load]);

  /* ── Load items list once ────────────────────────────────── */
  useEffect(() => {
    fetch("/api/admin/crime-empire/items?limit=200")
      .then(r => r.json())
      .then(d => setItems(d.items || []));
  }, []);

  /* ── Load drops for selected business ───────────────────── */
  const loadOutputs = useCallback(async (id: string) => {
    setDropsLoading(true);
    const res = await fetch(`/api/admin/crime-empire/businesses/${id}/outputs`);
    const data = await res.json();
    setOutputs(data.outputs || []);
    setDropsLoading(false);
  }, []);

  /* ── Modal helpers ───────────────────────────────────────── */
  const openCreate = () => { setForm(BLANK); setActiveTab("settings"); setOutputs([]); setModal("create"); };
  const openEdit = (b: Business) => {
    setForm({ ...b }); setActiveTab("settings"); setOutputs([]);
    setModal("edit");
    loadOutputs(b.id);
  };
  const closeModal = () => { setModal(null); setForm(BLANK); setOutputs([]); };

  /* ── Save business ───────────────────────────────────────── */
  const handleSave = async () => {
    setSaving(true);
    const isEdit = modal === "edit";
    const res = await fetch(
      isEdit ? `/api/admin/crime-empire/businesses/${form.id}` : "/api/admin/crime-empire/businesses",
      { method: isEdit ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }
    );
    const data = await res.json(); setSaving(false);
    if (data.business) { showToast(isEdit ? "Negócio atualizado!" : "Negócio criado!"); closeModal(); load(); }
    else showToast(data.error || "Erro", false);
  };

  /* ── Delete business ─────────────────────────────────────── */
  const handleDelete = async (b: Business) => {
    const res = await fetch(`/api/admin/crime-empire/businesses/${b.id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) { showToast("Negócio eliminado"); load(); }
    else showToast(data.error || "Erro", false);
    setConfirmDelete(null);
  };

  const toggleEnabled = async (b: Business) => {
    await fetch(`/api/admin/crime-empire/businesses/${b.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !b.enabled }),
    });
    load();
  };

  /* ── Add drop ────────────────────────────────────────────── */
  const handleAddDrop = async () => {
    if (!form.id || !dropForm.item_id) return;
    const res = await fetch(`/api/admin/crime-empire/businesses/${form.id}/outputs`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dropForm),
    });
    const data = await res.json();
    if (data.output) {
      showToast("Drop adicionado!");
      loadOutputs(form.id!);
      setDropForm({ item_id: "", quantity_per_hour: 1, drop_chance: 0.5, worker_drop_bonus_per_worker: 0.02 });
    } else showToast(data.error || "Erro", false);
  };

  /* ── Remove drop ─────────────────────────────────────────── */
  const handleRemoveDrop = async (outputId: string) => {
    await fetch(`/api/admin/crime-empire/businesses/${form.id}/outputs/${outputId}`, { method: "DELETE" });
    showToast("Drop removido");
    loadOutputs(form.id!);
  };

  /* ── Field helpers ───────────────────────────────────────── */
  const tf = (key: keyof Business, label: string, placeholder = "") => (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <input type="text" placeholder={placeholder} value={String(form[key] ?? "")}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className={inputCls} />
    </label>
  );
  const nf = (key: keyof Business, label: string, step = "1", min?: string) => (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <input type="number" step={step} min={min} value={String(form[key] ?? "")}
        onChange={e => setForm(f => ({ ...f, [key]: Number(e.target.value) }))}
        className={inputCls} />
    </label>
  );

  const riskColor = (r: string) => ({ low: "text-green-400", medium: "text-yellow-400", high: "text-orange-400", extreme: "text-red-400" }[r] || "text-white");

  /* ── Filtered businesses ── */
  const filtered = businesses.filter(b => {
    if (typeFilter === "drug")    return !!b.drug_output_item_id;
    if (typeFilter === "launder") return !!b.launder_cap_per_hour && !b.drug_output_item_id;
    if (typeFilter === "cash")    return !b.drug_output_item_id && !b.launder_cap_per_hour;
    return true;
  });

  const counts = {
    all:     businesses.length,
    cash:    businesses.filter(b => !b.drug_output_item_id && !b.launder_cap_per_hour).length,
    launder: businesses.filter(b => !!b.launder_cap_per_hour && !b.drug_output_item_id).length,
    drug:    businesses.filter(b => !!b.drug_output_item_id).length,
  };

  return (
    <div>
      {toast && <CEToast msg={toast.msg} ok={toast.ok} />}

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">🏢 Negócios</h1>
          <p className="text-[#555] text-sm">{total} negócios configurados</p>
        </div>
        <button onClick={openCreate}
          className="bg-[#ff6a00] hover:bg-[#ff8533] text-white font-bold px-4 py-2 rounded-lg text-sm transition-all">
          + Novo Negócio
        </button>
      </div>

      {/* ── Stats / Filter Tabs ── */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {([
          ["all",     "Total",     counts.all,     "text-white",      "border-[#2a2a2a]"      ] as const,
          ["cash",    "💰 Cash",   counts.cash,    "text-yellow-400", "border-yellow-900/40"  ] as const,
          ["launder", "💧 Lavagem",counts.launder, "text-blue-400",   "border-blue-900/40"    ] as const,
          ["drug",    "🌿 Drogas", counts.drug,    "text-purple-400", "border-purple-900/40"  ] as const,
        ]).map(([key, label, count, textCls, borderCls]) => (
          <button key={key} onClick={() => setTypeFilter(key as typeof typeFilter)}
            className={`rounded-xl p-3 text-left border transition-all ${typeFilter === key ? borderCls + " bg-[#111]" : "border-[#1a1a1a] bg-[#0a0a0a] hover:bg-[#111]"}`}>
            <p className={`text-2xl font-black ${textCls}`}>{count}</p>
            <p className="text-[#555] text-xs mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      {/* ── Search ── */}
      <div className="flex gap-3 mb-4">
        <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="Pesquisar nome…"
          className="bg-[#0e0e0e] border border-[#222] rounded-lg px-3 py-2 text-sm text-white flex-1 focus:outline-none focus:border-[#ff6a00]/60" />
      </div>

      {/* ── Table ── */}
      <div className="bg-[#0e0e0e] border border-[#1e1e1e] rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-[#1e1e1e] text-[#444] text-[10px] uppercase tracking-wider">
              <th className="text-left px-4 py-3">Nome / Tipo</th>
              <th className="text-center px-3 py-3">Nível</th>
              <th className="text-right px-3 py-3">Preço</th>
              <th className="text-left px-4 py-3">Produção / Income</th>
              <th className="text-center px-3 py-3">Workers</th>
              <th className="text-right px-3 py-3">Heat/h</th>
              <th className="text-center px-3 py-3">Risco</th>
              <th className="text-center px-3 py-3">Ativo</th>
              <th className="text-right px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="text-center py-12 text-[#444]">A carregar…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-12 text-[#444] italic">Nenhum negócio encontrado.</td></tr>
            ) : filtered.map((b) => {
              const { label: typeLabel, cls: typeCls } = bizTypeLabel(b);
              return (
                <tr key={b.id} className="border-b border-[#151515] hover:bg-[#111] transition-colors">
                  {/* Name / Type */}
                  <td className="px-4 py-3 max-w-[220px]">
                    <div className="flex items-start gap-2">
                      <span className={`mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${typeCls}`}>{typeLabel}</span>
                      <div className="min-w-0">
                        <p className="text-white font-semibold text-sm truncate">{b.name}</p>
                        <p className="text-[#444] text-[10px] font-mono truncate">{b.type}</p>
                        {b.tagline && <p className="text-[#555] text-[10px] italic truncate">{b.tagline}</p>}
                      </div>
                    </div>
                  </td>

                  {/* Level */}
                  <td className="px-3 py-3 text-center">
                    <span className="text-xs font-bold text-[#888] bg-[#1a1a1a] px-2 py-0.5 rounded">
                      Lv.{b.required_level}
                    </span>
                  </td>

                  {/* Price */}
                  <td className="px-3 py-3 text-right text-green-400 font-mono text-xs">
                    ${b.purchase_price.toLocaleString()}
                  </td>

                  {/* Production */}
                  <td className="px-4 py-3 max-w-[200px]">
                    {b.drug_output_item_id ? (
                      <div>
                        <span className="text-purple-400 text-xs font-bold">🌿 {b.drug_item?.name ?? "—"}</span>
                        <span className="text-[#555] text-[10px]"> · {b.drug_output_per_hour} ud/hr</span>
                      </div>
                    ) : b.launder_cap_per_hour ? (
                      <div>
                        <span className="text-blue-400 text-xs font-bold">💧 Lavagem</span>
                        <span className="text-[#555] text-[10px]"> · cap ${b.launder_cap_per_hour.toLocaleString()}/hr</span>
                        {b.base_income_per_hour > 0 && (
                          <p className="text-[#555] text-[10px]">base ${b.base_income_per_hour.toLocaleString()}/hr</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-yellow-400 text-xs font-mono">${b.base_income_per_hour.toLocaleString()}/hr</span>
                    )}
                    {(b.output_items?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {b.output_items!.map(o => (
                          <span key={o.id} className="text-[9px] px-1.5 py-0.5 rounded bg-[#1e1e1e] text-[#777]">
                            📦 {o.items?.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>

                  {/* Workers */}
                  <td className="px-3 py-3 text-center">
                    <p className="text-white text-xs font-bold">{b.max_employees}</p>
                    {b.employee_cost_per_hour > 0 && (
                      <p className="text-[#555] text-[10px]">${b.employee_cost_per_hour}/hr</p>
                    )}
                  </td>

                  {/* Heat */}
                  <td className="px-3 py-3 text-right">
                    <span className="text-orange-400 text-xs font-mono">{b.heat_per_hour ?? "—"}</span>
                  </td>

                  {/* Risk */}
                  <td className="px-3 py-3 text-center">
                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${RISK_COLORS[b.risk_level] || "text-white"}`}>
                      {b.risk_level || "—"}
                    </span>
                  </td>

                  {/* Enabled */}
                  <td className="px-3 py-3 text-center">
                    <button onClick={() => toggleEnabled(b)}
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-all ${b.enabled ? "bg-green-600/20 text-green-400 hover:bg-green-600/30" : "bg-[#1a1a1a] text-[#444] hover:bg-[#222]"}`}>
                      {b.enabled ? "ON" : "OFF"}
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-1.5 justify-end">
                      <button onClick={() => openEdit(b)}
                        className="text-xs px-2.5 py-1 rounded bg-[#1e1e1e] hover:bg-[#2a2a2a] text-white transition-all">
                        ✏️ Editar
                      </button>
                      <button onClick={() => setConfirmDelete(b)}
                        className="text-xs px-2.5 py-1 rounded bg-red-900/20 hover:bg-red-900/40 text-red-400 transition-all">
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {total > 50 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#1e1e1e]">
            <span className="text-xs text-[#444]">Página {page} de {Math.ceil(total / 50)}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="text-xs px-3 py-1 rounded bg-[#1a1a1a] text-white disabled:opacity-30">← Anterior</button>
              <button disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)} className="text-xs px-3 py-1 rounded bg-[#1a1a1a] text-white disabled:opacity-30">Próxima →</button>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          EDIT / CREATE MODAL
      ══════════════════════════════════════════════════════ */}
      {modal && (
        <div className="fixed inset-0 z-40 bg-black/85 flex items-center justify-center p-4" onClick={closeModal}>
          <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-2xl w-full max-w-2xl max-h-[94vh] flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#1e1e1e] flex-shrink-0">
              <div>
                <h2 className="text-lg font-black text-white">
                  {modal === "edit" ? `✏️ ${form.name}` : "➕ Criar Negócio"}
                </h2>
                {modal === "edit" && (
                  <p className="text-[#444] text-xs font-mono mt-0.5">
                    type: {form.type} · id: {form.id?.slice(0, 8)}…
                  </p>
                )}
              </div>
              <button onClick={closeModal} className="text-[#444] hover:text-white text-2xl leading-none transition-colors">×</button>
            </div>

            {/* Tabs — only show Drops tab on edit */}
            {modal === "edit" && (
              <div className="flex gap-1 px-6 pt-3 flex-shrink-0">
                {(["settings", "drops"] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === tab ? "bg-[#ff6a00] text-white" : "bg-[#1a1a1a] text-[#555] hover:text-white"}`}>
                    {tab === "settings" ? "⚙️ Definições" : `📦 Item Drops${outputs.length > 0 ? ` (${outputs.length})` : ""}`}
                  </button>
                ))}
              </div>
            )}

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 px-6 py-4">

              {/* ════ SETTINGS TAB ════ */}
              {activeTab === "settings" && (
                <div className="space-y-1">

                  {/* ── Identidade ── */}
                  <p className={sectionCls}>🪪 Identidade</p>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      {tf("name", "Nome")}
                      {modal === "create"
                        ? tf("type", "Tipo (enum)", "ex: weed_farm")
                        : (
                          <label className="block">
                            <span className={labelCls}>Tipo (não editável)</span>
                            <div className={`${inputCls} opacity-40 cursor-not-allowed`}>{form.type}</div>
                          </label>
                        )
                      }
                    </div>
                    {tf("tagline", "Tagline", "Ex: Cultiva cannabis de alta qualidade")}
                    <label className="block">
                      <span className={labelCls}>Descrição</span>
                      <textarea value={form.description || ""}
                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
                        className={inputCls} />
                    </label>
                  </div>

                  {/* ── Economia ── */}
                  <p className={sectionCls}>💰 Economia</p>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      {nf("purchase_price", "Preço de Compra ($)")}
                      {nf("required_level", "Nível Necessário", "1", "1")}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {nf("max_employees", "Máx. Trabalhadores")}
                      {nf("employee_cost_per_hour", "Custo por Trabalhador/h ($)")}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {nf("base_income_per_hour", "Income Base/hora ($)", "100")}
                      {nf("raid_risk", "Probabilidade de Raid (0–1)", "0.01", "0")}
                    </div>
                    {(form.max_employees ?? 0) > 0 && (form.employee_cost_per_hour ?? 0) > 0 && (
                      <div className="text-xs text-[#555] bg-[#111] rounded-lg px-3 py-2 border border-[#1e1e1e]">
                        Custo total máx.: <span className="text-red-400">${((form.max_employees ?? 0) * (form.employee_cost_per_hour ?? 0)).toLocaleString()}/hr</span>
                        {(form.base_income_per_hour ?? 0) > 0 && (
                          <> · Lucro líquido: <span className="text-green-400">
                            ${Math.max(0, (form.base_income_per_hour ?? 0) - (form.max_employees ?? 0) * (form.employee_cost_per_hour ?? 0)).toLocaleString()}/hr
                          </span></>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ── Tipo de Negócio ── */}
                  <p className={sectionCls}>🧬 Tipo de Negócio</p>
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        ["cash",    "💰 Cash",    "Gera dinheiro sujo directamente",          "yellow"] as const,
                        ["launder", "💧 Lavagem", "Converte dinheiro sujo em limpo",           "blue"]   as const,
                        ["drug",    "🌿 Drogas",  "Produz itens de droga (sem cash directo)", "purple"] as const,
                      ]).map(([key, label, desc, color]) => {
                        const isActive =
                          key === "drug"    ? !!form.drug_output_item_id :
                          key === "launder" ? !!form.launder_cap_per_hour && !form.drug_output_item_id :
                          !form.drug_output_item_id && !form.launder_cap_per_hour;
                        const colors: Record<string, string> = {
                          yellow: "border-yellow-500/60 bg-yellow-500/5 text-yellow-400",
                          blue:   "border-blue-500/60   bg-blue-500/5   text-blue-400",
                          purple: "border-purple-500/60 bg-purple-500/5 text-purple-400",
                        };
                        return (
                          <button key={key} type="button"
                            onClick={() => {
                              if (key === "cash")    setForm(f => ({ ...f, drug_output_item_id: null, launder_cap_per_hour: null }));
                              if (key === "launder") setForm(f => ({ ...f, drug_output_item_id: null, launder_cap_per_hour: f.launder_cap_per_hour ?? 20000 }));
                              if (key === "drug")    setForm(f => ({ ...f, launder_cap_per_hour: null }));
                            }}
                            className={`rounded-xl p-3 border text-left transition-all ${isActive ? colors[color] : "border-[#222] bg-[#0a0a0a] text-[#444] hover:border-[#333]"}`}>
                            <p className="text-sm font-bold">{label}</p>
                            <p className="text-[10px] mt-0.5 opacity-70 leading-tight">{desc}</p>
                          </button>
                        );
                      })}
                    </div>

                    {/* Launder sub-fields */}
                    {!!form.launder_cap_per_hour && !form.drug_output_item_id && (
                      <div className="rounded-xl border border-blue-900/30 bg-blue-950/10 p-3 space-y-2">
                        <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">Configuração de Lavagem</p>
                        <label className="block">
                          <span className={labelCls}>Cap de Lavagem/hora ($)</span>
                          <input type="number" step="500" min="0"
                            value={form.launder_cap_per_hour ?? ""}
                            onChange={e => setForm(f => ({ ...f, launder_cap_per_hour: e.target.value === "" ? null : Number(e.target.value) }))}
                            className={inputCls} />
                        </label>
                        <p className="text-[10px] text-[#555]">Quantidade máxima de dinheiro sujo que este negócio consegue lavar por hora.</p>
                      </div>
                    )}

                    {/* Drug sub-fields */}
                    <div className={`rounded-xl border p-3 space-y-2 transition-all ${form.drug_output_item_id ? "border-purple-900/30 bg-purple-950/10" : "border-[#1a1a1a] bg-[#0a0a0a]"}`}>
                      <p className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">Configuração de Drogas</p>
                      <label className="block">
                        <span className={labelCls}>Item de Droga Produzido</span>
                        <select
                          value={form.drug_output_item_id ?? ""}
                          onChange={e => setForm(f => ({ ...f, drug_output_item_id: e.target.value || null }))}
                          className={inputCls}>
                          <option value="">— Nenhum (negócio cash/lavagem) —</option>
                          {items.filter(i => i.category === "drug").map(i => (
                            <option key={i.id} value={i.id}>{i.name}</option>
                          ))}
                        </select>
                      </label>
                      {form.drug_output_item_id && (
                        <label className="block">
                          <span className={labelCls}>Output Base/hora (unidades)</span>
                          <input type="number" step="1" min="0"
                            value={form.drug_output_per_hour ?? 0}
                            onChange={e => setForm(f => ({ ...f, drug_output_per_hour: Number(e.target.value) }))}
                            className={inputCls} />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* ── Heat & Risco ── */}
                  <p className={sectionCls}>🌡️ Heat & Risco</p>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      {nf("heat_per_hour", "Heat gerado/hora", "0.5", "0")}
                      <label className="block">
                        <span className={labelCls}>Nível de Risco</span>
                        <select value={form.risk_level || "medium"}
                          onChange={e => setForm(f => ({ ...f, risk_level: e.target.value }))}
                          className={inputCls}>
                          {RISK_LEVELS.map(r => (
                            <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="text-xs text-[#555] bg-[#111] rounded-lg px-3 py-2 border border-[#1e1e1e] grid grid-cols-3 gap-2 text-center">
                      <div><p className="text-[#444] text-[10px]">Low prod.</p><p className="text-green-400">{((form.heat_per_hour ?? 0) * 0.3).toFixed(1)}/hr</p></div>
                      <div><p className="text-[#444] text-[10px]">Normal</p><p className="text-yellow-400">{(form.heat_per_hour ?? 0).toFixed(1)}/hr</p></div>
                      <div><p className="text-[#444] text-[10px]">Overdrive</p><p className="text-red-400">{((form.heat_per_hour ?? 0) * 2.5).toFixed(1)}/hr</p></div>
                    </div>
                  </div>

                  {/* ── Estado ── */}
                  <p className={sectionCls}>⚡ Estado</p>
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-[#1e1e1e] bg-[#0a0a0a] hover:bg-[#111] transition-colors">
                    <input type="checkbox" checked={form.enabled ?? true}
                      onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))}
                      className="w-4 h-4 accent-[#ff6a00]" />
                    <div>
                      <p className="text-sm text-white font-semibold">Negócio activo</p>
                      <p className="text-[10px] text-[#555]">Negócios inactivos não aparecem para os jogadores.</p>
                    </div>
                  </label>
                </div>
              )}

              {/* ════ DROPS TAB ════ */}
              {activeTab === "drops" && modal === "edit" && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-[#1e1e1e] bg-[#0a0a0a] p-3">
                    <p className="text-xs text-[#555] leading-relaxed">
                      Item drops são bónus aleatórios produzidos por este negócio além do income principal.
                      <br />
                      <span className="text-[#444]">Chance efectiva = chance_base + (nº workers × bonus_por_worker), máx. 100%.</span>
                    </p>
                  </div>

                  {dropsLoading ? (
                    <p className="text-[#444] text-sm text-center py-6">A carregar drops…</p>
                  ) : outputs.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-[#2a2a2a] rounded-xl">
                      <p className="text-[#444] text-sm">Nenhum drop configurado ainda.</p>
                      <p className="text-[#333] text-xs mt-1">Adiciona abaixo.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {outputs.map(o => (
                        <div key={o.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#111] border border-[#1e1e1e] hover:border-[#2a2a2a] transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-semibold">{o.items?.name ?? o.item_id}</p>
                            <p className="text-[#555] text-[10px] uppercase tracking-wider">{o.items?.category}</p>
                          </div>
                          <div className="flex gap-3 text-right flex-shrink-0">
                            <div>
                              <p className="text-[10px] text-[#444]">Chance base</p>
                              <p className="text-xs font-bold text-yellow-400">{Math.round(o.drop_chance * 100)}%</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-[#444]">+% por worker</p>
                              <p className="text-xs font-bold text-blue-400">+{Math.round(o.worker_drop_bonus_per_worker * 100)}%</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-[#444]">Qtd/hora</p>
                              <p className="text-xs font-bold text-green-400">{o.quantity_per_hour}x</p>
                            </div>
                          </div>
                          <button onClick={() => handleRemoveDrop(o.id)}
                            className="text-xs px-2 py-1 rounded-lg bg-red-900/20 hover:bg-red-900/50 text-red-400 flex-shrink-0 transition-all">
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add drop form */}
                  <div className="border border-[#2a2a2a] rounded-xl p-4 bg-[#0a0a0a] space-y-3">
                    <p className="text-xs font-bold text-[#555] uppercase tracking-wider">➕ Adicionar Drop</p>
                    <label className="block">
                      <span className={labelCls}>Item</span>
                      <select value={dropForm.item_id}
                        onChange={e => setDropForm(f => ({ ...f, item_id: e.target.value }))}
                        className={inputCls}>
                        <option value="">— Seleciona um item —</option>
                        {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.category})</option>)}
                      </select>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <label className="block">
                        <span className={labelCls}>Chance base (0–1)</span>
                        <input type="number" step="0.01" min="0.01" max="1" value={dropForm.drop_chance}
                          onChange={e => setDropForm(f => ({ ...f, drop_chance: Number(e.target.value) }))}
                          className={inputCls} />
                      </label>
                      <label className="block">
                        <span className={labelCls}>+% por worker</span>
                        <input type="number" step="0.01" min="0" max="1" value={dropForm.worker_drop_bonus_per_worker}
                          onChange={e => setDropForm(f => ({ ...f, worker_drop_bonus_per_worker: Number(e.target.value) }))}
                          className={inputCls} />
                      </label>
                      <label className="block">
                        <span className={labelCls}>Qtd/hora</span>
                        <input type="number" step="1" min="1" value={dropForm.quantity_per_hour}
                          onChange={e => setDropForm(f => ({ ...f, quantity_per_hour: Number(e.target.value) }))}
                          className={inputCls} />
                      </label>
                    </div>
                    {dropForm.item_id && (
                      <div className="text-xs text-[#555] bg-[#111] rounded-lg px-3 py-2 border border-[#1e1e1e] grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-[#444] text-[10px]">0 workers</p>
                          <p className="text-white">{Math.round(dropForm.drop_chance * 100)}%</p>
                        </div>
                        <div>
                          <p className="text-[#444] text-[10px]">5 workers</p>
                          <p className="text-green-400">{Math.min(100, Math.round((dropForm.drop_chance + 5 * dropForm.worker_drop_bonus_per_worker) * 100))}%</p>
                        </div>
                        <div>
                          <p className="text-[#444] text-[10px]">Máx ({form.max_employees})</p>
                          <p className="text-yellow-400">
                            {Math.min(100, Math.round((dropForm.drop_chance + (form.max_employees ?? 10) * dropForm.worker_drop_bonus_per_worker) * 100))}%
                          </p>
                        </div>
                      </div>
                    )}
                    <button onClick={handleAddDrop} disabled={!dropForm.item_id}
                      className="w-full py-2.5 rounded-xl bg-[#ff6a00] hover:bg-[#ff8533] disabled:opacity-40 text-white text-sm font-bold transition-all">
                      + Adicionar Drop
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Footer ── */}
            <div className="flex gap-3 px-6 py-4 border-t border-[#1e1e1e] flex-shrink-0">
              <button onClick={closeModal}
                className="px-5 py-2.5 rounded-xl bg-[#1a1a1a] text-[#888] text-sm font-semibold hover:bg-[#222] transition-all">
                Cancelar
              </button>
              {activeTab === "settings" && (
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-[#ff6a00] hover:bg-[#ff8533] text-white text-sm font-bold disabled:opacity-50 transition-all">
                  {saving ? "A guardar…" : modal === "edit" ? "💾 Guardar Alterações" : "✅ Criar Negócio"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm delete ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-[#0e0e0e] border border-red-900/40 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-white font-bold text-lg mb-1">🗑️ Eliminar negócio?</h3>
            <p className="text-[#888] text-sm mb-1">"{confirmDelete.name}"</p>
            <p className="text-[#555] text-xs">Remove o negócio e todos os seus drops. Jogadores perdem acesso mas os seus dados de player_business ficam intactos.</p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-[#1a1a1a] text-white text-sm font-semibold hover:bg-[#222] transition-all">
                Cancelar
              </button>
              <button onClick={() => handleDelete(confirmDelete)}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-all">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
