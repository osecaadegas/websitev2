"use client";

import { useAuth } from "@/lib/auth-context";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Reward } from "@/components/RewardCard";

const SELECT_CLS =
  "w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-arena-gold/40 appearance-none cursor-pointer";
const INPUT_CLS =
  "w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-arena-gold/40";

const emptyReward: Omit<Reward, "id"> = {
  title: "",
  description: "",
  image: null,
  cost: 100,
  type: "custom",
  tier: "common",
  stock: null,
  cooldown: null,
  vip_only: false,
  vip_level_required: null,
  active: true,
  sort_order: 0,
};

type FormReward = typeof emptyReward & { id?: string };

export default function AdminRewardsPage() {
  const { user } = useAuth();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FormReward | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fetchRewards = useCallback(async () => {
    try {
      const res = await fetch("/api/rewards?all=true");
      const data = await res.json();
      if (Array.isArray(data.rewards)) setRewards(data.rewards);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRewards(); }, [fetchRewards]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleSave() {
    if (!editing || !editing.title.trim()) return;
    setSaving(true);

    const isEdit = !!editing.id;
    const method = isEdit ? "PATCH" : "POST";
    const body = isEdit
      ? { id: editing.id, ...editing }
      : editing;

    try {
      const res = await fetch("/api/rewards", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const d = await res.json();
        showToast(d.details || d.error || "Erro ao guardar");
      } else {
        showToast(isEdit ? "Recompensa atualizada" : "Recompensa criada");
        setEditing(null);
        fetchRewards();
      }
    } catch {
      showToast("Erro de rede");
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Eliminar esta recompensa?")) return;

    try {
      const res = await fetch("/api/rewards", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        showToast("Recompensa eliminada");
        fetchRewards();
      }
    } catch {
      showToast("Erro ao eliminar");
    }
  }

  async function handleToggle(reward: Reward) {
    try {
      await fetch("/api/rewards", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reward.id, active: !reward.active }),
      });
      fetchRewards();
    } catch { /* ignore */ }
  }

  const tierColors: Record<string, string> = {
    common: "text-arena-smoke",
    elite: "text-arena-gold",
    legendary: "text-arena-red",
  };

  return (
    <div className="pt-24 pb-16 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-end mb-6">
          <button
            onClick={() => setEditing(editing ? null : { ...emptyReward })}
            className="px-4 py-2 rounded-lg bg-arena-crimson hover:bg-arena-red text-white text-sm gladiator-label transition-all cursor-pointer"
          >
            {editing && !editing.id ? "✕ Fechar" : "+ Nova Recompensa"}
          </button>
        </div>

        {/* Inline expandable form */}
        <AnimatePresence>
          {editing && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden mb-8"
            >
              <div className="rounded-2xl border border-white/10 bg-[#111] p-6">
                <h2 className="gladiator-label text-lg text-arena-white mb-6">
                  {editing.id ? "Editar Recompensa" : "Nova Recompensa"}
                </h2>

                <div className="space-y-4">
                  <Field label="Título">
                    <input
                      type="text"
                      value={editing.title}
                      onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                      className={INPUT_CLS}
                    />
                  </Field>

                  <Field label="Descrição">
                    <textarea
                      value={editing.description}
                      onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                      rows={2}
                      className={`${INPUT_CLS} resize-none`}
                    />
                  </Field>

                  <Field label="Imagem URL">
                    <input
                      type="url"
                      value={editing.image || ""}
                      onChange={(e) => setEditing({ ...editing, image: e.target.value || null })}
                      className={INPUT_CLS}
                      placeholder="https://..."
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Custo (pontos)">
                      <input
                        type="number"
                        min={1}
                        value={editing.cost}
                        onChange={(e) => setEditing({ ...editing, cost: parseInt(e.target.value) || 0 })}
                        className={INPUT_CLS}
                      />
                    </Field>

                    <Field label="Stock (vazio = ilimitado)">
                      <input
                        type="number"
                        min={0}
                        value={editing.stock ?? ""}
                        onChange={(e) => setEditing({ ...editing, stock: e.target.value ? parseInt(e.target.value) : null })}
                        className={INPUT_CLS}
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Tier">
                      <div className="flex gap-2">
                        {(["common", "elite", "legendary"] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setEditing({ ...editing, tier: t })}
                            className={`flex-1 py-2 rounded-lg text-xs gladiator-label uppercase transition-all cursor-pointer border
                              ${editing.tier === t
                                ? t === "common"
                                  ? "bg-arena-steel/30 border-arena-smoke/40 text-arena-white"
                                  : t === "elite"
                                    ? "bg-arena-gold/15 border-arena-gold/40 text-arena-gold"
                                    : "bg-arena-crimson/15 border-arena-red/40 text-arena-red"
                                : "bg-transparent border-white/10 text-arena-ash hover:border-white/20"
                              }`}
                          >
                            {t === "common" ? "⚔️" : t === "elite" ? "🏆" : "👑"} {t}
                          </button>
                        ))}
                      </div>
                    </Field>

                    <Field label="Tipo">
                      <div className="flex flex-wrap gap-2">
                        {(["deposit", "ticket", "gift", "cash", "custom"] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setEditing({ ...editing, type: t })}
                            className={`px-3 py-2 rounded-lg text-xs gladiator-label uppercase transition-all cursor-pointer border
                              ${editing.type === t
                                ? "bg-arena-gold/15 border-arena-gold/30 text-arena-gold"
                                : "bg-transparent border-white/10 text-arena-ash hover:border-white/20"
                              }`}
                          >
                            {t === "deposit" ? "💰" : t === "ticket" ? "🎟️" : t === "gift" ? "🎁" : t === "cash" ? "💵" : "⚡"} {t}
                          </button>
                        ))}
                      </div>
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Cooldown (horas)">
                      <input
                        type="number"
                        min={0}
                        value={editing.cooldown ?? ""}
                        onChange={(e) => setEditing({ ...editing, cooldown: e.target.value ? parseInt(e.target.value) : null })}
                        className={INPUT_CLS}
                      />
                    </Field>

                    <Field label="Ordem">
                      <input
                        type="number"
                        value={editing.sort_order}
                        onChange={(e) => setEditing({ ...editing, sort_order: parseInt(e.target.value) || 0 })}
                        className={INPUT_CLS}
                      />
                    </Field>
                  </div>

                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 text-sm text-arena-smoke cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editing.vip_only}
                        onChange={(e) => setEditing({ ...editing, vip_only: e.target.checked, vip_level_required: e.target.checked ? 1 : null })}
                        className="rounded border-white/20"
                      />
                      Apenas VIP
                    </label>

                    {editing.vip_only && (
                      <Field label="Nível mínimo">
                        <div className="flex gap-2">
                          {([
                            { v: 1, label: "Warrior", icon: "🗡️" },
                            { v: 2, label: "Champion", icon: "🏆" },
                            { v: 3, label: "Legend", icon: "👑" },
                          ] as const).map((l) => (
                            <button
                              key={l.v}
                              type="button"
                              onClick={() => setEditing({ ...editing, vip_level_required: l.v })}
                              className={`px-3 py-1.5 rounded-lg text-xs gladiator-label transition-all cursor-pointer border
                                ${(editing.vip_level_required ?? 1) === l.v
                                  ? "bg-arena-gold/15 border-arena-gold/30 text-arena-gold"
                                  : "bg-transparent border-white/10 text-arena-ash hover:border-white/20"
                                }`}
                            >
                              {l.icon} {l.label}
                            </button>
                          ))}
                        </div>
                      </Field>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-white/[0.06]">
                  <button
                    onClick={() => setEditing(null)}
                    className="px-4 py-2 rounded-lg text-sm text-arena-smoke hover:bg-white/5 transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !editing.title.trim()}
                    className="px-5 py-2 rounded-lg bg-arena-crimson hover:bg-arena-red text-white text-sm gladiator-label disabled:opacity-40 transition-all cursor-pointer"
                  >
                    {saving ? "A guardar..." : editing.id ? "Guardar" : "Criar"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Rewards Table */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 bg-white/[0.03] animate-pulse rounded-lg" />
            ))}
          </div>
        ) : rewards.length === 0 && !editing ? (
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-10 text-center">
            <p className="text-arena-ash">Nenhuma recompensa criada</p>
          </div>
        ) : rewards.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left gladiator-label text-xs text-arena-ash">
                  <th className="pb-3 pr-4">Título</th>
                  <th className="pb-3 pr-4">Tier</th>
                  <th className="pb-3 pr-4">Tipo</th>
                  <th className="pb-3 pr-4">Custo</th>
                  <th className="pb-3 pr-4">Stock</th>
                  <th className="pb-3 pr-4">VIP</th>
                  <th className="pb-3 pr-4">Ativa</th>
                  <th className="pb-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rewards.map((r) => (
                  <tr key={r.id} className="border-b border-white/[0.05] hover:bg-white/[0.02]">
                    <td className="py-3 pr-4 text-arena-white">{r.title}</td>
                    <td className={`py-3 pr-4 gladiator-label text-xs uppercase ${tierColors[r.tier]}`}>
                      {r.tier}
                    </td>
                    <td className="py-3 pr-4 text-arena-smoke">{r.type}</td>
                    <td className="py-3 pr-4 text-arena-gold">{r.cost.toLocaleString()}</td>
                    <td className="py-3 pr-4 text-arena-smoke">{r.stock ?? "∞"}</td>
                    <td className="py-3 pr-4 text-arena-smoke">
                      {r.vip_only ? `Nível ${r.vip_level_required}` : "—"}
                    </td>
                    <td className="py-3 pr-4">
                      <button
                        onClick={() => handleToggle(r)}
                        className={`w-9 h-5 rounded-full transition-colors cursor-pointer ${r.active ? "bg-green-600" : "bg-arena-steel/40"}`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${r.active ? "translate-x-4" : "translate-x-0.5"}`} />
                      </button>
                    </td>
                    <td className="py-3 flex gap-2">
                      <button
                        onClick={() => setEditing({ ...r })}
                        className="px-2 py-1 text-xs rounded bg-arena-steel/20 hover:bg-arena-steel/40 text-arena-smoke transition-all cursor-pointer"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="px-2 py-1 text-xs rounded bg-red-900/30 hover:bg-red-900/50 text-red-400 transition-all cursor-pointer"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-xl border border-arena-gold/20 bg-arena-dark/90 backdrop-blur-lg gladiator-label text-sm text-arena-gold"
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs gladiator-label text-arena-ash mb-1.5">{label}</label>
      {children}
    </div>
  );
}
