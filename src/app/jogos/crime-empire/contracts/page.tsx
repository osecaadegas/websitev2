"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { CEToast } from "@/components/CEToast";
import { useRouter } from "next/navigation";

/* ────────────────────────────── TYPES ─────────────────────────────── */
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

/* ────────────────────────────── CONFIG ─────────────────────────────── */
const DIFF: Record<string, { label: string; color: string; bg: string; riskMod: number }> = {
  easy:   { label: "FACIL",   color: "#22c55e", bg: "#22c55e18", riskMod: 0.7  },
  medium: { label: "MEDIO",   color: "#f59e0b", bg: "#f59e0b18", riskMod: 1.0  },
  hard:   { label: "DIFICIL", color: "#ef4444", bg: "#ef444418", riskMod: 1.35 },
};

/* ────────────────────────────── STAT BAR ────────────────────────────── */
function StatBar({ pct, color }: { pct: number; color: string }) {
  const blocks = 10;
  const filled = Math.round((pct / 100) * blocks);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: blocks }).map((_, i) => (
        <div
          key={i}
          className="h-2 w-4 rounded-sm flex-shrink-0 transition-all duration-500"
          style={{ background: i < filled ? color : "#1e1e1e" }}
        />
      ))}
    </div>
  );
}

/* ────────────────────────────── PLAYER HUD ─────────────────────────── */
function PlayerHUD({ player, isHitman }: { player: Player; isHitman: boolean }) {
  const stPct = Math.max(0, Math.min(100, (player.stamina / player.max_stamina) * 100));
  const hpPct = Math.max(0, Math.min(100, (player.hp / player.max_hp) * 100));
  return (
    <div className="flex items-center gap-5 flex-wrap border-b border-[#222] pb-4 mb-5">
      <div className="flex items-center gap-2">
        <span className="text-[8px] uppercase tracking-[0.3em] text-[#666]">NIV</span>
        <span className="text-sm font-black text-white bg-[#181818] border border-[#222] rounded px-3 py-1 tabular-nums">
          {player.level}
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center justify-between gap-6">
          <span className="text-[8px] uppercase tracking-[0.3em] text-[#666]">STAMINA</span>
          <span className="text-[9px] font-bold tabular-nums" style={{ color: stPct > 40 ? "#f59e0b" : "#ef4444" }}>
            {player.stamina}/{player.max_stamina}
          </span>
        </div>
        <div className="h-1 rounded-full bg-[#181818] overflow-hidden w-28">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${stPct}%`, background: stPct > 50 ? "#f59e0b" : stPct > 20 ? "#f97316" : "#ef4444" }} />
        </div>
      </div>
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center justify-between gap-6">
          <span className="text-[8px] uppercase tracking-[0.3em] text-[#666]">HP</span>
          <span className="text-[9px] font-bold tabular-nums" style={{ color: hpPct > 40 ? "#22c55e" : "#ef4444" }}>
            {player.hp}/{player.max_hp}
          </span>
        </div>
        <div className="h-1 rounded-full bg-[#181818] overflow-hidden w-24">
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

/* ────────────────────────────── CONTRACT LIST ITEM ─────────────────── */
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

  return (
    <button
      onClick={onClick}
      disabled={locked}
      className={[
        "w-full text-left px-3 py-2.5 rounded-lg border flex items-center gap-3 transition-all duration-150",
        selected
          ? "bg-[#1a1200] border-orange-700/60 shadow-md shadow-orange-950/40"
          : isCompleted
          ? "bg-[#060f06] border-green-900/30 opacity-70 hover:opacity-90"
          : isFailed
          ? "bg-[#0f0505] border-red-900/20 opacity-60 hover:opacity-80"
          : locked
          ? "bg-[#0c0c0c] border-[#141414] opacity-25 cursor-not-allowed"
          : "bg-[#0e0e0e] border-[#1a1a1a] hover:border-[#252525] hover:bg-[#111]",
      ].join(" ")}
    >
      {/* Status dot */}
      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: isCompleted ? "#22c55e" : isFailed ? "#ef4444" : selected ? "#f97316" : "#2a2a2a" }} />

      {/* Name */}
      <span className={`text-[11px] font-bold flex-1 truncate ${
        isCompleted ? "text-green-500/70" : isFailed ? "text-red-500/60" : locked ? "text-[#2a2a2a]" : "text-[#ccc]"
      }`}>
        {locked ? "🔒 " : ""}{contract.name}
      </span>

      {/* Difficulty tag */}
      <span
        className="text-[7px] font-black tracking-[0.2em] px-1.5 py-0.5 rounded flex-shrink-0"
        style={{ background: locked ? "#111" : diff.bg, color: locked ? "#333" : diff.color }}
      >
        {diff.label}
      </span>

      {/* Success % */}
      {!locked && (
        <span
          className="text-[9px] font-black tabular-nums flex-shrink-0 w-8 text-right"
          style={{ color: displayRate >= 60 ? "#22c55e" : displayRate >= 40 ? "#f59e0b" : "#ef4444" }}
        >
          {displayRate}%
        </span>
      )}
    </button>
  );
}

/* ────────────────────────────── CONTRACT BRIEFING ──────────────────── */
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
  const diff = DIFF[contract.difficulty] ?? DIFF.medium;
  const isCompleted = status === "completed";
  const isFailed    = status === "failed";
  const locked      = !levelUnlocked;

  const displayRate = isHitman
    ? Math.min(95, Math.round((contract.base_success_rate + contract.hitman_bonus) * 100))
    : Math.round(contract.base_success_rate * 100);

  const baseArrest = contract.arrest_chance ?? 0.3;
  const arrestDisplay = isHitman
    ? Math.round(baseArrest * (1 - (contract.hitman_arrest_reduction ?? 0.5)) * 100)
    : Math.round(baseArrest * 100);

  const riskDisplay = Math.min(99, Math.round((1 - contract.base_success_rate) * (DIFF[contract.difficulty]?.riskMod ?? 1) * 100));

  const meetsLevel  = (player?.level  ?? 0) >= contract.required_level;
  const hasStamina  = (player?.stamina ?? 0) >= contract.stamina_cost;
  const inJail      = player?.in_jail ?? false;

  let disabledReason = "";
  if (locked)           disabledReason = "BLOQUEADO";
  else if (inJail)      disabledReason = "DETIDO";
  else if (isCompleted) disabledReason = "JA CONCLUIDO";
  else if (levelDone)   disabledReason = "NIVEL JA CONCLUIDO";
  else if (!meetsLevel) disabledReason = `NIVEL ${contract.required_level} NECESSARIO`;
  else if (!hasStamina) disabledReason = "STAMINA INSUFICIENTE";

  const serif = { fontFamily: "Georgia, 'Times New Roman', serif" } as const;

  const noiseSvg = "data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E";

  const diffSepia: Record<string, { text: string; border: string; bg: string }> = {
    easy:   { text: "#166534", border: "#166534", bg: "rgba(22,101,52,0.12)"  },
    medium: { text: "#92400e", border: "#92400e", bg: "rgba(146,64,14,0.12)" },
    hard:   { text: "#7f1d1d", border: "#7f1d1d", bg: "rgba(127,29,29,0.12)" },
  };
  const ds = diffSepia[contract.difficulty] ?? diffSepia.medium;

  const successColor = displayRate >= 60 ? "#166534" : displayRate >= 40 ? "#92400e" : "#7f1d1d";

  return (
    <div className="relative" style={{ minHeight: "560px" }}>

      {/* ── PAPER BASE ── */}
      <div className="absolute inset-0 rounded-xl" style={{ background: "linear-gradient(155deg,#f7ebd0 0%,#ede0b6 45%,#e6d8aa 100%)" }} />

      {/* ── GRAIN NOISE ── */}
      <div
        className="absolute inset-0 rounded-xl pointer-events-none mix-blend-multiply poster-grain"
        style={{ backgroundImage: `url("${noiseSvg}")`, backgroundSize: "200px 200px", opacity: 0.07 }}
      />

      {/* ── BURNED EDGES ── */}
      <div
        className="absolute inset-0 rounded-xl pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center,transparent 50%,rgba(60,30,10,0.10) 66%,rgba(40,15,5,0.32) 80%,rgba(20,5,0,0.58) 100%)" }}
      />

      {/* ── CORNER EMBERS ── */}
      <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-24 h-24 bg-gradient-to-br from-amber-950/40 via-amber-900/15 to-transparent poster-ember" />
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-950/40 via-amber-900/15 to-transparent poster-ember" style={{ animationDelay: "0.8s" }} />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-amber-950/40 via-amber-900/15 to-transparent poster-ember" style={{ animationDelay: "1.6s" }} />
        <div className="absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-tl from-amber-950/40 via-amber-900/15 to-transparent poster-ember" style={{ animationDelay: "2.4s" }} />
      </div>

      {/* ── STAIN MARKS ── */}
      <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
        <div className="absolute top-[10%] right-[9%] w-16 h-12 rounded-full blur-md" style={{ background: "rgba(139,90,43,0.09)" }} />
        <div className="absolute bottom-[28%] left-[7%] w-12 h-8 rounded-full blur-md"  style={{ background: "rgba(100,60,20,0.08)" }} />
        <div className="absolute top-[50%] left-[78%] w-8 h-10 rounded-full blur-sm"   style={{ background: "rgba(120,70,30,0.07)" }} />
      </div>

      {/* ── CONTENT ── */}
      <div className="relative z-10 flex flex-col px-7 py-6">

        {/* HEADER */}
        <div className="text-center mb-3">
          <h1
            className="text-4xl font-black tracking-[0.4em] leading-none poster-ink"
            style={{ ...serif, color: "rgba(69,32,5,0.88)", textShadow: "1px 1px 0px rgba(0,0,0,0.18),2px 2px 4px rgba(0,0,0,0.08)" }}
          >
            CONTRATO
          </h1>
          <div className="flex items-center justify-center gap-3 mt-1.5">
            <div className="h-px flex-1 max-w-16 bg-amber-900/25" />
            <span className="text-[8px] font-bold tracking-[0.5em] uppercase" style={{ ...serif, color: "rgba(120,53,15,0.55)" }}>
              DOSSIE CONFIDENCIAL
            </span>
            <div className="h-px flex-1 max-w-16 bg-amber-900/25" />
          </div>
        </div>

        {/* DIFFICULTY BADGE */}
        <div className="flex items-center gap-2 mb-3">
          <div className="h-px flex-1 bg-amber-900/18" />
          <span
            className="text-[8px] font-black tracking-[0.3em] uppercase px-3 py-0.5 rounded-sm border"
            style={{ ...serif, color: ds.text, borderColor: `${ds.border}45`, background: ds.bg }}
          >
            {diff.label}
          </span>
          <div className="h-px flex-1 bg-amber-900/18" />
        </div>

        {/* TARGET PORTRAIT */}
        {contract.image && (
          <div className="flex justify-center mb-3">
            <div className="relative">
              {/* Frame glow */}
              <div className="absolute -inset-1 rounded-sm bg-amber-900/20 blur-sm" />
              {/* Image frame */}
              <div
                className="relative w-40 h-32 rounded-sm overflow-hidden"
                style={{ boxShadow: "inset 0 0 18px rgba(0,0,0,0.35),0 2px 10px rgba(0,0,0,0.25),0 0 0 2px rgba(120,53,15,0.22)" }}
              >
                {/* Sepia overlay on image */}
                <img
                  src={contract.image === "hacker"
                    ? `/images/contracts/contrac_hacker.png`
                    : `/images/contracts/contract_${contract.image}.png`}
                  alt={contract.name}
                  className="w-full h-full object-cover object-top"
                  style={{ filter: "sepia(0.35) contrast(1.08) brightness(0.94)" }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                {/* Burn vignette over image */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: "radial-gradient(ellipse at center,transparent 40%,rgba(40,15,5,0.30) 75%,rgba(20,5,0,0.55) 100%)" }}
                />
              </div>
              {/* Torn corner decorations */}
              <div className="absolute -top-1 -right-1 w-3 h-3 rotate-45" style={{ background: "rgba(245,220,170,0.65)" }} />
              <div className="absolute -bottom-1 -left-1 w-2 h-2 -rotate-12" style={{ background: "rgba(245,220,170,0.55)" }} />
            </div>
          </div>
        )}

        {/* TARGET NAME */}
        <h2
          className="text-2xl font-black tracking-[0.18em] text-center leading-tight mb-2"
          style={{ ...serif, color: "rgba(55,26,3,0.90)", textShadow: "0.5px 0.5px 0px rgba(0,0,0,0.12)" }}
        >
          {contract.name}
        </h2>
        {(isCompleted || isFailed) && (
          <div className="flex justify-center mb-3">
            <span
              className={`text-[8px] font-black tracking-[0.25em] px-4 py-1 rounded-sm uppercase border ${
                isCompleted
                  ? "text-green-900 border-green-900/30 bg-green-100/50"
                  : "text-red-900 border-red-900/30 bg-red-50/50"
              }`}
              style={serif}
            >
              {isCompleted ? "✓ MISSAO CUMPRIDA" : "✗ MISSAO FALHADA"}
            </span>
          </div>
        )}

        {/* INTEL DIVIDER + DESCRIPTION */}
        <div className="flex items-center gap-2 mb-2 mt-1">
          <div className="h-px flex-1 bg-amber-900/18" />
          <span className="text-[8px] font-bold tracking-[0.4em] uppercase" style={{ ...serif, color: "rgba(120,53,15,0.40)" }}>Intel</span>
          <div className="h-px flex-1 bg-amber-900/18" />
        </div>
        <p
          className="text-[12px] text-center leading-relaxed mb-4 italic px-2"
          style={{ ...serif, color: "rgba(101,63,15,0.68)", textShadow: "0.5px 0.5px 0px rgba(255,255,255,0.18)" }}
        >
          {contract.description}
        </p>

        {/* STATS — 3 columns */}
        <div className="w-full grid grid-cols-3 gap-2 mb-4">
          <div className="flex flex-col items-center gap-1 rounded-sm py-2.5 px-1 border border-amber-900/15" style={{ background: "rgba(139,90,43,0.10)" }}>
            <span className="text-[7px] font-bold tracking-[0.2em] uppercase" style={{ ...serif, color: "rgba(120,53,15,0.50)" }}>Sucesso</span>
            <span className="text-sm font-black tabular-nums" style={{ ...serif, color: successColor }}>
              {displayRate}%{isHitman ? " ✦" : ""}
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-sm py-2.5 px-1 border border-amber-900/15" style={{ background: "rgba(139,90,43,0.10)" }}>
            <span className="text-[7px] font-bold tracking-[0.2em] uppercase" style={{ ...serif, color: "rgba(120,53,15,0.50)" }}>Risco</span>
            <span className="text-sm font-black tabular-nums" style={{ ...serif, color: "#7f1d1d" }}>{riskDisplay}%</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-sm py-2.5 px-1 border border-amber-900/15" style={{ background: "rgba(139,90,43,0.10)" }}>
            <span className="text-[7px] font-bold tracking-[0.2em] uppercase" style={{ ...serif, color: "rgba(120,53,15,0.50)" }}>Stamina</span>
            <span className="text-sm font-black tabular-nums" style={{ ...serif, color: hasStamina ? "#78350f" : "#7f1d1d" }}>
              -{contract.stamina_cost}
            </span>
          </div>
        </div>

        {/* REWARD BOX */}
        <div className="relative mb-4 w-full">
          <div className="absolute inset-0 rounded-sm blur-sm" style={{ background: "rgba(245,210,140,0.25)" }} />
          <div className="relative px-5 py-3 text-center rounded-sm" style={{ border: "2px double rgba(120,53,15,0.28)", background: "rgba(253,246,227,0.30)" }}>
            <div
              className="absolute -top-3 -right-2 rotate-12 text-[7px] font-black tracking-[0.15em] uppercase px-2 py-0.5 rounded-sm border"
              style={{ ...serif, color: "rgba(153,27,27,0.45)", borderColor: "rgba(153,27,27,0.18)", background: "rgba(254,242,242,0.45)" }}
            >
              ALVO
            </div>
            <span className="text-[8px] font-bold tracking-[0.4em] uppercase block mb-0.5" style={{ ...serif, color: "rgba(120,53,15,0.50)" }}>
              Recompensa Estimada
            </span>
            <span
              className="text-xl font-black block"
              style={{ ...serif, color: "rgba(55,26,3,0.88)", textShadow: "0.5px 0.5px 0px rgba(0,0,0,0.10)", letterSpacing: "0.06em" }}
            >
              ${contract.min_cash.toLocaleString("pt-PT")} — ${contract.max_cash.toLocaleString("pt-PT")}
            </span>
            <span className="text-[10px] font-bold block mt-0.5" style={{ ...serif, color: "rgba(101,63,15,0.60)" }}>
              +{contract.respect_reward} Respeito
            </span>
          </div>
        </div>

        {/* CONSEQUENCES */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-px flex-1 bg-amber-900/18" />
            <span className="text-[8px] font-bold tracking-[0.35em] uppercase" style={{ ...serif, color: "rgba(120,53,15,0.40)" }}>Consequencias</span>
            <div className="h-px flex-1 bg-amber-900/18" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-start gap-2.5">
              <div className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ background: "rgba(153,27,27,0.50)" }} />
              <p className="text-[11px]" style={{ ...serif, color: "rgba(101,63,15,0.65)" }}>
                Em caso de falha, HP cai para 0 — serás enviado ao hospital.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ background: "rgba(153,27,27,0.50)" }} />
              <p className="text-[11px]" style={{ ...serif, color: "rgba(101,63,15,0.65)" }}>
                <span className="font-bold" style={{ color: "rgba(153,27,27,0.72)" }}>{arrestDisplay}% de chance</span> de ser preso (30–90 min).
              </p>
            </div>
            {!meetsLevel && (
              <div className="flex items-start gap-2.5">
                <div className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ background: "rgba(153,27,27,0.65)" }} />
                <p className="text-[11px] font-bold" style={{ ...serif, color: "rgba(127,29,29,0.75)" }}>
                  Requer nivel {contract.required_level} — o teu atual é insuficiente.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* CONFIDENCIAL STAMP */}
        <div className="flex justify-center my-3">
          <div className="transform -rotate-6">
            <span
              className="text-[11px] font-black tracking-[0.35em] uppercase border-2 rounded-full px-5 py-1.5"
              style={{ ...serif, color: "rgba(153,27,27,0.28)", borderColor: "rgba(153,27,27,0.18)" }}
            >
              CONFIDENCIAL
            </span>
          </div>
        </div>

        {/* ── EXECUTE BUTTON ── */}
        <div className="mt-2">
          {disabledReason ? (
            <div
              className="w-full py-3 rounded-sm text-center text-[8px] font-black tracking-[0.35em] uppercase border"
              style={{ ...serif, color: "rgba(120,53,15,0.48)", background: "rgba(245,230,200,0.35)", borderColor: "rgba(120,53,15,0.18)" }}
            >
              {disabledReason}
            </div>
          ) : (
            <button
              onClick={onExecute}
              disabled={processing}
              className={[
                "relative w-full py-3.5 px-6 rounded-sm font-black text-sm tracking-[0.25em] uppercase transition-all duration-200 ease-out",
                processing
                  ? "opacity-60 cursor-wait"
                  : "hover:brightness-110 active:scale-[0.98] active:translate-y-px",
              ].join(" ")}
              style={{
                ...serif,
                background: "linear-gradient(to bottom,#b45309,#92400e,#7c2d12)",
                color: "#fef3c7",
                border: "1px solid rgba(180,83,9,0.40)",
                boxShadow: "0 4px 14px rgba(0,0,0,0.30),0 1px 3px rgba(0,0,0,0.20),inset 0 1px 0 rgba(255,255,255,0.10)",
              }}
            >
              <div className="absolute inset-0 rounded-sm pointer-events-none opacity-20 bg-gradient-to-b from-white/20 to-transparent" />
              <span className="relative z-10 flex items-center justify-center gap-2">
                {processing ? (
                  <>
                    <span className="w-3 h-3 border border-amber-200/50 border-t-transparent rounded-full animate-spin" />
                    EXECUTANDO
                  </>
                ) : (
                  <>⚔ EXECUTAR CONTRATO</>
                )}
              </span>
            </button>
          )}
          {!disabledReason && (
            <p className="text-center text-[8px] mt-2 uppercase tracking-wider" style={{ ...serif, color: "rgba(120,53,15,0.42)" }}>
              Esta acao nao pode ser revertida
            </p>
          )}
        </div>

      </div>
    </div>
  );
}

/* ────────────────────────────── ROADMAP NODE ────────────────────────── */
function RoadmapNode({ level, completed, unlocked, active }: {
  level: number; completed: boolean; unlocked: boolean; active: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className={[
        "w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-black border flex-shrink-0 transition-all duration-300",
        completed ? "bg-green-950 border-green-700 text-green-400" :
        active    ? "bg-[#1a0d00] border-orange-700 text-orange-400 ce-pulse-orange" :
        unlocked  ? "bg-[#111] border-[#222] text-[#444]" :
                    "bg-[#0c0c0c] border-[#161616] text-[#252525]",
      ].join(" ")}>
        {completed ? "✓" : unlocked || active ? level : "—"}
      </div>
      <span className={`text-[8px] uppercase tracking-[0.2em] font-bold ${
        completed ? "text-green-400" : active ? "text-orange-400" : "text-[#444]"
      }`}>
        CAP {level}
      </span>
    </div>
  );
}

/* ─────────────────────────── MAIN PAGE ───────────────────────────── */
export default function ContractsPage() {
  const { user } = useAuth();
  const router   = useRouter();

  const [loading, setLoading]               = useState(true);
  const [contracts, setContracts]           = useState<Contract[]>([]);
  const [playerContracts, setPlayerContracts] = useState<PlayerContract[]>([]);
  const [player, setPlayer]                 = useState<Player | null>(null);
  const [processing, setProcessing]         = useState<string | null>(null);
  const [toast, setToast]                   = useState<{ msg: string; ok: boolean; details?: string } | null>(null);
  const [selected, setSelected]             = useState<string | null>(null);
  const [briefingKey, setBriefingKey]       = useState(0);

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

  /* Auto-select first available contract */
  useEffect(() => {
    if (contracts.length && !selected) {
      const first = contracts.find((c) => {
        const st = playerContracts.find((pc) => pc.contract_id === c.id)?.status ?? null;
        return st !== "completed";
      });
      if (first) setSelected(first.id);
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
        const details = ok
          ? `+💵 $${data.cash_earned?.toLocaleString()} | +⭐ ${data.respect_earned} Respeito`
          : data.arrested ? "🚔 Preso!" : "";
        showToast(data.message, ok, details);
        await fetchData();
      }
    } finally {
      setProcessing(null);
    }
  };

  /* ── Derived helpers ── */
  const levels = Array.from(new Set(contracts.map((c) => c.roadmap_level))).sort((a, b) => a - b);

  const getStatus = (contractId: string) =>
    playerContracts.find((pc) => pc.contract_id === contractId)?.status ?? null;

  const levelCompleted = (level: number) =>
    contracts.filter((c) => c.roadmap_level === level).some((c) => getStatus(c.id) === "completed");

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

  /* ─ Loading ─ */
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]" style={{ background: "#0B0B0B" }}>
        <div className="text-center">
          <div className="relative w-14 h-14 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border border-red-900/20 animate-ping" />
            <div className="absolute inset-2 rounded-full border border-red-800/30 animate-pulse" />
            <div className="absolute inset-0 flex items-center justify-center text-xl">🎯</div>
          </div>
          <p className="text-[8px] uppercase tracking-[0.4em] text-[#666]">A CARREGAR BRIEFING</p>
        </div>
      </div>
    );
  }

  /* ─ Main render ─ */
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
        style={{ background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.65) 100%)" }} />

      {toast && <CEToast msg={toast.msg} ok={toast.ok} details={toast.details} />}

      <div className="relative z-10 max-w-6xl mx-auto py-8 px-4 md:px-8 flex flex-col gap-6">

        {/* ── Page title + HUD ── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-[7px] uppercase tracking-[0.5em] text-[#555] mb-1">CRIME EMPIRE / CONTRATOS</p>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white leading-none">CONTRATOS</h1>
          </div>
          {player && <PlayerHUD player={player} isHitman={isHitman} />}
        </div>

        {/* ── Banners ── */}
        {isHitman && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#0e0404] border border-red-900/30 text-[10px] text-red-800">
            <span className="flex-shrink-0">🔪</span>
            <span className="text-red-400"><strong className="text-red-300">BONUS HITMAN:</strong> +15% taxa de sucesso · -50% chance de ser preso</span>
          </div>
        )}
        {player?.in_jail && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#0d0b00] border border-yellow-900/30 text-[10px] text-yellow-900">
            <span className="flex-shrink-0">🚔</span>
            <span className="text-yellow-600"><strong className="text-yellow-400">DETIDO:</strong> Nao podes aceitar contratos enquanto estiveres preso.</span>
          </div>
        )}

        {/* ── MAIN SPLIT LAYOUT ── */}
        {contracts.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-2xl opacity-10 mb-3">🎯</p>
            <p className="text-[9px] uppercase tracking-[0.4em] text-[#555]">Sem contratos disponiveis</p>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-4 items-start">

            {/* ── LEFT: Roadmap + List ── */}
            <div className="w-full lg:w-[260px] flex-shrink-0 space-y-6">
              {levels.map((lvl) => {
                const lvlContracts = contracts.filter((c) => c.roadmap_level === lvl);
                const unlocked     = levelUnlocked(lvl);
                const completed    = levelCompleted(lvl);
                const isActive     = lvlContracts.some((c) => c.id === selected);

                return (
                  <div key={lvl} className="relative">
                    {/* Spine line */}
                    <div className="absolute left-3 top-7 bottom-0 w-px bg-[#141414] -z-10" />

                    <RoadmapNode
                      level={lvl}
                      completed={completed}
                      unlocked={unlocked}
                      active={isActive}
                    />

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
                            if (selected !== c.id) {
                              setSelected(c.id);
                              setBriefingKey((k) => k + 1);
                            }
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Footer note */}
              <div className="px-2 pt-2 border-t border-[#121212]">
                <p className="text-[7px] uppercase tracking-[0.25em] text-[#555] leading-relaxed">
                  Falhar envia-te ao hospital com 0 HP. Possivel prisao de 30-90 min.
                </p>
              </div>
            </div>

            {/* ── RIGHT: Briefing Panel ── */}
            <div
              className="flex-1 rounded-xl overflow-hidden shadow-2xl shadow-black/60"
              style={{ border: "1px solid rgba(139,90,43,0.28)" }}
            >
              {selectedContract ? (
                <div key={briefingKey} className="ce-fade-slide" style={{ minHeight: "560px" }}>
                  <ContractBriefing
                    contract={selectedContract}
                    status={selectedStatus}
                    player={player}
                    levelDone={selLevelDone}
                    levelUnlocked={selLevelUnlocked}
                    isHitman={isHitman}
                    processing={processing === selected}
                    onExecute={() => selected && attemptContract(selected)}
                  />
                </div>
              ) : (
                <div
                  className="flex items-center justify-center"
                  style={{ minHeight: "560px", background: "linear-gradient(155deg,#f7ebd0 0%,#ede0b6 45%,#e6d8aa 100%)" }}
                >
                  <p
                    className="text-[8px] uppercase tracking-[0.4em]"
                    style={{ color: "rgba(120,53,15,0.40)", fontFamily: "Georgia,'Times New Roman',serif" }}
                  >
                    Seleciona um contrato
                  </p>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}