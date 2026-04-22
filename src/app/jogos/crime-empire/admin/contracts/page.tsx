"use client";

import { useEffect, useState, useCallback } from "react";

type Contract = {
  id: string;
  name: string;
  description: string;
  roadmap_level: number;
  difficulty: "easy" | "medium" | "hard";
  required_level: number;
  stamina_cost: number;
  base_success_rate: number;
  hitman_bonus: number;
  arrest_chance: number;
  hitman_arrest_reduction: number;
  min_cash: number;
  max_cash: number;
  respect_reward: number;
  enabled: boolean;
};

const DIFFICULTIES = ["easy", "medium", "hard"] as const;
const DIFF_LABEL: Record<string, string> = { easy: "🟢 Fácil", medium: "🟡 Médio", hard: "🔴 Difícil" };

const BLANK: Partial<Contract> = {
  name: "", description: "", roadmap_level: 1, difficulty: "easy",
  required_level: 1, stamina_cost: 20, base_success_rate: 0.5,
  hitman_bonus: 0.15, arrest_chance: 0.3, hitman_arrest_reduction: 0.5,
  min_cash: 500, max_cash: 2000, respect_reward: 50, enabled: true,
};

export default function AdminContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [form, setForm] = useState<Partial<Contract>>(BLANK);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Contract | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/crime-empire/contracts?limit=200");
    const data = await res.json();
    setContracts(data.contracts || []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const f = (key: keyof Contract, val: unknown) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const openCreate = () => { setForm(BLANK); setModal("create"); };
  const openEdit = (c: Contract) => { setForm({ ...c }); setModal("edit"); };
  const closeModal = () => { setModal(null); setForm(BLANK); };

  const save = async () => {
    if (!form.name?.trim()) { showToast("Nome obrigatório", false); return; }
    setSaving(true);
    const isEdit = modal === "edit";
    const method = isEdit ? "PUT" : "POST";
    const res = await fetch("/api/admin/crime-empire/contracts", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (data.contract) {
      showToast(isEdit ? "Contrato actualizado" : "Contrato criado");
      closeModal();
      load();
    } else {
      showToast(data.error || "Erro", false);
    }
  };

  const doDelete = async (contract: Contract) => {
    const res = await fetch("/api/admin/crime-empire/contracts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: contract.id }),
    });
    const data = await res.json();
    if (data.success) {
      showToast("Contrato eliminado");
      setConfirmDelete(null);
      load();
    } else {
      showToast(data.error || "Erro", false);
      setConfirmDelete(null);
    }
  };

  const toggleEnabled = async (contract: Contract) => {
    const res = await fetch("/api/admin/crime-empire/contracts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: contract.id, enabled: !contract.enabled }),
    });
    const data = await res.json();
    if (data.contract) {
      setContracts((prev) => prev.map((c) => (c.id === contract.id ? data.contract : c)));
    }
  };

  // Group by roadmap level
  const levels = Array.from(new Set(contracts.map((c) => c.roadmap_level))).sort((a, b) => a - b);

  return (
    <div className="flex-1 text-white py-10 px-4 md:px-8">
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-xl ${toast.ok ? "bg-green-700" : "bg-red-700"} text-white`}>
          {toast.msg}
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
              🎯 Contratos — Admin
            </h1>
            <p className="text-[#888] text-sm mt-1">{total} contratos no total</p>
          </div>
          <button
            onClick={openCreate}
            className="px-5 py-2.5 rounded-xl bg-[#ff6a00] hover:bg-[#ff8533] text-white font-bold text-sm transition-all"
          >
            + Novo Contrato
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 text-[#555]">A carregar...</div>
        ) : levels.length === 0 ? (
          <div className="text-center py-20 text-[#555]">
            <p className="text-4xl mb-3">🎯</p>
            <p>Nenhum contrato criado. Cria o primeiro!</p>
          </div>
        ) : (
          <div className="space-y-8">
            {levels.map((lvl) => {
              const lvlContracts = contracts.filter((c) => c.roadmap_level === lvl);
              return (
                <div key={lvl} className="bg-[#0e0e0e] rounded-2xl border border-[#1e1e1e] overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-[#1e1e1e] bg-[#111]">
                    <p className="font-black text-[#ff6a00] uppercase tracking-widest text-sm">
                      Nível {lvl} da Rota
                    </p>
                    <span className="text-xs text-[#555]">{lvlContracts.length} alvos</span>
                  </div>
                  <div className="divide-y divide-[#1a1a1a]">
                    {lvlContracts.map((c) => (
                      <div key={c.id} className="flex items-center gap-4 px-5 py-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                          c.difficulty === "easy" ? "bg-green-900/30 text-green-400"
                          : c.difficulty === "medium" ? "bg-yellow-900/30 text-yellow-400"
                          : "bg-red-900/30 text-red-400"
                        }`}>
                          {DIFF_LABEL[c.difficulty]}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">{c.name}</p>
                          <p className="text-[#555] text-xs truncate">{c.description}</p>
                        </div>
                        <div className="hidden md:flex items-center gap-4 text-xs text-[#666] flex-shrink-0">
                          <span>Nív. {c.required_level}</span>
                          <span className="text-green-400">${c.min_cash.toLocaleString()}–${c.max_cash.toLocaleString()}</span>
                          <span className="text-yellow-400">+{c.respect_reward} ⭐</span>
                          <span>{Math.round(c.base_success_rate * 100)}% base</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => toggleEnabled(c)}
                            className={`text-xs px-2 py-1 rounded font-bold transition-all ${c.enabled ? "bg-green-900/30 text-green-400 hover:bg-red-900/30 hover:text-red-400" : "bg-[#1a1a1a] text-[#555] hover:bg-green-900/30 hover:text-green-400"}`}
                          >
                            {c.enabled ? "ON" : "OFF"}
                          </button>
                          <button
                            onClick={() => openEdit(c)}
                            className="text-xs px-3 py-1.5 rounded bg-[#1e1e1e] hover:bg-[#2a2a2a] text-[#aaa] hover:text-white transition-all"
                          >
                            ✏️ Editar
                          </button>
                          <button
                            onClick={() => setConfirmDelete(c)}
                            className="text-xs px-3 py-1.5 rounded bg-[#1e1e1e] hover:bg-red-900/30 text-[#666] hover:text-red-400 transition-all"
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#121212] border border-[#222] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-black mb-5 text-white">
              {modal === "create" ? "➕ Novo Contrato" : "✏️ Editar Contrato"}
            </h2>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="text-xs text-[#888] uppercase tracking-wider mb-1 block">Nome do Alvo *</label>
                <input
                  type="text"
                  value={form.name ?? ""}
                  onChange={(e) => f("name", e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#ff6a00]"
                  placeholder="Ex: Miguel 'O Traidor' Santos"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs text-[#888] uppercase tracking-wider mb-1 block">Descrição</label>
                <textarea
                  value={form.description ?? ""}
                  onChange={(e) => f("description", e.target.value)}
                  rows={2}
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#ff6a00] resize-none"
                  placeholder="Descrição do alvo..."
                />
              </div>

              {/* Level + Difficulty */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#888] uppercase tracking-wider mb-1 block">Nível da Rota</label>
                  <input
                    type="number" min="1"
                    value={form.roadmap_level ?? 1}
                    onChange={(e) => f("roadmap_level", parseInt(e.target.value) || 1)}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#ff6a00]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#888] uppercase tracking-wider mb-1 block">Dificuldade</label>
                  <select
                    value={form.difficulty ?? "easy"}
                    onChange={(e) => f("difficulty", e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#ff6a00]"
                  >
                    {DIFFICULTIES.map((d) => (
                      <option key={d} value={d}>{DIFF_LABEL[d]}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Required level + Stamina */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#888] uppercase tracking-wider mb-1 block">Nível Mínimo do Jogador</label>
                  <input
                    type="number" min="1"
                    value={form.required_level ?? 1}
                    onChange={(e) => f("required_level", parseInt(e.target.value) || 1)}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#ff6a00]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#888] uppercase tracking-wider mb-1 block">Custo de Stamina</label>
                  <input
                    type="number" min="1"
                    value={form.stamina_cost ?? 20}
                    onChange={(e) => f("stamina_cost", parseInt(e.target.value) || 20)}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#ff6a00]"
                  />
                </div>
              </div>

              {/* Success rates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#888] uppercase tracking-wider mb-1 block">Taxa de Sucesso Base (0–1)</label>
                  <input
                    type="number" min="0.01" max="0.95" step="0.01"
                    value={form.base_success_rate ?? 0.5}
                    onChange={(e) => f("base_success_rate", parseFloat(e.target.value) || 0.5)}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#ff6a00]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#888] uppercase tracking-wider mb-1 block">Bónus Hitman (+)</label>
                  <input
                    type="number" min="0" max="0.5" step="0.01"
                    value={form.hitman_bonus ?? 0.15}
                    onChange={(e) => f("hitman_bonus", parseFloat(e.target.value) || 0.15)}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#ff6a00]"
                  />
                </div>
              </div>

              {/* Arrest */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#888] uppercase tracking-wider mb-1 block">Chance de Prisão (0–1)</label>
                  <input
                    type="number" min="0" max="1" step="0.01"
                    value={form.arrest_chance ?? 0.3}
                    onChange={(e) => f("arrest_chance", parseFloat(e.target.value) || 0.3)}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#ff6a00]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#888] uppercase tracking-wider mb-1 block">Redução Prisão Hitman (0–1)</label>
                  <input
                    type="number" min="0" max="1" step="0.01"
                    value={form.hitman_arrest_reduction ?? 0.5}
                    onChange={(e) => f("hitman_arrest_reduction", parseFloat(e.target.value) || 0.5)}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#ff6a00]"
                  />
                </div>
              </div>

              {/* Cash rewards */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#888] uppercase tracking-wider mb-1 block">Dinheiro Mínimo</label>
                  <input
                    type="number" min="0"
                    value={form.min_cash ?? 500}
                    onChange={(e) => f("min_cash", parseInt(e.target.value) || 500)}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#ff6a00]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#888] uppercase tracking-wider mb-1 block">Dinheiro Máximo</label>
                  <input
                    type="number" min="0"
                    value={form.max_cash ?? 2000}
                    onChange={(e) => f("max_cash", parseInt(e.target.value) || 2000)}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#ff6a00]"
                  />
                </div>
              </div>

              {/* Respect */}
              <div>
                <label className="text-xs text-[#888] uppercase tracking-wider mb-1 block">Respeito</label>
                <input
                  type="number" min="0"
                  value={form.respect_reward ?? 50}
                  onChange={(e) => f("respect_reward", parseInt(e.target.value) || 50)}
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#ff6a00]"
                />
              </div>

              {/* Enabled */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.enabled ?? true}
                  onChange={(e) => f("enabled", e.target.checked)}
                  className="w-4 h-4 accent-[#ff6a00]"
                />
                <span className="text-sm text-[#aaa]">Activado</span>
              </label>
            </div>

            {/* Footer */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={closeModal}
                className="flex-1 py-2.5 rounded-xl bg-[#1a1a1a] border border-[#333] text-[#aaa] hover:text-white font-bold text-sm transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-[#ff6a00] hover:bg-[#ff8533] text-white font-bold text-sm transition-all disabled:opacity-50"
              >
                {saving ? "A guardar..." : modal === "create" ? "Criar Contrato" : "Guardar Alterações"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#121212] border border-red-900 rounded-2xl p-6 w-full max-w-sm text-center">
            <p className="text-4xl mb-3">🗑</p>
            <p className="text-white font-bold mb-1">Eliminar contrato?</p>
            <p className="text-[#888] text-sm mb-5">{confirmDelete.name}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-[#1a1a1a] border border-[#333] text-[#aaa] font-bold text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={() => doDelete(confirmDelete)}
                className="flex-1 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 text-white font-bold text-sm transition-all"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
