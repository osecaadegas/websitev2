"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { CEToast } from "@/components/CEToast";
import RaidEscape from "@/components/crime-empire/raid/RaidEscape";
import { HEAT_STAGE_STYLE, CUSTOMER_TYPE_META, type HeatStage, type CustomerType } from "@/lib/street-defs";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DrugItem {
  id: string;
  item_id: string;
  quantity: number;
  items: { id: string; name: string; description: string; base_price: number; image_url: string | null };
}

interface PlayerInfo {
  id: string;
  class: string;
  level: number;
  dirty_cash: number;
  in_jail: boolean;
  jail_release_at: string | null;
  hp: number;
}

interface Zone {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockLevel: number;
  heatPerDeal: number;
  rewardMult: number;
}

interface Session {
  id: string;
  zone: string;
  heat: number;
  status: string;
}

interface Customer {
  id: string;
  name: string;
  type: CustomerType;
  budget: number;
  patience: number;
  riskTolerance: number;
  snitchChance: number;
  preferredQty: number;
  offersReceived: number;
  suspicion: number;
}

type Phase =
  | "zone_select"
  | "idle"            // in session, waiting to call next customer
  | "customer"        // customer is here, no offer submitted yet
  | "negotiating"     // offer submitted, waiting for response
  | "counter"         // customer countered, waiting for player to accept/reject
  | "result"          // deal done or skipped, show outcome before next
  | "session_end"     // session ended voluntarily
  | "arrested"        // police event
  | "loading";

type Action = "offer" | "push" | "discount" | "rush";

interface LogEntry {
  time: string;
  text: string;
  color: string;
}

interface FloatEntry { id: number; amount: number; left: number; }

// ─── Constants ────────────────────────────────────────────────────────────────

const DECISION_SECS = 30;

const ZONE_ACCENT: Record<string, string> = {
  bairro_antigo: "#d97706",
  mercado_negro: "#a855f7",
  porto:         "#0ea5e9",
  aeroporto:     "#6366f1",
};

const ZONE_GLOW: Record<string, string> = {
  bairro_antigo: "rgba(217,119,6,0.06)",
  mercado_negro: "rgba(168,85,247,0.06)",
  porto:         "rgba(14,165,233,0.06)",
  aeroporto:     "rgba(99,102,241,0.06)",
};

// -----------------------------------------------------------------------------
export default function StreetsPage() {
  const { user } = useAuth();
  const router = useRouter();

  // -- Server data
  const [drugs, setDrugs] = useState<DrugItem[]>([]);
  const [player, setPlayer] = useState<PlayerInfo | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);

  // -- Session state
  const [session, setSession] = useState<Session | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [greeting, setGreeting] = useState("👤");
  const [dialogue, setDialogue] = useState("👤");
  const [lastOutcome, setLastOutcome] = useState<string | null>(null);
  const [lastEarned, setLastEarned] = useState<number>(0);
  const [sessionEarned, setSessionEarned] = useState(0);
  const [sessionDeals, setSessionDeals] = useState(0);

  // -- Player controls
  const [selectedDrug, setSelectedDrug] = useState<DrugItem | null>(null);
  const [pricePerUnit, setPricePerUnit] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [counterPrice, setCounterPrice] = useState<number | null>(null);
  const [counterQty, setCounterQty] = useState<number | null>(null);

  // -- Heat / suspicion
  const [heat, setHeat] = useState(0);
  const [suspicion, setSuspicion] = useState(0);
  const [heatStage, setHeatStage] = useState<HeatStage>("safe");

  // -- Timer
  const [timerSecs, setTimerSecs] = useState(DECISION_SECS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // -- Arrest escape
  const [arrestEscape, setArrestEscape] = useState<{ token: string; jailMinutes: number } | null>(null);

  // -- Log
  const [log, setLog] = useState<LogEntry[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  // -- Toast
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  // -- Floating money
  const [floaters, setFloaters] = useState<FloatEntry[]>([]);
  const floaterIdRef = useRef(0);
  const showFloat = useCallback((amount: number) => {
    const id = floaterIdRef.current++;
    const left = 40 + Math.random() * 20;
    setFloaters((p) => [...p, { id, amount, left }]);
    setTimeout(() => setFloaters((p) => p.filter((f) => f.id !== id)), 1800);
  }, []);

  // -- Customer entrance animation
  const [customerAnim, setCustomerAnim] = useState(false);

  // --- Helpers -------------------------------------------------------------

  const addLog = useCallback((text: string, color = "text-gray-300") => {
    const time = new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLog((prev) => [...prev.slice(-49), { time, text, color }]);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    setTimerSecs(DECISION_SECS);
    timerRef.current = setInterval(() => {
      setTimerSecs((s) => {
        if (s <= 1) {
          // Time's up ? auto rush
          stopTimer();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, [stopTimer]);

  // --- Fetch initial data ---------------------------------------------------

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/crime-empire/streets");
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 404) { router.push("/jogos/crime-empire/create-character"); return; }
        return;
      }
      setDrugs(data.drugs || []);
      setPlayer(data.player);
      setZones(data.zones || []);

      if (data.activeSession) {
        setSession(data.activeSession);
        setHeat(data.activeSession.heat);
        setHeatStage(heatStageFor(data.activeSession.heat));
        setPhase("idle");
      } else {
        setPhase("zone_select");
      }

      if (data.drugs?.length > 0 && !selectedDrug) {
        const first = data.drugs[0];
        setSelectedDrug(first);
        setPricePerUnit(Math.round(first.items.base_price * 1.2));
        setQuantity(Math.min(10, first.quantity));
      }
    } catch {
      setPhase("zone_select");
    }
  }, [router, selectedDrug]);

  useEffect(() => {
    if (!user) { router.push("/"); return; }
    fetchData();
  }, [user, fetchData, router]);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  // Cleanup timer on unmount
  useEffect(() => () => stopTimer(), [stopTimer]);

  // Update price suggestion when drug changes
  useEffect(() => {
    if (selectedDrug) {
      setPricePerUnit(Math.round(selectedDrug.items.base_price * 1.2));
      setQuantity(Math.min(10, selectedDrug.quantity));
    }
  }, [selectedDrug]);

  // --- Actions -------------------------------------------------------------

  async function startSession(zoneId: string) {
    setPhase("loading");
    const res = await fetch("/api/crime-empire/streets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start_session", zoneId }),
    });
    const data = await res.json();
    if (!res.ok) { showToast((data.detail || data.error) + (data.code ? ` [${data.code}]` : ""), false); setPhase("zone_select"); return; }
    setSession(data.session);
    setHeat(0);
    setHeatStage("safe");
    setSessionEarned(0);
    setSessionDeals(0);
    setLog([]);
    addLog(`🌿 sessão iniciada em ${zones.find(z => z.id === zoneId)?.name ?? zoneId}`, "text-cyan-400");
    setPhase("idle");
  }

  async function callNextCustomer() {
    if (!session) return;
    setPhase("loading");
    setDialogue("👤");
    setLastOutcome(null);
    setSuspicion(0);

    const res = await fetch("/api/crime-empire/streets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "next_customer", sessionId: session.id }),
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || "Erro ao chamar cliente", false); addLog(`❌ ${data.error}`, "text-red-400"); setPhase("idle"); return; }

    setCustomer({ ...data.customer, offersReceived: 0, suspicion: 0 });
    setGreeting(data.greeting);
    setDialogue(data.greeting);
    setSession((s) => s ? { ...s, heat: data.session.heat } : s);
    setHeat(data.session.heat);
    setHeatStage(heatStageFor(data.session.heat));
    setPhase("customer");
    setCustomerAnim(true); setTimeout(() => setCustomerAnim(false), 600);
    startTimer();
    addLog(`👤 ${data.customer.name} (${CUSTOMER_TYPE_META[data.customer.type as CustomerType]?.label ?? data.customer.type}) aproximou-se`, "text-yellow-300");
  }

  async function submitOffer(action: Action = "offer") {
    if (!session || !customer || !selectedDrug) return;
    stopTimer();
    setPhase("negotiating");

    const res = await fetch("/api/crime-empire/streets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "negotiate",
        sessionId: session.id,
        customerId: customer.id,
        inventoryId: selectedDrug.id,
        pricePerUnit,
        quantity,
        negotiationAction: action,
        customerState: {
          budget: customer.budget,
          patience: customer.patience,
          offersReceived: customer.offersReceived,
          suspicion: customer.suspicion,
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || "Erro", false); setPhase("customer"); startTimer(); return; }

    // Update heat + suspicion
    setHeat(data.heat ?? heat);
    setHeatStage(data.heatStage ?? heatStage);
    setSuspicion(data.suspicion ?? suspicion);
    setDialogue(data.dialogue ?? "👤");
    setCustomer((c) => c ? { ...c, offersReceived: data.offersReceived ?? c.offersReceived + 1, suspicion: data.suspicion ?? c.suspicion } : c);

    await handleOutcome(data);
  }

  async function acceptCounter() {
    if (!session || !customer || !selectedDrug || counterPrice == null || counterQty == null) return;
    stopTimer();
    setPhase("negotiating");

    const res = await fetch("/api/crime-empire/streets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "accept_deal",
        sessionId: session.id,
        customerId: customer.id,
        inventoryId: selectedDrug.id,
        agreedPrice: counterPrice,
        quantity: counterQty,
      }),
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || "Erro", false); setPhase("counter"); return; }

    setHeat(data.heat ?? heat);
    setHeatStage(data.heatStage ?? heatStage);
    setDialogue(data.dialogue ?? "👤");
    await handleOutcome(data);
  }

  async function rejectCustomer() {
    if (!session) return;
    stopTimer();
    const res = await fetch("/api/crime-empire/streets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject_deal", sessionId: session.id, customerId: customer?.id }),
    });
    const data = await res.json();
    setHeat(data.heat ?? heat);
    setHeatStage(heatStageFor(data.heat ?? heat));
    addLog(`⏩ Ignoraste ${customer?.name}`, "text-gray-500");
    setCustomer(null);
    setDialogue("");
    setPhase("idle");
    await fetchDrugs();
  }

  async function endSession() {
    if (!session) return;
    stopTimer();
    setPhase("loading");
    const res = await fetch("/api/crime-empire/streets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "end_session", sessionId: session.id }),
    });
    const data = await res.json();
    if (res.ok) {
      setSessionEarned(data.totalEarned ?? sessionEarned);
      setSessionDeals(data.totalDeals ?? sessionDeals);
    }
    setSession(null);
    setCustomer(null);
    setPhase("session_end");
    addLog("🚪 Saíste da rua", "text-gray-400");
  }

  async function handleOutcome(data: any) {
    const outcome = data.outcome;
    setLastOutcome(outcome);

    if (outcome === "accept") {
      const earned = data.earned ?? 0;
      setLastEarned(earned);
      setSessionEarned((s) => s + earned);
      setSessionDeals((s) => s + 1);
      showFloat(earned);
      addLog(`✅ ${customer?.name} aceitou — +$${earned.toLocaleString()} sujos`, "text-green-400");
      setCustomer(null);
      setPhase("result");
      await fetchDrugs();
    } else if (outcome === "counter") {
      setCounterPrice(data.counterPrice ?? null);
      setCounterQty(data.counterQty ?? null);
      addLog(`↔️ ${customer?.name} contra-propôs $${data.counterPrice}/u × ${data.counterQty}g`, "text-yellow-400");
      setPhase("counter");
      startTimer();
    } else if (outcome === "reject") {
      addLog(`❌ ${customer?.name} recusou a oferta`, "text-orange-400");
      setPhase("customer");
      startTimer();
    } else if (outcome === "hostile") {
      addLog(`⚡ ${customer?.name} ficou hostil e foi embora`, "text-red-400");
      setCustomer(null);
      setPhase("idle");
      await fetchDrugs();
    } else if (outcome === "snitch") {
      addLog(`🚨 ${customer?.name} delatou-te! Calor disparou!`, "text-red-500");
      setCustomer(null);
      if (data.heat >= 100) {
        // bust triggers arrest
        setArrestEscape({ token: data.escape_token, jailMinutes: data.jail_minutes });
        setPhase("arrested");
      } else {
        setPhase("idle");
      }
      await fetchDrugs();
    } else if (outcome === "arrested" || outcome === "busted") {
      addLog("🚔 APANHADO! A polícia está aqui!", "text-red-600");
      setArrestEscape({ token: data.escape_token, jailMinutes: data.jail_minutes });
      setSession(null);
      setPhase("arrested");
      await fetchDrugs();
    }
  }

  async function fetchDrugs() {
    const res = await fetch("/api/crime-empire/streets");
    const data = await res.json();
    if (res.ok) {
      setDrugs(data.drugs || []);
      setPlayer(data.player);
      // re-sync selected drug
      if (selectedDrug) {
        const updated = (data.drugs || []).find((d: DrugItem) => d.id === selectedDrug.id);
        if (updated) setSelectedDrug(updated);
        else if (data.drugs?.length > 0) setSelectedDrug(data.drugs[0]);
        else setSelectedDrug(null);
      }
    }
  }

  // ─── Render helpers ──────────────────────────────────────────────────────

  const currentZone  = session ? zones.find((z) => z.id === session.zone) : null;
  const heatStyle    = HEAT_STAGE_STYLE[heatStage];
  const customerMeta = customer ? CUSTOMER_TYPE_META[customer.type] : null;
  const inJail       = player?.in_jail;
  const noDrugs      = drugs.length === 0;
  const zoneAccent   = currentZone ? (ZONE_ACCENT[currentZone.id] ?? "#22c55e") : "#22c55e";

  // Mood / suspicion colour
  const moodColor = suspicion >= 70 ? "#ef4444" : suspicion >= 40 ? "#eab308" : "#22c55e";
  const moodLabel = suspicion >= 70 ? "Muito suspeito" : suspicion >= 40 ? "Desconfiado" : "Calmo";

  // Deal price temperature
  const basePrice  = selectedDrug?.items.base_price ?? 100;
  const dealRatio  = pricePerUnit / basePrice;
  const dealColor  = dealRatio <= 0.9 ? "#22c55e" : dealRatio <= 1.15 ? "#06b6d4" : dealRatio <= 1.5 ? "#eab308" : "#ef4444";
  const dealLabel  = dealRatio <= 0.9 ? "Barato 🤑" : dealRatio <= 1.15 ? "Justo" : dealRatio <= 1.5 ? "Caro" : "Muito Caro 🚨";

  // Slider percentage for CSS track fill
  const sliderMin = Math.round(basePrice * 0.5);
  const sliderMax = Math.round(basePrice * 2.5);
  const sliderPct = Math.round(((pricePerUnit - sliderMin) / (sliderMax - sliderMin)) * 100);

  // Heat vignette
  const vignetteAlpha = Math.max(0, (heat - 25) / 75) * 0.65;

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (phase === "loading" && !session && !player) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#070707] text-white">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#444] text-sm">A carregar...</p>
        </div>
      </div>
    );
  }

  // ─── Arrest escape ────────────────────────────────────────────────────────
  if (phase === "arrested" && arrestEscape) {
    return (
      <div className="flex-1 text-white py-8 px-4">
        {toast && <CEToast msg={toast.msg} ok={toast.ok} />}
        <RaidEscape
          difficulty="high"
          cashAtRisk={0}
          onEscape={async () => {
            const token = arrestEscape.token; setArrestEscape(null);
            await fetch("/api/crime-empire/escape-attempt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, escaped: true }) });
            setPhase("zone_select"); showToast("Escapaste!", true);
          }}
          onArrested={async () => {
            const token = arrestEscape.token; setArrestEscape(null);
            await fetch("/api/crime-empire/escape-attempt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, escaped: false }) });
            router.push("/jogos/crime-empire/jail");
          }}
        />
      </div>
    );
  }

  // ─── Main render ──────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Custom keyframes ── */}
      <style>{`
        @keyframes floatUp {
          0%   { opacity: 1; transform: translateY(0) scale(1); }
          60%  { opacity: 1; transform: translateY(-48px) scale(1.15); }
          100% { opacity: 0; transform: translateY(-90px) scale(0.9); }
        }
        @keyframes customerEnter {
          from { opacity: 0; transform: translateX(-24px) scale(0.96); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes heatPulse {
          0%, 100% { opacity: 0.45; }
          50%       { opacity: 0.75; }
        }
        @keyframes dangerFlicker {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.55; }
        }
        .float-money   { animation: floatUp 1.8s ease-out forwards; }
        .customer-in   { animation: customerEnter 0.45s ease-out; }
        .heat-vignette { animation: heatPulse 1.8s ease-in-out infinite; }
        .danger-text   { animation: dangerFlicker 1s ease-in-out infinite; }
        input[type=range].street-range {
          -webkit-appearance: none;
          width: 100%; height: 4px; border-radius: 2px; outline: none; cursor: pointer;
        }
        input[type=range].street-range::-webkit-slider-runnable-track {
          height: 4px; border-radius: 2px; background: #1f1f1f;
        }
        input[type=range].street-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px; height: 16px; border-radius: 50%;
          background: #22c55e; cursor: pointer;
          border: 2px solid #080808; margin-top: -6px;
        }
        input[type=range].street-range:disabled::-webkit-slider-thumb { background: #333; cursor: not-allowed; }
      `}</style>

      <div className="flex-1 text-white flex flex-col min-h-screen relative" style={{ background: "#070707" }}>

        {/* ── Zone ambient background glow ── */}
        {session && currentZone && (
          <div className="pointer-events-none fixed inset-0 z-0"
            style={{ background: `radial-gradient(ellipse at 50% 100%, ${ZONE_GLOW[currentZone.id] ?? "rgba(34,197,94,0.04)"} 0%, transparent 65%)` }} />
        )}

        {/* ── Heat vignette overlay ── */}
        {heat > 25 && (
          <div className="pointer-events-none fixed inset-0 z-10 heat-vignette"
            style={{ background: `radial-gradient(ellipse at center, transparent 25%, rgba(185,28,28,${vignetteAlpha}) 100%)` }} />
        )}

        {/* ── Floating money notifications ── */}
        <div className="pointer-events-none fixed inset-0 z-50">
          {floaters.map((f) => (
            <div key={f.id} className="float-money absolute font-black text-2xl text-green-400 drop-shadow-lg select-none"
              style={{ top: "38%", left: `${f.left}%` }}>
              +${f.amount.toLocaleString()}
            </div>
          ))}
        </div>

        {toast && <CEToast msg={toast.msg} ok={toast.ok} />}

        {/* ══ TOP BAR ══════════════════════════════════════════════════════ */}
        <div className="relative z-20 flex items-center justify-between px-4 md:px-6 py-3 border-b border-[#141414]"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}>
          <Link href="/jogos/crime-empire/dashboard"
            className="text-[#ff6a00] hover:text-[#ff9940] text-sm font-semibold transition-colors">
            ← Voltar
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-xs text-[#444] font-mono">Nv.{player?.level ?? "–"}</span>
            <span className="text-xs text-green-400 font-mono font-bold">${player?.dirty_cash?.toLocaleString() ?? 0}</span>
            {currentZone && (
              <span className="text-xs px-2.5 py-1 rounded-full font-bold border"
                style={{ color: zoneAccent, borderColor: `${zoneAccent}44`, background: `${zoneAccent}14` }}>
                {currentZone.icon} {currentZone.name}
              </span>
            )}
          </div>
        </div>

        {/* ══ HEAT BAR ═════════════════════════════════════════════════════ */}
        {session && (
          <div className="relative z-20 px-4 md:px-6 py-2.5 border-b border-[#141414]"
            style={{ background: heatStage === "danger" || heatStage === "busted" ? "rgba(127,29,29,0.25)" : "rgba(0,0,0,0.5)" }}>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-black w-24 shrink-0 ${heatStyle.color} ${heatStage === "danger" ? "danger-text" : ""}`}>
                🌡️ {heat}/100
              </span>
              <div className="flex-1 h-2 bg-[#181818] rounded-full overflow-hidden border border-[#222]">
                <div className={`h-full rounded-full transition-all duration-700 ${heatStyle.bg}`} style={{ width: `${heat}%` }} />
              </div>
              <span className={`text-xs font-black w-20 text-right shrink-0 ${heatStyle.color}`}>{heatStyle.label}</span>
              {currentZone && <span className="text-xs text-[#333] hidden lg:inline">+{currentZone.heatPerDeal}/deal</span>}
            </div>
          </div>
        )}

        {/* ── Jail banner ── */}
        {inJail && player?.jail_release_at && (
          <div className="relative z-20 mx-4 md:mx-6 mt-3 p-3 rounded-xl bg-red-950/50 border border-red-800/60 text-red-300 text-sm flex items-center gap-2">
            <span>🚔</span>
            <span>Estás preso! Saída: <strong>{new Date(player.jail_release_at).toLocaleTimeString("pt-PT")}</strong></span>
            <Link href="/jogos/crime-empire/jail" className="ml-auto text-xs text-red-400 hover:text-red-200 underline">Ir à cela →</Link>
          </div>
        )}

        {/* ══ ZONE SELECT ══════════════════════════════════════════════════ */}
        {(phase === "zone_select" || phase === "session_end") && (
          <div className="relative z-20 flex-1 px-4 md:px-10 py-10">

            {/* Session-end summary */}
            {phase === "session_end" && (
              <div className="mb-8 p-6 rounded-2xl border border-green-800/40 text-center max-w-sm mx-auto"
                style={{ background: "linear-gradient(135deg, rgba(20,83,45,0.4), rgba(0,0,0,0.4))" }}>
                <p className="text-4xl mb-2">💰</p>
                <p className="text-green-400 font-black text-xl mb-1">Sessão Concluída</p>
                <p className="text-[#888] text-sm">
                  <span className="text-white font-black text-lg">{sessionDeals}</span> negócios ·{" "}
                  <span className="text-green-400 font-black text-lg">${sessionEarned.toLocaleString()}</span> ganhos
                </p>
              </div>
            )}

            <div className="max-w-2xl">
              <h1 className="text-4xl font-black mb-1">
                <span className="text-green-400">🌿</span>{" "}
                <span style={{ background: "linear-gradient(90deg,#4ade80,#16a34a)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  Ruas
                </span>
              </h1>
              <p className="text-[#555] mb-8 text-sm">Escolhe onde vais operar. Cada zona tem riscos e recompensas diferentes.</p>

              {inJail ? (
                <div className="p-5 rounded-2xl bg-red-950/40 border border-red-800/40 text-red-400 text-sm">
                  🚔 Não podes iniciar uma sessão enquanto estás preso.
                </div>
              ) : noDrugs ? (
                <div className="p-8 rounded-2xl bg-[#0d0d0d] border border-[#1a1a1a] text-center">
                  <p className="text-4xl mb-3 opacity-30">🌿</p>
                  <p className="text-[#666] mb-1">Sem stock para vender.</p>
                  <p className="text-[#444] text-xs mb-4">Vai ao Black Market comprar drogas primeiro.</p>
                  <Link href="/jogos/crime-empire/black-market"
                    className="inline-block px-5 py-2 rounded-xl bg-green-700 hover:bg-green-600 text-sm font-semibold transition-all hover:scale-105">
                    Ir ao Black Market →
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {zones.map((zone) => {
                    const locked    = (player?.level ?? 1) < zone.unlockLevel;
                    const accent    = ZONE_ACCENT[zone.id] ?? "#22c55e";
                    const profitPct = Math.round((zone.rewardMult - 1) * 100);
                    return (
                      <button key={zone.id}
                        onClick={() => !locked && startSession(zone.id)}
                        disabled={locked || !!inJail}
                        className={`group relative p-6 rounded-2xl border text-left overflow-hidden transition-all ${
                          locked ? "border-[#1a1a1a] opacity-40 cursor-not-allowed" : "border-[#222] hover:border-[#333] active:scale-95 cursor-pointer"
                        }`}
                        style={locked ? { background: "#0a0a0a" } : { background: `linear-gradient(135deg, ${accent}0a, #0a0a0a 60%)` }}>
                        {/* Hover accent glow */}
                        {!locked && (
                          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
                            style={{ background: `radial-gradient(ellipse at top left, ${accent}1a 0%, transparent 55%)` }} />
                        )}
                        <div className="relative z-10">
                          <div className="flex items-start justify-between mb-3">
                            <span className="text-3xl">{zone.icon}</span>
                            {locked && (
                              <span className="text-[#444] text-xs bg-[#111] px-2 py-0.5 rounded-full border border-[#1f1f1f]">Nv.{zone.unlockLevel}</span>
                            )}
                          </div>
                          <p className="font-black text-white text-base mb-1">{zone.name}</p>
                          <p className="text-xs text-[#555] mb-4 leading-relaxed">{zone.description}</p>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="font-bold" style={{ color: accent }}>{profitPct >= 0 ? "+" : ""}{profitPct}% lucro</span>
                            <span className="text-yellow-600">🌡️ +{zone.heatPerDeal} calor/deal</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ ACTIVE SESSION ═══════════════════════════════════════════════ */}
        {session && phase !== "zone_select" && phase !== "session_end" && phase !== "arrested" && (
          <div className="relative z-20 flex-1 flex flex-col lg:flex-row overflow-hidden">

            {/* ── LEFT — Customer ───────────────────────────────────────── */}
            <div className="w-full lg:w-64 xl:w-72 shrink-0 flex flex-col gap-3 p-4 border-b lg:border-b-0 lg:border-r border-[#141414]"
              style={{ background: "rgba(0,0,0,0.45)" }}>

              {customer ? (
                <div className={`rounded-2xl border flex flex-col gap-4 p-4 flex-1 transition-all ${customerAnim ? "customer-in" : ""}`}
                  style={{
                    borderColor: `${moodColor}33`,
                    background: `linear-gradient(160deg, ${moodColor}0a, #0a0a0a)`,
                    boxShadow: `0 0 28px ${moodColor}22`,
                  }}>
                  {/* Avatar + identity */}
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0 border transition-all"
                      style={{ borderColor: `${moodColor}44`, background: `${moodColor}14`, boxShadow: `0 0 16px ${moodColor}33` }}>
                      {customerMeta?.icon ?? "👤"}
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-white text-base leading-tight truncate">{customer.name}</p>
                      <p className="text-xs font-semibold mt-0.5" style={{ color: moodColor }}>{customerMeta?.label ?? customer.type}</p>
                      <p className="text-[10px] text-[#555] mt-0.5">{moodLabel}</p>
                    </div>
                  </div>

                  {/* Suspicion */}
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-[#555]">Suspeita</span>
                      <span className="font-bold tabular-nums" style={{ color: moodColor }}>{suspicion}%</span>
                    </div>
                    <div className="h-1.5 bg-[#141414] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${suspicion}%`, background: moodColor }} />
                    </div>
                  </div>

                  {/* Patience */}
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-[#555]">Paciência</span>
                      <span className="font-mono text-xs tracking-widest">
                        {Array.from({ length: customer.patience }).map((_, i) => (
                          <span key={i} style={{ color: i < customer.patience - customer.offersReceived ? "#22c55e" : "#222" }}>■</span>
                        ))}
                      </span>
                    </div>
                  </div>

                  {/* Hint for high-level players */}
                  {(player?.level ?? 1) >= 3 && (
                    <p className="text-[11px] text-[#444] italic border-t border-[#181818] pt-3">{customerMeta?.hint}</p>
                  )}
                </div>
              ) : (
                <div className="flex-1 rounded-2xl border border-dashed border-[#1f1f1f] flex flex-col items-center justify-center p-8 text-center gap-2">
                  <p className="text-5xl opacity-10">👤</p>
                  <p className="text-[#333] text-xs">Sem cliente no momento</p>
                </div>
              )}

              {/* Session stats */}
              <div className="rounded-xl bg-[#0d0d0d] border border-[#181818] p-3">
                <p className="text-[#333] text-[10px] uppercase tracking-widest font-bold mb-2">Sessão</p>
                <div className="flex justify-between items-baseline">
                  <span className="text-[#555] text-sm">{sessionDeals} negócios</span>
                  <span className="text-green-400 font-black">${sessionEarned.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* ── CENTER — Dialogue + Controls ──────────────────────────── */}
            <div className="flex-1 flex flex-col p-4 gap-3 overflow-y-auto">

              {/* Dialogue bubble */}
              <div className="rounded-2xl border border-[#1a1a1a] p-5 min-h-[72px]" style={{ background: "rgba(10,10,10,0.8)" }}>
                {dialogue ? (
                  <>
                    <p className="text-[10px] text-[#444] font-black uppercase tracking-widest mb-2">
                      {customer ? customer.name : "Sistema"}
                    </p>
                    <p className="text-white text-sm leading-relaxed italic">"{dialogue}"</p>
                  </>
                ) : (
                  <p className="text-[#333] text-sm italic">Chama o próximo cliente para começar a negociar...</p>
                )}
              </div>

              {/* Result badge */}
              {phase === "result" && lastOutcome === "accept" && (
                <div className="rounded-2xl border border-green-800/50 p-6 text-center"
                  style={{ background: "linear-gradient(135deg, rgba(20,83,45,0.5), rgba(0,0,0,0.4))" }}>
                  <p className="text-green-400 font-black text-xl mb-2">✅ NEGÓCIO FEITO!</p>
                  <p className="text-green-300 font-black text-3xl">+${lastEarned.toLocaleString()}</p>
                  <p className="text-green-700 text-xs mt-1">dinheiro sujo</p>
                  <button onClick={callNextCustomer}
                    className="mt-4 px-6 py-2.5 rounded-xl bg-green-700 hover:bg-green-600 text-white font-bold text-sm transition-all hover:scale-105 active:scale-95">
                    Próximo Cliente →
                  </button>
                </div>
              )}

              {/* Decision timer */}
              {(phase === "customer" || phase === "counter") && (
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-[#444]">Tempo de decisão</span>
                    <span className={`font-black tabular-nums ${timerSecs <= 10 ? "text-red-400 danger-text" : "text-[#666]"}`}>{timerSecs}s</span>
                  </div>
                  <div className="h-0.5 bg-[#181818] rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-1000 rounded-full ${timerSecs <= 10 ? "bg-red-500" : "bg-cyan-500"}`}
                      style={{ width: `${(timerSecs / DECISION_SECS) * 100}%` }} />
                  </div>
                </div>
              )}

              {/* Counter-offer panel */}
              {phase === "counter" && counterPrice != null && counterQty != null && (
                <div className="rounded-2xl border border-yellow-800/40 p-5"
                  style={{ background: "linear-gradient(135deg, rgba(78,52,10,0.35), rgba(0,0,0,0.4))" }}>
                  <p className="text-yellow-500 font-black mb-3 text-sm">↔️ Contra-Proposta</p>
                  <div className="bg-[#0a0a0a] rounded-xl p-4 mb-4 text-center border border-yellow-900/30">
                    <p className="text-yellow-300 font-black text-3xl">${(counterPrice * counterQty).toLocaleString()}</p>
                    <p className="text-yellow-700 text-xs mt-1">${counterPrice}/g × {counterQty}g</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={acceptCounter}
                      className="py-3 rounded-xl bg-green-700 hover:bg-green-600 text-white font-bold text-sm transition-all hover:scale-105 active:scale-95">
                      ✅ Aceitar
                    </button>
                    <button onClick={() => { setPhase("customer"); startTimer(); addLog(`↩ Rejeitaste a contra-proposta de ${customer?.name}`, "text-orange-400"); }}
                      className="py-3 rounded-xl border border-[#333] bg-[#111] hover:bg-[#1a1a1a] text-white font-bold text-sm transition-all hover:scale-105 active:scale-95">
                      ❌ Rejeitar
                    </button>
                  </div>
                </div>
              )}

              {/* Main controls */}
              {(phase === "customer" || phase === "idle") && (
                <div className="rounded-2xl border border-[#1a1a1a] p-5 space-y-5" style={{ background: "rgba(8,8,8,0.85)" }}>
                  <h3 className="text-[10px] text-[#333] font-black uppercase tracking-widest">Oferta</h3>

                  {/* Drug selector */}
                  <div>
                    <label className="text-xs text-[#555] block mb-1.5">Produto</label>
                    <select value={selectedDrug?.id ?? ""}
                      onChange={(e) => { const d = drugs.find((x) => x.id === e.target.value); if (d) setSelectedDrug(d); }}
                      className="w-full px-3 py-2.5 rounded-xl bg-[#111] border border-[#222] text-white text-sm focus:outline-none focus:border-green-600 transition-colors"
                      disabled={phase !== "customer"}>
                      {drugs.map((d) => (
                        <option key={d.id} value={d.id}>{d.items.name} — {d.quantity}g disponível</option>
                      ))}
                      {drugs.length === 0 && <option value="">Sem stock</option>}
                    </select>
                  </div>

                  {/* Price — slider + number input */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs text-[#555]">
                        Preço/g{selectedDrug && <span className="text-[#333] ml-1">(base ${selectedDrug.items.base_price})</span>}
                      </label>
                      <span className="text-xs font-bold" style={{ color: dealColor }}>{dealLabel}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 relative">
                        <div className="absolute inset-y-0 left-0 rounded-l-full pointer-events-none"
                          style={{ width: `${sliderPct}%`, background: dealColor, opacity: 0.3, top: "50%", transform: "translateY(-50%)", height: "4px" }} />
                        <input type="range" className="street-range relative z-10"
                          min={sliderMin} max={sliderMax} value={pricePerUnit}
                          onChange={(e) => setPricePerUnit(Number(e.target.value))}
                          disabled={phase !== "customer"} />
                      </div>
                      <input type="number" min={1} value={pricePerUnit}
                        onChange={(e) => setPricePerUnit(Math.max(1, Number(e.target.value)))}
                        className="w-20 px-2 py-1.5 rounded-lg bg-[#111] border border-[#222] text-white text-sm text-center focus:outline-none focus:border-green-600"
                        disabled={phase !== "customer"} />
                    </div>
                  </div>

                  {/* Quantity — slider */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs text-[#555]">
                        Quantidade{selectedDrug && <span className="text-[#333] ml-1">max {selectedDrug.quantity}g</span>}
                      </label>
                      <span className="text-white font-black text-sm">{quantity}g</span>
                    </div>
                    <input type="range" className="street-range w-full"
                      min={1} max={selectedDrug?.quantity ?? 1} value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                      disabled={phase !== "customer"} />
                  </div>

                  {/* Total */}
                  {selectedDrug && (
                    <div className="flex justify-between items-center py-2 border-t border-[#151515]">
                      <span className="text-[#444] text-xs">Total ofertado</span>
                      <span className="text-white font-black text-lg">${(pricePerUnit * quantity).toLocaleString()}</span>
                    </div>
                  )}

                  {/* Action buttons — customer phase */}
                  {phase === "customer" && (
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => submitOffer("offer")}
                        disabled={!selectedDrug || drugs.length === 0}
                        className="col-span-2 py-3 rounded-xl font-black text-sm text-white transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                        style={{ background: "linear-gradient(135deg,#166534,#15803d)" }}>
                        💰 Fazer Oferta
                      </button>
                      <button onClick={() => submitOffer("push")} disabled={!selectedDrug || drugs.length === 0}
                        title="Intimida o cliente — alto risco, pode aceitar ou ficar hostil"
                        className="py-2.5 rounded-xl border border-orange-900/40 bg-orange-950/40 hover:bg-orange-900/50 text-orange-300 font-bold text-xs transition-all hover:scale-105 active:scale-95 disabled:opacity-30">
                        💪 Push
                      </button>
                      <button onClick={() => submitOffer("discount")} disabled={!selectedDrug || drugs.length === 0}
                        title="Desconto — reduz suspeita, aumenta aceitação"
                        className="py-2.5 rounded-xl border border-blue-900/40 bg-blue-950/40 hover:bg-blue-900/50 text-blue-300 font-bold text-xs transition-all hover:scale-105 active:scale-95 disabled:opacity-30">
                        🎁 Desconto
                      </button>
                      <button onClick={() => submitOffer("rush")} disabled={!selectedDrug || drugs.length === 0}
                        title="Rush — apressa, reduz paciência do cliente"
                        className="py-2.5 rounded-xl border border-purple-900/40 bg-purple-950/40 hover:bg-purple-900/50 text-purple-300 font-bold text-xs transition-all hover:scale-105 active:scale-95 disabled:opacity-30">
                        ⚡ Rush
                      </button>
                      <button onClick={rejectCustomer}
                        className="py-2.5 rounded-xl border border-[#1f1f1f] bg-[#0d0d0d] hover:bg-[#141414] text-[#444] hover:text-[#888] font-semibold text-xs transition-all hover:scale-105 active:scale-95">
                        ⏩ Ignorar
                      </button>
                    </div>
                  )}

                  {/* Call next — idle phase */}
                  {phase === "idle" && (
                    <button onClick={callNextCustomer} disabled={noDrugs || !!inJail}
                      className="w-full py-3.5 rounded-xl font-black text-sm text-white transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{ background: "linear-gradient(135deg,#0e7490,#0891b2)" }}>
                      👤 Chamar Próximo Cliente
                    </button>
                  )}
                </div>
              )}

              {/* Negotiating spinner */}
              {phase === "negotiating" && (
                <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-6 text-center">
                  <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-[#444] text-sm">A negociar...</p>
                </div>
              )}

              {/* Loading spinner (active session) */}
              {phase === "loading" && session && (
                <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-6 text-center">
                  <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-[#444] text-sm">A carregar...</p>
                </div>
              )}

              {/* End session */}
              {session && phase !== "negotiating" && phase !== "loading" && (
                <button onClick={endSession}
                  className="w-full py-2.5 rounded-xl border border-red-950/60 bg-red-950/20 hover:bg-red-950/40 text-red-600 hover:text-red-500 font-semibold text-xs transition-all">
                  🚪 Sair da Rua
                </button>
              )}
            </div>

            {/* ── RIGHT — Action log ─────────────────────────────────────── */}
            <div className="w-full lg:w-60 xl:w-64 shrink-0 border-t lg:border-t-0 lg:border-l border-[#141414] flex flex-col p-4"
              style={{ background: "rgba(0,0,0,0.55)" }}>
              <p className="text-[10px] font-black text-[#2a2a2a] uppercase tracking-widest mb-3">Registo</p>
              <div ref={logRef} className="flex-1 overflow-y-auto space-y-1.5 max-h-[400px] lg:max-h-full"
                style={{ scrollbarWidth: "none" }}>
                {log.length === 0 && (
                  <p className="text-[#222] text-xs italic">Sem actividade ainda...</p>
                )}
                {log.map((entry, i) => (
                  <div key={i} className="text-xs flex gap-1.5 items-start">
                    <span className="text-[#2a2a2a] shrink-0 tabular-nums pt-px">{entry.time}</span>
                    <span className={`${entry.color} leading-snug`}>{entry.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Util ─────────────────────────────────────────────────────────────────────

function heatStageFor(heat: number): HeatStage {
  if (heat >= 100) return "busted";
  if (heat >= 70)  return "danger";
  if (heat >= 40)  return "warning";
  return "safe";
}


