"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { notifyPlayerUpdate } from "@/lib/crime-empire/player-context";
import { CEToast } from "@/components/CEToast";
import { useRouter } from "next/navigation";
import RaidEscape from "@/components/crime-empire/raid/RaidEscape";

/* ------------------------------ TYPES ------------------------------- */
interface Contract {
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
  image?: string | null;
}

interface PlayerContract {
  id: string;
  contract_id: string;
  status: "completed" | "failed" | "pending";
  cash_reward: number;
  respect_reward: number;
}

interface Player {
  id: string;
  level: number;
  cash: number;
  dirty_cash: number;
  hp: number;
  max_hp: number;
  stamina: number;
  max_stamina: number;
  class: string;
  addiction: number;
  in_jail: boolean;
}

/* -- Black-market (player-posted) contracts -- */
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

const CLASS_LABEL: Record<string, string> = {
  thief: "Ladrão", hooligan: "Hooligan", businessman: "Empresário",
  hitman: "Assassino", scammer: "Burlão", brute: "Bruto",
  dealer: "Traficante", pimp: "Chulo",
};

function minBounty(level: number) { return Math.max(10_000, level * 3_000); }
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

/* ------------------------------ CONFIG ------------------------------- */
const DIFF: Record<string, { label: string; color: string; bg: string; riskMod: number }> = {
  easy:   { label: "FACIL",   color: "#22c55e", bg: "#22c55e18", riskMod: 0.7  },
  medium: { label: "MEDIO",   color: "#f59e0b", bg: "#f59e0b18", riskMod: 1.0  },
  hard:   { label: "DIFICIL", color: "#ef4444", bg: "#ef444418", riskMod: 1.35 },
};

const serif = { fontFamily: "Georgia, 'Times New Roman', serif" } as const;
const noiseSvg = "data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E";

/* ------------------------------ PLAYER HUD --------------------------- */
function PlayerHUD({ player, isHitman }: { player: Player; isHitman: boolean }) {
  const stPct = Math.max(0, Math.min(100, (player.stamina / player.max_stamina) * 100));
  const hpPct = Math.max(0, Math.min(100, (player.hp / player.max_hp) * 100));
  return (
    <div
      className="flex items-center gap-3 sm:gap-5 flex-wrap px-3 sm:px-4 py-2 sm:py-3 rounded-xl"
      style={{ background: "rgba(28,20,8,0.90)", border: "1px solid rgba(120,53,15,0.25)" }}
    >
      <div className="flex items-center gap-2">
        <span className="text-[8px] uppercase tracking-[0.3em]" style={{ color: "rgba(180,110,40,0.60)" }}>NIV</span>
        <span
          className="text-sm font-black px-3 py-1 rounded tabular-nums"
          style={{ color: "#f0d090", background: "rgba(15,10,3,1)", border: "1px solid rgba(120,53,15,0.30)" }}
        >
          {player.level}
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center justify-between gap-6">
          <span className="text-[8px] uppercase tracking-[0.3em]" style={{ color: "rgba(180,110,40,0.60)" }}>STAMINA</span>
          <span className="text-[9px] font-bold tabular-nums" style={{ color: stPct > 40 ? "#f59e0b" : "#ef4444" }}>
            {player.stamina}/{player.max_stamina}
          </span>
        </div>
        <div className="h-1 rounded-full overflow-hidden w-20 sm:w-28" style={{ background: "rgba(15,10,3,1)", border: "1px solid rgba(80,40,10,0.30)" }}>
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${stPct}%`, background: stPct > 50 ? "#f59e0b" : stPct > 20 ? "#f97316" : "#ef4444" }} />
        </div>
      </div>
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center justify-between gap-6">
          <span className="text-[8px] uppercase tracking-[0.3em]" style={{ color: "rgba(180,110,40,0.60)" }}>HP</span>
          <span className="text-[9px] font-bold tabular-nums" style={{ color: hpPct > 40 ? "#22c55e" : "#ef4444" }}>
            {player.hp}/{player.max_hp}
          </span>
        </div>
        <div className="h-1 rounded-full overflow-hidden w-20 sm:w-24" style={{ background: "rgba(15,10,3,1)", border: "1px solid rgba(80,40,10,0.30)" }}>
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${hpPct}%`, background: hpPct > 50 ? "#22c55e" : hpPct > 20 ? "#f97316" : "#ef4444" }} />
        </div>
      </div>
      {isHitman && (
        <span className="text-[8px] font-black tracking-[0.2em] text-red-300 bg-red-900/30 border border-red-700/50 rounded px-2.5 py-1 uppercase">
          HITMAN +
        </span>
      )}
    </div>
  );
}

/* ------------------------------ CONTRACT LIST ITEM ------------------- */
interface ListItemProps {
  contract: Contract;
  status: "completed" | "failed" | "pending" | null;
  selected: boolean;
  levelUnlocked: boolean;
  isHitman: boolean;
  onClick: () => void;
}

function ContractListItem({ contract, status, selected, levelUnlocked, isHitman, onClick }: ListItemProps) {
  const diff = DIFF[contract.difficulty] ?? DIFF.medium;
  const isCompleted = status === "completed";
  const isFailed    = status === "failed";
  const locked      = !levelUnlocked;
  const displayRate = isHitman
    ? Math.min(95, Math.round((contract.base_success_rate + contract.hitman_bonus) * 100))
    : Math.round(contract.base_success_rate * 100);

  const itemBg = selected      ? "rgba(255,255,255,0.07)"
    : isCompleted ? "rgba(34,197,94,0.06)"
    : isFailed    ? "rgba(239,68,68,0.06)"
    : locked      ? "transparent"
    : "transparent";

  const itemBorder = selected      ? "rgba(255,255,255,0.14)"
    : isCompleted  ? "rgba(34,197,94,0.18)"
    : isFailed     ? "rgba(239,68,68,0.18)"
    : locked       ? "rgba(255,255,255,0.04)"
    : "transparent";

  return (
    <button
      onClick={onClick}
      disabled={locked}
      className={[
        "w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 transition-all duration-150",
        !locked && !selected ? "hover:brightness-125" : "",
        locked ? "opacity-30 cursor-not-allowed" : "",
        isCompleted || isFailed ? "opacity-70 hover:opacity-90" : "",
      ].join(" ")}
      style={{
        background: itemBg,
        border: `1px solid ${itemBorder}`,
        boxShadow: selected ? "0 0 0 1px rgba(255,255,255,0.10), 0 2px 12px rgba(0,0,0,0.40)" : undefined,
      }}
    >
      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{
        background: isCompleted ? "#22c55e" : isFailed ? "#ef4444" : selected ? "#ffffff" : "rgba(255,255,255,0.20)"
      }} />
      <span className="text-[11px] font-semibold flex-1 truncate" style={{
        color: isCompleted ? "rgba(134,239,172,0.80)" : isFailed ? "rgba(252,165,165,0.65)" : locked ? "rgba(255,255,255,0.18)" : selected ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.65)",
        letterSpacing: "0.01em",
      }}>
        {locked ? "?? " : ""}{contract.name}
      </span>
      <span
        className="text-[7px] font-black tracking-[0.2em] px-1.5 py-0.5 rounded flex-shrink-0"
        style={{
          background: locked ? "rgba(255,255,255,0.04)" : contract.difficulty === "easy" ? "rgba(34,197,94,0.10)" : contract.difficulty === "hard" ? "rgba(239,68,68,0.10)" : "rgba(251,191,36,0.10)",
          color: locked ? "rgba(255,255,255,0.18)" : contract.difficulty === "easy" ? "#4ade80" : contract.difficulty === "hard" ? "#f87171" : "#fbbf24",
          borderWidth: "1px", borderStyle: "solid",
          borderColor: locked ? "rgba(255,255,255,0.06)" : contract.difficulty === "easy" ? "rgba(74,222,128,0.20)" : contract.difficulty === "hard" ? "rgba(248,113,113,0.20)" : "rgba(251,191,36,0.20)",
          fontSize: "7px", letterSpacing: "0.15em", fontWeight: 700,
        }}
      >
        {diff.label}
      </span>
      {!locked && (
        <span className="text-[9px] font-bold tabular-nums flex-shrink-0 w-8 text-right" style={{
          color: displayRate >= 60 ? "rgba(74,222,128,0.85)" : displayRate >= 40 ? "rgba(251,191,36,0.85)" : "rgba(248,113,113,0.85)"
        }}>
          {displayRate}%
        </span>
      )}
    </button>
  );
}

/* ------------------------------ CONTRACT BRIEFING -------------------- */
interface BriefingProps {
  contract: Contract;
  status: "completed" | "failed" | "pending" | null;
  player: Player | null;
  levelDone: boolean;
  levelUnlocked: boolean;
  isHitman: boolean;
  processing: boolean;
  onExecute: () => void;
}

function ContractBriefing({
  contract, status, player, levelDone, levelUnlocked, isHitman, processing, onExecute,
}: BriefingProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const diff        = DIFF[contract.difficulty] ?? DIFF.medium;
  const isCompleted = status === "completed";
  const isFailed    = status === "failed";
  const locked      = !levelUnlocked;

  const displayRate = isHitman
    ? Math.min(95, Math.round((contract.base_success_rate + contract.hitman_bonus) * 100))
    : Math.round(contract.base_success_rate * 100);

  const baseArrest    = contract.arrest_chance ?? 0.3;
  const arrestDisplay = isHitman
    ? Math.round(baseArrest * (1 - (contract.hitman_arrest_reduction ?? 0.5)) * 100)
    : Math.round(baseArrest * 100);

  const riskDisplay = Math.min(99, Math.round((1 - contract.base_success_rate) * (DIFF[contract.difficulty]?.riskMod ?? 1) * 100));

  const meetsLevel = (player?.level  ?? 0) >= contract.required_level;
  const hasStamina = (player?.stamina ?? 0) >= contract.stamina_cost;
  const inJail     = player?.in_jail ?? false;

  let disabledReason = "";
  if (locked)           disabledReason = "BLOQUEADO";
  else if (inJail)      disabledReason = "DETIDO";
  else if (isCompleted) disabledReason = "JA CONCLUIDO";
  else if (levelDone)   disabledReason = "NIVEL JA CONCLUIDO";
  else if (!meetsLevel) disabledReason = `NIVEL ${contract.required_level} NECESSARIO`;
  else if (!hasStamina) disabledReason = "STAMINA INSUFICIENTE";

  const imgSrc = contract.image
    ? (contract.image === "hacker"
        ? `/images/contracts/contrac_hacker.png`
        : `/images/contracts/contract_${contract.image}.png`)
    : null;

  const diffSepiaColor =
    contract.difficulty === "easy"
      ? { text: "#166534", border: "rgba(22,101,52,0.35)", bg: "rgba(22,101,52,0.15)" }
      : contract.difficulty === "hard"
      ? { text: "#7f1d1d", border: "rgba(127,29,29,0.35)", bg: "rgba(127,29,29,0.15)" }
      : { text: "#92400e", border: "rgba(146,64,14,0.35)", bg: "rgba(245,230,200,0.80)" };

  return (
    <div
      className="relative mx-auto w-full max-w-[420px] select-none py-1"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setIsPressed(false); }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
    >
      {/* -- Outer shadow -- */}
      <div
        className="absolute rounded-sm bg-black/60 transition-all duration-300"
        style={{
          filter: isHovered && !isPressed ? "blur(24px)" : isPressed ? "blur(6px)" : "blur(16px)",
          top:    isHovered && !isPressed ? "-4px"  : isPressed ? "4px"  : "0",
          bottom: isHovered && !isPressed ? "-8px"  : "0",
          left:   isHovered && !isPressed ? "-8px"  : "0",
          right:  isHovered && !isPressed ? "-8px"  : "0",
        }}
      />

      {/* -- Main poster card -- */}
      <div
        className="relative rounded-sm transition-all duration-300 ease-out"
        style={{
          transform: isHovered && !isPressed
            ? "translateY(-6px) rotate(-0.3deg)"
            : isPressed
            ? "translateY(2px) rotate(0deg) scale(0.985)"
            : "rotate(0.2deg)",
        }}
      >
        {/* Paper base */}
        <div
          className="absolute inset-0 rounded-sm"
          style={{ background: "linear-gradient(155deg,#f7ebd0 0%,#ede0b6 45%,#e6d8aa 100%)" }}
        />

        {/* Grain noise */}
        <div
          className="absolute inset-0 rounded-sm pointer-events-none mix-blend-multiply poster-grain"
          style={{ backgroundImage: `url("${noiseSvg}")`, backgroundSize: "200px 200px", opacity: 0.07 }}
        />

        {/* Burned edges */}
        <div
          className="absolute inset-0 rounded-sm pointer-events-none"
          style={{ background: "radial-gradient(ellipse at center,transparent 55%,rgba(60,30,10,0.15) 70%,rgba(40,15,5,0.40) 85%,rgba(20,5,0,0.70) 100%)" }}
        />

        {/* Corner embers */}
        <div className="absolute inset-0 rounded-sm overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-0 w-20 h-20 bg-gradient-to-br from-amber-950/50 via-amber-900/20 to-transparent poster-ember" />
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-amber-950/50 via-amber-900/20 to-transparent poster-ember" style={{ animationDelay: "0.8s" }} />
          <div className="absolute bottom-0 left-0 w-20 h-20 bg-gradient-to-tr from-amber-950/50 via-amber-900/20 to-transparent poster-ember" style={{ animationDelay: "1.6s" }} />
          <div className="absolute bottom-0 right-0 w-20 h-20 bg-gradient-to-tl from-amber-950/50 via-amber-900/20 to-transparent poster-ember" style={{ animationDelay: "2.4s" }} />
        </div>

        {/* Stain marks */}
        <div className="absolute inset-0 rounded-sm overflow-hidden pointer-events-none">
          <div className="absolute top-[15%] right-[10%] w-16 h-12 rounded-full blur-md" style={{ background: "rgba(139,90,43,0.12)" }} />
          <div className="absolute bottom-[25%] left-[8%] w-12 h-8 rounded-full blur-md"  style={{ background: "rgba(100,60,20,0.10)" }} />
          <div className="absolute top-[40%] left-[75%] w-8 h-10 rounded-full blur-sm"   style={{ background: "rgba(120,70,30,0.08)" }} />
        </div>

        {/* -- CONTENT -- */}
        <div className="relative z-10 flex flex-col items-center px-4 sm:px-8 py-4">

          {/* HEADER */}
          <div className="text-center mb-2">
            <h1
              className="text-5xl font-black tracking-[0.35em] leading-none poster-ink"
              style={{ ...serif, color: "rgba(69,32,5,0.90)", textShadow: "1px 1px 0px rgba(0,0,0,0.30),2px 2px 4px rgba(0,0,0,0.10)" }}
            >
              WANTED
            </h1>
            <div className="flex items-center justify-center gap-3 mt-1.5">
              <div className="h-px flex-1 max-w-12 bg-amber-900/30" />
              <span className="text-xs font-bold tracking-[0.5em] uppercase" style={{ ...serif, color: "rgba(120,53,15,0.60)" }}>
                DEAD OR ALIVE
              </span>
              <div className="h-px flex-1 max-w-12 bg-amber-900/30" />
            </div>
          </div>

          {/* PORTRAIT ? always rendered, silhouette fallback */}
          <div className="relative mb-3">
            <div
              className="relative w-32 h-32 rounded-sm overflow-hidden border-2 border-amber-900/30"
              style={{ boxShadow: "inset 0 0 20px rgba(0,0,0,0.30),0 2px 8px rgba(0,0,0,0.20)" }}
            >
              {imgSrc ? (
                <>
                  <img
                    src={imgSrc}
                    alt={contract.name}
                    className="w-full h-full object-cover object-top"
                    style={{ filter: "sepia(0.40) contrast(1.10) brightness(0.92)" }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: "radial-gradient(ellipse at center,transparent 40%,rgba(40,15,5,0.30) 75%,rgba(20,5,0,0.55) 100%)" }}
                  />
                </>
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ background: "linear-gradient(to bottom,rgba(245,235,200,0.30),rgba(180,120,40,0.15),rgba(80,40,10,0.35))" }}
                >
                  <svg viewBox="0 0 80 80" className="w-20 h-20" fill="currentColor" style={{ color: "rgba(120,70,20,0.55)" }}>
                    <circle cx="40" cy="26" r="15" />
                    <ellipse cx="40" cy="66" rx="20" ry="18" />
                    <rect x="25" y="42" width="30" height="10" rx="3" />
                  </svg>
                </div>
              )}
            </div>

            {/* Difficulty badge pinned to portrait corner */}
            <div
              className="absolute -bottom-2 -right-2 text-[7px] font-black tracking-[0.2em] uppercase px-2 py-0.5 rounded-sm border"
              style={{
                ...serif,
                transform: "rotate(6deg)",
                color: diffSepiaColor.text,
                borderColor: diffSepiaColor.border,
                background: diffSepiaColor.bg,
              }}
            >
              {diff.label}
            </div>

            {/* Torn corner accents */}
            <div className="absolute -top-1 -right-1 w-3 h-3 rotate-45" style={{ background: "rgba(247,235,208,0.80)" }} />
            <div className="absolute -bottom-1 -left-1 w-2 h-2 -rotate-12" style={{ background: "rgba(237,224,182,0.70)" }} />
          </div>

          {/* TARGET NAME */}
          <h2
            className="text-2xl font-black tracking-[0.25em] text-center leading-tight mb-1"
            style={{ ...serif, color: "rgba(55,26,3,0.90)", textShadow: "0.5px 0.5px 0px rgba(0,0,0,0.20)" }}
          >
            {contract.name}
          </h2>

          {/* MISSION STATUS BADGE */}
          {(isCompleted || isFailed) && (
            <div className="mb-3">
              <span
                className={`text-[8px] font-black tracking-[0.25em] px-4 py-1 rounded-sm uppercase border ${
                  isCompleted ? "text-green-900 border-green-900/30 bg-green-100/60" : "text-red-900 border-red-900/30 bg-red-50/60"
                }`}
                style={serif}
              >
                {isCompleted ? "✔ MISSÃO CUMPRIDA" : "✗ MISSÃO FALHADA"}
              </span>
            </div>
          )}

          {/* INTEL DIVIDER */}
          <div className="w-full flex items-center gap-2 mb-2">
            <div className="h-px flex-1 bg-amber-900/20" />
            <span className="text-[10px] tracking-[0.3em] uppercase font-bold" style={{ ...serif, color: "rgba(120,53,15,0.42)" }}>
              Intel
            </span>
            <div className="h-px flex-1 bg-amber-900/20" />
          </div>

          {/* DESCRIPTION */}
          <p
            className="text-sm text-center leading-relaxed mb-3 italic px-2"
            style={{ ...serif, color: "rgba(101,63,15,0.70)", textShadow: "0.5px 0.5px 0px rgba(255,255,255,0.15)" }}
          >
            {contract.description}
          </p>

          {/* REWARD BOX */}
          <div className="relative mb-3 w-full">
            <div className="absolute inset-0 bg-amber-200/20 rounded-sm blur-sm" />
            <div
              className="relative px-6 py-3 text-center rounded-sm"
              style={{ border: "2px double rgba(120,53,15,0.28)", background: "rgba(253,246,227,0.20)" }}
            >
              <div
                className="absolute -top-3 -right-2 rotate-12 text-[9px] font-black tracking-[0.15em] uppercase px-2 py-0.5 rounded-sm border"
                style={{ ...serif, color: "rgba(153,27,27,0.55)", borderColor: "rgba(153,27,27,0.22)", background: "rgba(254,242,242,0.50)" }}
              >
                TARGET
              </div>
              <span className="text-[10px] font-bold tracking-[0.4em] uppercase block mb-0.5" style={{ ...serif, color: "rgba(120,53,15,0.50)" }}>
                Recompensa
              </span>
              <span
                className="text-2xl font-black tracking-[0.06em] block"
                style={{ ...serif, color: "rgba(55,26,3,0.88)", textShadow: "0.5px 0.5px 0px rgba(0,0,0,0.12)" }}
              >
                ${contract.min_cash.toLocaleString("pt-PT")} ? ${contract.max_cash.toLocaleString("pt-PT")}
              </span>
              <span className="text-[10px] font-bold block mt-0.5" style={{ ...serif, color: "rgba(101,63,15,0.60)" }}>
                +{contract.respect_reward} Respeito
              </span>
            </div>
          </div>

          {/* STATS ? 3 cols */}
          <div className="w-full grid grid-cols-3 gap-2 mb-3">
            <div className="flex flex-col items-center gap-1 rounded-sm py-2 px-1 border border-amber-900/10" style={{ background: "rgba(139,90,43,0.10)" }}>
              <span className="text-base">??</span>
              <span className="text-[9px] font-bold tracking-[0.15em] uppercase" style={{ ...serif, color: "rgba(120,53,15,0.50)" }}>Sucesso</span>
              <span className="text-sm font-black tracking-wide" style={{ ...serif, color: displayRate >= 60 ? "rgba(22,101,52,0.85)" : displayRate >= 40 ? "rgba(146,64,14,0.85)" : "rgba(127,29,29,0.85)" }}>
                {displayRate}%{isHitman ? " ?" : ""}
              </span>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-sm py-2 px-1 border border-amber-900/10" style={{ background: "rgba(139,90,43,0.10)" }}>
              <span className="text-base">??</span>
              <span className="text-[9px] font-bold tracking-[0.15em] uppercase" style={{ ...serif, color: "rgba(120,53,15,0.50)" }}>Risco</span>
              <span className="text-sm font-black tracking-wide" style={{ ...serif, color: "rgba(127,29,29,0.75)" }}>{riskDisplay}%</span>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-sm py-2 px-1 border border-amber-900/10" style={{ background: "rgba(139,90,43,0.10)" }}>
              <span className="text-base">?</span>
              <span className="text-[9px] font-bold tracking-[0.15em] uppercase" style={{ ...serif, color: "rgba(120,53,15,0.50)" }}>Stamina</span>
              <span className="text-sm font-black tracking-wide" style={{ ...serif, color: hasStamina ? "rgba(120,53,15,0.80)" : "rgba(127,29,29,0.85)" }}>
                -{contract.stamina_cost}
              </span>
            </div>
          </div>

          {/* CONSEQUENCES */}
          <div className="w-full mb-3 px-1 space-y-1">
            <div className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ background: "rgba(153,27,27,0.50)" }} />
              <p className="text-[10px]" style={{ ...serif, color: "rgba(101,63,15,0.65)" }}>
                Em caso de falha, HP cai para 0 ? enviado ao hospital.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ background: "rgba(153,27,27,0.50)" }} />
              <p className="text-[10px]" style={{ ...serif, color: "rgba(101,63,15,0.65)" }}>
                <span className="font-bold" style={{ color: "rgba(153,27,27,0.75)" }}>{arrestDisplay}% chance</span> de pris?o (30?90 min).
              </p>
            </div>
            {!meetsLevel && (
              <div className="flex items-start gap-2">
                <div className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ background: "rgba(153,27,27,0.65)" }} />
                <p className="text-[10px] font-bold" style={{ ...serif, color: "rgba(127,29,29,0.80)" }}>
                  Requer n?vel {contract.required_level} ? n?vel insuficiente.
                </p>
              </div>
            )}
          </div>

          {/* WARNING */}
          <p
            className="text-[11px] font-bold tracking-[0.2em] uppercase text-center mb-3"
            style={{ ...serif, color: "rgba(153,27,27,0.55)", textShadow: "0.5px 0.5px 0px rgba(255,255,255,0.10)" }}
          >
            ? Aborda com cautela. Falha tem consequencias.
          </p>

          {/* CONFIDENTIAL / COMPLETED STAMP */}
          <div className="mb-3 transform -rotate-6">
            {isCompleted ? (
              <span
                className="text-[13px] font-black tracking-[0.3em] uppercase border-2 rounded-full px-5 py-1.5"
                style={{ ...serif, color: "rgba(22,101,52,0.80)", borderColor: "rgba(22,101,52,0.55)", background: "rgba(22,101,52,0.08)" }}
              >
                ? CONCLU?DO
              </span>
            ) : (
              <span
                className="text-[13px] font-black tracking-[0.3em] uppercase border-2 rounded-full px-5 py-1.5"
                style={{ ...serif, color: "rgba(153,27,27,0.52)", borderColor: "rgba(153,27,27,0.42)" }}
              >
                CONFIDENCIAL
              </span>
            )}
          </div>

          {/* EXECUTE BUTTON */}
          {!isCompleted && (disabledReason ? (
            <div
              className="w-full py-3 rounded-sm text-center text-[8px] font-black tracking-[0.35em] uppercase border"
              style={{ ...serif, color: "rgba(120,53,15,0.50)", background: "rgba(245,230,200,0.35)", borderColor: "rgba(120,53,15,0.20)" }}
            >
              {disabledReason}
            </div>
          ) : (
            <>
              <button
                onClick={onExecute}
                disabled={processing}
                className={[
                  "relative w-full py-3.5 px-6 rounded-sm font-black text-sm tracking-[0.25em] uppercase transition-all duration-200 ease-out",
                  "bg-gradient-to-b from-orange-700 via-orange-800 to-orange-950",
                  "text-orange-100 border border-orange-600/40",
                  "shadow-[0_4px_12px_rgba(0,0,0,0.4),0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.10)]",
                  "hover:from-orange-600 hover:via-orange-700 hover:to-orange-900",
                  "hover:shadow-[0_6px_20px_rgba(0,0,0,0.5),0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.15)]",
                  "hover:border-orange-500/50",
                  "active:from-orange-800 active:via-orange-900 active:to-orange-950",
                  "active:shadow-[0_2px_6px_rgba(0,0,0,0.5),inset_0_2px_4px_rgba(0,0,0,0.3)]",
                  "active:scale-[0.98] active:translate-y-px",
                  processing ? "opacity-60 cursor-wait" : "",
                ].join(" ")}
                style={serif}
              >
                <div className="absolute inset-0 rounded-sm pointer-events-none opacity-30 bg-gradient-to-b from-white/10 to-transparent" />
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {processing ? (
                    <>
                      <span className="w-3 h-3 border border-amber-200/50 border-t-transparent rounded-full animate-spin" />
                      EXECUTANDO
                    </>
                  ) : (
                    <>⚔ {isFailed ? "TENTAR NOVAMENTE ↺" : "EXECUTAR CONTRATO"}</>
                  )}
                </span>
              </button>
              <p className="text-center text-[8px] mt-2 uppercase tracking-wider" style={{ ...serif, color: "rgba(120,53,15,0.42)" }}>
                Esta ação não pode ser revertida
              </p>
            </>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ ROADMAP NODE -------------------------- */
function RoadmapNode({ level, levelIndex, completed, unlocked, active }: {
  level: number; levelIndex: number; completed: boolean; unlocked: boolean; active: boolean;
}) {
  const tierColors = ["#4ade80", "#f59e0b", "#f97316", "#ef4444"];
  const tierColor  = tierColors[Math.min(levelIndex, tierColors.length - 1)];
  return (
    <div className="flex items-center gap-2">
      <div
        className={[
          "w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0 transition-all duration-300",
          completed ? "" :
          active    ? "ce-pulse-orange" : "",
        ].join(" ")}
        style={
          completed
            ? { background: "rgba(34,197,94,0.10)", border: "1px solid rgba(34,197,94,0.30)", color: "#4ade80" }
            : active
            ? { background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.30)", color: "#ffffff" }
            : unlocked
            ? { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.55)" }
            : { background: "transparent", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.20)" }
        }
      >
        {completed ? "?" : unlocked || active ? level : "?"}
      </div>
      <div className="flex flex-col gap-0">
        <span className="text-[8px] uppercase tracking-[0.25em] font-semibold" style={{
          color: completed ? "rgba(74,222,128,0.70)" : active ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.25)"
        }}>
          CAP {level}
        </span>
        <span className="text-[8px] leading-none" style={{ color: completed ? "rgba(74,222,128,0.50)" : unlocked ? tierColor : "rgba(255,255,255,0.12)" }}>
          {"?".repeat(Math.min(levelIndex + 1, 4))}
        </span>
      </div>
    </div>
  );
}

/* --------------------------- THREE-CARD FAN ----------------------- */
const DIFF_ORDER = ["easy", "medium", "hard"] as const;
type DiffKey = (typeof DIFF_ORDER)[number];

function ThreeCardFan({
  levelContracts, selected, getStatus, levelDone, levelUnlocked, player,
  isHitman, processing, onSelect, onExecute,
}: {
  levelContracts: Contract[];
  selected: string | null;
  getStatus: (id: string) => "completed" | "failed" | "pending" | null;
  levelDone: boolean;
  levelUnlocked: boolean;
  player: Player | null;
  isHitman: boolean;
  processing: string | null;
  onSelect: (id: string) => void;
  onExecute: (id: string) => void;
}) {
  const [centerDiff, setCenterDiff] = useState<DiffKey>("medium");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Sync centerDiff when selected changes from outside (e.g. sidebar click)
  useEffect(() => {
    if (!selected) return;
    const c = levelContracts.find((lc) => lc.id === selected);
    if (c && DIFF_ORDER.includes(c.difficulty as DiffKey)) {
      setCenterDiff(c.difficulty as DiffKey);
    }
  }, [selected, levelContracts]);

  const sorted = DIFF_ORDER
    .map((d) => levelContracts.find((c) => c.difficulty === d))
    .filter((c): c is Contract => Boolean(c));

  if (sorted.length === 0) return null;

  const centerIdx = DIFF_ORDER.indexOf(centerDiff);

  // Circular wrapping ? always exactly left / center / right regardless of which is selected
  const getRole = (diff: DiffKey): "center" | "left" | "right" => {
    const rel = (DIFF_ORDER.indexOf(diff) - centerIdx + 3) % 3;
    if (rel === 0) return "center";
    if (rel === 1) return "right";
    return "left"; // rel === 2
  };

  // Role ? absolute transform. left: "50%" on each card anchors to container center,
  // then translateX(-50% ? offset) positions left/center/right purely via CSS.
  // DOM order never affects layout so the carousel rotation is always clean.
  const roleStyles: Record<"center" | "left" | "right", React.CSSProperties> = {
    center: {
      transform: "translateX(-50%) rotateY(0deg) translateZ(0px)",
      opacity: 1, zIndex: 10, cursor: "default",
    },
    left: {
      transform: "translateX(calc(-50% - 220px)) rotateY(16deg) translateZ(-90px)",
      opacity: 0.55, zIndex: 2, cursor: "pointer",
    },
    right: {
      transform: "translateX(calc(-50% + 220px)) rotateY(-16deg) translateZ(-90px)",
      opacity: 0.55, zIndex: 2, cursor: "pointer",
    },
  };

  /* -- MOBILE: single card + difficulty tab switcher -- */
  if (isMobile) {
    const centerContract = sorted.find((c) => c.difficulty === centerDiff) ?? sorted[0];
    return (
      <div className="flex flex-col items-center gap-4 w-full">
        {sorted.length > 1 && (
          <div className="flex gap-2">
            {sorted.map((c) => {
              const d = c.difficulty as DiffKey;
              const active = d === centerDiff;
              const cfg = DIFF[d];
              return (
                <button
                  key={d}
                  onClick={() => { setCenterDiff(d); onSelect(c.id); }}
                  className="px-4 py-1.5 rounded-lg text-[10px] font-black tracking-[0.15em] uppercase border transition-all"
                  style={{
                    color: active ? cfg.color : "rgba(255,255,255,0.25)",
                    borderColor: active ? `${cfg.color}55` : "rgba(255,255,255,0.08)",
                    background: active ? `${cfg.color}15` : "transparent",
                  }}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>
        )}
        {centerContract && (
          <div className="w-full max-w-sm mx-auto">
            <ContractBriefing
              contract={centerContract}
              status={getStatus(centerContract.id)}
              player={player}
              levelDone={levelDone}
              levelUnlocked={levelUnlocked}
              isHitman={isHitman}
              processing={processing === centerContract.id}
              onExecute={() => onExecute(centerContract.id)}
            />
          </div>
        )}
      </div>
    );
  }

  /* -- DESKTOP: 3D fan -- */
  return (
    <div
      className="relative w-full"
      style={{ perspective: "1100px", perspectiveOrigin: "50% 20%", minHeight: "740px" }}
    >
      {sorted.map((contract) => {
        const diff = contract.difficulty as DiffKey;
        const role = getRole(diff);

        return (
          <div
            key={contract.id}
            style={{
              position: "absolute",
              left: "50%",
              top: 0,
              width: "360px",
              transformStyle: "preserve-3d",
              transition: "transform 0.58s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.42s ease",
              ...roleStyles[role],
            }}
            onClick={() => {
              if (role !== "center") {
                setCenterDiff(diff);
                onSelect(contract.id);
              }
            }}
          >
            <ContractBriefing
              contract={contract}
              status={getStatus(contract.id)}
              player={player}
              levelDone={levelDone}
              levelUnlocked={levelUnlocked}
              isHitman={isHitman}
              processing={processing === contract.id}
              onExecute={() => onExecute(contract.id)}
            />
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------- BOUNTY CARD (player-posted) ----------- */
function BountyCard({
  contract, myLevel, isOwn, processing, onExecute, onCancel,
}: {
  contract: HitmanContract;
  myLevel: number;
  isOwn: boolean;
  processing: string | null;
  onExecute: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const chance    = hitChance(myLevel, contract.target_level);
  const remaining = timeLeft(contract.expires_at);
  const expired   = remaining === "Expirado";
  const isBusy    = processing === contract.id;

  const urgency = contract.reward_cash >= 500_000 ? "#ef4444"
    : contract.reward_cash >= 200_000 ? "#f97316"
    : contract.reward_cash >= 50_000  ? "#fbbf24"
    : "#22c55e";

  const tier = contract.reward_cash >= 500_000 ? "LENDÁRIO"
    : contract.reward_cash >= 200_000 ? "ELITE"
    : contract.reward_cash >= 50_000  ? "ALTO VALOR"
    : "STANDARD";

  return (
    <div
      className="relative rounded-xl overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(14,8,3,0.98), rgba(10,6,2,0.97))",
        border: `1px solid ${urgency}22`,
        boxShadow: `0 0 20px ${urgency}08`,
      }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: urgency, boxShadow: `0 0 8px ${urgency}80` }} />
      <div
        className="absolute top-3 right-3 text-[7px] font-black tracking-widest px-2 py-0.5 rounded"
        style={{ background: `${urgency}18`, color: urgency, border: `1px solid ${urgency}30` }}
      >
        {tier}
      </div>

      <div className="pl-5 pr-4 py-4">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            🎯
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black" style={{ color: "#ddc870", ...serif }}>
                {contract.target_display_name || contract.target_username}
              </span>
              <span
                className="text-[8px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: "rgba(255,255,255,0.05)", color: "rgba(200,160,60,0.7)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                NÍV. {contract.target_level}
              </span>
            </div>
            <span className="text-[9px]" style={{ color: "rgba(160,120,40,0.5)" }}>
              @{contract.target_username}
            </span>
          </div>
        </div>

        {contract.message && (
          <p
            className="text-[10px] italic mb-3 px-3 py-2 rounded-lg"
            style={{ color: "rgba(180,130,50,0.55)", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", ...serif }}
          >
            &ldquo;{contract.message}&rdquo;
          </p>
        )}

        <div className="flex items-center gap-4 mb-4">
          <div>
            <span className="text-[8px] block" style={{ color: "rgba(140,100,35,0.4)" }}>RECOMPENSA</span>
            <span className="text-lg font-black tabular-nums" style={{ color: urgency }}>
              ${contract.reward_cash.toLocaleString()}
            </span>
          </div>
          {!isOwn && (
            <div>
              <span className="text-[8px] block" style={{ color: "rgba(140,100,35,0.4)" }}>CHANCE HIT</span>
              <span className="text-base font-black"
                style={{ color: chance >= 60 ? "#22c55e" : chance >= 40 ? "#fbbf24" : "#ef4444" }}>
                {chance}%
              </span>
            </div>
          )}
          <div className="ml-auto text-right">
            <span className="text-[8px] block" style={{ color: "rgba(140,100,35,0.4)" }}>EXPIRA EM</span>
            <span className="text-[11px] font-bold" style={{ color: expired ? "#ef4444" : "rgba(200,160,60,0.6)" }}>
              {remaining}
            </span>
          </div>
        </div>

        {isOwn ? (
          <button
            onClick={() => onCancel(contract.id)}
            disabled={isBusy || expired}
            className="w-full py-2 rounded-lg text-[10px] font-black tracking-widest transition-all active:scale-95"
            style={{
              background: "rgba(239,68,68,0.08)", color: "rgba(248,113,113,0.6)",
              border: "1px solid rgba(239,68,68,0.2)",
              cursor: isBusy ? "wait" : "pointer", opacity: expired ? 0.4 : 1,
            }}
          >
            {isBusy ? "..." : "CANCELAR (reembolso 75%)"}
          </button>
        ) : (
          <button
            onClick={() => onExecute(contract.id)}
            disabled={isBusy || expired}
            className="w-full py-2.5 rounded-lg text-[11px] font-black tracking-widest transition-all active:scale-95"
            style={{
              background: isBusy ? "rgba(255,106,0,0.15)" : "linear-gradient(135deg, #cc4400, #ff6a00)",
              color: "#fff", border: "1px solid rgba(255,106,0,0.35)",
              boxShadow: isBusy ? "none" : "0 0 14px rgba(255,106,0,0.2)",
              cursor: isBusy ? "wait" : expired ? "not-allowed" : "pointer", opacity: expired ? 0.4 : 1,
            }}
          >
            {isBusy ? "EXECUTANDO..." : "🔫 EXECUTAR"}
          </button>
        )}
      </div>
    </div>
  );
}

/* --------------------------- PLACE BOUNTY FORM ---------------------- */
function PlaceBountyForm({
  player, processing, onPlace,
}: {
  player: { level: number; cash: number };
  processing: boolean;
  onPlace: (targetId: string, reward: number, message: string) => void;
}) {
  const [search, setSearch]   = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [reward, setReward]   = useState("");
  const [msg, setMsg]         = useState("");
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const res  = await fetch(`/api/crime-empire/hitman-contratos?search=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.searchResults ?? []);
    } finally { setSearching(false); }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(search), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, doSearch]);

  const minimum   = selected ? minBounty(selected.level) : 10_000;
  const rewardNum = parseInt(reward.replace(/\D/g, ""), 10) || 0;
  const canSubmit = selected && rewardNum >= minimum && player.cash >= rewardNum && !processing;
  const chance    = selected ? hitChance(player.level, selected.level) : null;

  return (
    <div className="rounded-2xl p-5 space-y-4" style={{ background: "#111", border: "1px solid rgba(255,106,0,0.12)" }}>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
          style={{ background: "rgba(255,106,0,0.1)", border: "1px solid rgba(255,106,0,0.2)" }}>💀</div>
        <span className="text-[10px] font-black tracking-[0.25em] uppercase" style={{ color: "#ff6a00" }}>
          Colocar Contrato
        </span>
      </div>

      <div className="relative">
        <label className="text-[8px] font-black tracking-[0.2em] uppercase block mb-1.5" style={{ color: "rgba(160,120,40,0.45)" }}>
          Alvo (pesquisar por username)
        </label>
        {selected ? (
          <div className="flex items-center justify-between px-3 py-2.5 rounded-lg"
            style={{ background: "rgba(255,106,0,0.06)", border: "1px solid rgba(255,106,0,0.2)" }}>
            <div>
              <span className="text-sm font-black" style={{ color: "#ddc870" }}>
                {selected.display_name || selected.username}
              </span>
              <span className="text-[9px] ml-2" style={{ color: "rgba(160,120,40,0.5)" }}>
                Nív. {selected.level} · {CLASS_LABEL[selected.class] ?? selected.class}
              </span>
            </div>
            <button onClick={() => { setSelected(null); setSearch(""); setResults([]); }}
              className="text-[9px] font-bold px-2 py-1 rounded"
              style={{ color: "rgba(248,113,113,0.6)", background: "rgba(239,68,68,0.08)" }}>✕</button>
          </div>
        ) : (
          <>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ex: xXKillerXx"
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }} />
            {(results.length > 0 || searching) && (
              <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl overflow-hidden"
                style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)" }}>
                {searching && (
                  <div className="px-3 py-2 text-[10px]" style={{ color: "rgba(160,120,40,0.4)" }}>A procurar...</div>
                )}
                {results.map((r) => (
                  <button key={r.id} onClick={() => { setSelected(r); setResults([]); setSearch(""); }}
                    className="w-full text-left px-3 py-2.5 flex items-center gap-3 hover:brightness-125 transition-all"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm" style={{ background: "rgba(255,255,255,0.06)" }}>🎯</div>
                    <div>
                      <span className="text-sm font-bold text-white block">{r.display_name || r.username}</span>
                      <span className="text-[9px]" style={{ color: "rgba(160,120,40,0.5)" }}>
                        @{r.username} · Nív. {r.level} · {CLASS_LABEL[r.class] ?? r.class}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div>
        <label className="text-[8px] font-black tracking-[0.2em] uppercase block mb-1.5" style={{ color: "rgba(160,120,40,0.45)" }}>
          Recompensa {selected ? `(mínimo $${minimum.toLocaleString()})` : ""}
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black" style={{ color: "rgba(200,160,60,0.5)" }}>$</span>
          <input type="number" value={reward} onChange={(e) => setReward(e.target.value)} min={minimum}
            placeholder={minimum.toLocaleString()}
            className="w-full pl-7 pr-3 py-2.5 rounded-lg text-sm outline-none"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${rewardNum > 0 && rewardNum < minimum ? "rgba(239,68,68,0.35)" : "rgba(255,255,255,0.08)"}`,
              color: "#fff",
            }} />
        </div>
        {selected && rewardNum > 0 && rewardNum < minimum && (
          <p className="text-[9px] mt-1" style={{ color: "#f87171" }}>
            Mínimo para nível {selected.level}: ${minimum.toLocaleString()}
          </p>
        )}
        {rewardNum > player.cash && (
          <p className="text-[9px] mt-1" style={{ color: "#f87171" }}>
            Dinheiro insuficiente. Tens ${player.cash.toLocaleString()}
          </p>
        )}
      </div>

      <div>
        <label className="text-[8px] font-black tracking-[0.2em] uppercase block mb-1.5" style={{ color: "rgba(160,120,40,0.45)" }}>
          Mensagem (opcional)
        </label>
        <input value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={120} placeholder="Motivo do contrato..."
          className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }} />
      </div>

      {selected && chance !== null && (
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <span className="text-[9px]" style={{ color: "rgba(160,120,40,0.5)" }}>
            Um assassino de nível {player.level} teria:
          </span>
          <span className="text-sm font-black ml-auto"
            style={{ color: chance >= 60 ? "#22c55e" : chance >= 40 ? "#fbbf24" : "#ef4444" }}>
            {chance}% chance
          </span>
        </div>
      )}

      <button onClick={() => selected && onPlace(selected.id, rewardNum, msg)} disabled={!canSubmit}
        className="w-full py-3 rounded-xl text-[11px] font-black tracking-widest transition-all active:scale-95"
        style={{
          background: canSubmit ? "linear-gradient(135deg, #7f1d1d, #ef4444)" : "rgba(255,255,255,0.04)",
          color: canSubmit ? "#fff" : "rgba(255,255,255,0.2)",
          border: canSubmit ? "1px solid rgba(239,68,68,0.35)" : "1px solid rgba(255,255,255,0.06)",
          boxShadow: canSubmit ? "0 0 14px rgba(239,68,68,0.2)" : "none",
          cursor: canSubmit ? "pointer" : "not-allowed",
        }}>
        {processing ? "A PROCESSAR..." : "💀 COLOCAR CONTRATO"}
      </button>
    </div>
  );
}

/* --------------------------- MAIN PAGE ----------------------------- */
export default function ContractsPage() {
  const { user } = useAuth();
  const router   = useRouter();

  const [loading, setLoading]                 = useState(true);
  const [contracts, setContracts]             = useState<Contract[]>([]);
  const [playerContracts, setPlayerContracts] = useState<PlayerContract[]>([]);
  const [player, setPlayer]                   = useState<Player | null>(null);
  const [processing, setProcessing]           = useState<string | null>(null);
  const [toast, setToast]                     = useState<{ msg: string; ok: boolean; details?: string } | null>(null);
  const [selected, setSelected]               = useState<string | null>(null);
  const [briefingKey, setBriefingKey]         = useState(0);
  const [arrestEscape, setArrestEscape]       = useState<{ token: string; jailMinutes: number; roadmapLevel: number } | null>(null);

  /* -- Black market (player-posted) state -- */
  const [mode, setMode] = useState<"oficial" | "blackmarket">("oficial");
  const [bountyTab, setBountyTab] = useState<"open" | "mine">("open");
  const [openBounties, setOpenBounties] = useState<HitmanContract[]>([]);
  const [myBounties, setMyBounties]     = useState<HitmanContract[]>([]);
  const [bountiesLoaded, setBountiesLoaded] = useState(false);
  const [processingBounty, setProcessingBounty] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [showPlaceForm, setShowPlaceForm] = useState(false);

  const showToast = (msg: string, ok: boolean, details?: string) => {
    setToast({ msg, ok, details });
    setTimeout(() => setToast(null), 5000);
  };

  const fetchData = useCallback(async () => {
    const res  = await fetch("/api/crime-empire/contracts");
    const data = await res.json();
    setContracts(data.contracts || []);
    setPlayerContracts(data.playerContracts || []);
    setPlayer(data.player || null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) { router.push("/"); return; }
    fetchData();
  }, [user, fetchData, router]);

  /* Auto-select medium contract on load so it starts centered; fall back to first available */
  useEffect(() => {
    if (contracts.length && !selected) {
      const medium = contracts.find((c) => {
        const st = playerContracts.find((pc) => pc.contract_id === c.id)?.status ?? null;
        return st !== "completed" && c.difficulty === "medium";
      });
      const fallback = contracts.find((c) => {
        const st = playerContracts.find((pc) => pc.contract_id === c.id)?.status ?? null;
        return st !== "completed";
      });
      const pick = medium ?? fallback;
      if (pick) setSelected(pick.id);
    }
  }, [contracts, playerContracts, selected]);

  const attemptContract = async (contractId: string) => {
    if (!player) return;
    setProcessing(contractId);
    try {
      const res  = await fetch("/api/crime-empire/contracts", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ contractId }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Erro", false);
      } else {
        const ok      = data.success;
        if (data.escape_token) {
          setArrestEscape({ token: data.escape_token, jailMinutes: data.jail_time_minutes ?? 30, roadmapLevel: data.roadmap_level ?? 1 });
        }
        const details = ok
          ? `💵 +$${data.cash_earned?.toLocaleString()} | 👑 +${data.respect_earned} Respeito | ⭐ +${data.xp_earned} XP`
          : data.arrested ? "🚔 Preso!" : "";
        showToast(data.message, ok, details);
        notifyPlayerUpdate();
        await fetchData();
      }
    } finally {
      setProcessing(null);
    }
  };

  /* -- Black-market bounties -- */
  const fetchBounties = useCallback(async () => {
    const res  = await fetch("/api/crime-empire/hitman-contratos");
    const data = await res.json();
    if (!res.ok) return;
    setOpenBounties(data.openBounties ?? []);
    setMyBounties(data.myBounties ?? []);
    setBountiesLoaded(true);
  }, []);

  useEffect(() => {
    if (mode === "blackmarket" && !bountiesLoaded) fetchBounties();
  }, [mode, bountiesLoaded, fetchBounties]);

  const executeBounty = async (id: string) => {
    setProcessingBounty(id);
    try {
      const res  = await fetch("/api/crime-empire/hitman-contratos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "execute", contractId: id }),
      });
      const data = await res.json();
      if (!res.ok) showToast(data.error ?? "Erro", false);
      else {
        showToast(
          data.success
            ? `${data.message}`
            : `${data.message} (-${data.hp_lost} HP)`,
          data.success,
          data.success ? `💵 +$${data.cash_earned?.toLocaleString()} | ⭐ +${data.xp_earned} XP` : undefined,
        );
        notifyPlayerUpdate();
        await fetchBounties();
        await fetchData();
      }
    } finally { setProcessingBounty(null); }
  };

  const cancelBounty = async (id: string) => {
    setProcessingBounty(id);
    try {
      const res  = await fetch("/api/crime-empire/hitman-contratos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", contractId: id }),
      });
      const data = await res.json();
      showToast(data.message ?? (res.ok ? "Cancelado" : "Erro"), res.ok);
      if (res.ok) { notifyPlayerUpdate(); await fetchBounties(); await fetchData(); }
    } finally { setProcessingBounty(null); }
  };

  const placeBounty = async (targetId: string, reward: number, message: string) => {
    setPlacing(true);
    try {
      const res  = await fetch("/api/crime-empire/hitman-contratos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "place", targetId, reward, message: message || null }),
      });
      const data = await res.json();
      showToast(data.message ?? (res.ok ? "Contrato colocado" : "Erro"), res.ok);
      if (res.ok) {
        setShowPlaceForm(false);
        notifyPlayerUpdate();
        await fetchBounties(); await fetchData();
      }
    } finally { setPlacing(false); }
  };

  /* -- Derived helpers -- */
  const levels = Array.from(new Set(contracts.map((c) => c.roadmap_level))).sort((a, b) => a - b);

  const getStatus = (contractId: string) =>
    playerContracts.find((pc) => pc.contract_id === contractId)?.status ?? null;

  const levelCompleted = (level: number) =>
    contracts.filter((c) => c.roadmap_level === level).every((c) => getStatus(c.id) === "completed");

  const levelUnlocked = (level: number) => {
    if (level === levels[0]) return true;
    const prev = levels[levels.indexOf(level) - 1];
    return levelCompleted(prev);
  };

  const isHitman = player?.class === "hitman";

  const selectedContract = contracts.find((c) => c.id === selected) ?? null;
  const selectedLevel    = selectedContract?.roadmap_level ?? null;
  const selectedStatus   = selected ? getStatus(selected) : null;
  const selLevelDone     = selectedLevel !== null ? levelCompleted(selectedLevel) : false;
  const selLevelUnlocked = selectedLevel !== null ? levelUnlocked(selectedLevel) : false;
  const levelContracts   = selectedLevel !== null ? contracts.filter((c) => c.roadmap_level === selectedLevel) : [];

  /* - Loading - */
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]" style={{ background: "#0B0B0B" }}>
        <div className="text-center">
          <div className="relative w-14 h-14 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border border-amber-900/20 animate-ping" />
            <div className="absolute inset-2 rounded-full border border-amber-800/30 animate-pulse" />
            <div className="absolute inset-0 flex items-center justify-center text-xl">??</div>
          </div>
          <p className="text-[8px] uppercase tracking-[0.4em]" style={{ color: "rgba(180,110,40,0.50)" }}>A CARREGAR BRIEFING</p>
        </div>
      </div>
    );
  }

  /* - Main render - */
  return (
    <div className="flex-1 text-white min-h-screen" style={{ background: "#0B0B0B" }}>
      <style>{`
        @keyframes ceShake {
          0%,100% { transform:translateX(0); }
          20% { transform:translateX(-5px); }
          40% { transform:translateX(5px); }
          60% { transform:translateX(-3px); }
          80% { transform:translateX(3px); }
        }
        @keyframes cePulseOrange {
          0%,100% { box-shadow:0 0 0 0 rgba(234,88,12,0.55); }
          50%      { box-shadow:0 0 0 7px rgba(234,88,12,0); }
        }
        @keyframes ceFadeSlide {
          from { opacity:0; transform:translateX(10px); }
          to   { opacity:1; transform:translateX(0); }
        }
        @keyframes paperFlicker {
          0%,100% { opacity:0.06; }
          50% { opacity:0.09; }
          52% { opacity:0.04; }
          54% { opacity:0.08; }
        }
        @keyframes inkBleed {
          0%,100% { text-shadow:0.5px 0.5px 0px rgba(0,0,0,0.18); }
          50% { text-shadow:0.5px 0.9px 2px rgba(0,0,0,0.28); }
        }
        @keyframes emberGlow {
          0%,100% { opacity:0.5; }
          50% { opacity:0.7; }
          70% { opacity:0.42; }
        }
        .ce-pulse-orange { animation: cePulseOrange 2.2s ease-in-out infinite; }
        .ce-fade-slide   { animation: ceFadeSlide 200ms ease-out forwards; }
        .poster-grain    { animation: paperFlicker 8s ease-in-out infinite; }
        .poster-ink      { animation: inkBleed 6s ease-in-out infinite; }
        .poster-ember    { animation: emberGlow 4s ease-in-out infinite; }
      `}</style>

      {/* Vignette */}
      <div className="pointer-events-none fixed inset-0 z-0"
        style={{ background: "radial-gradient(ellipse at center,transparent 50%,rgba(0,0,0,0.55) 100%)" }} />

      {toast && <CEToast msg={toast.msg} ok={toast.ok} details={toast.details} />}

      <div className="relative z-10 py-8 pl-2 pr-4 md:pl-3 md:pr-8 flex flex-col gap-6">

        {/* -- Page header -- */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-[7px] uppercase tracking-[0.5em] mb-1" style={{ color: "rgba(180,110,40,0.45)" }}>
              CRIME EMPIRE / CONTRATOS
            </p>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter leading-none" style={{ color: "#f0d090" }}>
              CONTRATOS
            </h1>
          </div>
          {player && <PlayerHUD player={player} isHitman={isHitman} />}
        </div>

        {/* -- Banners -- */}
        {isHitman && (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-[10px]"
            style={{ background: "rgba(28,5,5,0.85)", border: "1px solid rgba(153,27,27,0.32)" }}
          >
            <span className="flex-shrink-0">??</span>
            <span style={{ color: "rgba(248,113,113,0.90)" }}>
              <strong style={{ color: "rgba(252,165,165,1)" }}>BONUS HITMAN:</strong> +15% taxa de sucesso ? -50% chance de ser preso
            </span>
          </div>
        )}
        {player?.in_jail && (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-[10px]"
            style={{ background: "rgba(25,18,5,0.85)", border: "1px solid rgba(146,64,14,0.38)" }}
          >
            <span className="flex-shrink-0">⚠️</span>
            <span style={{ color: "rgba(251,191,36,0.80)" }}>
              <strong style={{ color: "rgba(253,224,71,1)" }}>DETIDO:</strong> Não podes aceitar contratos enquanto estiveres preso.
            </span>
          </div>
        )}

        {/* -- MODE TOGGLE -- */}
        <div
          className="flex gap-1 p-1 rounded-xl"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          {([
            { key: "oficial",     label: "ALVOS OFICIAIS", icon: "📜", color: "#f0d090" },
            { key: "blackmarket", label: "MERCADO NEGRO",  icon: "💀", color: "#ef4444" },
          ] as const).map((m) => {
            const active = mode === m.key;
            return (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg transition-all duration-200"
                style={{
                  background: active ? `${m.color}14` : "transparent",
                  border: active ? `1px solid ${m.color}33` : "1px solid transparent",
                  color: active ? m.color : "rgba(140,110,50,0.35)",
                }}
              >
                <span className="text-sm">{m.icon}</span>
                <span className="text-[10px] font-black tracking-[0.18em]">{m.label}</span>
                {m.key === "blackmarket" && bountiesLoaded && openBounties.length > 0 && (
                  <span
                    className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                    style={{
                      background: active ? `${m.color}22` : "rgba(255,255,255,0.04)",
                      color: active ? m.color : "rgba(140,110,50,0.35)",
                    }}
                  >
                    {openBounties.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* -- MAIN SPLIT LAYOUT -- */}
        {mode === "oficial" && (contracts.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-2xl opacity-10 mb-3">??</p>
            <p className="text-[9px] uppercase tracking-[0.4em]" style={{ color: "rgba(180,110,40,0.40)" }}>Sem contratos disponiveis</p>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8 items-start">

            {/* -- LEFT: Roadmap + List -- */}
            <div
              className="w-full lg:w-[260px] flex-shrink-0 rounded-2xl p-4 space-y-5"
              style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-[9px] font-semibold tracking-[0.45em] uppercase" style={{ color: "rgba(255,255,255,0.30)" }}>Dossie de Alvos</p>
              </div>
              {levels.map((lvl, lvlIdx) => {
                const lvlContracts = contracts.filter((c) => c.roadmap_level === lvl);
                const unlocked     = levelUnlocked(lvl);
                const completed    = levelCompleted(lvl);
                const isActive     = lvlContracts.some((c) => c.id === selected);

                return (
                  <div key={lvl} className="relative">
                    {/* Spine line */}
                    <div
                      className="absolute left-3 top-7 bottom-0 w-px -z-10"
                      style={{ background: "rgba(255,255,255,0.06)" }}
                    />
                    <RoadmapNode level={lvl} levelIndex={lvlIdx} completed={completed} unlocked={unlocked} active={isActive} />
                    <div className="mt-2 ml-4 space-y-1">
                      {lvlContracts.map((c) => (
                        <ContractListItem
                          key={c.id}
                          contract={c}
                          status={getStatus(c.id)}
                          selected={selected === c.id}
                          levelUnlocked={unlocked}
                          isHitman={isHitman}
                          onClick={() => {
                            if (selected !== c.id) setSelected(c.id);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Footer note */}
              <div className="px-1 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <p className="text-[7px] uppercase tracking-[0.20em] leading-relaxed" style={{ color: "rgba(255,255,255,0.22)" }}>
                  Falhar envia-te ao hospital com 0 HP. Dificuldade e recompensas aumentam com cada fase.
                </p>
              </div>
            </div>

            {/* -- RIGHT: 3-Card Fan -- */}
            <div className="flex-1 pt-2 min-w-0" style={{ minHeight: "740px" }}>
              {selectedContract ? (
                <div key={selectedLevel ?? "none"} className="ce-fade-slide w-full">
                  <ThreeCardFan
                    levelContracts={levelContracts}
                    selected={selected}
                    getStatus={getStatus}
                    levelDone={selLevelDone}
                    levelUnlocked={selLevelUnlocked}
                    player={player}
                    isHitman={isHitman}
                    processing={processing}
                    onSelect={(id) => setSelected(id)}
                    onExecute={attemptContract}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center py-20">
                  <p className="text-[8px] uppercase tracking-[0.4em]" style={{ color: "rgba(120,70,20,0.40)" }}>
                    Seleciona um contrato
                  </p>
                </div>
              )}
            </div>

          </div>
        ))}

        {/* -- BLACK MARKET (player-posted contracts) -- */}
        {mode === "blackmarket" && (
          <div className="flex flex-col gap-5">
            {/* Info strip */}
            <div
              className="grid grid-cols-3 gap-3 px-4 py-3 rounded-xl"
              style={{ background: "rgba(14,8,3,0.9)", border: "1px solid rgba(255,106,0,0.08)" }}
            >
              {[
                { label: "Preço mínimo", value: "Nível × $3.000", icon: "💰" },
                { label: "Chance base",  value: "50% ±2% por nível", icon: "🎯" },
                { label: "Falha",        value: "-40% HP ao executor", icon: "💔" },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <div className="text-xl mb-1">{s.icon}</div>
                  <div className="text-[10px] font-bold" style={{ color: "#ddc870" }}>{s.value}</div>
                  <div className="text-[8px] mt-0.5" style={{ color: "rgba(160,120,40,0.4)" }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Place bounty toggle */}
            <button
              onClick={() => setShowPlaceForm((v) => !v)}
              disabled={player?.in_jail ?? false}
              className="w-full py-3 rounded-xl text-[11px] font-black tracking-widest transition-all active:scale-[0.98]"
              style={{
                background: showPlaceForm
                  ? "rgba(239,68,68,0.1)"
                  : "linear-gradient(135deg, rgba(127,29,29,0.8), rgba(185,28,28,0.8))",
                color: showPlaceForm ? "rgba(248,113,113,0.8)" : "#fff",
                border: showPlaceForm ? "1px solid rgba(239,68,68,0.2)" : "1px solid rgba(239,68,68,0.35)",
                boxShadow: showPlaceForm ? "none" : "0 0 16px rgba(239,68,68,0.15)",
                opacity: (player?.in_jail ?? false) ? 0.4 : 1,
                cursor: (player?.in_jail ?? false) ? "not-allowed" : "pointer",
              }}
            >
              {showPlaceForm ? "✕ CANCELAR" : "💀 COLOCAR CONTRATO"}
            </button>

            {showPlaceForm && player && (
              <PlaceBountyForm
                player={{ level: player.level, cash: player.cash }}
                processing={placing}
                onPlace={placeBounty}
              />
            )}

            {/* Bounty tabs */}
            <div
              className="flex gap-1 p-1 rounded-xl"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              {(["open", "mine"] as const).map((t) => {
                const active = bountyTab === t;
                const count  = t === "open"
                  ? openBounties.length
                  : myBounties.filter((b) => b.status === "open").length;
                return (
                  <button
                    key={t}
                    onClick={() => setBountyTab(t)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-2 rounded-lg transition-all duration-200"
                    style={{
                      background: active ? "rgba(255,106,0,0.1)" : "transparent",
                      border: active ? "1px solid rgba(255,106,0,0.22)" : "1px solid transparent",
                      color: active ? "#ff6a00" : "rgba(140,110,50,0.35)",
                    }}
                  >
                    <span className="text-[10px] font-black tracking-[0.12em]">
                      {t === "open" ? "CONTRATOS ABERTOS" : "OS MEUS CONTRATOS"}
                    </span>
                    {count > 0 && (
                      <span
                        className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                        style={{
                          background: active ? "rgba(255,106,0,0.18)" : "rgba(255,255,255,0.04)",
                          color: active ? "#ff6a00" : "rgba(140,110,50,0.35)",
                        }}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Bounty list */}
            {!bountiesLoaded ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="relative w-10 h-10 mb-3">
                  <div className="absolute inset-0 rounded-full border border-red-900/30 animate-ping" />
                  <div className="absolute inset-2 rounded-full border border-red-800/40 animate-pulse" />
                </div>
                <p className="text-[8px] uppercase tracking-[0.4em]" style={{ color: "rgba(180,60,40,0.5)" }}>A CARREGAR MERCADO</p>
              </div>
            ) : (() => {
              const list = bountyTab === "open" ? openBounties : myBounties;
              if (list.length === 0) {
                return (
                  <div
                    className="flex flex-col items-center justify-center py-20 rounded-xl"
                    style={{ background: "rgba(10,7,3,0.5)", border: "1px solid rgba(255,255,255,0.03)" }}
                  >
                    <span className="text-4xl mb-3" style={{ opacity: 0.1 }}>🔫</span>
                    <p className="text-[9px] tracking-[0.3em]" style={{ color: "rgba(160,120,40,0.3)" }}>
                      {bountyTab === "open" ? "SEM CONTRATOS ABERTOS" : "NÃO TENS CONTRATOS COLOCADOS"}
                    </p>
                  </div>
                );
              }
              return (
                <div className="space-y-3">
                  {list.map((c) => (
                    <BountyCard
                      key={c.id}
                      contract={c}
                      myLevel={player?.level ?? 1}
                      isOwn={bountyTab === "mine"}
                      processing={processingBounty}
                      onExecute={executeBounty}
                      onCancel={cancelBounty}
                    />
                  ))}
                </div>
              );
            })()}

            {/* History */}
            {bountyTab === "mine" && myBounties.some((b) => b.status !== "open") && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.05)" }} />
                  <span className="text-[8px] font-black tracking-[0.25em]" style={{ color: "rgba(160,120,40,0.3)" }}>
                    HISTÓRICO
                  </span>
                  <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.05)" }} />
                </div>
                <div className="space-y-2">
                  {myBounties.filter((b) => b.status !== "open").map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between px-4 py-3 rounded-xl"
                      style={{
                        background: "rgba(8,5,2,0.8)",
                        border: `1px solid ${c.status === "completed" ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)"}`,
                        opacity: 0.6,
                      }}
                    >
                      <div>
                        <span className="text-xs font-bold" style={{ color: "#ddc870" }}>
                          {c.target_display_name || c.target_username}
                        </span>
                        <span className="text-[8px] ml-2" style={{ color: "rgba(160,120,40,0.4)" }}>
                          Nív. {c.target_level}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[9px] font-bold" style={{ color: "rgba(200,160,60,0.5)" }}>
                          ${c.reward_cash.toLocaleString()}
                        </span>
                        <span
                          className="text-[8px] font-black px-2 py-0.5 rounded"
                          style={{
                            color: c.status === "completed" ? "#4ade80" : c.status === "failed" ? "#f87171" : "rgba(200,160,60,0.6)",
                            background: c.status === "completed" ? "rgba(34,197,94,0.1)" : c.status === "failed" ? "rgba(239,68,68,0.1)" : "rgba(200,160,60,0.06)",
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
        )}
      </div>
      {arrestEscape && (
        <RaidEscape
          difficulty={arrestEscape.roadmapLevel <= 1 ? "medium" : "high"}
          cashAtRisk={0}
          onEscape={async () => {
            const token = arrestEscape.token;
            setArrestEscape(null);
            await fetch("/api/crime-empire/escape-attempt", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token, escaped: true }),
            });
            fetchData();
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
