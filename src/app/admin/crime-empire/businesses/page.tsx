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
};

const RISK_LEVELS = ["low", "medium", "high", "extreme"];

export default function BusinessesAdminPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [q, setQ]                   = useState("");
  const [loading, setLoading]       = useState(false);
  const [modal, setModal]           = useState<"create" | "edit" | null>(null);
  const [activeTab, setActiveTab]   = useState<"settings" | "drops">("settings");
  const [form, setForm]             = useState<Partial<Business>>(BLANK);
  const [saving, setSaving]         = useState(false);
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Business | null>(null);

  // Item drops state
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
      <span className="text-xs text-[#666] mb-1 block">{label}</span>
      <input type="text" placeholder={placeholder} value={String(form[key] ?? "")}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white" />
    </label>
  );
  const nf = (key: keyof Business, label: string, step = "1") => (
    <label className="block">
      <span className="text-xs text-[#666] mb-1 block">{label}</span>
      <input type="number" step={step} value={String(form[key] ?? "")}
        onChange={e => setForm(f => ({ ...f, [key]: Number(e.target.value) }))}
        className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white" />
    </label>
  );

  const riskColor = (r: string) => ({ low: "text-green-400", medium: "text-yellow-400", high: "text-orange-400", extreme: "text-red-400" }[r] || "text-white");

  return (
    <div>
      {toast && <CEToast msg={toast.msg} ok={toast.ok} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">🏢 Negócios</h1>
          <p className="text-[#555] text-sm">{total} negócios — inclui item drops e mecânicas v2</p>
        </div>
        <button onClick={openCreate}
          className="bg-[#ff6a00] hover:bg-[#ff8533] text-white font-bold px-4 py-2 rounded-lg text-sm transition-all">
          + Novo Negócio
        </button>
      </div>

      {/* Search */}
      <div className="flex gap-3 mb-5">
        <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="Pesquisar…"
          className="bg-[#0e0e0e] border border-[#222] rounded-lg px-3 py-2 text-sm text-white flex-1" />
      </div>

      {/* Table */}
      <div className="bg-[#0e0e0e] border border-[#1e1e1e] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e1e1e] text-[#444] text-xs uppercase">
              <th className="text-left px-4 py-3">Nome / Tipo</th>
              <th className="text-right px-4 py-3">Preço</th>
              <th className="text-right px-4 py-3">Income/h</th>
              <th className="text-right px-4 py-3">Workers</th>
              <th className="text-right px-4 py-3">Heat/h</th>
              <th className="text-center px-4 py-3">Risco</th>
              <th className="text-center px-4 py-3">Ativo</th>
              <th className="text-right px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-8 text-[#444]">A carregar…</td></tr>
            ) : businesses.map((b) => (
              <tr key={b.id} className="border-b border-[#151515] hover:bg-[#141414] transition-colors">
                <td className="px-4 py-3">
                  <p className="text-white font-medium">{b.name}</p>
                  <p className="text-[#444] text-xs font-mono">{b.type}</p>
                  {b.tagline && <p className="text-[#555] text-xs italic mt-0.5">{b.tagline}</p>}
                </td>
                <td className="px-4 py-3 text-right text-green-400">💵 {b.purchase_price.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-yellow-400">{b.base_income_per_hour.toLocaleString()}/h</td>
                <td className="px-4 py-3 text-right text-[#888]">{b.max_employees}</td>
                <td className="px-4 py-3 text-right text-orange-400">{b.heat_per_hour ?? "—"}/h</td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs font-bold uppercase ${riskColor(b.risk_level)}`}>{b.risk_level || "—"}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => toggleEnabled(b)}
                    className={`text-xs px-2 py-0.5 rounded-full font-bold ${b.enabled ? "bg-green-600/20 text-green-400" : "bg-[#1a1a1a] text-[#444]"}`}>
                    {b.enabled ? "ON" : "OFF"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => openEdit(b)} className="text-xs px-2 py-1 rounded bg-[#1e1e1e] hover:bg-[#2a2a2a] text-white">Editar</button>
                    <button onClick={() => setConfirmDelete(b)} className="text-xs px-2 py-1 rounded bg-red-900/30 hover:bg-red-900/50 text-red-400">Del</button>
                  </div>
                </td>
              </tr>
            ))}
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

      {/* Edit / Create Modal */}
      {modal && (
        <div className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4" onClick={closeModal}>
          <div className="bg-[#0e0e0e] border border-[#2a2a2a] rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#1e1e1e] flex-shrink-0">
              <h2 className="text-lg font-black text-white">{modal === "edit" ? `Editar: ${form.name}` : "Criar Negócio"}</h2>
              <button onClick={closeModal} className="text-[#444] hover:text-white text-xl leading-none">×</button>
            </div>

            {/* Tabs — only show Drops tab on edit */}
            {modal === "edit" && (
              <div className="flex gap-1 px-6 pt-3 flex-shrink-0">
                {(["settings", "drops"] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === tab ? "bg-[#ff6a00] text-white" : "bg-[#1a1a1a] text-[#555] hover:text-white"}`}>
                    {tab === "settings" ? "⚙️ Definições" : "📦 Item Drops"}
                  </button>
                ))}
              </div>
            )}

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 px-6 py-4">

              {/* ── SETTINGS TAB ── */}
              {activeTab === "settings" && (
                <div className="space-y-3">
                  {modal === "edit" && <p className="text-xs text-[#444] font-mono">tipo: {form.type} (não editável)</p>}

                  {tf("name", "Nome")}
                  {modal === "create" && tf("type", "Tipo (enum ex: weed_farm)")}
                  <label className="block">
                    <span className="text-xs text-[#666] mb-1 block">Descrição</span>
                    <textarea value={form.description || ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
                      className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white" />
                  </label>
                  {tf("tagline", "Tagline (frase curta)", "Ex: Cultiva cannabis de alta qualidade")}

                  <p className="text-[10px] uppercase tracking-widest text-[#555] pt-2">Economia</p>
                  <div className="grid grid-cols-2 gap-3">
                    {nf("purchase_price", "Preço de Compra")}
                    {nf("base_income_per_hour", "Income/hora")}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {nf("max_employees", "Max. Trabalhadores")}
                    {nf("employee_cost_per_hour", "Custo Trabalhador/h")}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {nf("required_level", "Nível Req.")}
                    {nf("raid_risk", "Risco Raid (0-1)", "0.01")}
                  </div>

                  <p className="text-[10px] uppercase tracking-widest text-[#555] pt-2">Heat & Risco (v2)</p>
                  <div className="grid grid-cols-2 gap-3">
                    {nf("heat_per_hour", "Heat/hora", "0.5")}
                    <label className="block">
                      <span className="text-xs text-[#666] mb-1 block">Nível de Risco</span>
                      <select value={form.risk_level || "medium"} onChange={e => setForm(f => ({ ...f, risk_level: e.target.value }))}
                        className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white">
                        {RISK_LEVELS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </label>
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer pt-1">
                    <input type="checkbox" checked={form.enabled ?? true} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))}
                      className="w-4 h-4 accent-[#ff6a00]" />
                    <span className="text-sm text-[#888]">Negócio activo</span>
                  </label>
                </div>
              )}

              {/* ── DROPS TAB ── */}
              {activeTab === "drops" && modal === "edit" && (
                <div className="space-y-4">
                  <p className="text-xs text-[#555]">
                    Configura que itens este negócio produz. Chance efectiva = base + (workers × bonus/worker), máx. 100%.
                  </p>

                  {dropsLoading ? (
                    <p className="text-[#444] text-sm">A carregar drops…</p>
                  ) : outputs.length === 0 ? (
                    <p className="text-[#444] text-sm italic">Nenhum drop configurado ainda.</p>
                  ) : (
                    <div className="space-y-2">
                      {outputs.map(o => (
                        <div key={o.id} className="flex items-center gap-3 p-3 rounded-lg bg-[#111] border border-[#1e1e1e]">
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-semibold truncate">{o.items?.name ?? o.item_id}</p>
                            <p className="text-[#555] text-xs">{o.items?.category}</p>
                          </div>
                          <div className="text-right flex-shrink-0 space-y-0.5">
                            <p className="text-xs text-yellow-400">Base: {Math.round(o.drop_chance * 100)}%</p>
                            <p className="text-xs text-blue-400">+{Math.round(o.worker_drop_bonus_per_worker * 100)}%/worker</p>
                            <p className="text-xs text-green-400">{o.quantity_per_hour}x/h</p>
                          </div>
                          <button onClick={() => handleRemoveDrop(o.id)}
                            className="text-xs px-2 py-1 rounded bg-red-900/30 hover:bg-red-900/60 text-red-400 flex-shrink-0">
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add drop form */}
                  <div className="border border-[#2a2a2a] rounded-xl p-4 bg-[#0a0a0a] space-y-3">
                    <p className="text-xs font-bold text-[#666] uppercase tracking-wider">Adicionar Drop</p>
                    <label className="block">
                      <span className="text-xs text-[#666] mb-1 block">Item</span>
                      <select value={dropForm.item_id} onChange={e => setDropForm(f => ({ ...f, item_id: e.target.value }))}
                        className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white">
                        <option value="">— Seleciona um item —</option>
                        {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.category})</option>)}
                      </select>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <label className="block">
                        <span className="text-xs text-[#666] mb-1 block">Chance base (0-1)</span>
                        <input type="number" step="0.01" min="0.01" max="1" value={dropForm.drop_chance}
                          onChange={e => setDropForm(f => ({ ...f, drop_chance: Number(e.target.value) }))}
                          className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white" />
                      </label>
                      <label className="block">
                        <span className="text-xs text-[#666] mb-1 block">+%/worker (0-1)</span>
                        <input type="number" step="0.01" min="0" max="1" value={dropForm.worker_drop_bonus_per_worker}
                          onChange={e => setDropForm(f => ({ ...f, worker_drop_bonus_per_worker: Number(e.target.value) }))}
                          className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white" />
                      </label>
                      <label className="block">
                        <span className="text-xs text-[#666] mb-1 block">Qtd/hora</span>
                        <input type="number" step="1" min="1" value={dropForm.quantity_per_hour}
                          onChange={e => setDropForm(f => ({ ...f, quantity_per_hour: Number(e.target.value) }))}
                          className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white" />
                      </label>
                    </div>
                    {dropForm.item_id && (
                      <div className="text-xs text-[#555] bg-[#111] rounded-lg px-3 py-2 border border-[#1e1e1e]">
                        0 workers: <span className="text-white">{Math.round(dropForm.drop_chance * 100)}%</span>
                        {" · "}5 workers: <span className="text-green-400">{Math.min(100, Math.round((dropForm.drop_chance + 5 * dropForm.worker_drop_bonus_per_worker) * 100))}%</span>
                        {" · "}Máx ({form.max_employees} workers): <span className="text-yellow-400">{Math.min(100, Math.round((dropForm.drop_chance + (form.max_employees ?? 10) * dropForm.worker_drop_bonus_per_worker) * 100))}%</span>
                      </div>
                    )}
                    <button onClick={handleAddDrop} disabled={!dropForm.item_id}
                      className="w-full py-2 rounded-lg bg-[#ff6a00] hover:bg-[#ff8533] disabled:opacity-40 text-white text-sm font-bold transition-all">
                      + Adicionar Drop
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-[#1e1e1e] flex-shrink-0">
              <button onClick={closeModal} className="flex-1 py-2.5 rounded-lg bg-[#1a1a1a] text-[#888] text-sm font-semibold">Cancelar</button>
              {activeTab === "settings" && (
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-2.5 rounded-lg bg-[#ff6a00] text-white text-sm font-bold disabled:opacity-50">
                  {saving ? "A guardar…" : modal === "edit" ? "Guardar" : "Criar"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0e0e0e] border border-red-900/50 rounded-2xl p-6 w-full max-w-sm text-center">
            <h3 className="text-white font-bold mb-1">Eliminar "{confirmDelete.name}"?</h3>
            <p className="text-[#555] text-xs mb-4">Isto remove o negócio e todos os seus drops configurados.</p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2 rounded-lg bg-[#1a1a1a] text-white text-sm">Cancelar</button>
              <button onClick={() => handleDelete(confirmDelete)} className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
