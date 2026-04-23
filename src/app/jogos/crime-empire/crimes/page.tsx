"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth-context";

interface Player {
  id: string;
  level: number;
  stamina: number;
  max_stamina: number;
  in_jail: boolean;
}

interface Crime {
  id: string;
  name: string;
  description: string;
  difficulty: string;
  base_success_rate: number;
  jail_risk: number;
  stamina_cost: number;
  min_dirty_cash: number;
  max_dirty_cash: number;
  xp_reward: number;
  required_level: number;
}

const DIFFICULTY_ICONS: Record<string, string> = {
  facil: "🔫", easy: "🔫",
  medio: "💊", medium: "💊",
  dificil: "🔪", hard: "🔪",
  expert: "💣", elite: "💣",
};
function diffIcon(d: string) { return DIFFICULTY_ICONS[d?.toLowerCase()] ?? "🎲"; }
function fmt(n: number) { return n.toLocaleString("pt-PT"); }

function PlayerBar({ player }: { player: Player }) {
  const pct = player.max_stamina > 0 ? (player.stamina / player.max_stamina) * 100 : 0;
  const barColor = pct > 60 ? "#3b82f6" : pct > 30 ? "#f59e0b" : "#ef4444";
  return (
    <div className="mb-6 flex items-center gap-4 px-4 py-3 rounded-2xl bg-[#111] border border-[#1e1e1e]">
      <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/25 flex flex-col items-center justify-center flex-shrink-0">
        <span className="text-orange-400 font-black text-[9px] leading-none uppercase tracking-wider">LVL</span>
        <span className="text-orange-300 font-black text-sm leading-tight">{player.level}</span>
      </div>
      <div className="h-8 w-px bg-[#1e1e1e] flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[10px] uppercase tracking-widest text-[#444] font-bold">Stamina</span>
          <span className="text-xs font-bold tabular-nums" style={{ color: barColor }}>
            {player.stamina} / {player.max_stamina}
          </span>
        </div>
        <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${barColor}88, ${barColor})` }}
          />
        </div>
      </div>
      {player.in_jail && (
        <>
          <div className="h-8 w-px bg-[#1e1e1e] flex-shrink-0" />
          <div className="px-3 py-1.5 rounded-lg bg-red-900/25 border border-red-700/40 flex-shrink-0">
            <span className="text-red-400 text-xs font-bold">Na Prisao</span>
          </div>
        </>
      )}
    </div>
  );
}

function FeaturedCrime({
  crime, player, isProcessing, onCommit,
}: {
  crime: Crime; player: Player; isProcessing: boolean; onCommit: (id: string) => void;
}) {
  const canAfford = player.stamina >= crime.stamina_cost;
  const canCommit = canAfford && !player.in_jail && !isProcessing;
  const successPct = Math.round(crime.base_success_rate * 100);
  const jailPct = Math.round(crime.jail_risk * 100);
  const icon = diffIcon(crime.difficulty);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-2xl mb-6 border border-[#1e1e1e]"
      style={{ background: "linear-gradient(135deg, #0d0d0d 0%, #111 50%, #0f0a00 100%)" }}
    >
      <div className="absolute top-0 right-0 w-72 h-72 rounded-full opacity-[0.06] blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, #ff6a00 0%, transparent 70%)" }} />
      <div className="h-px w-full bg-gradient-to-r from-transparent via-orange-700/40 to-transparent" />
      <div className="p-6 relative z-10">
        <p className="text-[10px] uppercase tracking-[0.28em] text-orange-500/55 font-bold mb-3">Operacao em Destaque</p>
        <div className="flex items-start justify-between gap-4 mb-2">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{icon}</span>
            <h2 className="text-2xl font-black text-white leading-tight">{crime.name}</h2>
          </div>
          <span className="text-sm font-black text-green-400 flex-shrink-0 mt-1">{successPct}%</span>
        </div>
        <p className="text-[#555] text-sm mb-5 leading-relaxed">{crime.description}</p>
        <div className="flex items-center gap-4 mb-6 flex-wrap text-sm font-bold">
          <span className="text-green-400">Sucesso {successPct}%</span>
          <span className="text-red-400">Prisao {jailPct}%</span>
          <span className={canAfford ? "text-blue-400" : "text-red-400"}>Stamina {crime.stamina_cost}</span>
          <span className="text-yellow-400">${fmt(crime.min_dirty_cash)} - ${fmt(crime.max_dirty_cash)}</span>
          <span className="text-purple-400">+{crime.xp_reward} XP</span>
        </div>
        <motion.button
          whileTap={canCommit ? { scale: 0.97 } : {}}
          disabled={!canCommit}
          onClick={() => canCommit && onCommit(crime.id)}
          className={`w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-widest transition-all duration-200 ${
            canCommit
              ? "bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-900/30"
              : "bg-[#1a1a1a] text-[#333] cursor-not-allowed"
          }`}
        >
          {isProcessing ? "A executar..." : !canAfford ? "Stamina insuficiente" : player.in_jail ? "Na Prisao" : "EXECUTAR"}
        </motion.button>
      </div>
    </motion.div>
  );
}

function CrimeCard({
  crime, player, isProcessing, onCommit,
}: {
  crime: Crime; player: Player; isProcessing: boolean; onCommit: (id: string) => void;
}) {
  const isLocked = crime.required_level > player.level;
  const canAfford = player.stamina >= crime.stamina_cost;
  const canCommit = !isLocked && canAfford && !player.in_jail && !isProcessing;
  const successPct = Math.round(crime.base_success_rate * 100);
  const jailPct = Math.round(crime.jail_risk * 100);
  const icon = diffIcon(crime.difficulty);

  if (isLocked) {
    return (
      <div className="relative rounded-xl overflow-hidden border border-[#181818] bg-[#0d0d0d]">
        <div className="p-4 opacity-25 blur-[1.5px] select-none pointer-events-none">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-base">{icon}</span>
              <span className="text-sm font-bold text-white truncate">{crime.name}</span>
            </div>
            <span className="text-xs font-black text-green-400">{successPct}%</span>
          </div>
          <p className="text-xs text-[#555] mb-3 truncate">{crime.description}</p>
          <div className="flex items-center gap-3 text-xs text-[#333]">
            <span>{successPct}%</span><span>{jailPct}%</span><span>{crime.stamina_cost}</span>
          </div>
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/55">
          <span className="text-2xl mb-1.5">🔒</span>
          <span className="text-[11px] font-black text-[#444] uppercase tracking-wider">Nivel {crime.required_level}</span>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={canCommit ? { y: -3 } : {}}
      onClick={() => canCommit && onCommit(crime.id)}
      className={`group relative rounded-xl border transition-all duration-200 ${
        canCommit
          ? "bg-[#111] border-[#1e1e1e] hover:border-orange-700/40 cursor-pointer"
          : "bg-[#0e0e0e] border-[#181818] opacity-50 cursor-not-allowed"
      }`}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base flex-shrink-0">{icon}</span>
            <span className="text-sm font-bold text-white truncate">{crime.name}</span>
          </div>
          <span className="text-xs font-black text-green-400 flex-shrink-0 ml-2">{successPct}%</span>
        </div>
        <p className="text-xs text-[#4a4a4a] mb-3.5 truncate">{crime.description}</p>
        <div className="flex items-center gap-3 text-xs font-semibold flex-wrap">
          <span className="text-green-400">S {successPct}%</span>
          <span className="text-red-400">P {jailPct}%</span>
          <span className={canAfford ? "text-blue-400" : "text-red-400"}>ST {crime.stamina_cost}</span>
          <span className="text-yellow-400">${fmt(crime.min_dirty_cash)}-${fmt(crime.max_dirty_cash)}</span>
        </div>
        {isProcessing && (
          <div className="mt-3 flex items-center gap-2">
            <div className="w-3 h-3 border border-orange-500/40 border-t-orange-500 rounded-full animate-spin" />
            <span className="text-orange-400 text-xs">A executar...</span>
          </div>
        )}
        {!canAfford && !player.in_jail && (
          <p className="mt-2.5 text-xs text-red-400/60">Stamina insuficiente</p>
        )}
      </div>
    </motion.div>
  );
}

export default function CrimesPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [player, setPlayer] = useState<Player | null>(null);
  const [crimes, setCrimes] = useState<Crime[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCrime, setSelectedCrime] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [crimeResult, setCrimeResult] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    if (!user) { router.push("/"); return; }
    fetchPlayer();
    fetchCrimes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchPlayer = async () => {
    try {
      const res = await fetch("/api/crime-empire/player");
      const data = await res.json();
      if (data.player) setPlayer(data.player);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchCrimes = async () => {
    try {
      const res = await fetch("/api/crime-empire/crimes");
      const data = await res.json();
      setCrimes(data.crimes || []);
    } catch (e) { console.error(e); }
  };

  const commitCrime = async (crimeId: string) => {
    if (!player || selectedCrime) return;
    setSelectedCrime(crimeId);
    setCrimeResult(null);
    try {
      const res = await fetch("/api/crime-empire/crimes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crimeId }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error); setSelectedCrime(null); return; }
      setCrimeResult(data);
      setTimeout(() => { fetchPlayer(); setSelectedCrime(null); setCrimeResult(null); }, 3000);
    } catch (e) { console.error(e); setSelectedCrime(null); }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-white/10 border-t-white/50 rounded-full animate-spin" />
      </div>
    );
  }

  if (!player) return null;

  const sorted = [...crimes].sort((a, b) => {
    const aL = a.required_level > player.level;
    const bL = b.required_level > player.level;
    return aL === bL ? 0 : aL ? 1 : -1;
  });
  const featured = sorted.find((c) => c.required_level <= player.level) ?? null;
  const gridCrimes = sorted.filter((c) => c !== featured);

  return (
    <div className="relative flex-1 text-white py-8 px-4 md:px-6" style={{ background: "#0B0B0B" }}>
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-[0.035]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
        }}
      />
      <div className="relative z-10 max-w-5xl mx-auto">
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-[0.3em] text-orange-600/55 font-bold mb-1">Crime Empire</p>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-1">OPERACOES CRIMINOSAS</h1>
          <p className="text-[#3a3a3a] text-sm">Seleciona uma operacao, executa sem testemunhas.</p>
          <div className="mt-4 h-px bg-gradient-to-r from-orange-800/35 via-[#1e1e1e] to-transparent" />
        </div>
        <PlayerBar player={player} />
        {featured && (
          <FeaturedCrime
            crime={featured}
            player={player}
            isProcessing={selectedCrime === featured.id}
            onCommit={commitCrime}
          />
        )}
        {gridCrimes.length > 0 && (
          <p className="text-[10px] uppercase tracking-[0.25em] text-[#2e2e2e] font-bold mb-3">
            Todas as operacoes
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {gridCrimes.map((crime) => (
            <CrimeCard
              key={crime.id}
              crime={crime}
              player={player}
              isProcessing={selectedCrime === crime.id}
              onCommit={commitCrime}
            />
          ))}
        </div>
      </div>
      <AnimatePresence>
        {crimeResult && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm pointer-events-auto"
          >
            <div
              className="relative rounded-2xl overflow-hidden border shadow-2xl"
              style={{
                background: crimeResult.success
                  ? "linear-gradient(135deg, #0a1f0a 0%, #0d1a0d 100%)"
                  : "linear-gradient(135deg, #1a0808 0%, #150808 100%)",
                borderColor: crimeResult.success ? "#16a34a60" : "#dc262660",
                boxShadow: crimeResult.success
                  ? "0 0 40px #16a34a22, 0 8px 32px rgba(0,0,0,0.6)"
                  : "0 0 40px #dc262622, 0 8px 32px rgba(0,0,0,0.6)",
              }}
            >
              <div
                className="h-[2px] w-full"
                style={{
                  background: crimeResult.success
                    ? "linear-gradient(90deg, transparent, #22c55e, transparent)"
                    : "linear-gradient(90deg, transparent, #ef4444, transparent)",
                }}
              />
              <div className="absolute bottom-0 left-0 h-[2px] w-full bg-[#111]">
                <motion.div
                  initial={{ width: "100%" }}
                  animate={{ width: "0%" }}
                  transition={{ duration: 3, ease: "linear" }}
                  className="h-full"
                  style={{ background: crimeResult.success ? "#22c55e" : "#ef4444" }}
                />
              </div>
              <div className="px-5 py-4">
                <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#555] mb-1">
                  {crimes.find((c) => c.id === selectedCrime)?.name ?? "Crime"}
                </p>
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{
                      background: crimeResult.success ? "#16a34a25" : "#dc262625",
                      border: `1px solid ${crimeResult.success ? "#16a34a50" : "#dc262650"}`,
                    }}
                  >
                    {crimeResult.success ? "✅" : "❌"}
                  </div>
                  <h2
                    className="text-2xl font-black tracking-tight"
                    style={{ color: crimeResult.success ? "#4ade80" : "#f87171" }}
                  >
                    {crimeResult.success ? "SUCESSO!" : "FALHOU!"}
                  </h2>
                </div>
                {crimeResult.success && (
                  <div className="space-y-2 mb-3">
                    {[
                      { icon: "💵", label: "Dinheiro Sujo", value: `+$${(crimeResult.dirty_cash_earned as number)?.toLocaleString()}`, color: "#4ade80", delay: 0.05 },
                      { icon: "⭐", label: "XP",            value: `+${crimeResult.xp_earned}`,                                       color: "#60a5fa", delay: 0.1  },
                      { icon: "👑", label: "Respeito",      value: `+${crimeResult.respect_earned}`,                                  color: "#c084fc", delay: 0.15 },
                    ].map((r) => (
                      <motion.div
                        key={r.label}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: r.delay, duration: 0.25 }}
                        className="flex items-center justify-between px-3 py-2 rounded-lg"
                        style={{ background: `${r.color}0d`, border: `1px solid ${r.color}18` }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{r.icon}</span>
                          <span className="text-[11px] text-[#666]">{r.label}</span>
                        </div>
                        <span className="text-sm font-black" style={{ color: r.color }}>{r.value}</span>
                      </motion.div>
                    ))}
                    {crimeResult.leveled_up && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10"
                      >
                        <span className="text-sm">🎉</span>
                        <span className="text-xs font-black text-yellow-400 uppercase tracking-wide">
                          Nivel {crimeResult.new_level as number} desbloqueado!
                        </span>
                      </motion.div>
                    )}
                  </div>
                )}
                {crimeResult.went_to_jail && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-red-600/30 bg-red-900/15 mt-2"
                  >
                    <span className="text-lg">🚔</span>
                    <div>
                      <p className="text-xs font-bold text-red-400">Foste apanhado!</p>
                      <p className="text-[10px] text-red-500/70">Prisao por {crimeResult.jail_time_minutes as number} min</p>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}