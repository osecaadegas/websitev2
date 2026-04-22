"use client";

import { useEffect, useState, useCallback } from "react";
import { CEToast } from "@/components/CEToast";

// ─── Types ────────────────────────────────────────────────────
type Player = {
  id: string; username: string; display_name: string; avatar_url: string;
  level: number; xp: number; hp: number; max_hp: number;
  stamina: number; max_stamina: number; cash: number; dirty_cash: number;
  vcash: number; class: string; respect: number; in_jail: boolean;
  addiction: number; power: number; intelligence: number; charisma: number;
  created_at: string; last_login: string;
};

type Logs = {
  businesses: any[];
  brothel: any[];
  crime_attempts: any[];
  jail_records: any[];
  pvp_history: any[];
  inventory: any[];
  gambling_history: any[];
  player_stats: any;
  summary: {
    income_per_hour: number;
    total_crimes: number; crimes_success: number; crimes_failed: number;
    times_jailed: number; bribes_attempted: number; bribes_success: number;
    pvp_wins: number; pvp_losses: number; pvp_total: number;
    jail_from_crimes: number;
    gambling: {
      total_bets: number; total_wagered: number; total_profit: number;
      by_game: Record<string, { count: number; profit: number; wagered: number }>;
    };
  };
};

type Action = "give_cash" | "take_cash" | "give_dirty_cash" | "take_dirty_cash" | "heal" | "free_jail" | "set_addiction";

const CLASS_COLORS: Record<string, string> = {
  thief: "text-yellow-400", hooligan: "text-blue-400", businessman: "text-green-400",
  hitman: "text-red-400", scammer: "text-purple-400", brute: "text-orange-400",
  dealer: "text-cyan-400", pimp: "text-pink-400",
};

const DIFF_COLOR: Record<string, string> = {
  petty: "text-[#888]", small: "text-blue-400", medium: "text-yellow-400",
  big: "text-orange-400", legendary: "text-red-400",
};

function fmt(n: number) { return n.toLocaleString("pt-PT"); }
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// ─── Sub-components ────────────────────────────────────────────
function StatCard({ label, value, color = "text-white" }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-[#141414] rounded-lg px-3 py-2.5">
      <p className="text-[#444] text-xs mb-0.5">{label}</p>
      <p className={`font-bold text-sm ${color}`}>{value}</p>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-bold uppercase tracking-widest text-[#ff6a00] mb-3">{children}</p>;
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-[#333] text-sm text-center py-6">{text}</p>;
}

// ─── Tab: Overview ────────────────────────────────────────────
function TabOverview({ player, logs }: { player: Player; logs: Logs }) {
  const s = logs.summary;
  return (
    <div className="space-y-5">
      {/* Financial */}
      <div>
        <SectionHeader>💰 Financeiro</SectionHeader>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <StatCard label="Cash Limpo" value={`💵 ${fmt(player.cash)}`} color="text-green-400" />
          <StatCard label="Cash Sujo" value={`💰 ${fmt(player.dirty_cash)}`} color="text-yellow-400" />
          <StatCard label="vCash" value={`🪙 ${fmt(player.vcash)}`} color="text-purple-400" />
          <StatCard label="Renda/hora (estimada)" value={`💵 ${fmt(s.income_per_hour)}/h`} color={s.income_per_hour >= 0 ? "text-green-400" : "text-red-400"} />
          <StatCard label="Negócios" value={logs.businesses.length} />
          <StatCard label="Prostitutas" value={logs.brothel.length} />
        </div>
      </div>

      {/* Combat / Crime */}
      <div>
        <SectionHeader>⚔️ Crime & Combate</SectionHeader>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <StatCard label="Crimes tentados" value={s.total_crimes} />
          <StatCard label="Crimes bem-suc." value={`${s.crimes_success} (${s.total_crimes > 0 ? Math.round((s.crimes_success / s.total_crimes) * 100) : 0}%)`} color="text-green-400" />
          <StatCard label="Crimes falhados" value={s.crimes_failed} color="text-red-400" />
          <StatCard label="Vezes preso" value={s.times_jailed} color={s.times_jailed > 5 ? "text-red-400" : "text-white"} />
          <StatCard label="Subornos tent." value={s.bribes_attempted} />
          <StatCard label="Subornos suc." value={`${s.bribes_success} / ${s.bribes_attempted}`} color="text-yellow-400" />
        </div>
      </div>

      {/* PvP */}
      <div>
        <SectionHeader>🥊 PvP</SectionHeader>
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Vitórias" value={s.pvp_wins} color="text-green-400" />
          <StatCard label="Derrotas" value={s.pvp_losses} color="text-red-400" />
          <StatCard label="Taxa V/D" value={s.pvp_total > 0 ? `${Math.round((s.pvp_wins / s.pvp_total) * 100)}%` : "—"} />
        </div>
      </div>

      {/* Gambling */}
      <div>
        <SectionHeader>🎰 Jogo</SectionHeader>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <StatCard label="Total apostas" value={s.gambling.total_bets} />
          <StatCard label="Total apostado" value={`💵 ${fmt(Math.round(s.gambling.total_wagered))}`} />
          <StatCard label="Lucro/Perda total" value={`${s.gambling.total_profit >= 0 ? "+" : ""}${fmt(Math.round(s.gambling.total_profit))}`}
            color={s.gambling.total_profit >= 0 ? "text-green-400" : "text-red-400"} />
        </div>
        {Object.entries(s.gambling.by_game).length > 0 && (
          <div className="mt-2 space-y-1">
            {Object.entries(s.gambling.by_game).map(([game, g]) => (
              <div key={game} className="flex items-center justify-between bg-[#141414] rounded-lg px-3 py-2 text-xs">
                <span className="text-white font-medium capitalize">{game}</span>
                <span className="text-[#555]">{g.count}x</span>
                <span className="text-[#555]">apostado: {fmt(Math.round(g.wagered))}</span>
                <span className={g.profit >= 0 ? "text-green-400" : "text-red-400"}>{g.profit >= 0 ? "+" : ""}{fmt(Math.round(g.profit))}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats bars */}
      <div>
        <SectionHeader>📊 Status</SectionHeader>
        <div className="space-y-2">
          {[
            { label: "❤️ HP", val: player.hp, max: player.max_hp, color: "bg-red-500" },
            { label: "⚡ Stamina", val: player.stamina, max: player.max_stamina, color: "bg-yellow-500" },
            { label: "💊 Vício", val: player.addiction || 0, max: 100, color: "bg-purple-500" },
          ].map(bar => (
            <div key={bar.label}>
              <div className="flex justify-between text-xs text-[#444] mb-1">
                <span>{bar.label}</span><span>{bar.val}/{bar.max}</span>
              </div>
              <div className="h-2 bg-[#1a1a1a] rounded-full">
                <div className={`h-full rounded-full ${bar.color}`} style={{ width: `${(bar.val / bar.max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Businesses ──────────────────────────────────────────
function TabBusinesses({ logs }: { logs: Logs }) {
  const bizzes = logs.businesses;
  if (bizzes.length === 0) return <EmptyState text="Nenhum negócio" />;
  return (
    <div className="space-y-2">
      {bizzes.map((b: any) => {
        const biz = b.business || {};
        const gross = Math.round(biz.base_income_per_hour * b.income_multiplier * b.upgrade_level);
        const costs = b.employees * (biz.employee_cost_per_hour || 0);
        const net = gross - costs;
        return (
          <div key={b.id} className="bg-[#141414] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-white font-bold">{biz.name}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${b.active ? "bg-green-600/20 text-green-400" : "bg-[#1a1a1a] text-[#444]"}`}>
                {b.active ? "ATIVO" : "INATIVO"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-[#0e0e0e] rounded-lg px-2 py-1.5">
                <p className="text-[#444]">Trabalhadores</p>
                <p className="text-white font-bold">{b.employees}/{b.max_employees}</p>
              </div>
              <div className="bg-[#0e0e0e] rounded-lg px-2 py-1.5">
                <p className="text-[#444]">Nível Upgrade</p>
                <p className="text-white font-bold">{b.upgrade_level}</p>
              </div>
              <div className="bg-[#0e0e0e] rounded-lg px-2 py-1.5">
                <p className="text-[#444]">Renda Líq./h</p>
                <p className={`font-bold ${net >= 0 ? "text-green-400" : "text-red-400"}`}>{fmt(net)}</p>
              </div>
            </div>
            <p className="text-[#333] text-xs mt-2">Desde: {fmtDate(b.purchased_at)} · Última cobrança: {fmtDate(b.last_collection)}</p>
          </div>
        );
      })}

      {/* Brothel section */}
      {logs.brothel.length > 0 && (
        <div className="mt-4">
          <SectionHeader>💃 Bordel ({logs.brothel.length} trabalhadoras)</SectionHeader>
          <div className="space-y-1.5">
            {logs.brothel.map((w: any) => (
              <div key={w.id} className="flex items-center justify-between bg-[#141414] rounded-lg px-3 py-2 text-xs">
                <span className="text-white font-medium">{w.name}</span>
                <span className={`px-2 py-0.5 rounded-full font-bold ${w.status === "healthy" ? "bg-green-600/20 text-green-400" : w.status === "sick" ? "bg-red-600/20 text-red-400" : "bg-yellow-600/20 text-yellow-400"}`}>
                  {w.status}
                </span>
                <span className="text-green-400">{fmt(w.income_per_hour)}/h</span>
                <span className="text-[#444]">desde {fmtDate(w.hired_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Crimes ──────────────────────────────────────────────
function TabCrimes({ logs, playerId }: { logs: Logs; playerId: string }) {
  const crimes = logs.crime_attempts;
  if (crimes.length === 0) return <EmptyState text="Nenhum crime registado" />;
  return (
    <div>
      <div className="space-y-1">
        {crimes.map((c: any) => (
          <div key={c.id} className="flex items-center gap-2 bg-[#141414] rounded-lg px-3 py-2 text-xs">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.success ? "bg-green-500" : "bg-red-500"}`} />
            <span className="text-white flex-1 truncate">{(c.crime as any)?.name || "?"}</span>
            <span className={`text-xs ${DIFF_COLOR[(c.crime as any)?.difficulty] || "text-[#555]"}`}>{(c.crime as any)?.difficulty}</span>
            {c.success && <span className="text-green-400">+{fmt(c.dirty_cash_earned)}</span>}
            {c.went_to_jail && <span className="text-red-400">PRESO</span>}
            <span className="text-[#333]">{fmtDate(c.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: Jail ────────────────────────────────────────────────
function TabJail({ logs }: { logs: Logs }) {
  const records = logs.jail_records;
  if (records.length === 0) return <EmptyState text="Nunca foi preso" />;
  return (
    <div className="space-y-2">
      {records.map((r: any) => (
        <div key={r.id} className="bg-[#141414] rounded-xl px-4 py-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-white text-sm font-medium">{(r.crime as any)?.name || "Crime desconhecido"}</span>
            <span className="text-[#555] text-xs">{fmtDate(r.created_at)}</span>
          </div>
          <div className="flex gap-3 text-xs flex-wrap">
            <span className="text-[#888]">⏱ {r.jail_time_minutes} min</span>
            {r.released_early ? (
              <span className="text-green-400">
                Saiu antes: {r.release_method === "bribe" ? `Suborno (💵${fmt(r.amount_paid || 0)})` : r.release_method === "fine" ? `Multa (💵${fmt(r.amount_paid || 0)})` : "Outros"}
              </span>
            ) : (
              <span className="text-[#444]">Cumpriu pena</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tab: PvP ─────────────────────────────────────────────────
function TabPvP({ logs, playerId }: { logs: Logs; playerId: string }) {
  const battles = logs.pvp_history;
  if (battles.length === 0) return <EmptyState text="Nenhum combate PvP" />;
  return (
    <div className="space-y-2">
      {battles.map((b: any) => {
        const isAttacker = b.attacker_id === playerId;
        const won = b.winner_id === playerId;
        const opponent = isAttacker ? (b.defender as any) : (b.attacker as any);
        return (
          <div key={b.id} className={`rounded-xl px-4 py-3 border ${won ? "bg-green-600/10 border-green-600/20" : "bg-red-600/10 border-red-600/20"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {opponent?.avatar_url && <img src={opponent.avatar_url} alt="" className="w-7 h-7 rounded-full" />}
                <div>
                  <p className="text-white text-sm font-medium">
                    {isAttacker ? "Atacou" : "Foi atacado por"} <span className="text-[#ff6a00]">{opponent?.username || "?"}</span>
                  </p>
                  <p className="text-[#555] text-xs">{fmtDate(b.created_at)}</p>
                </div>
              </div>
              <span className={`text-sm font-black ${won ? "text-green-400" : "text-red-400"}`}>{won ? "VITÓRIA" : "DERROTA"}</span>
            </div>
            {won && (
              <div className="flex gap-3 mt-2 text-xs text-[#555]">
                {b.dirty_cash_stolen > 0 && <span className="text-yellow-400">+💰 {fmt(b.dirty_cash_stolen)}</span>}
                {b.respect_gained > 0 && <span className="text-purple-400">+{b.respect_gained} respeito</span>}
                {b.xp_gained > 0 && <span className="text-blue-400">+{b.xp_gained} XP</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Tab: Gambling ────────────────────────────────────────────
function TabGambling({ logs }: { logs: Logs }) {
  const records = logs.gambling_history;
  if (records.length === 0) return <EmptyState text="Nunca jogou no casino" />;
  return (
    <div>
      <div className="space-y-1">
        {records.map((g: any) => (
          <div key={g.id} className="flex items-center gap-2 bg-[#141414] rounded-lg px-3 py-2 text-xs">
            <span className="text-white w-24 flex-shrink-0 font-medium capitalize">{g.game_type}</span>
            <span className="text-[#555]">Aposta: {fmt(g.bet_amount)}</span>
            <span className="text-[#555] flex-1">Payout: {fmt(g.payout)}</span>
            <span className={`font-bold w-20 text-right ${g.profit >= 0 ? "text-green-400" : "text-red-400"}`}>
              {g.profit >= 0 ? "+" : ""}{fmt(Math.round(g.profit))}
            </span>
            <span className="text-[#333]">{fmtDate(g.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: Inventory ───────────────────────────────────────────
function TabInventory({ logs }: { logs: Logs }) {
  const items = logs.inventory;
  if (items.length === 0) return <EmptyState text="Inventário vazio" />;
  const RARITY_COLOR: Record<string, string> = {
    common: "text-[#888]", rare: "text-blue-400", epic: "text-purple-400", legendary: "text-yellow-400",
  };
  return (
    <div className="space-y-1.5">
      {items.map((row: any) => {
        const item = row.item || {};
        return (
          <div key={row.id} className="flex items-center gap-2 bg-[#141414] rounded-lg px-3 py-2">
            <div className="w-8 h-8 rounded bg-[#1a1a1a] flex items-center justify-center flex-shrink-0 text-xs">🎒</div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{item.name}</p>
              <p className={`text-xs ${RARITY_COLOR[item.rarity] || "text-[#888]"}`}>{item.category} · {item.rarity}</p>
            </div>
            <div className="text-right text-xs space-y-0.5">
              {row.equipped && <span className="block text-[#ff6a00] font-bold">EQUIPADO</span>}
              <span className="text-white font-bold">x{row.quantity}</span>
              {item.base_price && <span className="block text-[#444]">💵{fmt(item.base_price * row.quantity)}</span>}
            </div>
            {(item.power_bonus > 0 || item.intelligence_bonus > 0 || item.charisma_bonus > 0) && (
              <div className="text-xs text-[#555] space-y-0.5 text-right">
                {item.power_bonus > 0 && <span className="block">⚔️+{item.power_bonus}</span>}
                {item.intelligence_bonus > 0 && <span className="block">🧠+{item.intelligence_bonus}</span>}
                {item.charisma_bonus > 0 && <span className="block">✨+{item.charisma_bonus}</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Detail panel ─────────────────────────────────────────────
function PlayerDetailPanel({ player, onClose, onRefresh }: { player: Player; onClose: () => void; onRefresh: () => void }) {
  const [activeTab, setTab] = useState("overview");
  const [logs, setLogs] = useState<Logs | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionValue, setActionValue] = useState("");
  const [addictionVal, setAddictionVal] = useState(player.addiction || 0);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); };

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    const res = await fetch(`/api/admin/crime-empire/players/${player.id}/logs`);
    const data = await res.json();
    setLogs(data);
    setLogsLoading(false);
  }, [player.id]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const doAction = async (action: Action) => {
    setActionLoading(true);
    const body: Record<string, unknown> = { action };
    if (["give_cash", "take_cash", "give_dirty_cash", "take_dirty_cash"].includes(action)) body.amount = Number(actionValue);
    if (action === "set_addiction") body.value = addictionVal;
    const res = await fetch(`/api/admin/crime-empire/players/${player.id}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const data = await res.json();
    setActionLoading(false);
    if (data.success) { showToast(data.message || "Acao executada!"); loadLogs(); onRefresh(); }
    else showToast(data.error || "Erro", false);
  };

  const TABS = [
    { id: "overview",   label: "Visao Geral" },
    { id: "businesses", label: "Negocios" },
    { id: "crimes",     label: "Crimes" },
    { id: "jail",       label: "Prisao" },
    { id: "pvp",        label: "PvP" },
    { id: "gambling",   label: "Casino" },
    { id: "inventory",  label: "Inventario" },
    { id: "actions",    label: "Acoes" },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-stretch justify-end" onClick={onClose}>
      {toast && <CEToast msg={toast.msg} ok={toast.ok} center />}

      <div className="bg-[#0a0a0a] border-l border-[#1e1e1e] w-full max-w-2xl flex flex-col h-full overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-5 border-b border-[#1a1a1a] flex-shrink-0">
          {player.avatar_url && <img src={player.avatar_url} alt="" className="w-12 h-12 rounded-full ring-2 ring-[#ff6a00]/40" />}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-white font-black text-lg truncate">{player.display_name || player.username}</p>
              {player.in_jail && <span className="text-xs px-2 py-0.5 rounded-full bg-red-600/20 text-red-400 font-bold flex-shrink-0">PRESO</span>}
            </div>
            <p className="text-[#444] text-sm">
              <span className={CLASS_COLORS[player.class] || "text-[#888]"}>{player.class}</span>
              {" · "}Nível {player.level}
              {" · "}Respeito {fmt(player.respect)}
              {" · "}Desde {new Date(player.created_at).toLocaleDateString("pt-PT")}
            </p>
          </div>
          <button onClick={onClose} className="text-[#333] hover:text-white transition-colors text-xl flex-shrink-0">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto border-b border-[#1a1a1a] flex-shrink-0 scrollbar-none">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-xs font-semibold whitespace-nowrap transition-colors flex-shrink-0 border-b-2 ${activeTab === t.id ? "text-[#ff6a00] border-[#ff6a00]" : "text-[#444] border-transparent hover:text-[#888]"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {logsLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-[#333] text-sm animate-pulse">A carregar logs...</div>
            </div>
          ) : logs ? (
            <>
              {activeTab === "overview"   && <TabOverview player={player} logs={logs} />}
              {activeTab === "businesses" && <TabBusinesses logs={logs} />}
              {activeTab === "crimes"     && <TabCrimes logs={logs} playerId={player.id} />}
              {activeTab === "jail"       && <TabJail logs={logs} />}
              {activeTab === "pvp"        && <TabPvP logs={logs} playerId={player.id} />}
              {activeTab === "gambling"   && <TabGambling logs={logs} />}
              {activeTab === "inventory"  && <TabInventory logs={logs} />}
            </>
          ) : null}

          {activeTab === "actions" && (
            <div className="space-y-4">
              <SectionHeader>Acoes de Admin</SectionHeader>

              {/* Quick actions */}
              <div>
                <p className="text-xs text-[#555] mb-2">Acoes rapidas</p>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => doAction("heal")} disabled={actionLoading}
                    className="text-xs px-3 py-2 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-400 disabled:opacity-50">❤️ Curar HP</button>
                  {player.in_jail && (
                    <button onClick={() => doAction("free_jail")} disabled={actionLoading}
                      className="text-xs px-3 py-2 rounded-lg bg-green-900/30 hover:bg-green-900/50 text-green-400 disabled:opacity-50">🔓 Libertar da Prisao</button>
                  )}
                </div>
              </div>

              {/* Cash management */}
              <div>
                <p className="text-xs text-[#555] mb-2">Gestao de dinheiro</p>
                <input type="number" placeholder="Quantidade..." value={actionValue}
                  onChange={e => setActionValue(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white mb-2" />
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => doAction("give_cash")} disabled={actionLoading || !actionValue}
                    className="text-xs py-2 rounded-lg bg-green-900/30 hover:bg-green-900/50 text-green-400 disabled:opacity-50">+ Dar Cash</button>
                  <button onClick={() => doAction("take_cash")} disabled={actionLoading || !actionValue}
                    className="text-xs py-2 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-400 disabled:opacity-50">- Tirar Cash</button>
                  <button onClick={() => doAction("give_dirty_cash")} disabled={actionLoading || !actionValue}
                    className="text-xs py-2 rounded-lg bg-yellow-900/30 hover:bg-yellow-900/50 text-yellow-400 disabled:opacity-50">+ Dar Cash Sujo</button>
                  <button onClick={() => doAction("take_dirty_cash")} disabled={actionLoading || !actionValue}
                    className="text-xs py-2 rounded-lg bg-orange-900/30 hover:bg-orange-900/50 text-orange-400 disabled:opacity-50">- Tirar Cash Sujo</button>
                </div>
              </div>

              {/* Addiction */}
              <div>
                <p className="text-xs text-[#555] mb-2">Definir Vicio</p>
                <div className="flex gap-3 items-center">
                  <input type="range" min={0} max={100} value={addictionVal} onChange={e => setAddictionVal(Number(e.target.value))}
                    className="flex-1 accent-purple-500" />
                  <span className="text-white text-sm w-10 text-right">{addictionVal}%</span>
                  <button onClick={() => doAction("set_addiction")} disabled={actionLoading}
                    className="text-xs px-3 py-2 rounded-lg bg-purple-900/30 hover:bg-purple-900/50 text-purple-400 disabled:opacity-50">Definir</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function PlayersAdminPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [q, setQ]             = useState("");
  const [classFilter, setClass] = useState("");
  const [jailedFilter, setJailed] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Player | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), q, ...(classFilter && { class: classFilter }), ...(jailedFilter && { jailed: jailedFilter }) });
    const res = await fetch(`/api/admin/crime-empire/players?${params}`);
    const data = await res.json();
    setPlayers(data.players || []); setTotal(data.total || 0); setLoading(false);
  }, [page, q, classFilter, jailedFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">Jogadores</h1>
          <p className="text-[#555] text-sm">{total} jogadores registados</p>
        </div>
      </div>

      <div className="flex gap-3 mb-5 flex-wrap">
        <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="Pesquisar por username..."
          className="bg-[#0e0e0e] border border-[#222] rounded-lg px-3 py-2 text-sm text-white flex-1 min-w-[200px]" />
        <select value={classFilter} onChange={e => { setClass(e.target.value); setPage(1); }}
          className="bg-[#0e0e0e] border border-[#222] rounded-lg px-3 py-2 text-sm text-white">
          <option value="">Todas as classes</option>
          {["thief", "hooligan", "businessman", "hitman", "scammer", "brute", "dealer", "pimp"].map(c =>
            <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={jailedFilter} onChange={e => { setJailed(e.target.value); setPage(1); }}
          className="bg-[#0e0e0e] border border-[#222] rounded-lg px-3 py-2 text-sm text-white">
          <option value="">Todos os estados</option>
          <option value="true">Na prisao</option>
          <option value="false">Em liberdade</option>
        </select>
      </div>

      <div className="bg-[#0e0e0e] border border-[#1e1e1e] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e1e1e] text-[#444] text-xs uppercase">
              <th className="text-left px-4 py-3">Jogador</th>
              <th className="text-left px-4 py-3">Classe</th>
              <th className="text-right px-4 py-3">Nivel</th>
              <th className="text-right px-4 py-3">Cash</th>
              <th className="text-right px-4 py-3">Cash Sujo</th>
              <th className="text-left px-4 py-3">Vicio</th>
              <th className="text-center px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-[#444]">A carregar...</td></tr>
            ) : players.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-[#444]">Nenhum jogador</td></tr>
            ) : players.map(p => (
              <tr key={p.id} className="border-b border-[#151515] hover:bg-[#141414] transition-colors cursor-pointer" onClick={() => setSelected(p)}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {p.avatar_url && <img src={p.avatar_url} className="w-7 h-7 rounded-full" alt="" />}
                    <span className="text-white font-medium">{p.username}</span>
                  </div>
                </td>
                <td className={`px-4 py-3 font-bold text-xs ${CLASS_COLORS[p.class] || "text-[#888]"}`}>{p.class}</td>
                <td className="px-4 py-3 text-right text-white">{p.level}</td>
                <td className="px-4 py-3 text-right text-green-400">{fmt(p.cash)}</td>
                <td className="px-4 py-3 text-right text-yellow-400">{fmt(p.dirty_cash)}</td>
                <td className="px-4 py-3 w-28">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-[#1a1a1a] rounded-full">
                      <div className="h-full rounded-full bg-purple-500" style={{ width: `${p.addiction || 0}%` }} />
                    </div>
                    <span className="text-xs text-[#555]">{p.addiction || 0}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${p.in_jail ? "bg-red-600/20 text-red-400" : "bg-green-600/20 text-green-400"}`}>
                    {p.in_jail ? "Preso" : "Livre"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {total > 40 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#1e1e1e]">
            <span className="text-xs text-[#444]">Pagina {page} de {Math.ceil(total / 40)}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={e => { e.stopPropagation(); setPage(p => p - 1); }} className="text-xs px-3 py-1 rounded bg-[#1a1a1a] text-white disabled:opacity-30">Anterior</button>
              <button disabled={page * 40 >= total} onClick={e => { e.stopPropagation(); setPage(p => p + 1); }} className="text-xs px-3 py-1 rounded bg-[#1a1a1a] text-white disabled:opacity-30">Proxima</button>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <PlayerDetailPanel
          player={selected}
          onClose={() => setSelected(null)}
          onRefresh={load}
        />
      )}
    </div>
  );
}
