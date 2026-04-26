"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { notifyPlayerUpdate } from "@/lib/crime-empire/player-context";
import RaidEscape from "@/components/crime-empire/raid/RaidEscape";

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
  clean_cash_pct: number;
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
  const barColorClass = pct > 60 ? "ce-progress-fill-orange" : pct > 30 ? "ce-progress-fill-red" : "ce-progress-fill-red";
  const barColor = pct > 60 ? "#ff8c40" : pct > 30 ? "#f59e0b" : "#ef4444";
  return (
    <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-2xl ce-card ce-card-orange">
      <div className="w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ce-shine"
        style={{ background: "linear-gradient(145deg, rgba(255,106,0,0.15), rgba(255,106,0,0.06))", border: "1px solid rgba(255,106,0,0.3)" }}>
        <span className="text-[#ff8c40] font-black text-[8px] leading-none uppercase tracking-wider">LVL</span>
        <span className="text-white font-black text-sm leading-tight">{player.level}</span>
      </div>
      <div className="h-8 w-px bg-white/5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1.5">
          <span className="ce-stat-label text-[9px]">Stamina</span>
          <span className="text-xs font-black tabular-nums" style={{ color: barColor }}>
            {player.stamina}<span className="text-white/20 font-normal"> / {player.max_stamina}</span>
          </span>
        </div>
        <div className="ce-progress-track h-2">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={`ce-progress-fill ${barColorClass} h-full rounded-full`}
          />
        </div>
      </div>
      {player.in_jail && (
        <>
          <div className="h-8 w-px bg-white/5 flex-shrink-0" />
          <div className="ce-badge ce-badge-red flex-shrink-0">🚔 Preso</div>
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
      className="relative overflow-hidden rounded-2xl mb-6 ce-shine ce-card--metal-blood"
      style={{
        background: "linear-gradient(145deg, #131313 0%, #0f0f0f 60%, #0c0800 100%)",
        border: "1px solid rgba(255,106,0,0.3)",
        boxShadow: "0 0 60px rgba(255,106,0,0.08), 0 1px 0 rgba(255,150,50,0.1) inset, 0 8px 32px rgba(0,0,0,0.6)",
      }}
    >
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-[0.07] blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, #ff6a00 0%, transparent 70%)", transform: "translate(30%,-30%)" }} />
      <div className="h-px w-full" style={{ background: "linear-gradient(90deg, transparent, rgba(255,106,0,0.5), transparent)" }} />
      <div className="p-6 relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <span className="ce-badge ce-badge-orange">⭐ Operacao em Destaque</span>
          <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, rgba(255,106,0,0.2), transparent)" }} />
        </div>
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{ background: "rgba(255,106,0,0.1)", border: "1px solid rgba(255,106,0,0.2)" }}>
              {icon}
            </div>
            <h2 className="text-2xl font-black text-white leading-tight">{crime.name}</h2>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className="text-xs font-black ce-text-green">{successPct}% sucesso</span>
            <span className="text-xs font-bold ce-text-red">{jailPct}% prisao</span>
          </div>
        </div>
        <p className="ce-text-muted text-sm mb-5 leading-relaxed">{crime.description}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
          {[
            { label: "Sucesso", value: `${successPct}%`, color: "ce-text-green" },
            { label: "Prisao",  value: `${jailPct}%`,    color: "ce-text-red" },
            { label: "Stamina", value: String(crime.stamina_cost), color: canAfford ? "text-blue-400" : "ce-text-red" },
            { label: "XP",      value: `+${crime.xp_reward}`,   color: "text-purple-400" },
          ].map((s) => (
            <div key={s.label} className="ce-card rounded-lg p-3 text-center">
              <p className="ce-stat-label text-[9px] mb-1">{s.label}</p>
              <p className={`font-black text-sm ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mb-5 px-3 py-2 rounded-lg" style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.12)" }}>
          <span className="ce-stat-label text-[9px]">Recompensa</span>
          <span className="text-sm font-black ce-text-gold">${fmt(crime.min_dirty_cash)} — ${fmt(crime.max_dirty_cash)}</span>
          {crime.clean_cash_pct > 0 && <span className="ce-badge ce-badge-green text-[9px]">💴 {crime.clean_cash_pct}% limpo</span>}
        </div>
        <motion.button
          whileTap={canCommit ? { scale: 0.97 } : {}}
          disabled={!canCommit}
          onClick={() => canCommit && onCommit(crime.id)}
          className={`ce-btn w-full py-4 text-sm uppercase tracking-widest ${canCommit ? "ce-btn-primary" : "ce-btn-ghost"}`}
        >
          {isProcessing
            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> A executar...</>
            : !canAfford ? "Stamina Insuficiente" : player.in_jail ? "🚔 Na Prisao" : "⚡ EXECUTAR"}
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
      <div className="relative rounded-xl overflow-hidden"
        style={{ background: "linear-gradient(145deg, #0d0d0d, #0a0a0a)", border: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="p-4 opacity-20 blur-[1.5px] select-none pointer-events-none">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-base">{icon}</span>
              <span className="text-sm font-bold text-white truncate">{crime.name}</span>
            </div>
            <span className="text-xs font-black text-green-400">{successPct}%</span>
          </div>
          <p className="text-xs text-[#555] mb-3 truncate">{crime.description}</p>
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center backdrop-blur-[1px]" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <span className="text-lg">🔒</span>
          </div>
          <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">Nível {crime.required_level}</span>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={canCommit ? { y: -2 } : {}}
      onClick={() => canCommit && onCommit(crime.id)}
      className={`group relative rounded-xl ce-shine transition-all duration-200 ${canCommit ? "cursor-pointer" : "opacity-50 cursor-not-allowed"}`}
      style={{
        background: "linear-gradient(145deg, #141414, #0f0f0f)",
        border: `1px solid ${canCommit ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)"}`,
        boxShadow: "0 2px 12px rgba(0,0,0,0.5)",
      }}
    >
      <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
        style={{ background: "linear-gradient(145deg, rgba(255,106,0,0.04) 0%, transparent 60%)", border: "1px solid rgba(255,106,0,0.2)" }} />
      <div className="p-4 relative z-10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base flex-shrink-0">{icon}</span>
            <span className="text-sm font-bold text-white truncate">{crime.name}</span>
          </div>
          <span className="text-xs font-black ce-text-green flex-shrink-0 ml-2">{successPct}%</span>
        </div>
        <p className="text-xs ce-text-muted mb-3.5 leading-relaxed line-clamp-2">{crime.description}</p>
        <div className="flex items-center gap-2 text-[10px] font-bold flex-wrap mb-3">
          <span className="ce-badge ce-badge-green py-0.5">S {successPct}%</span>
          <span className="ce-badge ce-badge-red py-0.5">P {jailPct}%</span>
          <span className={`ce-badge py-0.5 ${canAfford ? "ce-badge-orange" : "ce-badge-red"}`}>ST {crime.stamina_cost}</span>
          <span className="ce-badge ce-badge-gold py-0.5">${fmt(crime.min_dirty_cash)}-${fmt(crime.max_dirty_cash)}</span>
        </div>
        {isProcessing && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 border border-orange-500/40 border-t-orange-500 rounded-full animate-spin" />
            <span className="ce-text-orange text-[10px] font-bold">A executar...</span>
          </div>
        )}
        {!canAfford && !player.in_jail && (
          <p className="text-[10px] ce-text-red font-bold">Stamina insuficiente</p>
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
  const [arrestEscape, setArrestEscape] = useState<{ token: string; jailMinutes: number } | null>(null);

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
      if (data.escape_token) {
        setArrestEscape({ token: data.escape_token, jailMinutes: data.jail_time_minutes });
      }
      notifyPlayerUpdate();
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
      <div className="ce-noise" />
      <div className="absolute inset-0 pointer-events-none z-0"
        style={{ background: "radial-gradient(ellipse at 50% -10%, rgba(255,106,0,0.05) 0%, transparent 60%)" }} />
      <div className="relative z-10 max-w-5xl mx-auto">
        <div className="ce-page-header">
          <p className="ce-page-eyebrow">Crime Empire</p>
          <h1 className="ce-page-title">OPERAÇÕES <span className="ce-page-title-accent">CRIMINOSAS</span></h1>
          <p className="ce-text-muted text-sm mt-1">Seleciona uma operação, executa sem testemunhas.</p>
          <div className="ce-page-divider" />
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
          <p className="ce-section-label mb-4">Todas as Operações</p>
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
            <div className={`ce-card relative rounded-2xl overflow-hidden shadow-2xl ${crimeResult.success ? "ce-card-green" : "ce-card-red"}`}
              style={{ boxShadow: crimeResult.success ? "0 0 40px #16a34a22, 0 8px 32px rgba(0,0,0,0.6)" : "0 0 40px #dc262622, 0 8px 32px rgba(0,0,0,0.6)" }}>
              <div className="h-[2px] w-full"
                style={{ background: crimeResult.success ? "linear-gradient(90deg, transparent, #22c55e, transparent)" : "linear-gradient(90deg, transparent, #ef4444, transparent)" }} />
              <div className="absolute bottom-0 left-0 h-[2px] w-full bg-[#111]">
                <motion.div initial={{ width: "100%" }} animate={{ width: "0%" }} transition={{ duration: 3, ease: "linear" }}
                  className="h-full" style={{ background: crimeResult.success ? "#22c55e" : "#ef4444" }} />
              </div>
              <div className="px-5 py-4">
                <p className="ce-page-eyebrow mb-1">{crimes.find((c) => c.id === selectedCrime)?.name ?? "Crime"}</p>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${crimeResult.success ? "ce-glow-green" : "ce-glow-red"}`}
                    style={{ background: crimeResult.success ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)" }}>
                    {crimeResult.success ? "✅" : "❌"}
                  </div>
                  <h2 className={`text-2xl font-black tracking-tight ${crimeResult.success ? "ce-text-green" : "ce-text-red"}`}>
                    {crimeResult.success ? "SUCESSO!" : "FALHOU!"}
                  </h2>
                </div>
                {crimeResult.success && (
                  <div className="space-y-2 mb-3">
                    {[
                      crimeResult.dirty_cash_earned > 0 ? { icon: "💵", label: "Dinheiro Sujo", value: `+$${(crimeResult.dirty_cash_earned as number)?.toLocaleString()}`, color: "#4ade80", delay: 0.05 } : null,
                      crimeResult.clean_cash_earned  > 0 ? { icon: "💴", label: "Dinheiro Limpo", value: `+$${(crimeResult.clean_cash_earned  as number)?.toLocaleString()}`, color: "#34d399", delay: 0.08 } : null,
                      { icon: "⭐", label: "XP",            value: `+${crimeResult.xp_earned}`,                                       color: "#60a5fa", delay: 0.1  },
                      { icon: "👑", label: "Respeito",      value: `+${crimeResult.respect_earned}`,                                  color: "#c084fc", delay: 0.15 },
                    ].filter(Boolean).map((r: any) => (
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
                          <span className="ce-stat-label text-[10px]">{r.label}</span>
                        </div>
                        <span className="text-sm font-black" style={{ color: r.color }}>{r.value}</span>
                      </motion.div>
                    ))}
                    {crimeResult.leveled_up && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg ce-badge ce-badge-gold"
                      >
                        <span className="text-sm">🎉</span>
                        <span className="text-xs font-black uppercase tracking-wide">
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
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg mt-2 ce-card ce-card-red"
                  >
                    <span className="text-lg">🚔</span>
                    <div>
                      <p className="text-xs font-black ce-text-red">Foste apanhado!</p>
                      <p className="text-[10px] ce-text-muted">Prisão por {crimeResult.jail_time_minutes as number} min</p>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {arrestEscape && (
        <RaidEscape
          difficulty={arrestEscape.jailMinutes >= 35 ? "high" : arrestEscape.jailMinutes >= 25 ? "medium" : "low"}
          cashAtRisk={0}
          onEscape={async () => {
            const token = arrestEscape.token;
            setArrestEscape(null);
            await fetch("/api/crime-empire/escape-attempt", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token, escaped: true }),
            });
            fetchPlayer();
          }}
          onArrested={async () => {
            const token = arrestEscape.token;
            setArrestEscape(null);
            await fetch("/api/crime-empire/escape-attempt", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token, escaped: false }),
            });
            router.push("/jogos/crime-empire/jail");
          }}
        />
      )}
    </div>
  );
}