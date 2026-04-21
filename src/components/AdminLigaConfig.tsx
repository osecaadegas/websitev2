"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ── Types ─────────────────────────────────────────────── */
interface LeaderboardYear {
  id: string;
  year: number;
  is_active: boolean;
  is_locked: boolean;
  created_at: string;
}

interface LeaderboardEntry {
  id: string;
  year_id: string;
  month: number;
  winner_name: string;
  winner_avatar: string | null;
  updated_at: string;
}

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril",
  "Maio", "Junho", "Julho", "Agosto",
  "Setembro", "Outubro", "Novembro", "Dezembro",
];

/* ── Toast ─────────────────────────────────────────────── */
function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
        type === "success"
          ? "bg-green-900/90 text-green-200 border border-green-700/50"
          : "bg-red-900/90 text-red-200 border border-red-700/50"
      }`}
    >
      {message}
    </motion.div>
  );
}

/* ── Main Component ────────────────────────────────────── */
export default function AdminLigaConfig() {
  const [years, setYears] = useState<LeaderboardYear[]>([]);
  const [selectedYear, setSelectedYear] = useState<LeaderboardYear | null>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [newYearInput, setNewYearInput] = useState("");
  const [cloneTarget, setCloneTarget] = useState("");
  const [showClone, setShowClone] = useState(false);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
  }, []);

  /* ── Fetch ────────────────────────────────────────── */
  const fetchYears = useCallback(async () => {
    const res = await fetch("/api/leaderboard?list=true");
    const data = await res.json();
    return (data.years ?? []) as LeaderboardYear[];
  }, []);

  const fetchEntries = useCallback(async (year: LeaderboardYear) => {
    const res = await fetch(`/api/leaderboard?year=${year.year}`);
    const data = await res.json();
    setSelectedYear(data.year as LeaderboardYear);
    setEntries((data.entries ?? []) as LeaderboardEntry[]);
  }, []);

  const reload = useCallback(async (selectYear?: number) => {
    setLoading(true);
    const yrs = await fetchYears();
    setYears(yrs);
    const target = selectYear ? yrs.find((y) => y.year === selectYear) : yrs[0];
    if (target) {
      await fetchEntries(target);
    } else {
      setSelectedYear(null);
      setEntries([]);
    }
    setLoading(false);
  }, [fetchYears, fetchEntries]);

  useEffect(() => { reload(); }, [reload]);

  /* ── Actions ──────────────────────────────────────── */
  const createYear = async () => {
    const year = parseInt(newYearInput);
    if (!year || year < 2020 || year > 2100) {
      showToast("Ano inválido", "error");
      return;
    }
    const res = await fetch("/api/leaderboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_year", year }),
    });
    if (res.ok) {
      showToast(`Ano ${year} criado`, "success");
      setNewYearInput("");
      await reload(year);
    } else {
      const data = await res.json();
      showToast(data.error ?? "Erro ao criar", "error");
    }
  };

  const setActive = async (yearId: string) => {
    const res = await fetch("/api/leaderboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_active", year_id: yearId }),
    });
    if (res.ok) {
      showToast("Ano ativo atualizado", "success");
      await reload(selectedYear?.year);
    } else {
      showToast("Erro ao definir ano ativo", "error");
    }
  };

  const toggleLock = async (yearId: string) => {
    const res = await fetch("/api/leaderboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_lock", year_id: yearId }),
    });
    if (res.ok) {
      showToast("Estado de bloqueio atualizado", "success");
      await reload(selectedYear?.year);
    } else {
      showToast("Erro ao alterar bloqueio", "error");
    }
  };

  const deleteYear = async (yearId: string, yearNum: number) => {
    if (!confirm(`Eliminar o ano ${yearNum} e todos os dados?`)) return;
    const res = await fetch("/api/leaderboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_year", year_id: yearId }),
    });
    if (res.ok) {
      showToast(`Ano ${yearNum} eliminado`, "success");
      await reload();
    } else {
      showToast("Erro ao eliminar", "error");
    }
  };

  const cloneYear = async () => {
    if (!selectedYear) return;
    const target = parseInt(cloneTarget);
    if (!target || target < 2020 || target > 2100) {
      showToast("Ano alvo inválido", "error");
      return;
    }
    const res = await fetch("/api/leaderboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clone_year", source_year_id: selectedYear.id, target_year: target }),
    });
    if (res.ok) {
      showToast(`Ano clonado para ${target}`, "success");
      setCloneTarget("");
      setShowClone(false);
      await reload(target);
    } else {
      const data = await res.json();
      showToast(data.error ?? "Erro ao clonar", "error");
    }
  };

  const updateEntry = async (entryId: string, winnerName: string, winnerAvatar: string) => {
    setSaving(entryId);
    const res = await fetch("/api/leaderboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_entry", entry_id: entryId, winner_name: winnerName, winner_avatar: winnerAvatar }),
    });
    setSaving(null);
    if (res.ok) {
      const data = await res.json();
      setEntries((prev) => prev.map((e) => (e.id === entryId ? data.entry : e)));
      showToast("Entrada atualizada", "success");
    } else {
      showToast("Erro ao atualizar", "error");
    }
  };

  /* ── Render ───────────────────────────────────────── */
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-arena-gold font-[family-name:var(--font-display)] tracking-wider">
          Liga dos Secas
        </h1>
        <p className="text-sm text-arena-smoke mt-1">Gerir vencedores mensais por ano</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-arena-gold">{years.length}</p>
          <p className="text-xs text-arena-smoke">Anos</p>
        </div>
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-400">
            {entries.filter((e) => e.winner_name).length}
          </p>
          <p className="text-xs text-arena-smoke">Preenchidos</p>
        </div>
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-arena-smoke">
            {entries.filter((e) => !e.winner_name).length}
          </p>
          <p className="text-xs text-arena-smoke">Vazios</p>
        </div>
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-arena-gold">
            {selectedYear?.is_active ? "✓" : "—"}
          </p>
          <p className="text-xs text-arena-smoke">Ativo</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: Years Panel ────────────────── */}
        <div className="lg:col-span-1 space-y-4">
          {/* Create Year */}
          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-arena-gold mb-3 font-[family-name:var(--font-display)] tracking-wider">
              Criar Ano
            </h3>
            <div className="flex gap-2">
              <input
                type="number"
                value={newYearInput}
                onChange={(e) => setNewYearInput(e.target.value)}
                placeholder="Ex: 2025"
                className="flex-1 bg-arena-iron/60 border border-arena-gold/15 rounded-lg px-3 py-2.5 text-sm text-arena-white placeholder:text-white/30 focus:outline-none focus:border-arena-gold/40"
              />
              <button
                onClick={createYear}
                className="bg-gradient-to-r from-arena-crimson to-red-800 hover:from-red-700 hover:to-red-600 text-white font-bold px-4 py-2 rounded-lg text-sm transition-all"
              >
                +
              </button>
            </div>
          </div>

          {/* Years List */}
          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-arena-gold mb-3 font-[family-name:var(--font-display)] tracking-wider">
              Anos
            </h3>
            {loading ? (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-arena-gold/30 border-t-arena-gold rounded-full animate-spin" />
              </div>
            ) : years.length === 0 ? (
              <p className="text-sm text-arena-smoke text-center py-4">Nenhum ano criado</p>
            ) : (
              <div className="space-y-2">
                {years.map((y) => (
                  <div
                    key={y.id}
                    onClick={() => fetchEntries(y)}
                    className={`relative cursor-pointer rounded-lg p-3 border transition-all ${
                      selectedYear?.id === y.id
                        ? "bg-arena-gold/10 border-arena-gold/30"
                        : "bg-white/[0.02] border-white/5 hover:border-white/15"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-arena-white">{y.year}</span>
                        {y.is_active && (
                          <span className="text-[10px] bg-green-900/50 text-green-400 px-1.5 py-0.5 rounded">ATIVO</span>
                        )}
                        {y.is_locked && (
                          <span className="text-[10px] bg-yellow-900/50 text-yellow-400 px-1.5 py-0.5 rounded">🔒</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); setActive(y.id); }}
                          title="Definir como ativo"
                          className="p-1.5 rounded hover:bg-white/10 text-arena-smoke hover:text-green-400 transition-colors text-xs"
                        >
                          ✓
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleLock(y.id); }}
                          title="Bloquear / Desbloquear"
                          className="p-1.5 rounded hover:bg-white/10 text-arena-smoke hover:text-yellow-400 transition-colors text-xs"
                        >
                          {y.is_locked ? "🔓" : "🔒"}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteYear(y.id, y.year); }}
                          title="Eliminar"
                          className="p-1.5 rounded hover:bg-white/10 text-arena-smoke hover:text-red-400 transition-colors text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Clone */}
          {selectedYear && (
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
              <button
                onClick={() => setShowClone(!showClone)}
                className="text-sm text-arena-smoke hover:text-arena-gold transition-colors w-full text-left"
              >
                📋 Clonar {selectedYear.year} para outro ano
              </button>
              <AnimatePresence>
                {showClone && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex gap-2 mt-3">
                      <input
                        type="number"
                        value={cloneTarget}
                        onChange={(e) => setCloneTarget(e.target.value)}
                        placeholder="Ano alvo"
                        className="flex-1 bg-arena-iron/60 border border-arena-gold/15 rounded-lg px-3 py-2 text-sm text-arena-white placeholder:text-white/30 focus:outline-none focus:border-arena-gold/40"
                      />
                      <button
                        onClick={cloneYear}
                        className="bg-arena-gold/20 border border-arena-gold/30 text-arena-gold px-3 py-2 rounded-lg text-sm hover:bg-arena-gold/30 transition-all"
                      >
                        Clonar
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* ── Right: Monthly Entries ───────────── */}
        <div className="lg:col-span-2">
          {!selectedYear ? (
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-8 text-center">
              <p className="text-arena-smoke">Seleciona ou cria um ano para editar</p>
            </div>
          ) : (
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-arena-gold font-[family-name:var(--font-display)] tracking-wider">
                  Vencedores — {selectedYear.year}
                </h3>
                {selectedYear.is_locked && (
                  <span className="text-xs text-yellow-400/80">🔒 Ano bloqueado (só leitura)</span>
                )}
              </div>

              <div className="space-y-2">
                {entries.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    locked={selectedYear.is_locked}
                    saving={saving === entry.id}
                    onSave={updateEntry}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Entry Row ─────────────────────────────────────────── */
function EntryRow({
  entry,
  locked,
  saving,
  onSave,
}: {
  entry: LeaderboardEntry;
  locked: boolean;
  saving: boolean;
  onSave: (id: string, name: string, avatar: string) => void;
}) {
  const [name, setName] = useState(entry.winner_name);
  const [avatar, setAvatar] = useState(entry.winner_avatar ?? "");
  const changed = name !== entry.winner_name || avatar !== (entry.winner_avatar ?? "");
  const currentMonth = new Date().getMonth() + 1;
  const isCurrent = entry.month === currentMonth;

  return (
    <div
      className={`flex items-center gap-3 rounded-lg p-3 border transition-all ${
        isCurrent
          ? "bg-arena-gold/[0.06] border-arena-gold/20"
          : "bg-white/[0.02] border-white/5"
      }`}
    >
      <span className={`text-xs font-[family-name:var(--font-display)] tracking-wider w-20 shrink-0 ${
        isCurrent ? "text-arena-gold font-bold" : "text-arena-smoke"
      }`}>
        {MONTH_NAMES[entry.month - 1]}
      </span>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={locked}
        placeholder="Nome do vencedor"
        className="flex-1 bg-arena-iron/40 border border-arena-gold/10 rounded-lg px-3 py-2 text-sm text-arena-white placeholder:text-white/20 focus:outline-none focus:border-arena-gold/30 disabled:opacity-40"
      />

      <input
        value={avatar}
        onChange={(e) => setAvatar(e.target.value)}
        disabled={locked}
        placeholder="URL avatar (opcional)"
        className="w-40 bg-arena-iron/40 border border-arena-gold/10 rounded-lg px-3 py-2 text-sm text-arena-white placeholder:text-white/20 focus:outline-none focus:border-arena-gold/30 disabled:opacity-40 hidden sm:block"
      />

      {avatar && (
        <img src={avatar} alt="" className="w-7 h-7 rounded-full object-cover border border-arena-gold/20" />
      )}

      <button
        onClick={() => onSave(entry.id, name, avatar)}
        disabled={locked || !changed || saving}
        className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
          changed && !locked
            ? "bg-gradient-to-r from-arena-crimson to-red-800 hover:from-red-700 hover:to-red-600 text-white"
            : "bg-white/5 text-white/20 cursor-not-allowed"
        }`}
      >
        {saving ? "..." : "Salvar"}
      </button>
    </div>
  );
}
