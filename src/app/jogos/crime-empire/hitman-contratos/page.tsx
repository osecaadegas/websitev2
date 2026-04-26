"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { CEToast } from "@/components/CEToast";
import { useRouter } from "next/navigation";
import { notifyPlayerUpdate } from "@/lib/crime-empire/player-context";

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

const CLASS_LABEL: Record<string, string> = {
  thief: "Ladrão", hooligan: "Hooligan", businessman: "Empresário",
  hitman: "Assassino", scammer: "Burlão", brute: "Bruto",
  dealer: "Traficante", pimp: "Chulo",
};

/* ─── BountyCard ─────────────────────────────────────────────── */
function BountyCard({
  contract, myLevel, isOwn, processing,
  onExecute, onCancel,
}: {
  contract: HitmanContract;
  myLevel: number;
  isOwn: boolean;
  processing: string | null;
  onExecute: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const chance = hitChance(myLevel, contract.target_level);
  const remaining = timeLeft(contract.expires_at);
  const expired = remaining === "Expirado";
  const isBusy = processing === contract.id;

  const urgency = contract.reward_cash >= 500_000 ? "#ef4444"
    : contract.reward_cash >= 200_000 ? "#f97316"
    : contract.reward_cash >= 50_000 ? "#fbbf24"
    : "#22c55e";

  return (
    <div
      className="relative rounded-xl overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(14,8,3,0.98), rgba(10,6,2,0.97))",
        border: `1px solid ${urgency}22`,
        boxShadow: `0 0 20px ${urgency}08`,
      }}
    >
      {/* Left accent */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ background: urgency, boxShadow: `0 0 8px ${urgency}80` }}
      />

      {/* Urgency tier badge */}
      <div
        className="absolute top-3 right-3 text-[7px] font-black tracking-widest px-2 py-0.5 rounded"
        style={{ background: `${urgency}18`, color: urgency, border: `1px solid ${urgency}30` }}
      >
        {contract.reward_cash >= 500_000 ? "LENDÁRIO"
          : contract.reward_cash >= 200_000 ? "ELITE"
          : contract.reward_cash >= 50_000 ? "ALTO VALOR"
          : "STANDARD"}
      </div>

      <div className="pl-5 pr-4 py-4">
        {/* Target info */}
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            🎯
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black" style={{ color: "#ddc870", fontFamily: "Georgia, serif" }}>
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

        {/* Message */}
        {contract.message && (
          <p
            className="text-[10px] italic mb-3 px-3 py-2 rounded-lg"
            style={{ color: "rgba(180,130,50,0.55)", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", fontFamily: "Georgia, serif" }}
          >
            &ldquo;{contract.message}&rdquo;
          </p>
        )}

        {/* Stats row */}
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
              <span
                className="text-base font-black"
                style={{ color: chance >= 60 ? "#22c55e" : chance >= 40 ? "#fbbf24" : "#ef4444" }}
              >
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

        {/* Actions */}
        {isOwn ? (
          <button
            onClick={() => onCancel(contract.id)}
            disabled={isBusy || expired}
            className="w-full py-2 rounded-lg text-[10px] font-black tracking-widest transition-all active:scale-95"
            style={{
              background: "rgba(239,68,68,0.08)",
              color: "rgba(248,113,113,0.6)",
              border: "1px solid rgba(239,68,68,0.2)",
              cursor: isBusy ? "wait" : "pointer",
              opacity: expired ? 0.4 : 1,
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
              color: "#fff",
              border: "1px solid rgba(255,106,0,0.35)",
              boxShadow: isBusy ? "none" : "0 0 14px rgba(255,106,0,0.2)",
              cursor: isBusy ? "wait" : expired ? "not-allowed" : "pointer",
              opacity: expired ? 0.4 : 1,
            }}
          >
            {isBusy ? "EXECUTANDO..." : "🔫 EXECUTAR"}
          </button>
        )}
      </div>
    </div>
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
  const canSubmit = selected && rewardNum >= minimum && player.cash >= rewardNum && !processing;
  const chance = selected ? hitChance(player.level, selected.level) : null;

  return (
    <div
      className="rounded-2xl p-5 space-y-4"
      style={{ background: "#111", border: "1px solid rgba(255,106,0,0.12)" }}
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
          style={{ background: "rgba(255,106,0,0.1)", border: "1px solid rgba(255,106,0,0.2)" }}
        >
          💀
        </div>
        <span className="text-[10px] font-black tracking-[0.25em] uppercase" style={{ color: "#ff6a00" }}>
          Colocar Contrato
        </span>
      </div>

      {/* Search */}
      <div className="relative">
        <label className="text-[8px] font-black tracking-[0.2em] uppercase block mb-1.5" style={{ color: "rgba(160,120,40,0.45)" }}>
          Alvo (pesquisar por username)
        </label>
        {selected ? (
          <div
            className="flex items-center justify-between px-3 py-2.5 rounded-lg"
            style={{ background: "rgba(255,106,0,0.06)", border: "1px solid rgba(255,106,0,0.2)" }}
          >
            <div>
              <span className="text-sm font-black" style={{ color: "#ddc870" }}>
                {selected.display_name || selected.username}
              </span>
              <span className="text-[9px] ml-2" style={{ color: "rgba(160,120,40,0.5)" }}>
                Nív. {selected.level} · {CLASS_LABEL[selected.class] ?? selected.class}
              </span>
            </div>
            <button
              onClick={() => { setSelected(null); setSearch(""); setResults([]); }}
              className="text-[9px] font-bold px-2 py-1 rounded"
              style={{ color: "rgba(248,113,113,0.6)", background: "rgba(239,68,68,0.08)" }}
            >
              ✕
            </button>
          </div>
        ) : (
          <>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ex: xXKillerXx"
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#fff",
              }}
            />
            {(results.length > 0 || searching) && (
              <div
                className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl overflow-hidden"
                style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                {searching && (
                  <div className="px-3 py-2 text-[10px]" style={{ color: "rgba(160,120,40,0.4)" }}>
                    A procurar...
                  </div>
                )}
                {results.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => { setSelected(r); setResults([]); setSearch(""); }}
                    className="w-full text-left px-3 py-2.5 flex items-center gap-3 hover:brightness-125 transition-all"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                  >
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm" style={{ background: "rgba(255,255,255,0.06)" }}>
                      🎯
                    </div>
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

      {/* Reward input */}
      <div>
        <label className="text-[8px] font-black tracking-[0.2em] uppercase block mb-1.5" style={{ color: "rgba(160,120,40,0.45)" }}>
          Recompensa {selected ? `(mínimo $${minimum.toLocaleString()})` : ""}
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black" style={{ color: "rgba(200,160,60,0.5)" }}>$</span>
          <input
            type="number"
            value={reward}
            onChange={(e) => setReward(e.target.value)}
            min={minimum}
            placeholder={minimum.toLocaleString()}
            className="w-full pl-7 pr-3 py-2.5 rounded-lg text-sm outline-none"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${rewardNum > 0 && rewardNum < minimum ? "rgba(239,68,68,0.35)" : "rgba(255,255,255,0.08)"}`,
              color: "#fff",
            }}
          />
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

      {/* Optional message */}
      <div>
        <label className="text-[8px] font-black tracking-[0.2em] uppercase block mb-1.5" style={{ color: "rgba(160,120,40,0.45)" }}>
          Mensagem (opcional)
        </label>
        <input
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          maxLength={120}
          placeholder="Motivo do contrato..."
          className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#fff",
          }}
        />
      </div>

      {/* Chance preview */}
      {selected && chance !== null && (
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          <span className="text-[9px]" style={{ color: "rgba(160,120,40,0.5)" }}>
            Um assassino de nível {player.level} teria:
          </span>
          <span
            className="text-sm font-black ml-auto"
            style={{ color: chance >= 60 ? "#22c55e" : chance >= 40 ? "#fbbf24" : "#ef4444" }}
          >
            {chance}% chance
          </span>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={() => selected && onPlace(selected.id, rewardNum, msg)}
        disabled={!canSubmit}
        className="w-full py-3 rounded-xl text-[11px] font-black tracking-widest transition-all active:scale-95"
        style={{
          background: canSubmit ? "linear-gradient(135deg, #7f1d1d, #ef4444)" : "rgba(255,255,255,0.04)",
          color: canSubmit ? "#fff" : "rgba(255,255,255,0.2)",
          border: canSubmit ? "1px solid rgba(239,68,68,0.35)" : "1px solid rgba(255,255,255,0.06)",
          boxShadow: canSubmit ? "0 0 14px rgba(239,68,68,0.2)" : "none",
          cursor: canSubmit ? "pointer" : "not-allowed",
        }}
      >
        {processing ? "A PROCESSAR..." : "💀 COLOCAR CONTRATO"}
      </button>
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────────────── */
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
      if (!res.ok) {
        showToast(data.error ?? "Erro", false);
      } else {
        showToast(
          data.success
            ? `${data.message} 💵 +$${data.cash_earned?.toLocaleString()} | ⭐ +${data.xp_earned} XP`
            : `${data.message} (-${data.hp_lost} HP)`,
          data.success,
        );
        notifyPlayerUpdate();
        await fetchData();
      }
    } finally {
      setProcessing(null);
    }
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
    } finally {
      setProcessing(null);
    }
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
    } finally {
      setPlacing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]" style={{ background: "#0b0b0b" }}>
        <div className="text-center">
          <p className="text-3xl mb-4 opacity-30">🔫</p>
          <p className="text-[8px] uppercase tracking-[0.4em]" style={{ color: "rgba(180,110,40,0.5)" }}>
            A CARREGAR CONTRATOS...
          </p>
        </div>
      </div>
    );
  }

  const displayList = tab === "open" ? openBounties : myBounties;

  return (
    <div className="flex-1 min-h-screen text-white" style={{ background: "#0b0b0b" }}>
      {toast && <CEToast msg={toast.msg} ok={toast.ok} />}

      <div className="relative z-10 py-8 px-4 md:px-6 max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-[7px] uppercase tracking-[0.5em] mb-1" style={{ color: "rgba(180,110,40,0.45)" }}>
              CRIME EMPIRE / CONTRATOS
            </p>
            <h1 className="text-4xl font-black tracking-tighter leading-none" style={{ color: "#f0d090" }}>
              QUADRO DE CONTRATOS
            </h1>
            <p className="text-[9px] mt-1 tracking-[0.15em]" style={{ color: "rgba(160,120,40,0.4)" }}>
              Mercado negro de assassinos. Paga. Mata. Cobra.
            </p>
          </div>
          {player && (
            <div
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl flex-shrink-0"
              style={{ background: "rgba(28,20,8,0.90)", border: "1px solid rgba(120,53,15,0.25)" }}
            >
              <span className="text-[8px] uppercase tracking-[0.3em]" style={{ color: "rgba(180,110,40,0.6)" }}>SALDO</span>
              <span className="text-sm font-black tabular-nums" style={{ color: "#fbbf24" }}>
                ${player.cash.toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {/* Banners */}
        {player?.in_jail && (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-[10px]"
            style={{ background: "rgba(25,18,5,0.85)", border: "1px solid rgba(146,64,14,0.38)" }}
          >
            <span>⚠️</span>
            <span style={{ color: "rgba(251,191,36,0.80)" }}>
              <strong style={{ color: "rgba(253,224,71,1)" }}>DETIDO:</strong> Não podes executar contratos enquanto estiveres preso.
            </span>
          </div>
        )}

        {/* Info box */}
        <div
          className="grid grid-cols-3 gap-3 px-4 py-3 rounded-xl"
          style={{ background: "rgba(14,8,3,0.9)", border: "1px solid rgba(255,106,0,0.08)" }}
        >
          {[
            { label: "Preço mínimo", value: "Nível × $3.000", icon: "💰" },
            { label: "Chance base", value: "50% ±2% por nível", icon: "🎯" },
            { label: "Falha", value: "-40% HP ao executor", icon: "💔" },
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
          onClick={() => setShowForm((v) => !v)}
          className="w-full py-3 rounded-xl text-[11px] font-black tracking-widest transition-all active:scale-[0.98]"
          style={{
            background: showForm ? "rgba(239,68,68,0.1)" : "linear-gradient(135deg, rgba(127,29,29,0.8), rgba(185,28,28,0.8))",
            color: showForm ? "rgba(248,113,113,0.8)" : "#fff",
            border: showForm ? "1px solid rgba(239,68,68,0.2)" : "1px solid rgba(239,68,68,0.35)",
            boxShadow: showForm ? "none" : "0 0 16px rgba(239,68,68,0.15)",
          }}
        >
          {showForm ? "✕ CANCELAR" : "💀 COLOCAR CONTRATO"}
        </button>

        {showForm && player && (
          <PlaceBountyPanel player={player} processing={placing} onPlace={handlePlace} />
        )}

        {/* Tabs */}
        <div
          className="flex gap-1 p-1 rounded-xl"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          {(["open", "mine"] as const).map((t) => {
            const active = tab === t;
            const count = t === "open" ? openBounties.length : myBounties.filter((b) => b.status === "open").length;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
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

        {/* Contract list */}
        {displayList.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-20 rounded-xl"
            style={{ background: "rgba(10,7,3,0.5)", border: "1px solid rgba(255,255,255,0.03)" }}
          >
            <span className="text-4xl mb-3" style={{ opacity: 0.1 }}>🔫</span>
            <p className="text-[9px] tracking-[0.3em]" style={{ color: "rgba(160,120,40,0.3)" }}>
              {tab === "open" ? "SEM CONTRATOS ABERTOS" : "NÃO TENS CONTRATOS COLOCADOS"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayList.map((c) => (
              <BountyCard
                key={c.id}
                contract={c}
                myLevel={player?.level ?? 1}
                isOwn={tab === "mine"}
                processing={processing}
                onExecute={handleExecute}
                onCancel={handleCancel}
              />
            ))}
          </div>
        )}

        {/* History section for own contracts */}
        {tab === "mine" && myBounties.some((b) => b.status !== "open") && (
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
    </div>
  );
}
