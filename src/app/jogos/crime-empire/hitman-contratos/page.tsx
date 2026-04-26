"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { CEToast } from "@/components/CEToast";
import { useRouter } from "next/navigation";
import { notifyPlayerUpdate } from "@/lib/crime-empire/player-context";
import { pushReward } from "@/components/crime-empire/ui/GlobalRewardLayer";
import {
  pickBountyFlavor,
  riskTier,
  RISK_META,
  rewardTier,
  REWARD_META,
  avatarInitials,
  avatarHue,
  type RiskTier,
} from "@/lib/crime-empire/bounty-flavor";

/* ─── Types ──────────────────────────────────────────────────── */
interface HitmanContract {
  id: string;
  requester_id: string;
  target_id: string;
  target_username: string;
  target_display_name: string;
  target_level: number;
  reward_cash: number;
  status: "open" | "completed" | "failed" | "cancelled";
  executed_by: string | null;
  created_at: string;
  expires_at: string;
  message: string | null;
}

interface SearchResult {
  id: string;
  username: string;
  display_name: string;
  level: number;
  class: string;
}

interface Player {
  id: string;
  level: number;
  cash: number;
  dirty_cash: number;
  class: string;
  display_name: string;
  username: string;
  in_jail: boolean;
  hp: number;
}

/* ─── Helpers ────────────────────────────────────────────────── */
function minBounty(level: number) {
  return Math.max(10_000, level * 3_000);
}
function hitChance(myLevel: number, targetLevel: number) {
  const raw = 0.50 + (myLevel - targetLevel) * 0.02;
  return Math.round(Math.min(80, Math.max(20, raw * 100)));
}
function timeLeft(expires_at: string) {
  const diff = new Date(expires_at).getTime() - Date.now();
  if (diff <= 0) return "Expirado";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function isHot(created_at: string) {
  return Date.now() - new Date(created_at).getTime() < 30 * 60_000;
}

const CLASS_LABEL: Record<string, string> = {
  thief: "Ladrão", hooligan: "Hooligan", businessman: "Empresário",
  hitman: "Assassino", scammer: "Burlão", brute: "Bruto",
  dealer: "Traficante", pimp: "Chulo",
};

/* ─── Wanted Poster Card ─────────────────────────────────────── */
function WantedPosterCard({
  contract, myLevel, isOwn, processing,
  onExecute, onCancel, onSkip,
}: {
  contract: HitmanContract;
  myLevel: number;
  isOwn: boolean;
  processing: string | null;
  onExecute: (id: string) => void;
  onCancel: (id: string) => void;
  onSkip?: (id: string) => void;
}) {
  const remaining = timeLeft(contract.expires_at);
  const expired = remaining === "Expirado";
  const isBusy = processing === contract.id;

  const risk: RiskTier = riskTier(myLevel, contract.target_level);
  const rMeta = RISK_META[risk];
  const reward = rewardTier(contract.reward_cash);
  const wMeta = REWARD_META[reward];
  const flavor = useMemo(() => pickBountyFlavor(contract.id), [contract.id]);
  const chance = hitChance(myLevel, contract.target_level);
  const hot = isHot(contract.created_at);
  const legendary = reward === "lendario";

  const display = contract.target_display_name || contract.target_username;
  const initials = avatarInitials(display);
  const hue = avatarHue(contract.target_username);

  // Drag (swipe) gesture
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-6, 0, 6]);
  const skipOpacity = useTransform(x, [-150, -40, 0], [1, 0, 0]);
  const attackOpacity = useTransform(x, [0, 40, 150], [0, 0, 1]);

  const handleDragEnd = (_: unknown, info: { offset: { x: number } }) => {
    if (isOwn || expired || isBusy) return;
    if (info.offset.x > 130) onExecute(contract.id);
    else if (info.offset.x < -130 && onSkip) onSkip(contract.id);
  };

  return (
    <motion.div
      drag={isOwn || expired ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.6}
      onDragEnd={handleDragEnd}
      style={{ x, rotate }}
      whileTap={{ scale: 0.985 }}
      className="relative select-none"
    >
      {/* Swipe hint overlays */}
      <motion.div
        style={{ opacity: skipOpacity }}
        className="absolute inset-y-0 left-3 flex items-center pointer-events-none z-20"
      >
        <span
          className="text-[10px] font-black tracking-[0.3em] px-3 py-2 rounded-lg"
          style={{ background: "rgba(120,113,108,0.25)", color: "#d6d3d1", border: "1px solid rgba(214,211,209,0.4)" }}
        >
          PASSAR
        </span>
      </motion.div>
      <motion.div
        style={{ opacity: attackOpacity }}
        className="absolute inset-y-0 right-3 flex items-center pointer-events-none z-20"
      >
        <span
          className="text-[10px] font-black tracking-[0.3em] px-3 py-2 rounded-lg"
          style={{ background: "rgba(220,38,38,0.25)", color: "#fecaca", border: "1px solid rgba(239,68,68,0.55)" }}
        >
          ATACAR →
        </span>
      </motion.div>

      <div
        className={`relative rounded-[18px] overflow-hidden ${legendary ? "wanted-pulse" : ""}`}
        style={{
          background: "radial-gradient(120% 100% at 50% 0%, #2a1d10 0%, #181109 55%, #0d0905 100%)",
          border: `1.5px solid ${wMeta.border}`,
          boxShadow: `0 10px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,200,140,0.07), 0 0 ${legendary ? 32 : 14}px ${rMeta.glow}`,
          filter: expired ? "grayscale(0.6)" : undefined,
        }}
      >
        {/* Paper grain */}
        <div className="absolute inset-0 pointer-events-none wanted-grain opacity-[0.18]" />
        {/* Torn-edge notches */}
        <div className="absolute -top-2 left-6 w-10 h-4 rounded-b-full" style={{ background: "#0b0807" }} />
        <div className="absolute -top-2 right-6 w-10 h-4 rounded-b-full" style={{ background: "#0b0807" }} />
        <div className="absolute -bottom-2 left-10 w-12 h-4 rounded-t-full" style={{ background: "#0b0807" }} />
        <div className="absolute -bottom-2 right-12 w-8 h-4 rounded-t-full" style={{ background: "#0b0807" }} />

        {/* Light sweep */}
        {(reward === "elite" || legendary) && !expired && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div
              className="wanted-sweep absolute -inset-x-full top-0 h-full w-1/3"
              style={{ background: "linear-gradient(115deg, transparent 30%, rgba(255,220,160,0.10) 50%, transparent 70%)" }}
            />
          </div>
        )}

        {/* Header */}
        <div className="relative px-5 pt-4 pb-2 text-center">
          <div className="flex items-center justify-center gap-2">
            <span
              className="h-px flex-1 max-w-[60px]"
              style={{ background: "linear-gradient(to right, transparent, rgba(251,191,36,0.5), transparent)" }}
            />
            <span
              className="text-[9px] font-black tracking-[0.55em]"
              style={{ color: "#e6c483", fontFamily: "'Courier New', monospace", textShadow: "0 1px 0 rgba(0,0,0,0.6)" }}
            >
              {legendary ? "DEAD OR ALIVE" : "WANTED"}
            </span>
            <span
              className="h-px flex-1 max-w-[60px]"
              style={{ background: "linear-gradient(to right, transparent, rgba(251,191,36,0.5), transparent)" }}
            />
          </div>
          <div className="text-[7px] tracking-[0.4em] mt-0.5" style={{ color: "rgba(214,170,90,0.5)" }}>
            BY ORDER · MERCADO NEGRO
          </div>

          {/* Tier ribbon */}
          <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
            <span
              className="text-[8px] font-black tracking-[0.25em] px-2 py-0.5 rounded"
              style={{ background: `${wMeta.color}1c`, color: wMeta.color, border: `1px solid ${wMeta.color}55` }}
            >
              {wMeta.label}
            </span>
            {hot && !expired && (
              <span
                className="text-[7px] font-black tracking-[0.3em] px-1.5 py-0.5 rounded animate-pulse"
                style={{ background: "rgba(239,68,68,0.18)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.45)" }}
              >
                🔥 HOT
              </span>
            )}
          </div>
        </div>

        <div className="relative px-5 pb-4">
          <div className="flex items-start gap-4">
            {/* Mugshot */}
            <div
              className="relative w-20 h-20 rounded-md flex items-center justify-center flex-shrink-0"
              style={{
                background: `linear-gradient(135deg, hsl(${20 + hue},45%,18%), hsl(${10 + hue},55%,28%))`,
                border: "2px solid rgba(120,80,30,0.55)",
                boxShadow: "inset 0 0 14px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.5)",
              }}
            >
              <span
                className="text-3xl font-black"
                style={{ color: "#f4d9a8", fontFamily: "Georgia, serif", textShadow: "0 2px 4px rgba(0,0,0,0.6)" }}
              >
                {initials}
              </span>
              <span
                className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-sm"
                style={{ background: rMeta.color, boxShadow: `0 0 10px ${rMeta.glow}`, border: "2px solid #0d0905" }}
              >
                {rMeta.icon}
              </span>
            </div>

            {/* Identity */}
            <div className="flex-1 min-w-0">
              <div className="text-[8px] tracking-[0.35em] mb-0.5" style={{ color: "rgba(200,160,90,0.45)" }}>NOME</div>
              <div
                className="text-xl font-black leading-none truncate"
                style={{
                  color: "#f3dba5",
                  fontFamily: "Georgia, serif",
                  letterSpacing: "-0.01em",
                  textShadow: "0 2px 6px rgba(0,0,0,0.6)",
                }}
              >
                {display}
              </div>
              <div className="text-[10px] mt-0.5 truncate" style={{ color: "rgba(180,130,60,0.55)" }}>
                @{contract.target_username}
              </div>

              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span
                  className="text-[8px] font-black px-1.5 py-0.5 rounded tracking-widest"
                  style={{ background: "rgba(200,160,60,0.10)", color: "#e6c483", border: "1px solid rgba(200,160,60,0.25)" }}
                >
                  NÍV {contract.target_level}
                </span>
                <span
                  className="text-[8px] font-black px-1.5 py-0.5 rounded tracking-widest"
                  style={{ background: `${rMeta.color}1a`, color: rMeta.color, border: `1px solid ${rMeta.color}55` }}
                >
                  {rMeta.short}
                </span>
                {!isOwn && (
                  <span
                    className="text-[8px] font-black px-1.5 py-0.5 rounded tracking-widest"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      color: chance >= 60 ? "#86efac" : chance >= 40 ? "#fde68a" : "#fca5a5",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    {chance}% HIT
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Bounty banner */}
          <div
            className="relative mt-4 rounded-lg overflow-hidden"
            style={{
              background: wMeta.gradient,
              border: `1px solid ${wMeta.border}`,
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -2px 0 rgba(0,0,0,0.35), 0 0 14px ${rMeta.glow}`,
            }}
          >
            {legendary && (
              <div
                className="absolute inset-0 wanted-shimmer pointer-events-none"
                style={{ background: "linear-gradient(120deg, transparent 35%, rgba(255,240,200,0.35) 50%, transparent 65%)" }}
              />
            )}
            <div className="relative flex items-center justify-between px-4 py-2.5">
              <div>
                <div className="text-[8px] font-black tracking-[0.4em]" style={{ color: "rgba(255,240,200,0.7)" }}>
                  RECOMPENSA
                </div>
                <div
                  className="text-2xl font-black tabular-nums leading-none mt-0.5"
                  style={{
                    color: "#fff8e3",
                    fontFamily: "Georgia, serif",
                    textShadow: "0 2px 4px rgba(0,0,0,0.55), 0 0 10px rgba(255,200,120,0.35)",
                  }}
                >
                  ${contract.reward_cash.toLocaleString()}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[8px] font-black tracking-[0.3em]" style={{ color: "rgba(255,240,200,0.6)" }}>
                  EXPIRA
                </div>
                <div className="text-xs font-black tabular-nums" style={{ color: expired ? "#fca5a5" : "#fff8e3" }}>
                  {remaining}
                </div>
              </div>
            </div>
          </div>

          {/* Flavor */}
          <div
            className="mt-3 px-3 py-2 rounded-md text-[10.5px] italic leading-snug"
            style={{
              color: "rgba(240,210,140,0.78)",
              background: "rgba(255,200,140,0.04)",
              border: "1px dashed rgba(200,160,90,0.20)",
              fontFamily: "Georgia, serif",
            }}
          >
            “{contract.message?.trim() || flavor}”
          </div>

          {/* Actions */}
          {isOwn ? (
            <button
              onClick={() => onCancel(contract.id)}
              disabled={isBusy || expired}
              className="mt-3 w-full py-2.5 rounded-lg text-[10px] font-black tracking-[0.25em] transition-all active:scale-95"
              style={{
                background: "rgba(239,68,68,0.10)",
                color: "#fecaca",
                border: "1px solid rgba(239,68,68,0.30)",
                cursor: isBusy ? "wait" : "pointer",
                opacity: expired ? 0.4 : 1,
              }}
            >
              {isBusy ? "..." : "CANCELAR · REEMBOLSO 75%"}
            </button>
          ) : (
            <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
              <button
                onClick={() => onExecute(contract.id)}
                disabled={isBusy || expired}
                className="relative py-3 rounded-lg text-[11px] font-black tracking-[0.25em] transition-all active:scale-95 overflow-hidden"
                style={{
                  background: isBusy
                    ? "linear-gradient(135deg, #5b1d05, #8a3308)"
                    : "linear-gradient(135deg, #7f1d1d 0%, #c2410c 50%, #ff6a00 100%)",
                  color: "#fff8e3",
                  border: `1px solid ${rMeta.color}`,
                  boxShadow: isBusy ? "none" : `0 0 18px ${rMeta.glow}`,
                  cursor: isBusy ? "wait" : expired ? "not-allowed" : "pointer",
                  opacity: expired ? 0.4 : 1,
                  fontFamily: "Georgia, serif",
                }}
              >
                {isBusy ? "EM CURSO…" : (
                  <span className="inline-flex items-center gap-2">
                    <span>🔫</span>
                    <span>{legendary ? "CAÇAR" : "ATACAR"}</span>
                  </span>
                )}
              </button>
              {onSkip && (
                <button
                  onClick={() => onSkip(contract.id)}
                  disabled={isBusy}
                  className="px-3 py-3 rounded-lg text-[10px] font-black tracking-[0.2em] transition-all active:scale-95"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    color: "rgba(214,211,209,0.6)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                  title="Passar"
                >
                  PASSAR
                </button>
              )}
            </div>
          )}
        </div>

        {/* Bottom strip */}
        <div className="relative px-5 pb-3 flex items-center justify-between">
          <span className="text-[7px] tracking-[0.4em]" style={{ color: "rgba(180,130,60,0.4)" }}>
            ID·{contract.id.slice(0, 6).toUpperCase()}
          </span>
          <span className="text-[7px] tracking-[0.3em]" style={{ color: "rgba(180,130,60,0.4)" }}>
            {rMeta.label}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── PlaceBountyPanel ───────────────────────────────────────── */
function PlaceBountyPanel({
  player, processing, onPlace,
}: {
  player: Player;
  processing: boolean;
  onPlace: (targetId: string, reward: number, message: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [reward, setReward] = useState("");
  const [msg, setMsg] = useState("");
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/crime-empire/hitman-contratos?search=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.searchResults ?? []);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(search), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, doSearch]);

  const minimum = selected ? minBounty(selected.level) : 10_000;
  const rewardNum = parseInt(reward.replace(/\D/g, ""), 10) || 0;
  const canSubmit = !!selected && rewardNum >= minimum && player.cash >= rewardNum && !processing;
  const chance = selected ? hitChance(player.level, selected.level) : null;

  return (
    <div
      className="rounded-2xl p-5 space-y-4 relative overflow-hidden"
      style={{
        background: "radial-gradient(120% 100% at 50% 0%, #1c1208 0%, #0e0905 100%)",
        border: "1px solid rgba(239,68,68,0.18)",
        boxShadow: "0 0 24px rgba(239,68,68,0.06)",
      }}
    >
      <div className="absolute inset-0 pointer-events-none wanted-grain opacity-[0.10]" />

      <div className="relative flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
          style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)" }}
        >
          💀
        </div>
        <div>
          <div className="text-[10px] font-black tracking-[0.3em] uppercase" style={{ color: "#fca5a5", fontFamily: "Georgia, serif" }}>
            Emitir Recompensa
          </div>
          <div className="text-[8px] tracking-[0.25em]" style={{ color: "rgba(180,130,60,0.5)" }}>
            Põe um nome no quadro. Paga em ouro.
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <label className="text-[8px] font-black tracking-[0.3em] uppercase block mb-1.5" style={{ color: "rgba(200,160,90,0.55)" }}>
          Procurado
        </label>
        {selected ? (
          <div
            className="flex items-center justify-between px-3 py-2.5 rounded-lg"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.28)" }}
          >
            <div>
              <span className="text-sm font-black" style={{ color: "#f3dba5", fontFamily: "Georgia, serif" }}>
                {selected.display_name || selected.username}
              </span>
              <span className="text-[9px] ml-2" style={{ color: "rgba(200,160,90,0.55)" }}>
                Nív {selected.level} · {CLASS_LABEL[selected.class] ?? selected.class}
              </span>
            </div>
            <button
              onClick={() => { setSelected(null); setSearch(""); setResults([]); }}
              className="text-[9px] font-black px-2 py-1 rounded"
              style={{ color: "#fca5a5", background: "rgba(239,68,68,0.10)" }}
            >
              ✕
            </button>
          </div>
        ) : (
          <>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Username do alvo…"
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
            />
            {(results.length > 0 || searching) && (
              <div
                className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl overflow-hidden"
                style={{ background: "#1a120a", border: "1px solid rgba(200,160,90,0.18)" }}
              >
                {searching && (
                  <div className="px-3 py-2 text-[10px]" style={{ color: "rgba(200,160,90,0.5)" }}>A procurar…</div>
                )}
                {results.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => { setSelected(r); setResults([]); setSearch(""); }}
                    className="w-full text-left px-3 py-2.5 flex items-center gap-3 hover:brightness-125 transition-all"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                  >
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center text-sm"
                      style={{ background: "rgba(200,160,90,0.10)", color: "#f3dba5", fontFamily: "Georgia, serif" }}
                    >
                      {avatarInitials(r.display_name || r.username)}
                    </div>
                    <div>
                      <span className="text-sm font-bold text-white block">{r.display_name || r.username}</span>
                      <span className="text-[9px]" style={{ color: "rgba(200,160,90,0.55)" }}>
                        @{r.username} · Nív {r.level} · {CLASS_LABEL[r.class] ?? r.class}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Reward */}
      <div>
        <label className="text-[8px] font-black tracking-[0.3em] uppercase block mb-1.5" style={{ color: "rgba(200,160,90,0.55)" }}>
          Recompensa {selected ? `(min $${minimum.toLocaleString()})` : ""}
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black" style={{ color: "#fbbf24" }}>$</span>
          <input
            type="number"
            value={reward}
            onChange={(e) => setReward(e.target.value)}
            min={minimum}
            placeholder={minimum.toLocaleString()}
            className="w-full pl-7 pr-3 py-2.5 rounded-lg text-sm outline-none"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${rewardNum > 0 && rewardNum < minimum ? "rgba(239,68,68,0.45)" : "rgba(255,255,255,0.08)"}`,
              color: "#fff",
            }}
          />
        </div>
        {selected && rewardNum > 0 && rewardNum < minimum && (
          <p className="text-[9px] mt-1" style={{ color: "#fca5a5" }}>
            Mínimo para nível {selected.level}: ${minimum.toLocaleString()}
          </p>
        )}
        {rewardNum > player.cash && (
          <p className="text-[9px] mt-1" style={{ color: "#fca5a5" }}>
            Dinheiro insuficiente. Tens ${player.cash.toLocaleString()}
          </p>
        )}
      </div>

      {/* Message */}
      <div>
        <label className="text-[8px] font-black tracking-[0.3em] uppercase block mb-1.5" style={{ color: "rgba(200,160,90,0.55)" }}>
          Mensagem (opcional)
        </label>
        <input
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          maxLength={120}
          placeholder="Motivo do contrato…"
          className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
        />
      </div>

      {/* Chance preview */}
      {selected && chance !== null && (
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          <span className="text-[9px]" style={{ color: "rgba(200,160,90,0.55)" }}>
            Um caçador de nível {player.level} teria:
          </span>
          <span
            className="text-sm font-black ml-auto"
            style={{ color: chance >= 60 ? "#86efac" : chance >= 40 ? "#fde68a" : "#fca5a5" }}
          >
            {chance}% chance
          </span>
        </div>
      )}

      <button
        onClick={() => selected && onPlace(selected.id, rewardNum, msg)}
        disabled={!canSubmit}
        className="w-full py-3 rounded-xl text-[11px] font-black tracking-[0.3em] transition-all active:scale-95"
        style={{
          background: canSubmit ? "linear-gradient(135deg, #7f1d1d, #c2410c, #ef4444)" : "rgba(255,255,255,0.04)",
          color: canSubmit ? "#fff8e3" : "rgba(255,255,255,0.2)",
          border: canSubmit ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(255,255,255,0.06)",
          boxShadow: canSubmit ? "0 0 18px rgba(239,68,68,0.25)" : "none",
          cursor: canSubmit ? "pointer" : "not-allowed",
          fontFamily: "Georgia, serif",
        }}
      >
        {processing ? "A PROCESSAR…" : "💀 EMITIR RECOMPENSA"}
      </button>
    </div>
  );
}

/* ─── Filters / Sort ─────────────────────────────────────────── */
type FilterId = "todos" | "alta" | "faceis" | "dificeis" | "recentes";
type SortId = "reward" | "easy" | "recent" | "expiring";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "todos",    label: "TODOS" },
  { id: "alta",     label: "RECOMPENSA ALTA" },
  { id: "faceis",   label: "FÁCEIS" },
  { id: "dificeis", label: "DIFÍCEIS" },
  { id: "recentes", label: "RECENTES" },
];

const SORTS: { id: SortId; label: string }[] = [
  { id: "reward",   label: "Maior recompensa" },
  { id: "easy",     label: "Mais fácil" },
  { id: "recent",   label: "Mais recente" },
  { id: "expiring", label: "A expirar" },
];

/* ─── Main Page ──────────────────────────────────────────────── */
export default function HitmanContratosPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [player, setPlayer] = useState<Player | null>(null);
  const [openBounties, setOpenBounties] = useState<HitmanContract[]>([]);
  const [myBounties, setMyBounties] = useState<HitmanContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [tab, setTab] = useState<"open" | "mine">("open");
  const [showForm, setShowForm] = useState(false);

  const [filter, setFilter] = useState<FilterId>("todos");
  const [sort, setSort] = useState<SortId>("reward");
  const [skipped, setSkipped] = useState<Set<string>>(new Set());

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/crime-empire/hitman-contratos");
    const data = await res.json();
    if (!res.ok) { setLoading(false); return; }
    setPlayer(data.player ?? null);
    setOpenBounties(data.openBounties ?? []);
    setMyBounties(data.myBounties ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) { router.push("/jogos/crime-empire"); return; }
    fetchData();
  }, [user, fetchData, router]);

  const handleExecute = async (contractId: string) => {
    setProcessing(contractId);
    try {
      const res = await fetch("/api/crime-empire/hitman-contratos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "execute", contractId }),
      });
      const data = await res.json();
      if (!res.ok) showToast(data.error ?? "Erro", false);
      else {
        showToast(
          data.success
            ? `${data.message} 💵 +$${data.cash_earned?.toLocaleString()} | ⭐ +${data.xp_earned} XP`
            : `${data.message} (-${data.hp_lost} HP)`,
          data.success,
        );
        if (data.success) {
          if (data.xp_earned) pushReward("xp", `+${data.xp_earned} XP`);
          if (data.cash_earned) pushReward("cash", `+$${Number(data.cash_earned).toLocaleString()}`);
        } else if (data.hp_lost) {
          pushReward("damage", `-${data.hp_lost} HP`);
        }
        notifyPlayerUpdate();
        await fetchData();
      }
    } finally { setProcessing(null); }
  };

  const handleCancel = async (contractId: string) => {
    setProcessing(contractId);
    try {
      const res = await fetch("/api/crime-empire/hitman-contratos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", contractId }),
      });
      const data = await res.json();
      showToast(data.message ?? (res.ok ? "Cancelado" : "Erro"), res.ok);
      if (res.ok) await fetchData();
    } finally { setProcessing(null); }
  };

  const handlePlace = async (targetId: string, reward: number, message: string) => {
    setPlacing(true);
    try {
      const res = await fetch("/api/crime-empire/hitman-contratos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "place", targetId, reward, message: message || null }),
      });
      const data = await res.json();
      showToast(data.message ?? (res.ok ? "Contrato colocado" : "Erro"), res.ok);
      if (res.ok) {
        setShowForm(false);
        notifyPlayerUpdate();
        await fetchData();
      }
    } finally { setPlacing(false); }
  };

  const handleSkip = (id: string) => {
    setSkipped((prev) => new Set(prev).add(id));
  };

  /* Filtering & sorting */
  const filteredOpen = useMemo(() => {
    if (!player) return openBounties;
    let list = openBounties.filter((c) => !skipped.has(c.id));

    if (filter === "alta") list = list.filter((c) => c.reward_cash >= 200_000);
    else if (filter === "faceis") list = list.filter((c) => c.target_level <= player.level + 2);
    else if (filter === "dificeis") list = list.filter((c) => c.target_level > player.level + 2);
    else if (filter === "recentes") list = list.filter((c) => isHot(c.created_at));

    const sorted = [...list];
    if (sort === "reward") sorted.sort((a, b) => b.reward_cash - a.reward_cash);
    else if (sort === "easy") sorted.sort((a, b) => a.target_level - b.target_level);
    else if (sort === "recent") sorted.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    else if (sort === "expiring") sorted.sort((a, b) => +new Date(a.expires_at) - +new Date(b.expires_at));
    return sorted;
  }, [openBounties, skipped, filter, sort, player]);

  const myOpenList = useMemo(
    () => myBounties.filter((b) => b.status === "open"),
    [myBounties],
  );

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]" style={{ background: "#0b0b0b" }}>
        <div className="text-center">
          <p className="text-3xl mb-4 opacity-30">🤠</p>
          <p className="text-[8px] uppercase tracking-[0.4em]" style={{ color: "rgba(180,110,40,0.5)" }}>
            A CARREGAR QUADRO DE PROCURADOS…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-screen text-white relative" style={{ background: "#0b0807" }}>
      {/* Page texture */}
      <div className="pointer-events-none fixed inset-0 wanted-grain opacity-[0.07] z-0" />
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(255,140,40,0.07), transparent 60%), radial-gradient(ellipse at 50% 100%, rgba(120,30,30,0.10), transparent 60%)",
        }}
      />

      {toast && <CEToast msg={toast.msg} ok={toast.ok} />}

      <div className="relative z-10 py-6 px-4 md:px-6 max-w-3xl mx-auto space-y-5 pb-28">

        {/* Header */}
        <div
          className="relative rounded-2xl px-5 py-5"
          style={{
            background: "radial-gradient(120% 100% at 50% 0%, #2a1d10 0%, #100a05 100%)",
            border: "1px solid rgba(200,160,90,0.20)",
            boxShadow: "0 0 30px rgba(239,68,68,0.06), inset 0 1px 0 rgba(255,200,140,0.07)",
          }}
        >
          <div className="absolute inset-0 pointer-events-none wanted-grain opacity-[0.10] rounded-2xl" />
          <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <p className="text-[7px] uppercase tracking-[0.55em] mb-1" style={{ color: "rgba(200,160,90,0.5)" }}>
                CRIME EMPIRE · MERCADO NEGRO
              </p>
              <h1
                className="text-[34px] font-black tracking-tight leading-none"
                style={{ color: "#f3dba5", fontFamily: "Georgia, serif", textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}
              >
                QUADRO DE PROCURADOS
              </h1>
              <p
                className="text-[10px] mt-1.5 italic"
                style={{ color: "rgba(200,160,90,0.55)", fontFamily: "Georgia, serif" }}
              >
                “Cada nome é um saco de ouro. Cada saco custa sangue.”
              </p>
            </div>
            {player && (
              <div
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl flex-shrink-0"
                style={{ background: "rgba(28,20,8,0.92)", border: "1px solid rgba(120,53,15,0.30)" }}
              >
                <span className="text-[8px] uppercase tracking-[0.3em]" style={{ color: "rgba(200,160,90,0.6)" }}>OURO</span>
                <span className="text-sm font-black tabular-nums" style={{ color: "#fbbf24" }}>
                  ${player.cash.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Jail banner */}
        {player?.in_jail && (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-[10px]"
            style={{ background: "rgba(25,18,5,0.85)", border: "1px solid rgba(146,64,14,0.38)" }}
          >
            <span>⚠️</span>
            <span style={{ color: "rgba(251,191,36,0.85)" }}>
              <strong style={{ color: "#fde68a" }}>DETIDO:</strong> Não podes caçar enquanto estiveres preso.
            </span>
          </div>
        )}

        {/* Rules strip */}
        <div
          className="grid grid-cols-3 gap-3 px-4 py-3 rounded-xl"
          style={{ background: "rgba(14,8,3,0.9)", border: "1px solid rgba(200,160,90,0.10)" }}
        >
          {[
            { label: "Preço mínimo", value: "Nível × $3.000", icon: "💰" },
            { label: "Chance base",  value: "50% ±2% / nív",  icon: "🎯" },
            { label: "Falha",        value: "-40% HP",        icon: "💔" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-xl mb-1">{s.icon}</div>
              <div className="text-[10px] font-black" style={{ color: "#f3dba5", fontFamily: "Georgia, serif" }}>{s.value}</div>
              <div className="text-[8px] mt-0.5 tracking-widest" style={{ color: "rgba(200,160,90,0.45)" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Place toggle */}
        <button
          onClick={() => setShowForm((v) => !v)}
          className="w-full py-3 rounded-xl text-[11px] font-black tracking-[0.3em] transition-all active:scale-[0.98]"
          style={{
            background: showForm ? "rgba(239,68,68,0.10)" : "linear-gradient(135deg, #7f1d1d, #c2410c, #ef4444)",
            color: showForm ? "#fca5a5" : "#fff8e3",
            border: showForm ? "1px solid rgba(239,68,68,0.25)" : "1px solid rgba(239,68,68,0.4)",
            boxShadow: showForm ? "none" : "0 0 18px rgba(239,68,68,0.18)",
            fontFamily: "Georgia, serif",
          }}
        >
          {showForm ? "✕ FECHAR" : "💀 EMITIR RECOMPENSA"}
        </button>

        <AnimatePresence initial={false}>
          {showForm && player && (
            <motion.div
              key="place-form"
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.18 }}
            >
              <PlaceBountyPanel player={player} processing={placing} onPlace={handlePlace} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs */}
        <div
          className="flex gap-1 p-1 rounded-xl"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          {(["open", "mine"] as const).map((t) => {
            const active = tab === t;
            const count = t === "open" ? openBounties.length : myOpenList.length;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-2 rounded-lg transition-all duration-200"
                style={{
                  background: active ? "rgba(255,106,0,0.10)" : "transparent",
                  border: active ? "1px solid rgba(255,106,0,0.22)" : "1px solid transparent",
                  color: active ? "#ff6a00" : "rgba(180,140,80,0.45)",
                }}
              >
                <span className="text-[10px] font-black tracking-[0.18em]">
                  {t === "open" ? "QUADRO ABERTO" : "OS MEUS"}
                </span>
                {count > 0 && (
                  <span
                    className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                    style={{
                      background: active ? "rgba(255,106,0,0.18)" : "rgba(255,255,255,0.04)",
                      color: active ? "#ff6a00" : "rgba(180,140,80,0.45)",
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Filter chips + sort */}
        {tab === "open" && (
          <div className="space-y-2">
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {FILTERS.map((f) => {
                const active = filter === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    className="text-[9px] font-black tracking-[0.2em] px-3 py-1.5 rounded-full whitespace-nowrap transition-all active:scale-95"
                    style={{
                      background: active
                        ? "linear-gradient(135deg, rgba(239,68,68,0.18), rgba(255,106,0,0.18))"
                        : "rgba(255,255,255,0.03)",
                      color: active ? "#fde68a" : "rgba(200,160,90,0.55)",
                      border: active ? "1px solid rgba(251,191,36,0.45)" : "1px solid rgba(255,255,255,0.06)",
                      boxShadow: active ? "0 0 10px rgba(251,191,36,0.18)" : "none",
                    }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-black tracking-[0.3em]" style={{ color: "rgba(200,160,90,0.45)" }}>
                ORDENAR
              </span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortId)}
                className="text-[10px] font-bold px-2 py-1 rounded outline-none"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  color: "#f3dba5",
                  border: "1px solid rgba(200,160,90,0.20)",
                  fontFamily: "Georgia, serif",
                }}
              >
                {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <span className="ml-auto text-[8px] tracking-[0.25em]" style={{ color: "rgba(200,160,90,0.45)" }}>
                {filteredOpen.length} {filteredOpen.length === 1 ? "alvo" : "alvos"}
              </span>
            </div>
          </div>
        )}

        {/* Lists */}
        {tab === "open" ? (
          filteredOpen.length === 0 ? (
            <EmptyState text={openBounties.length === 0 ? "QUADRO VAZIO. SILÊNCIO NAS RUAS." : "NENHUM ALVO COM ESTES FILTROS."} />
          ) : (
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {filteredOpen.map((c) => (
                  <motion.div
                    key={c.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -200, transition: { duration: 0.18 } }}
                  >
                    <WantedPosterCard
                      contract={c}
                      myLevel={player?.level ?? 1}
                      isOwn={false}
                      processing={processing}
                      onExecute={handleExecute}
                      onCancel={handleCancel}
                      onSkip={handleSkip}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
              <p className="text-center text-[8px] tracking-[0.4em] py-2" style={{ color: "rgba(200,160,90,0.30)" }}>
                ← PASSA · ATACA →
              </p>
            </div>
          )
        ) : (
          myOpenList.length === 0 ? (
            <EmptyState text="AINDA NÃO EMITISTE NENHUMA RECOMPENSA." />
          ) : (
            <div className="space-y-3">
              {myOpenList.map((c) => (
                <WantedPosterCard
                  key={c.id}
                  contract={c}
                  myLevel={player?.level ?? 1}
                  isOwn
                  processing={processing}
                  onExecute={handleExecute}
                  onCancel={handleCancel}
                />
              ))}
            </div>
          )
        )}

        {/* History (own contracts) */}
        {tab === "mine" && myBounties.some((b) => b.status !== "open") && (
          <div>
            <div className="flex items-center gap-2 mb-3 mt-2">
              <div className="h-px flex-1" style={{ background: "rgba(200,160,90,0.10)" }} />
              <span className="text-[8px] font-black tracking-[0.3em]" style={{ color: "rgba(200,160,90,0.4)" }}>
                HISTÓRICO
              </span>
              <div className="h-px flex-1" style={{ background: "rgba(200,160,90,0.10)" }} />
            </div>
            <div className="space-y-2">
              {myBounties.filter((b) => b.status !== "open").map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between px-4 py-3 rounded-xl"
                  style={{
                    background: "rgba(8,5,2,0.8)",
                    border: `1px solid ${c.status === "completed" ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.05)"}`,
                    opacity: 0.65,
                  }}
                >
                  <div>
                    <span className="text-xs font-black" style={{ color: "#f3dba5", fontFamily: "Georgia, serif" }}>
                      {c.target_display_name || c.target_username}
                    </span>
                    <span className="text-[8px] ml-2" style={{ color: "rgba(200,160,90,0.45)" }}>
                      Nív {c.target_level}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] font-black" style={{ color: "rgba(200,160,90,0.55)" }}>
                      ${c.reward_cash.toLocaleString()}
                    </span>
                    <span
                      className="text-[8px] font-black px-2 py-0.5 rounded tracking-widest"
                      style={{
                        color: c.status === "completed" ? "#86efac" : c.status === "failed" ? "#fca5a5" : "rgba(200,160,90,0.6)",
                        background: c.status === "completed" ? "rgba(34,197,94,0.10)" : c.status === "failed" ? "rgba(239,68,68,0.10)" : "rgba(200,160,90,0.06)",
                      }}
                    >
                      {c.status === "completed" ? "✓ CONCLUÍDO" : c.status === "failed" ? "✗ FALHADO" : "CANCELADO"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Sticky bottom CTA on mobile */}
      {tab === "open" && filteredOpen.length > 0 && !showForm && (
        <div className="fixed bottom-0 left-0 right-0 z-30 sm:hidden pointer-events-none">
          <div
            className="px-4 pb-4 pt-6"
            style={{
              background:
                "linear-gradient(to top, rgba(11,8,7,0.96) 0%, rgba(11,8,7,0.85) 60%, transparent 100%)",
            }}
          >
            <div
              className="flex items-center justify-between gap-2 pointer-events-auto rounded-xl px-3 py-2"
              style={{
                background: "rgba(28,20,8,0.92)",
                border: "1px solid rgba(200,160,90,0.25)",
                boxShadow: "0 -4px 18px rgba(239,68,68,0.10)",
              }}
            >
              <div className="text-[9px] tracking-[0.25em]" style={{ color: "rgba(200,160,90,0.6)" }}>
                {filteredOpen.length} ALVO(S) · ARRASTA →
              </div>
              <button
                onClick={() => setShowForm(true)}
                className="text-[10px] font-black tracking-[0.25em] px-3 py-2 rounded-lg active:scale-95"
                style={{
                  background: "linear-gradient(135deg, #7f1d1d, #c2410c)",
                  color: "#fff8e3",
                  border: "1px solid rgba(239,68,68,0.45)",
                  fontFamily: "Georgia, serif",
                }}
              >
                💀 EMITIR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Local keyframes */}
      <style jsx global>{`
        .wanted-grain {
          background-image:
            radial-gradient(rgba(255,200,140,0.08) 1px, transparent 1px),
            radial-gradient(rgba(0,0,0,0.18) 1px, transparent 1px);
          background-size: 3px 3px, 5px 5px;
          background-position: 0 0, 1px 2px;
        }
        @keyframes wanted-pulse {
          0%, 100% { box-shadow: 0 10px 32px rgba(0,0,0,0.55), 0 0 18px rgba(239,68,68,0.30); }
          50%      { box-shadow: 0 10px 32px rgba(0,0,0,0.55), 0 0 36px rgba(239,68,68,0.65); }
        }
        .wanted-pulse { animation: wanted-pulse 2.4s ease-in-out infinite; }
        @keyframes wanted-sweep {
          0%   { transform: translateX(-120%); }
          100% { transform: translateX(420%); }
        }
        .wanted-sweep { animation: wanted-sweep 3.6s ease-in-out infinite; }
        @keyframes wanted-shimmer {
          0%   { transform: translateX(-100%); opacity: 0; }
          25%  { opacity: 1; }
          50%  { transform: translateX(100%); opacity: 0; }
          100% { transform: translateX(100%); opacity: 0; }
        }
        .wanted-shimmer { animation: wanted-shimmer 4.2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

/* ─── Empty state ────────────────────────────────────────────── */
function EmptyState({ text }: { text: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 rounded-xl"
      style={{ background: "rgba(10,7,3,0.55)", border: "1px dashed rgba(200,160,90,0.18)" }}
    >
      <span className="text-5xl mb-3" style={{ opacity: 0.18 }}>🤠</span>
      <p
        className="text-[9px] tracking-[0.4em] text-center px-4"
        style={{ color: "rgba(200,160,90,0.4)", fontFamily: "Georgia, serif" }}
      >
        {text}
      </p>
    </div>
  );
}
