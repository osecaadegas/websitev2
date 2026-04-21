"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import GiveawaySpin from "@/components/GiveawaySpin";

/* ── Types ──────────────────────────────────────────────────── */
interface Giveaway {
  id: string;
  title: string;
  description: string;
  mode: "single" | "tickets";
  ticket_cost: number;
  max_entries_per_user: number | null;
  prize: string;
  prize_image: string | null;
  duration_seconds: number;
  start_time: string | null;
  end_time: string | null;
  is_active: boolean;
  is_ended: boolean;
  chat_command: string;
  created_at: string;
}

interface Participant {
  id: string;
  twitch_id: string;
  twitch_username: string;
  tickets: number;
}

interface Winner {
  twitch_id: string;
  twitch_username: string;
  selected_at: string;
}

/* ── Sound helper ───────────────────────────────────────────── */
function playCoinSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
    if (navigator.vibrate) navigator.vibrate(50);
  } catch { /* noop */ }
}

/* ── Countdown Hook ─────────────────────────────────────────── */
function useCountdown(endTime: string | null) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!endTime) { setRemaining(0); return; }
    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(endTime).getTime() - Date.now()) / 1000));
      setRemaining(diff);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [endTime]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  return { remaining, display: `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}` };
}

/* ── Main Component ─────────────────────────────────────────── */
export default function GiveawayArena() {
  const { user, login } = useAuth();
  const [giveaway, setGiveaway] = useState<Giveaway | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [myTickets, setMyTickets] = useState(0);
  const [ticketInput, setTicketInput] = useState(1);
  const [entering, setEntering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entryPulse, setEntryPulse] = useState(false);
  const [celebrationWinner, setCelebrationWinner] = useState<Winner | null>(null);
  const [pastGiveaways, setPastGiveaways] = useState<Giveaway[]>([]);
  const [tab, setTab] = useState<"active" | "archive">("active");
  const prevParticipantCount = useRef(0);

  /* ── Load active giveaway ─────────────────────────────────── */
  const loadActive = useCallback(async () => {
    const res = await fetch("/api/giveaways?active=true");
    const data = await res.json();
    const active = (data.giveaways ?? [])[0] || null;

    if (active) {
      setGiveaway(active);
      // Load detail
      const detailRes = await fetch(`/api/giveaways?id=${active.id}`);
      const detailData = await detailRes.json();
      setParticipants(detailData.participants ?? []);
      setWinners(detailData.winners ?? []);
    } else {
      setGiveaway(null);
      setParticipants([]);
      setWinners([]);
    }
  }, []);

  const loadPast = useCallback(async () => {
    const res = await fetch("/api/giveaways");
    const data = await res.json();
    setPastGiveaways((data.giveaways ?? []).filter((g: Giveaway) => g.is_ended));
  }, []);

  useEffect(() => {
    loadActive();
    loadPast();
  }, [loadActive, loadPast]);

  // Update my tickets
  useEffect(() => {
    if (!user || !giveaway) { setMyTickets(0); return; }
    const mine = participants.find((p) => p.twitch_id === user.id);
    setMyTickets(mine?.tickets ?? 0);
  }, [participants, user, giveaway]);

  /* ── Realtime ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!giveaway) return;

    const channel = supabase
      .channel(`giveaway-user-${giveaway.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "giveaway_participants", filter: `giveaway_id=eq.${giveaway.id}` },
        () => loadActive()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "giveaways", filter: `id=eq.${giveaway.id}` },
        (payload) => {
          const updated = payload.new as Giveaway;
          setGiveaway(updated);

          // If giveaway just ended, check for winner
          if (updated.is_ended) {
            loadActive();
            loadPast();
            // Fetch winner
            fetch(`/api/giveaways?id=${updated.id}`)
              .then((r) => r.json())
              .then((d) => {
                const w = (d.winners ?? [])[0];
                if (w) setCelebrationWinner(w);
              });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [giveaway?.id, loadActive, loadPast]);

  // Detect new participants for pulse effect
  useEffect(() => {
    if (participants.length > prevParticipantCount.current && prevParticipantCount.current > 0) {
      setEntryPulse(true);
      setTimeout(() => setEntryPulse(false), 600);
    }
    prevParticipantCount.current = participants.length;
  }, [participants.length]);

  /* ── Enter giveaway ───────────────────────────────────────── */
  const handleEnter = async () => {
    if (!user) { login(); return; }
    if (!giveaway) return;

    setEntering(true);
    setError(null);

    const res = await fetch("/api/giveaways/enter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        giveaway_id: giveaway.id,
        ticket_count: giveaway.mode === "tickets" ? ticketInput : 1,
      }),
    });

    const data = await res.json();
    setEntering(false);

    if (data.success) {
      playCoinSound();
      setMyTickets(data.tickets);
      setEntryPulse(true);
      setTimeout(() => setEntryPulse(false), 600);
      loadActive();
    } else {
      setError(data.error);
    }
  };

  const { remaining, display } = useCountdown(giveaway?.is_active ? giveaway?.end_time : null);
  const totalTickets = participants.reduce((s, p) => s + p.tickets, 0);
  const myChance = totalTickets > 0 && myTickets > 0 ? ((myTickets / totalTickets) * 100).toFixed(1) : null;

  return (
    <div className="space-y-8">
      {/* Tab switcher */}
      <div className="flex gap-3">
        {(["active", "archive"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-[family-name:var(--font-display)] tracking-wider transition-all ${
              tab === t
                ? "bg-arena-gold/20 text-arena-gold border border-arena-gold/30"
                : "bg-white/5 text-arena-smoke/60 border border-white/10 hover:bg-white/10"
            }`}
          >
            {t === "active" ? "⚔ Arena Ativa" : "📜 Arquivo"}
          </button>
        ))}
      </div>

      {tab === "active" ? (
        giveaway ? (
          <div className="space-y-6">
            {/* Main Card */}
            <motion.div
              className={`relative rounded-2xl border-2 overflow-hidden transition-all ${
                giveaway.is_active ? "border-arena-gold/40" : "border-white/10"
              }`}
              animate={entryPulse ? { boxShadow: ["0 0 0 0 rgba(212,168,67,0)", "0 0 30px 10px rgba(212,168,67,0.3)", "0 0 0 0 rgba(212,168,67,0)"] } : {}}
              transition={{ duration: 0.6 }}
            >
              {/* Background gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-arena-charcoal via-arena-dark to-black" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(212,168,67,0.08),transparent_60%)]" />

              <div className="relative p-6 sm:p-8">
                {/* Status + Title */}
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      {giveaway.is_active && (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          ATIVO
                        </span>
                      )}
                      <span className="px-2.5 py-1 rounded-full bg-white/10 text-arena-smoke/60 text-xs">
                        {giveaway.mode === "single" ? "Entrada Única" : "Sistema de Tickets"}
                      </span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-arena-gold font-[family-name:var(--font-display)] tracking-wide">
                      {giveaway.title}
                    </h2>
                    {giveaway.description && (
                      <p className="text-arena-smoke text-sm mt-2 max-w-xl">{giveaway.description}</p>
                    )}
                  </div>

                  {/* Prize */}
                  {giveaway.prize && (
                    <div className="hidden sm:block text-right">
                      <p className="text-xs text-arena-smoke/50 uppercase tracking-wider">Prémio</p>
                      <p className="text-lg text-arena-gold-light font-[family-name:var(--font-display)]">{giveaway.prize}</p>
                    </div>
                  )}
                </div>

                {/* Prize mobile */}
                {giveaway.prize && (
                  <div className="sm:hidden mb-6 p-3 rounded-lg bg-arena-gold/10 border border-arena-gold/20 text-center">
                    <p className="text-xs text-arena-smoke/50 uppercase tracking-wider">Prémio</p>
                    <p className="text-lg text-arena-gold-light font-[family-name:var(--font-display)]">{giveaway.prize}</p>
                  </div>
                )}

                {/* Timer */}
                {giveaway.is_active && giveaway.end_time && (
                  <div className="text-center mb-8">
                    <p className="text-xs text-arena-smoke/50 uppercase tracking-wider mb-2 font-[family-name:var(--font-display)]">
                      Tempo Restante
                    </p>
                    <motion.p
                      className={`text-6xl sm:text-7xl font-bold font-[family-name:var(--font-display)] tracking-[0.15em] ${
                        remaining <= 30 ? "text-arena-red" : remaining <= 60 ? "text-arena-ember" : "text-arena-gold"
                      }`}
                      animate={remaining <= 10 && remaining > 0 ? { scale: [1, 1.05, 1] } : {}}
                      transition={{ duration: 0.5, repeat: Infinity }}
                      style={{
                        textShadow: remaining <= 30
                          ? "0 0 30px rgba(198,40,40,0.5)"
                          : "0 0 20px rgba(212,168,67,0.3)",
                      }}
                    >
                      {display}
                    </motion.p>
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  <div className="rounded-lg bg-white/5 border border-white/5 p-3 text-center">
                    <p className="text-xs text-arena-smoke/50 uppercase tracking-wider">Participantes</p>
                    <p className="text-2xl font-bold text-arena-gold font-[family-name:var(--font-display)]">
                      {participants.length}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/5 border border-white/5 p-3 text-center">
                    <p className="text-xs text-arena-smoke/50 uppercase tracking-wider">Total Tickets</p>
                    <p className="text-2xl font-bold text-arena-gold font-[family-name:var(--font-display)]">
                      {totalTickets}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/5 border border-white/5 p-3 text-center">
                    <p className="text-xs text-arena-smoke/50 uppercase tracking-wider">Os Teus Tickets</p>
                    <p className="text-2xl font-bold text-arena-gold font-[family-name:var(--font-display)]">
                      {myTickets}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/5 border border-white/5 p-3 text-center">
                    <p className="text-xs text-arena-smoke/50 uppercase tracking-wider">Hipótese</p>
                    <p className="text-2xl font-bold text-arena-gold font-[family-name:var(--font-display)]">
                      {myChance ? `${myChance}%` : "—"}
                    </p>
                  </div>
                </div>

                {/* Entry section */}
                {giveaway.is_active && (
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    {giveaway.mode === "tickets" && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setTicketInput(Math.max(1, ticketInput - 1))}
                          className="w-10 h-10 rounded-lg bg-white/10 text-arena-smoke hover:bg-white/20 transition-all text-xl font-bold"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={giveaway.max_entries_per_user ? giveaway.max_entries_per_user - myTickets : 100}
                          value={ticketInput}
                          onChange={(e) => setTicketInput(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-16 h-10 rounded-lg bg-white/5 border border-white/10 text-center text-arena-gold font-bold text-lg focus:border-arena-gold/40 focus:outline-none"
                        />
                        <button
                          onClick={() => setTicketInput(ticketInput + 1)}
                          className="w-10 h-10 rounded-lg bg-white/10 text-arena-smoke hover:bg-white/20 transition-all text-xl font-bold"
                        >
                          ＋
                        </button>
                      </div>
                    )}

                    <button
                      onClick={handleEnter}
                      disabled={entering || (giveaway.mode === "single" && myTickets > 0)}
                      className="flex-1 sm:flex-none px-8 py-3 rounded-xl bg-arena-gold text-black font-bold text-lg font-[family-name:var(--font-display)] tracking-wider hover:bg-arena-gold-light transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-arena-gold/20"
                    >
                      {entering ? (
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                          A entrar...
                        </span>
                      ) : giveaway.mode === "single" && myTickets > 0 ? (
                        "✓ Já Inscrito"
                      ) : (
                        <>⚔ {!user ? "Iniciar Sessão" : "Entrar na Arena"}</>
                      )}
                    </button>

                    {giveaway.ticket_cost > 0 && (
                      <p className="text-xs text-arena-smoke/50">
                        Custo: {giveaway.ticket_cost * (giveaway.mode === "tickets" ? ticketInput : 1)} SE Points
                      </p>
                    )}
                  </div>
                )}

                {/* Ended state with winner */}
                {giveaway.is_ended && winners.length > 0 && (
                  <div className="text-center py-4">
                    <p className="text-sm text-arena-smoke/50 uppercase tracking-wider mb-2">Vencedor</p>
                    <p className="text-3xl font-bold text-arena-gold font-[family-name:var(--font-display)]" style={{ textShadow: "0 0 20px rgba(212,168,67,0.4)" }}>
                      🏆 {winners[0].twitch_username}
                    </p>
                  </div>
                )}

                {/* Chat command hint */}
                <div className="mt-4 text-center">
                  <p className="text-xs text-arena-smoke/40">
                    Também podes participar pelo chat Twitch: <span className="text-arena-gold font-mono">{giveaway.chat_command}</span>
                    {giveaway.mode === "tickets" && <> (ex: <span className="font-mono text-arena-gold">{giveaway.chat_command} 5</span>)</>}
                  </p>
                </div>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center"
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* Top Participants leaderboard */}
            {participants.length > 0 && (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <h3 className="text-sm font-bold text-arena-smoke/70 uppercase tracking-wider mb-4 font-[family-name:var(--font-display)]">
                  ⚔ Gladiadores na Arena
                </h3>
                <div className="space-y-1">
                  {participants
                    .sort((a, b) => b.tickets - a.tickets)
                    .slice(0, 20)
                    .map((p, i) => {
                      const chance = totalTickets > 0 ? ((p.tickets / totalTickets) * 100).toFixed(1) : "0";
                      const isMe = user && p.twitch_id === user.id;
                      return (
                        <div
                          key={p.id}
                          className={`flex items-center justify-between py-2 px-3 rounded-lg transition-colors ${
                            isMe ? "bg-arena-gold/10 border border-arena-gold/20" : "hover:bg-white/5"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`text-sm w-6 text-right ${i < 3 ? "text-arena-gold font-bold" : "text-arena-smoke/40"}`}>
                              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}
                            </span>
                            <span className={`text-sm ${isMe ? "text-arena-gold font-bold" : "text-arena-smoke"}`}>
                              {p.twitch_username} {isMe && "(tu)"}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs">
                            <span className="text-arena-smoke/60">{p.tickets} ticket{p.tickets > 1 ? "s" : ""}</span>
                            <span className="text-arena-gold w-12 text-right">{chance}%</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* No active giveaway */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-6xl mb-6">⚔️</div>
            <h2 className="text-2xl font-bold text-arena-gold font-[family-name:var(--font-display)] tracking-wider mb-3">
              A Arena Está em Repouso
            </h2>
            <p className="text-arena-smoke text-sm max-w-md">
              Não há giveaways ativos de momento. Fica atento ao stream para o próximo confronto!
            </p>
          </div>
        )
      ) : (
        /* Archive tab */
        <div className="space-y-3">
          {pastGiveaways.length === 0 ? (
            <p className="text-arena-smoke/50 text-sm text-center py-12">Nenhum giveaway passado.</p>
          ) : (
            pastGiveaways.map((g) => (
              <PastGiveawayCard key={g.id} giveaway={g} />
            ))
          )}
        </div>
      )}

      {/* Spin Roulette + Celebration */}
      <GiveawaySpin
        winner={celebrationWinner}
        participants={participants}
        prize={giveaway?.prize}
        onDismiss={() => setCelebrationWinner(null)}
      />
    </div>
  );
}

/* ── Past Giveaway Card ──────────────────────────────────────── */
function PastGiveawayCard({ giveaway }: { giveaway: Giveaway }) {
  const [winner, setWinner] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    fetch(`/api/giveaways?id=${giveaway.id}`)
      .then((r) => r.json())
      .then((d) => {
        const w = (d.winners ?? [])[0];
        if (w) setWinner(w.twitch_username);
      });
  }, [expanded, giveaway.id]);

  return (
    <button
      onClick={() => setExpanded(!expanded)}
      className="w-full text-left rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] p-4 transition-all"
    >
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-bold text-arena-gold font-[family-name:var(--font-display)]">{giveaway.title}</h4>
          <div className="flex gap-2 text-xs text-arena-smoke/50 mt-1">
            <span>{new Date(giveaway.created_at).toLocaleDateString("pt-PT")}</span>
            <span>·</span>
            <span>{giveaway.prize || "—"}</span>
          </div>
        </div>
        <svg className={`w-4 h-4 text-arena-smoke/40 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {expanded && winner && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <p className="text-sm text-arena-smoke">
            Vencedor: <span className="text-arena-gold font-bold">{winner}</span>
          </p>
        </div>
      )}
    </button>
  );
}
