"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { CEToast } from "@/components/CEToast";
import { useRouter } from "next/navigation";

/* ── Types ── */
interface Business {
  id: string;
  name: string;
  type: string;
}
interface OwnedBusiness {
  id: string;
  business_id: string;
  employees: number;
  max_employees: number;
  sick_workers: number;
  security_tier: "none" | "basic" | "advanced" | "elite";
  security_expires_at: string | null;
  last_visited_at: string | null;
  business: Business;
}
interface Worker {
  id: string;
  name: string;
  status: "healthy" | "sick" | "leaving";
  income_per_hour: number;
}
interface Player {
  id: string;
  cash: number;
  class: string;
}
interface FireEvent {
  businessName: string;
  eventType: string;
  message: string;
}

/* ── Constants ── */
const BROTHEL_TYPES = ["brothel_basic", "brothel_upgraded", "brothel_luxury", "brothel_exclusive", "brothel_empire"];
const isBrothelType = (type: string) => BROTHEL_TYPES.includes(type);

const TIER_CONFIG = {
  none:     { label: "Sem Segurança", icon: "❌", color: "#ef4444", bg: "#1a0505" },
  basic:    { label: "Básica",        icon: "🛡️", color: "#3b82f6", bg: "#0c1a2e" },
  advanced: { label: "Avançada",      icon: "⚔️", color: "#a855f7", bg: "#1a0c2e" },
  elite:    { label: "Elite",         icon: "💀", color: "#f59e0b", bg: "#1c1003" },
} as const;

const SECURITY_COSTS: Record<string, number> = {
  basic: 3500,
  advanced: 9000,
  elite: 22000,
};

const TIER_REDUCTION: Record<string, string> = {
  basic: "-60%",
  advanced: "-80%",
  elite: "-95%",
};

const EVENT_ICON: Record<string, string> = {
  sick: "🤒",
  left: "🚪",
  died: "💀",
  healed: "💊",
};

function daysUntilExpiry(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export default function SecurityPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<OwnedBusiness[]>([]);
  const [brothelWorkers, setBrothelWorkers] = useState<Worker[]>([]);
  const [player, setPlayer] = useState<Player | null>(null);
  const [events, setEvents] = useState<FireEvent[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/crime-empire/security");
    const data = await res.json();
    setBusinesses(data.businesses || []);
    setBrothelWorkers(data.brothelWorkers || []);
    setPlayer(data.player || null);
    setEvents(data.events || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) { router.push("/"); return; }
    fetchData();
  }, [user, fetchData, router]);

  const hireSecurityForBusiness = async (playerBusinessId: string, tier: string, weeks: number) => {
    setProcessing(`${playerBusinessId}-${tier}`);
    const res = await fetch("/api/crime-empire/security", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "hire_security", playerBusinessId, tier, weeks }),
    });
    const data = await res.json();
    setProcessing(null);
    if (data.success) {
      showToast(data.message, true);
      fetchData();
    } else {
      showToast(data.error || "Erro", false);
    }
  };

  const dismissWorker = async (workerId: string) => {
    const res = await fetch("/api/crime-empire/security", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss_worker", workerId }),
    });
    const data = await res.json();
    if (data.success) {
      setBrothelWorkers((prev) => prev.filter((w) => w.id !== workerId));
      showToast("Worker dispensado", true);
    }
  };

  const regularBusinesses = businesses.filter((b) => !isBrothelType(b.business?.type));
  const brothelBusinesses = businesses.filter((b) => isBrothelType(b.business?.type));

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh] text-white">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse">🛡️</div>
          <p className="text-[#888]">A verificar estado da segurança...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 text-white py-10 px-4 md:px-8">
      {toast && <CEToast msg={toast.msg} ok={toast.ok} />}

      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
              🛡️ Segurança
            </h1>
            <p className="text-[#888] mt-1">Protege os teus negócios e trabalhadores da negligência.</p>
          </div>
          {player && (
            <div className="bg-[#121212] border border-[#222] rounded-xl px-5 py-3 text-center">
              <p className="text-xs text-[#666] uppercase tracking-wider mb-0.5">Dinheiro Limpo</p>
              <p className="font-black text-green-400 text-lg">${player.cash.toLocaleString()}</p>
            </div>
          )}
        </div>

        {/* Events fired this visit */}
        {events.length > 0 && (
          <div className="mb-6 bg-[#1a0a0a] border border-red-900 rounded-xl p-4">
            <p className="text-red-400 font-black text-sm mb-3 uppercase tracking-wider">⚠️ Incidentes detectados durante a tua ausência</p>
            <div className="space-y-1.5">
              {events.map((ev, i) => (
                <div key={i} className={`flex items-center gap-2 text-sm ${ev.eventType === "healed" ? "text-green-400" : ev.eventType === "died" ? "text-red-400" : ev.eventType === "left" ? "text-yellow-400" : "text-orange-400"}`}>
                  <span>{EVENT_ICON[ev.eventType] ?? "⚠️"}</span>
                  <span>{ev.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tier info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          {(["basic", "advanced", "elite"] as const).map((tier) => {
            const cfg = TIER_CONFIG[tier];
            return (
              <div key={tier} className="rounded-xl p-4 border" style={{ background: cfg.bg, borderColor: `${cfg.color}44` }}>
                <p className="font-black text-sm mb-1" style={{ color: cfg.color }}>{cfg.icon} {cfg.label}</p>
                <p className="text-xs text-[#777] mb-2">{TIER_REDUCTION[tier]} chance de incidentes</p>
                <p className="text-xs font-bold" style={{ color: cfg.color }}>${SECURITY_COSTS[tier].toLocaleString()}/semana</p>
              </div>
            );
          })}
        </div>

        {/* No businesses */}
        {businesses.length === 0 && (
          <div className="text-center py-20 text-[#555]">
            <p className="text-5xl mb-4">🏢</p>
            <p>Não tens negócios. Compra um negócio primeiro.</p>
          </div>
        )}

        {/* Regular businesses */}
        {regularBusinesses.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-black text-white mb-4 uppercase tracking-wider">🏢 Negócios</h2>
            <div className="space-y-3">
              {regularBusinesses.map((pb) => (
                <BusinessCard
                  key={pb.id}
                  pb={pb}
                  brothelWorkers={[]}
                  processing={processing}
                  player={player}
                  onHire={hireSecurityForBusiness}
                  onDismiss={dismissWorker}
                />
              ))}
            </div>
          </section>
        )}

        {/* Brothels */}
        {brothelBusinesses.length > 0 && (
          <section>
            <h2 className="text-lg font-black text-white mb-4 uppercase tracking-wider">💋 Bordéis</h2>
            <div className="space-y-3">
              {brothelBusinesses.map((pb) => (
                <BusinessCard
                  key={pb.id}
                  pb={pb}
                  brothelWorkers={brothelWorkers}
                  processing={processing}
                  player={player}
                  onHire={hireSecurityForBusiness}
                  onDismiss={dismissWorker}
                />
              ))}
            </div>
          </section>
        )}

        {/* Info footer */}
        <div className="mt-10 p-4 rounded-xl bg-[#111] border border-[#1e1e1e] text-xs text-[#666] space-y-1.5">
          <p>🕒 <strong className="text-[#888]">Ausência</strong> — Após 24h sem visitar, há 15% de chance de incidente por dia (máx. 7 dias).</p>
          <p>🤒 <strong className="text-[#888]">Trabalhador doente</strong> — Reduz rendimento em 15% por trabalhador doente.</p>
          <p>🚪 <strong className="text-[#888]">Trabalhador saiu</strong> — Perdes um empregado permanentemente.</p>
          <p>💀 <strong className="text-[#888]">Trabalhador morreu</strong> — Perdes um empregado e o bordel perde uma worker.</p>
          <p>💊 <strong className="text-[#888]">Cura</strong> — Segurança activa cura trabalhadores doentes automaticamente ao visitar.</p>
        </div>
      </div>
    </div>
  );
}

/* ── Business Card ── */
function BusinessCard({
  pb, brothelWorkers, processing, player, onHire, onDismiss,
}: {
  pb: OwnedBusiness;
  brothelWorkers: Worker[];
  processing: string | null;
  player: Player | null;
  onHire: (id: string, tier: string, weeks: number) => void;
  onDismiss: (id: string) => void;
}) {
  const isBrothel = isBrothelType(pb.business?.type);
  const tier = pb.security_tier || "none";
  const cfg = TIER_CONFIG[tier];
  const expiryDays = daysUntilExpiry(pb.security_expires_at);
  const isExpired = pb.security_expires_at ? new Date(pb.security_expires_at) <= new Date() : true;

  // For regular businesses
  const healthyWorkers = pb.employees - (pb.sick_workers || 0);
  const sickWorkers = pb.sick_workers || 0;

  // For brothels
  const myWorkers = brothelWorkers; // all workers belong to player
  const healthyBW = myWorkers.filter((w) => w.status === "healthy");
  const sickBW = myWorkers.filter((w) => w.status === "sick");
  const leavingBW = myWorkers.filter((w) => w.status === "leaving");

  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-[#0e0e0e] border border-[#1e1e1e] rounded-xl overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-4 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-black text-white">{pb.business?.name}</p>
            {/* Security badge */}
            <span
              className="text-xs px-2 py-0.5 rounded-full font-bold"
              style={{ background: `${cfg.color}22`, color: cfg.color }}
            >
              {cfg.icon} {cfg.label}
              {tier !== "none" && !isExpired && expiryDays !== null && ` — ${expiryDays}d`}
              {tier !== "none" && isExpired && " — EXPIRADA"}
            </span>
          </div>

          {/* Worker health */}
          <div className="flex gap-3 mt-1.5 text-xs">
            {isBrothel ? (
              <>
                <span className="text-green-400">✓ {healthyBW.length} saudáveis</span>
                {sickBW.length > 0 && <span className="text-orange-400">🤒 {sickBW.length} doentes</span>}
                {leavingBW.length > 0 && <span className="text-yellow-400">🚪 {leavingBW.length} a sair</span>}
              </>
            ) : (
              <>
                <span className="text-green-400">✓ {Math.max(0, healthyWorkers)} saudáveis</span>
                {sickWorkers > 0 && <span className="text-orange-400">🤒 {sickWorkers} doentes (-{sickWorkers * 15}% rendimento)</span>}
                <span className="text-[#555]">/ {pb.max_employees} max</span>
              </>
            )}
          </div>
        </div>

        {/* Expand toggle for brothel workers */}
        {isBrothel && myWorkers.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-[#555] hover:text-white transition-colors px-2 flex-shrink-0"
          >
            {expanded ? "▲" : "▼"} Workers
          </button>
        )}
      </div>

      {/* Brothel worker list */}
      {isBrothel && expanded && (
        <div className="border-t border-[#1a1a1a] px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {myWorkers.map((w) => (
            <div key={w.id} className="flex items-center justify-between bg-[#111] rounded-lg px-3 py-2">
              <div>
                <p className="text-xs font-bold text-white">{w.name}</p>
                <p className={`text-xs ${w.status === "healthy" ? "text-green-400" : w.status === "sick" ? "text-orange-400" : "text-yellow-400"}`}>
                  {w.status === "healthy" ? "✓ Saudável" : w.status === "sick" ? "🤒 Doente" : "🚪 A sair"}
                  {" "}· ${w.income_per_hour}/h
                </p>
              </div>
              {(w.status === "sick" || w.status === "leaving") && (
                <button
                  onClick={() => onDismiss(w.id)}
                  className="text-xs px-2 py-1 rounded bg-red-900/30 text-red-400 hover:bg-red-900/50 transition-all"
                >
                  Dispensar
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Security hire buttons */}
      <div className="border-t border-[#1a1a1a] px-4 py-3 flex flex-wrap gap-2">
        {(["basic", "advanced", "elite"] as const).map((t) => {
          const tcfg = TIER_CONFIG[t];
          const cost = SECURITY_COSTS[t];
          const canAfford = (player?.cash ?? 0) >= cost;
          const isActive = tier === t && !isExpired;
          const isBusy = processing === `${pb.id}-${t}`;

          return (
            <button
              key={t}
              disabled={!canAfford || isBusy}
              onClick={() => onHire(pb.id, t, 1)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                isActive
                  ? "ring-1 ring-offset-1 ring-offset-[#0e0e0e]"
                  : ""
              } ${canAfford && !isBusy ? "hover:opacity-90" : "opacity-40 cursor-not-allowed"}`}
              style={canAfford ? { background: `${tcfg.color}22`, color: tcfg.color, ...(isActive ? { ringColor: tcfg.color } : {}) } : { background: "#1a1a1a", color: "#444" }}
            >
              {tcfg.icon} {tcfg.label}
              <span className="ml-1 opacity-70">${cost.toLocaleString()}/sem</span>
              {isActive && <span className="ml-1">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
