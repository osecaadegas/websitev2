"use client";

import { useEffect, useState } from "react";

interface Battle {
  id: string;
  attacker_name: string;
  attacker_avatar?: string;
  defender_name: string;
  defender_avatar?: string;
  winner_id: string;
  attacker_id: string;
  attacker_score: number;
  defender_score: number;
  loot_type: "cash" | "crypto";
  loot_amount: number;
  created_at: string;
}

interface Settings {
  pvp_enabled: boolean;
  cooldown_minutes: number;
  min_loot_percent: number;
  max_loot_percent: number;
  hp_after_loss_percent: number;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return "agora";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m atrás`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h atrás`;
  return new Date(dateStr).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function AdminPvpPage() {
  const [battles, setBattles] = useState<Battle[]>([]);
  const [settings, setSettings] = useState<Settings>({
    pvp_enabled: true,
    cooldown_minutes: 10,
    min_loot_percent: 5,
    max_loot_percent: 20,
    hp_after_loss_percent: 10,
  });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  const fetchData = async (p = page) => {
    setLoading(true);
    const res = await fetch(`/api/admin/crime-empire/pvp?page=${p}`);
    const data = await res.json();
    setBattles(data.battles ?? []);
    setSettings(data.settings ?? settings);
    setTotal(data.total ?? 0);
    setLoading(false);
  };

  useEffect(() => { fetchData(page); }, [page]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/crime-empire/pvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_settings", ...settings }),
      });
      const data = await res.json();
      if (!data.success) alert(data.error || "Erro");
    } finally {
      setSaving(false);
    }
  };

  const deleteBattle = async (id: string) => {
    await fetch("/api/admin/crime-empire/pvp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_battle", battleId: id }),
    });
    setBattles((prev) => prev.filter((b) => b.id !== id));
    setTotal((t) => t - 1);
  };

  const clearAllBattles = async () => {
    if (!confirm("Apagar TODOS os logs de batalha? Esta ação é irreversível.")) return;
    setClearing(true);
    await fetch("/api/admin/crime-empire/pvp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear_all_battles" }),
    });
    setBattles([]);
    setTotal(0);
    setClearing(false);
  };

  const clearChat = async () => {
    if (!confirm("Apagar todo o chat da arena?")) return;
    await fetch("/api/admin/crime-empire/pvp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear_chat" }),
    });
    alert("Chat limpo.");
  };

  const totalPages = Math.max(1, Math.ceil(total / 40));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">⚔️ PvP Arena — Admin</h1>
          <p className="text-[#555] text-sm mt-1">{total} batalhas registadas</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={clearChat}
            className="px-4 py-2 rounded-lg bg-[#1a1a1a] hover:bg-[#222] border border-[#333] text-[#888] text-sm font-medium transition-all"
          >
            Limpar Chat
          </button>
          <button
            onClick={clearAllBattles}
            disabled={clearing}
            className="px-4 py-2 rounded-lg bg-red-900/20 hover:bg-red-900/40 border border-red-800 text-red-400 text-sm font-bold transition-all disabled:opacity-50"
          >
            {clearing ? "A apagar…" : "Apagar Todos os Logs"}
          </button>
        </div>
      </div>

      {/* Settings */}
      <div className="p-5 rounded-xl bg-[#121212] border border-[#222]">
        <h2 className="text-lg font-bold text-white mb-4">⚙️ Configurações PvP</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {/* PvP Enabled Toggle */}
          <div className="p-4 rounded-lg bg-[#1a1a1a] border border-[#222]">
            <label className="text-xs text-[#888] font-bold mb-2 block">ESTADO</label>
            <button
              onClick={() => setSettings((s) => ({ ...s, pvp_enabled: !s.pvp_enabled }))}
              className={`w-full py-2 rounded-lg font-bold text-sm border transition-all ${
                settings.pvp_enabled
                  ? "bg-green-900/30 border-green-700 text-green-400"
                  : "bg-red-900/30 border-red-700 text-red-400"
              }`}
            >
              {settings.pvp_enabled ? "✅ PvP Ativo" : "⛔ PvP Desativado"}
            </button>
          </div>

          {/* Cooldown */}
          <div className="p-4 rounded-lg bg-[#1a1a1a] border border-[#222]">
            <label className="text-xs text-[#888] font-bold mb-2 block">COOLDOWN (minutos)</label>
            <input
              type="number"
              min={0}
              max={1440}
              value={settings.cooldown_minutes}
              onChange={(e) => setSettings((s) => ({ ...s, cooldown_minutes: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 rounded-lg bg-[#222] border border-[#333] text-white text-sm focus:outline-none focus:border-[#ff6a00]"
            />
          </div>

          {/* Min Loot % */}
          <div className="p-4 rounded-lg bg-[#1a1a1a] border border-[#222]">
            <label className="text-xs text-[#888] font-bold mb-2 block">SAQUE MÍNIMO (%)</label>
            <input
              type="number"
              min={1}
              max={50}
              step={0.5}
              value={settings.min_loot_percent}
              onChange={(e) => setSettings((s) => ({ ...s, min_loot_percent: parseFloat(e.target.value) || 5 }))}
              className="w-full px-3 py-2 rounded-lg bg-[#222] border border-[#333] text-white text-sm focus:outline-none focus:border-[#ff6a00]"
            />
          </div>

          {/* Max Loot % */}
          <div className="p-4 rounded-lg bg-[#1a1a1a] border border-[#222]">
            <label className="text-xs text-[#888] font-bold mb-2 block">SAQUE MÁXIMO (%)</label>
            <input
              type="number"
              min={1}
              max={90}
              step={0.5}
              value={settings.max_loot_percent}
              onChange={(e) => setSettings((s) => ({ ...s, max_loot_percent: parseFloat(e.target.value) || 20 }))}
              className="w-full px-3 py-2 rounded-lg bg-[#222] border border-[#333] text-white text-sm focus:outline-none focus:border-[#ff6a00]"
            />
          </div>

          {/* HP after loss */}
          <div className="p-4 rounded-lg bg-[#1a1a1a] border border-[#222]">
            <label className="text-xs text-[#888] font-bold mb-2 block">HP APÓS DERROTA (% do max)</label>
            <input
              type="number"
              min={1}
              max={50}
              step={1}
              value={settings.hp_after_loss_percent}
              onChange={(e) => setSettings((s) => ({ ...s, hp_after_loss_percent: parseFloat(e.target.value) || 10 }))}
              className="w-full px-3 py-2 rounded-lg bg-[#222] border border-[#333] text-white text-sm focus:outline-none focus:border-[#ff6a00]"
            />
          </div>
        </div>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="px-6 py-2.5 rounded-lg bg-[#ff6a00] hover:bg-[#ff8533] text-white font-bold text-sm transition-all disabled:opacity-50"
        >
          {saving ? "A guardar…" : "💾 Guardar Configurações"}
        </button>
      </div>

      {/* Battle Log */}
      <div className="rounded-xl bg-[#121212] border border-[#222] overflow-hidden">
        <div className="p-4 border-b border-[#222]">
          <h2 className="font-bold text-white">📋 Log de Batalhas</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-[#555]">A carregar…</div>
        ) : battles.length === 0 ? (
          <div className="p-8 text-center text-[#555]">Nenhuma batalha registada.</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-[#1a1a1a] text-[#555] uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Atacante</th>
                <th className="px-4 py-3 text-left">Defensor</th>
                <th className="px-4 py-3 text-left">Vencedor</th>
                <th className="px-4 py-3 text-right">Scores</th>
                <th className="px-4 py-3 text-right">Saque</th>
                <th className="px-4 py-3 text-right">Data</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a1a]">
              {battles.map((b) => {
                const attackerWon = b.winner_id === b.attacker_id;
                return (
                  <tr key={b.id} className="hover:bg-[#181818] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {b.attacker_avatar && <img src={b.attacker_avatar} alt="" className="w-6 h-6 rounded-full" />}
                        <span className={`font-medium ${attackerWon ? "text-green-400" : "text-red-400"}`}>{b.attacker_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {b.defender_avatar && <img src={b.defender_avatar} alt="" className="w-6 h-6 rounded-full" />}
                        <span className={`font-medium ${!attackerWon ? "text-green-400" : "text-red-400"}`}>{b.defender_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-green-400 font-bold">
                        🏆 {attackerWon ? b.attacker_name : b.defender_name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-[#666]">
                      {b.attacker_score} vs {b.defender_score}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {b.loot_amount > 0 ? (
                        <span className="text-yellow-400 font-bold">
                          {b.loot_amount.toLocaleString()} {b.loot_type === "cash" ? "💰" : "₿"}
                        </span>
                      ) : (
                        <span className="text-[#444]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-[#555]">{timeAgo(b.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => deleteBattle(b.id)}
                        className="text-red-600 hover:text-red-400 transition-colors text-xs"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-[#1a1a1a] flex items-center justify-between">
            <span className="text-xs text-[#555]">Página {page} de {totalPages}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#222] text-[#888] text-xs hover:bg-[#222] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                ← Anterior
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#222] text-[#888] text-xs hover:bg-[#222] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Seguinte →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
