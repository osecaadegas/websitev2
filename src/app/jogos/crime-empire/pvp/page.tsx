"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

interface PvpPlayer {
  id: string;
  display_name: string;
  username: string;
  avatar_url?: string;
  level: number;
  prestige_level: number;
  class: string;
  power: number;
  intelligence: number;
  charisma: number;
  hp: number;
  max_hp: number;
  last_login: string;
}

interface Battle {
  id: string;
  attacker_id: string;
  defender_id: string;
  winner_id: string;
  attacker_name: string;
  attacker_avatar?: string;
  defender_name: string;
  defender_avatar?: string;
  attacker_score: number;
  defender_score: number;
  loot_type: "cash" | "crypto";
  loot_amount: number;
  created_at: string;
}

interface ChatMsg {
  id: string;
  player_id: string;
  player_name: string;
  avatar_url?: string;
  message: string;
  created_at: string;
}

interface Settings {
  pvp_enabled: boolean;
  cooldown_minutes: number;
  min_loot_percent: number;
  max_loot_percent: number;
  hp_after_loss_percent: number;
}

interface BattleResult {
  attackerWon: boolean;
  atkScore: number;
  defScore: number;
  lootType: string;
  lootAmount: number;
  loserName: string;
  winnerName: string;
}

const CLASS_LABELS: Record<string, string> = {
  thief: "Ladrão", hooligan: "Hooligan", businessman: "Empresário",
  hitman: "Assassino", scammer: "Burlão", brute: "Brutamontes",
  dealer: "Dealer", pimp: "Chulo",
};

const CLASS_COLOR: Record<string, string> = {
  thief: "text-yellow-400", hooligan: "text-orange-400", businessman: "text-blue-400",
  hitman: "text-red-500", scammer: "text-purple-400", brute: "text-red-400",
  dealer: "text-green-400", pimp: "text-pink-400",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return "agora";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return `${Math.floor(diff / 86400000)}d`;
}

function Avatar({ url, name, size = 8 }: { url?: string; name: string; size?: number }) {
  const cls = `w-${size} h-${size} rounded-full`;
  if (url) return <img src={url} alt={name} className={`${cls} object-cover border border-[#333]`} />;
  return (
    <div className={`${cls} bg-[#2a2a2a] border border-[#333] flex items-center justify-center text-xs font-bold text-[#888]`}>
      {name[0]?.toUpperCase()}
    </div>
  );
}

export default function PvPPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [players, setPlayers] = useState<PvpPlayer[]>([]);
  const [battles, setBattles] = useState<Battle[]>([]);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selfId, setSelfId] = useState<string>("");
  const [selfLastPvpAt, setSelfLastPvpAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attacking, setAttacking] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [result, setResult] = useState<BattleResult | null>(null);
  const [cooldownSecs, setCooldownSecs] = useState(0);
  const [search, setSearch] = useState("");
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchAll = useCallback(async () => {
    const res = await fetch("/api/crime-empire/pvp");
    if (!res.ok) return;
    const data = await res.json();
    setPlayers(data.players ?? []);
    setBattles(data.battles ?? []);
    setChat(data.chat ?? []);
    setSettings(data.settings);
    setSelfId(data.selfId);
    setSelfLastPvpAt(data.selfLastPvpAt);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) { router.push("/"); return; }
    fetchAll();
    pollRef.current = setInterval(fetchAll, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [user, fetchAll]);

  // Cooldown countdown
  useEffect(() => {
    if (!settings || !selfLastPvpAt) { setCooldownSecs(0); return; }
    const update = () => {
      const ms = settings.cooldown_minutes * 60 * 1000 - (Date.now() - new Date(selfLastPvpAt).getTime());
      setCooldownSecs(ms > 0 ? Math.ceil(ms / 1000) : 0);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [selfLastPvpAt, settings]);

  // Auto-scroll chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  const attack = async (targetId: string) => {
    if (attacking || cooldownSecs > 0) return;
    setAttacking(targetId);
    try {
      const res = await fetch("/api/crime-empire/pvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "attack", targetId }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Erro"); return; }
      setResult(data);
      setSelfLastPvpAt(new Date().toISOString());
      await fetchAll();
    } finally {
      setAttacking(null);
    }
  };

  const sendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || sendingChat) return;
    setSendingChat(true);
    try {
      await fetch("/api/crime-empire/pvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "chat", message: chatInput.trim() }),
      });
      setChatInput("");
      await fetchAll();
    } finally {
      setSendingChat(false);
    }
  };

  const filtered = players.filter(
    (p) =>
      (p.display_name || p.username).toLowerCase().includes(search.toLowerCase()) ||
      p.class.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-white text-xl">A carregar arena…</div>
      </div>
    );
  }

  const pvpDisabled = settings && !settings.pvp_enabled;

  return (
    <div className="flex-1 text-white py-8 px-4 lg:px-6">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-4xl font-black bg-gradient-to-r from-red-500 to-[#ff6a00] bg-clip-text text-transparent">
              ⚔️ PvP Arena
            </h1>
            <p className="text-[#666] text-sm mt-1">Destrói os teus inimigos e rouba-lhes o dinheiro</p>
          </div>
          {settings && (
            <div className="flex flex-col items-end gap-1">
              {pvpDisabled ? (
                <span className="px-3 py-1 rounded-full bg-red-900/30 border border-red-700 text-red-400 text-xs font-bold">⛔ PvP Desativado</span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-green-900/30 border border-green-700 text-green-400 text-xs font-bold">✅ PvP Ativo</span>
              )}
              <span className="text-xs text-[#555]">
                Saque: {settings.min_loot_percent}–{settings.max_loot_percent}% · Cooldown: {settings.cooldown_minutes}min
              </span>
            </div>
          )}
        </div>

        {/* Cooldown banner */}
        {cooldownSecs > 0 && (
          <div className="mb-4 p-3 rounded-xl bg-yellow-900/20 border border-yellow-700/50 text-yellow-400 text-sm font-semibold">
            ⏳ Próximo ataque disponível em:{" "}
            {Math.floor(cooldownSecs / 60)}:{String(cooldownSecs % 60).padStart(2, "0")}
          </div>
        )}

        {/* 3-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
          {/* ── LEFT: Player List ── */}
          <div className="flex flex-col gap-3">
            <div className="p-4 rounded-xl bg-[#121212] border border-[#222]">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-white text-sm">🎯 Jogadores ({filtered.length})</h2>
              </div>
              <input
                type="text"
                placeholder="Procurar jogador ou classe…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#ff6a00] mb-3"
              />
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {filtered.length === 0 && (
                  <p className="text-[#444] text-sm text-center py-4">Nenhum jogador encontrado</p>
                )}
                {filtered.map((p) => {
                  const hpPct = Math.round((p.hp / p.max_hp) * 100);
                  const isAttacking = attacking === p.id;
                  const canAttack = !pvpDisabled && cooldownSecs === 0 && !attacking;
                  return (
                    <div key={p.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-[#1a1a1a] border border-[#222] hover:border-[#333] transition-all">
                      <Avatar url={p.avatar_url} name={p.display_name || p.username} size={9} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-white truncate">{p.display_name || p.username}</span>
                          {p.prestige_level > 0 && (
                            <span className="text-xs text-yellow-400 shrink-0">⭐{p.prestige_level}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs font-medium ${CLASS_COLOR[p.class] ?? "text-[#888]"}`}>
                            {CLASS_LABELS[p.class] ?? p.class}
                          </span>
                          <span className="text-xs text-[#555]">Nv.{p.level}</span>
                        </div>
                        <div className="mt-1.5 w-full bg-[#111] rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${hpPct > 60 ? "bg-green-500" : hpPct > 30 ? "bg-yellow-500" : "bg-red-600"}`}
                            style={{ width: `${hpPct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-[#444]">{p.hp}/{p.max_hp} HP · Visto {timeAgo(p.last_login)}</span>
                      </div>
                      <button
                        onClick={() => attack(p.id)}
                        disabled={!canAttack || isAttacking}
                        className={`shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          canAttack && !isAttacking
                            ? "bg-red-600 hover:bg-red-500 text-white hover:scale-105"
                            : "bg-[#222] text-[#444] cursor-not-allowed"
                        }`}
                      >
                        {isAttacking ? "⚔️…" : "ATACAR"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Combat formula info */}
            <div className="p-3 rounded-xl bg-[#0e0e0e] border border-[#1e1e1e]">
              <p className="text-xs text-[#555] font-bold mb-2">FÓRMULA DE COMBATE</p>
              <div className="space-y-1 text-xs text-[#444]">
                <p><span className="text-red-400 font-bold">Brutamontes</span> — +50% Poder em PvP</p>
                <p>Score = Poder×3 + Intel×1.5 + Carisma×0.5</p>
                <p>+ Nível×10 + Prestige×50</p>
                <p>Vício alto penaliza até -50%</p>
                <p>HP baixo penaliza até -40%</p>
                <p className="text-[#333]">±15% variação aleatória</p>
              </div>
            </div>
          </div>

          {/* ── CENTER: Battle History ── */}
          <div className="p-4 rounded-xl bg-[#121212] border border-[#222] flex flex-col">
            <h2 className="font-bold text-white text-sm mb-3">💀 Historial de Batalhas</h2>
            <div className="space-y-2 overflow-y-auto flex-1 max-h-[680px] pr-1">
              {battles.length === 0 && (
                <p className="text-[#444] text-sm text-center py-8">
                  Ainda não há batalhas. Parte para o ataque!
                </p>
              )}
              {battles.map((b) => {
                const attackerWon = b.winner_id === b.attacker_id;
                const iInvolved = b.attacker_id === selfId || b.defender_id === selfId;
                return (
                  <div
                    key={b.id}
                    className={`p-3 rounded-lg border text-xs transition-all ${
                      iInvolved
                        ? "bg-[#1e1510] border-[#ff6a00]/30"
                        : "bg-[#1a1a1a] border-[#222]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <Avatar url={b.attacker_avatar} name={b.attacker_name} size={7} />
                        <span className={`font-bold truncate ${attackerWon ? "text-green-400" : "text-red-400"}`}>
                          {b.attacker_name}
                        </span>
                      </div>
                      <span className="text-[#333] shrink-0 font-black text-[10px]">⚔️</span>
                      <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                        <span className={`font-bold truncate ${!attackerWon ? "text-green-400" : "text-red-400"}`}>
                          {b.defender_name}
                        </span>
                        <Avatar url={b.defender_avatar} name={b.defender_name} size={7} />
                      </div>
                    </div>
                    <div className="flex justify-between text-[#555] mt-1 text-[10px]">
                      <span>{b.attacker_score} pts</span>
                      <span>{b.defender_score} pts</span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-green-400 font-bold">
                        🏆 {attackerWon ? b.attacker_name : b.defender_name}
                      </span>
                      {b.loot_amount > 0 && (
                        <span className="text-yellow-400 font-semibold">
                          {b.loot_amount.toLocaleString()} {b.loot_type === "cash" ? "💰" : "₿"}
                        </span>
                      )}
                    </div>
                    <div className="text-[#333] mt-1 text-[10px]">{timeAgo(b.created_at)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── RIGHT: Chat ── */}
          <div className="p-4 rounded-xl bg-[#121212] border border-[#222] flex flex-col">
            <h2 className="font-bold text-white text-sm mb-3">💬 Chat da Arena</h2>
            <div className="flex-1 overflow-y-auto space-y-2 max-h-[600px] pr-1 mb-3">
              {chat.length === 0 && (
                <p className="text-[#444] text-sm text-center py-8">
                  Ninguém falou ainda. Sê o primeiro!
                </p>
              )}
              {chat.map((msg) => {
                const isMe = msg.player_id === selfId;
                return (
                  <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                    <div className="shrink-0">
                      <Avatar url={msg.avatar_url} name={msg.player_name} size={7} />
                    </div>
                    <div className={`max-w-[75%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                      <span className="text-[10px] text-[#444] mb-0.5 px-1">{msg.player_name}</span>
                      <div
                        className={`px-3 py-2 rounded-xl text-xs text-white break-words ${
                          isMe
                            ? "bg-[#ff6a00]/20 border border-[#ff6a00]/30"
                            : "bg-[#1e1e1e] border border-[#2a2a2a]"
                        }`}
                      >
                        {msg.message}
                      </div>
                      <span className="text-[9px] text-[#333] mt-0.5 px-1">{timeAgo(msg.created_at)}</span>
                    </div>
                  </div>
                );
              })}
              <div ref={chatBottomRef} />
            </div>
            <form onSubmit={sendChat} className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Escreve uma mensagem…"
                maxLength={200}
                className="flex-1 px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#ff6a00]"
              />
              <button
                type="submit"
                disabled={sendingChat || !chatInput.trim()}
                className="px-4 py-2 rounded-lg bg-[#ff6a00] hover:bg-[#ff8533] text-white text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ➤
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Battle Result Modal */}
      {result && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setResult(null)}
        >
          <div
            className={`bg-[#1a1a1a] border-2 rounded-2xl p-8 max-w-sm w-full text-center ${
              result.attackerWon ? "border-green-500" : "border-red-600"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-6xl mb-4">{result.attackerWon ? "🏆" : "💀"}</div>
            <h2 className={`text-3xl font-black mb-2 ${result.attackerWon ? "text-green-400" : "text-red-400"}`}>
              {result.attackerWon ? "VITÓRIA!" : "DERROTA!"}
            </h2>
            <p className="text-[#888] text-sm mb-4">
              {result.attackerWon
                ? `Destruíste ${result.loserName}!`
                : `${result.winnerName} destruiu-te!`}
            </p>
            <div className="flex justify-center gap-6 mb-4 text-sm">
              <div className="text-center">
                <p className="text-[#555] text-xs mb-1">Teu Score</p>
                <p className="font-bold text-white">{result.atkScore}</p>
              </div>
              <div className="text-[#333] font-bold self-center">VS</div>
              <div className="text-center">
                <p className="text-[#555] text-xs mb-1">Score Deles</p>
                <p className="font-bold text-white">{result.defScore}</p>
              </div>
            </div>
            {result.lootAmount > 0 && (
              <div
                className={`p-3 rounded-xl mb-4 ${
                  result.attackerWon
                    ? "bg-green-900/20 border border-green-700"
                    : "bg-red-900/20 border border-red-700"
                }`}
              >
                <p className={`font-bold text-sm ${result.attackerWon ? "text-green-400" : "text-red-400"}`}>
                  {result.attackerWon ? "+" : "-"}{result.lootAmount.toLocaleString()}{" "}
                  {result.lootType === "cash" ? "💰 Dinheiro Limpo" : "₿ Crypto"}
                </p>
                {!result.attackerWon && (
                  <p className="text-xs text-[#888] mt-1">Foste para o hospital 🏥</p>
                )}
              </div>
            )}
            <button
              onClick={() => setResult(null)}
              className="w-full px-6 py-3 rounded-xl bg-[#222] hover:bg-[#2a2a2a] border border-[#333] font-bold transition-all"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
