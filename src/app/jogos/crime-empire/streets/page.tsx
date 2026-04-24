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
  requestedDrugName: string;
  requestedQty: number;
  requestedPriceExpectation: number;
  flexibility: number;
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

// ─── Portrait pool ────────────────────────────────────────────────────────────

const PORTRAIT_POOL: Record<CustomerType, string[]> = {
  regular:    [
    "/images/cliente/pedreiro_tier1.jpg",
    "/images/cliente/engenheiro_obras_tier2.jpg",
    "/images/cliente/barman_tier2.jpg",
    "/images/cliente/agricultor_tier1.jpg",
    "/images/cliente/pescador_tier1.jpg",
    "/images/cliente/Tio_tier2.jpg",
    "/images/cliente/gordo_tier1.jpg",
    "/images/cliente/camionista_tier1.jpg",
  ],
  tourist:    [
    "/images/cliente/americano_tier3.jpg",
    "/images/cliente/jovem_americano_tier2.jpg",
    "/images/cliente/italiano_tier2.jpg",
    "/images/cliente/chines_tier1.jpg",
    "/images/cliente/marinheiro_tier2.jpg",
    "/images/cliente/rasta_russa_female_tier1.jpg",
  ],
  junkie:     [
    "/images/cliente/drogado_tier1.jpg",
    "/images/cliente/maluco_tier1.jpg",
    "/images/cliente/sem_abrigo_tier1.jpg",
    "/images/cliente/sem_abrigo_mulher_tier1.jpg",
  ],
  dealer:     [
    "/images/cliente/homem_de_negocios_tier3.jpg",
    "/images/cliente/lenda_tier3.jpg",
    "/images/cliente/musculado_tier3.jpg",
    "/images/cliente/patrao_mafia_russa_tier3.jpg",
    "/images/cliente/advogado_tier3.jpg",
    "/images/cliente/male_Tier3.jpg",
  ],
  undercover: [
    "/images/cliente/medico_tier2.jpg",
    "/images/cliente/padre_tier2.jpg",
    "/images/cliente/barman_tier2.jpg",
    "/images/cliente/engenheiro_obras_tier2.jpg",
  ],
};

function pickPortrait(type: CustomerType, id: string): string {
  const pool = PORTRAIT_POOL[type] ?? PORTRAIT_POOL.regular;
  const hash = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return pool[hash % pool.length];
}

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

  // -- Typewriter dialogue
  const [typedDialogue, setTypedDialogue] = useState("");
  const [dialogueDone, setDialogueDone] = useState(false);
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typeDialogue = useCallback((text: string) => {
    if (typewriterRef.current) clearInterval(typewriterRef.current);
    setTypedDialogue("");
    setDialogueDone(false);
    let i = 0;
    typewriterRef.current = setInterval(() => {
      i++;
      setTypedDialogue(text.slice(0, i));
      if (i >= text.length) {
        if (typewriterRef.current) clearInterval(typewriterRef.current);
        setDialogueDone(true);
      }
    }, 28);
  }, []);
  useEffect(() => () => { if (typewriterRef.current) clearInterval(typewriterRef.current); }, []);

  // -- Inspector reveal
  const [inspectorRevealed, setInspectorRevealed] = useState(false);

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

  // Use a ref so fetchData never re-creates when selectedDrug changes,
  // which would cause the useEffect to re-fire and reset the phase to "idle".
  const selectedDrugRef = useRef<DrugItem | null>(null);
  useEffect(() => { selectedDrugRef.current = selectedDrug; }, [selectedDrug]);

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

      if (data.drugs?.length > 0 && !selectedDrugRef.current) {
        const first = data.drugs[0];
        setSelectedDrug(first);
        setPricePerUnit(Math.round(first.items.base_price * 1.2));
        setQuantity(Math.min(10, first.quantity));
      }
    } catch {
      setPhase("zone_select");
    }
  }, [router]); // intentionally excludes selectedDrug — use selectedDrugRef instead

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
    typeDialogue(data.greeting);
    setInspectorRevealed(false);
    setDialogueDone(false);
    setSession((s) => s ? { ...s, heat: data.session.heat } : s);
    setHeat(data.session.heat);
    setHeatStage(heatStageFor(data.session.heat));
    setPhase("customer");
    setCustomerAnim(true); setTimeout(() => setCustomerAnim(false), 600);
    startTimer();
    addLog(`👤 ${data.customer.name} (${CUSTOMER_TYPE_META[data.customer.type as CustomerType]?.label ?? data.customer.type}) aproximou-se`, "text-yellow-300");

    // Auto-select drug matching client's request
    if (data.customer.requestedDrugName && drugs.length > 0) {
      const match = drugs.find((d: DrugItem) =>
        d.items.name.toLowerCase() === data.customer.requestedDrugName.toLowerCase()
      );
      const target = match ?? drugs[0];
      setSelectedDrug(target);
      setPricePerUnit(Math.round(target.items.base_price * 1.2));
      setQuantity(Math.min(data.customer.requestedQty ?? 10, target.quantity));
    }
  }

  async function submitOffer(action: Action = "offer", overridePrice?: number, overrideQty?: number) {
    if (!session || !customer || !selectedDrug) return;
    stopTimer();
    setPhase("negotiating");
    const usedPrice = overridePrice ?? pricePerUnit;
    const usedQty   = overrideQty   ?? quantity;

    const res = await fetch("/api/crime-empire/streets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "negotiate",
        sessionId: session.id,
        customerId: customer.id,
        inventoryId: selectedDrug.id,
        pricePerUnit: usedPrice,
        quantity: usedQty,
        negotiationAction: action,
        customerState: {
          budget: customer.budget,
          patience: customer.patience,
          offersReceived: customer.offersReceived,
          suspicion: customer.suspicion,
          requestedDrugName: customer.requestedDrugName,
          requestedQty: customer.requestedQty,
          requestedPriceExpectation: customer.requestedPriceExpectation,
          flexibility: customer.flexibility,
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
    if (data.dialogue) typeDialogue(data.dialogue);
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
    if (data.dialogue) typeDialogue(data.dialogue);
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
      if (customer?.type === "undercover") {
        setInspectorRevealed(true);
        if (data.dialogue) typeDialogue(data.dialogue);
        await new Promise((r) => setTimeout(r, 2200));
      }
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

  const currentZone   = session ? zones.find((z) => z.id === session.zone) : null;
  const heatStyle     = HEAT_STAGE_STYLE[heatStage];
  const customerMeta  = customer ? CUSTOMER_TYPE_META[customer.type] : null;
  const inJail        = player?.in_jail;
  const noDrugs       = drugs.length === 0;
  const zoneAccent    = currentZone ? (ZONE_ACCENT[currentZone.id] ?? "#22c55e") : "#22c55e";

  const moodColor = suspicion >= 70 ? "#ef4444" : suspicion >= 40 ? "#eab308" : "#22c55e";
  const moodLabel = suspicion >= 70 ? "Muito suspeito" : suspicion >= 40 ? "Desconfiado" : "Calmo";

  const basePrice  = selectedDrug?.items.base_price ?? 100;
  const vignetteAlpha = Math.max(0, (heat - 20) / 80) * 0.65;

  const drugMatchesRequest = customer && selectedDrug
    && selectedDrug.items.name.toLowerCase() === customer.requestedDrugName.toLowerCase();

  // Cinematic button values (no sliders)
  const fairPrice = customer ? Math.round(customer.requestedPriceExpectation) : Math.round(basePrice * 1.0);
  const highPrice = Math.round(pricePerUnit * 1.2);
  const lowPrice  = Math.round(pricePerUnit * 0.85);
  const lessQty   = Math.max(1, quantity - 2);
  const nextDrug  = drugs.length > 1 ? drugs[(drugs.indexOf(selectedDrug!) + 1) % drugs.length] ?? drugs[0] : null;
  const portrait  = customer ? pickPortrait(customer.type, customer.id) : null;

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (phase === "loading" && !session && !player) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#060608] text-white">
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
      <style>{`
        @keyframes floatUp {
          0%   { opacity: 1; transform: translateY(0) scale(1); }
          60%  { opacity: 1; transform: translateY(-48px) scale(1.15); }
          100% { opacity: 0; transform: translateY(-90px) scale(0.9); }
        }
        @keyframes clientSlideIn {
          from { opacity: 0; transform: translateX(-40px) scale(0.94); filter: blur(4px); }
          to   { opacity: 1; transform: translateX(0) scale(1);   filter: blur(0);   }
        }
        @keyframes heatPulse {
          0%, 100% { opacity: 0.45; }
          50%      { opacity: 0.8; }
        }
        @keyframes dangerFlicker {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.5; }
        }
        @keyframes inspectorFlash {
          0%, 100% { background: rgba(185,28,28,0.25); box-shadow: 0 0 0 rgba(239,68,68,0); }
          25%      { background: rgba(185,28,28,0.7);  box-shadow: 0 0 60px rgba(239,68,68,0.7); }
          50%      { background: rgba(185,28,28,0.15); box-shadow: 0 0 10px rgba(239,68,68,0.2); }
          75%      { background: rgba(185,28,28,0.6);  box-shadow: 0 0 50px rgba(239,68,68,0.6); }
        }
        @keyframes btnReveal {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes suspicionShake {
          0%, 100% { transform: translateX(0); }
          25%      { transform: translateX(-3px); }
          75%      { transform: translateX(3px); }
        }
        .float-money      { animation: floatUp 1.8s ease-out forwards; }
        .client-enter     { animation: clientSlideIn 0.5s cubic-bezier(.22,.68,0,1.2) forwards; }
        .heat-vignette    { animation: heatPulse 2s ease-in-out infinite; }
        .danger-text      { animation: dangerFlicker 0.9s ease-in-out infinite; }
        .inspector-reveal { animation: inspectorFlash 0.5s ease-in-out 3; }
        .btn-reveal       { animation: btnReveal 0.3s ease-out forwards; }
        .suspicion-shake  { animation: suspicionShake 0.35s ease-in-out; }
      `}</style>

      <div className="flex-1 text-white flex flex-col min-h-screen relative overflow-hidden" style={{ background: "#060608" }}>

        {/* ── Zone ambient glow ── */}
        {session && currentZone && (
          <div className="pointer-events-none fixed inset-0 z-0 transition-all duration-1000"
            style={{ background: `radial-gradient(ellipse at 30% 80%, ${ZONE_GLOW[currentZone.id] ?? "rgba(34,197,94,0.04)"} 0%, transparent 70%)` }} />
        )}

        {/* ── Heat vignette ── */}
        {heat > 20 && (
          <div className="pointer-events-none fixed inset-0 z-10 heat-vignette"
            style={{ background: `radial-gradient(ellipse at center, transparent 20%, rgba(185,28,28,${vignetteAlpha}) 100%)` }} />
        )}

        {/* ── Floating money ── */}
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
        <div className="relative z-20 flex items-center gap-3 px-4 md:px-6 py-3 border-b border-[#111]"
          style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}>
          <Link href="/jogos/crime-empire/dashboard"
            className="text-[#ff6a00] hover:text-[#ffaa50] text-sm font-bold transition-colors shrink-0">
            ←
          </Link>

          {session ? (
            <div className="flex-1 flex items-center gap-3">
              {currentZone && (
                <span className="text-xs px-2.5 py-1 rounded-full font-bold border shrink-0 hidden sm:inline"
                  style={{ color: zoneAccent, borderColor: `${zoneAccent}44`, background: `${zoneAccent}11` }}>
                  {currentZone.icon} {currentZone.name}
                </span>
              )}
              <div className="flex-1 flex items-center gap-2">
                <span className={`text-xs font-black shrink-0 w-6 text-right ${heatStyle.color} ${heatStage === "danger" ? "danger-text" : ""}`}>
                  {heat}
                </span>
                <div className="flex-1 h-2.5 bg-[#111] rounded-full overflow-hidden border border-[#1a1a1a] relative">
                  <div className={`h-full rounded-full transition-all duration-700 ${heatStyle.bg}`}
                    style={{ width: `${heat}%`, boxShadow: heat > 60 ? `0 0 8px ${heatStage === "danger" ? "#ef4444" : "#eab308"}` : "none" }} />
                </div>
                <span className={`text-[10px] font-black shrink-0 w-20 text-right ${heatStyle.color} ${heatStage === "danger" ? "danger-text" : ""}`}>
                  {heatStyle.label}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex-1" />
          )}

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs text-[#444] font-mono">Nv.{player?.level ?? "–"}</span>
            <span className="text-xs text-green-400 font-mono font-bold">${player?.dirty_cash?.toLocaleString() ?? 0}</span>
          </div>
        </div>

        {/* Jail banner */}
        {inJail && player?.jail_release_at && (
          <div className="relative z-20 mx-4 mt-2 p-3 rounded-xl bg-red-950/50 border border-red-800/40 text-red-300 text-sm flex items-center gap-2">
            <span>🚔</span>
            <span>Estás preso até <strong>{new Date(player.jail_release_at).toLocaleTimeString("pt-PT")}</strong></span>
            <Link href="/jogos/crime-empire/jail" className="ml-auto text-xs underline">Ir à cela →</Link>
          </div>
        )}

        {/* ══ ZONE SELECT / SESSION END ═══════════════════════════════════ */}
        {(phase === "zone_select" || phase === "session_end") && (
          <div className="relative z-20 flex-1 px-4 md:px-10 py-10">
            {phase === "session_end" && (
              <div className="mb-10 p-8 rounded-2xl border border-green-800/30 text-center max-w-sm mx-auto"
                style={{ background: "linear-gradient(135deg, rgba(20,83,45,0.35), rgba(0,0,0,0.5))" }}>
                <p className="text-5xl mb-3">💰</p>
                <p className="text-green-400 font-black text-2xl mb-2">Sessão Encerrada</p>
                <p className="text-[#888] text-sm">
                  <span className="text-white font-black text-xl">{sessionDeals}</span> negócios ·{" "}
                  <span className="text-green-400 font-black text-xl">${sessionEarned.toLocaleString()}</span>
                </p>
              </div>
            )}
            <div className="max-w-2xl">
              <h1 className="text-5xl font-black mb-2 tracking-tight">
                <span style={{ background: "linear-gradient(90deg,#4ade80,#166534)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  Ruas
                </span>
              </h1>
              <p className="text-[#444] mb-8 text-sm">Escolhe a zona. Cada rua tem os seus riscos.</p>
              {inJail ? (
                <div className="p-5 rounded-2xl bg-red-950/30 border border-red-900/40 text-red-400 text-sm">🚔 Não podes sair enquanto estás preso.</div>
              ) : noDrugs ? (
                <div className="p-8 rounded-2xl bg-[#0c0c0c] border border-[#181818] text-center">
                  <p className="text-4xl mb-3 opacity-20">🌿</p>
                  <p className="text-[#555] mb-1">Sem stock para vender.</p>
                  <p className="text-[#333] text-xs mb-5">Vai ao Black Market primeiro.</p>
                  <Link href="/jogos/crime-empire/black-market"
                    className="inline-block px-5 py-2.5 rounded-xl bg-green-800 hover:bg-green-700 text-sm font-bold transition-all hover:scale-105">
                    Black Market →
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {zones.map((zone) => {
                    const locked = (player?.level ?? 1) < zone.unlockLevel;
                    const accent = ZONE_ACCENT[zone.id] ?? "#22c55e";
                    return (
                      <button key={zone.id}
                        onClick={() => !locked && startSession(zone.id)}
                        disabled={locked || !!inJail}
                        className={`group relative p-6 rounded-2xl border text-left overflow-hidden transition-all ${
                          locked ? "border-[#181818] opacity-30 cursor-not-allowed" : "border-[#1f1f1f] hover:border-[#2a2a2a] active:scale-95 cursor-pointer"
                        }`}
                        style={locked ? { background: "#0a0a0a" } : { background: `linear-gradient(135deg, ${accent}0d, #0a0a0a 60%)` }}>
                        {!locked && (
                          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
                            style={{ background: `radial-gradient(ellipse at top left, ${accent}18 0%, transparent 55%)` }} />
                        )}
                        <div className="relative z-10">
                          <div className="flex items-start justify-between mb-3">
                            <span className="text-3xl">{zone.icon}</span>
                            {locked && <span className="text-[#333] text-xs">Nv.{zone.unlockLevel}</span>}
                          </div>
                          <p className="font-black text-white text-base mb-1">{zone.name}</p>
                          <p className="text-xs text-[#444] mb-4 leading-relaxed">{zone.description}</p>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="font-bold" style={{ color: accent }}>+{Math.round((zone.rewardMult - 1) * 100)}% lucro</span>
                            <span className="text-yellow-700">🌡️ +{zone.heatPerDeal}/deal</span>
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

        {/* ══ ACTIVE SESSION — CINEMATIC ENCOUNTER ═══════════════════════ */}
        {session && phase !== "zone_select" && phase !== "session_end" && phase !== "arrested" && (
          <div className="relative z-20 flex-1 flex flex-col lg:flex-row min-h-0">

            {/* ── LEFT — CLIENT PORTRAIT ────────────────────────────────── */}
            <div className="w-full lg:w-72 xl:w-80 shrink-0 flex flex-col p-4 gap-3 lg:border-r border-[#101010]"
              style={{ background: "rgba(0,0,0,0.5)" }}>

              {customer ? (
                <div
                  className={`relative rounded-3xl overflow-hidden flex-1 flex flex-col min-h-[320px] lg:min-h-0 ${customerAnim ? "client-enter" : ""} ${inspectorRevealed ? "inspector-reveal" : ""}`}
                  style={{
                    border: `1.5px solid ${moodColor}55`,
                    boxShadow: `0 0 40px ${moodColor}33, inset 0 0 20px ${moodColor}0a`,
                    background: inspectorRevealed
                      ? "linear-gradient(160deg,#1a0000,#0a0a0a)"
                      : `linear-gradient(160deg,${moodColor}12,#0a0a0a)`,
                    transition: "border-color 0.6s, box-shadow 0.6s, background 0.6s",
                  }}>

                  {/* Portrait image — full bleed */}
                  {portrait && (
                    <div className="relative w-full" style={{ paddingBottom: "100%" }}>
                      <img
                        src={portrait}
                        alt={customer.name}
                        className="absolute inset-0 w-full h-full object-cover object-top"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                      <div className="absolute inset-0"
                        style={{ background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.92) 100%)" }} />

                      {/* Inspector badge on reveal */}
                      {inspectorRevealed && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-center btn-reveal">
                            <p className="text-6xl mb-2">🚔</p>
                            <p className="text-red-400 font-black text-2xl tracking-widest">POLÍCIA</p>
                            <p className="text-red-600 text-xs mt-1">Estás detido</p>
                          </div>
                        </div>
                      )}

                      {/* Name + type over image */}
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <p className="font-black text-white text-xl leading-tight drop-shadow-lg">{customer.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: `${moodColor}22`, color: moodColor, border: `1px solid ${moodColor}44` }}>
                            {inspectorRevealed ? "🚔 Polícia" : (customer.type === "undercover" ? "🧑 Regular" : `${customerMeta?.icon} ${customerMeta?.label}`)}
                          </span>
                          <span className={`text-xs font-bold ${inspectorRevealed ? "danger-text" : suspicion >= 40 ? "danger-text" : ""}`}
                            style={{ color: moodColor }}>
                            {moodLabel}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bottom section — stats */}
                  <div className="p-4 flex flex-col gap-3">
                    {!inspectorRevealed && (
                      <div className="flex flex-wrap gap-2">
                        <span className="px-3 py-1.5 rounded-xl text-xs font-black"
                          style={{ background: "#0b1a0b", border: "1px solid #1a3a1a", color: "#4ade80" }}>
                          🌿 {customer.requestedDrugName}
                        </span>
                        <span className="px-3 py-1.5 rounded-xl text-xs font-black"
                          style={{ background: "#0b0b1a", border: "1px solid #1a1a3a", color: "#818cf8" }}>
                          ⚖️ {customer.requestedQty}g
                        </span>
                        {!drugMatchesRequest && selectedDrug && (
                          <span className="px-2 py-1 rounded-lg text-[10px] font-bold"
                            style={{ background: "#1a1200", border: "1px solid #3a2800", color: "#d97706" }}>
                            ⚠️ produto diferente
                          </span>
                        )}
                      </div>
                    )}

                    {/* Suspicion bar */}
                    <div className={suspicion > 60 ? "suspicion-shake" : ""}>
                      <div className="flex justify-between text-[11px] mb-1.5">
                        <span style={{ color: "#333" }}>Suspeita</span>
                        <span className="font-black tabular-nums" style={{ color: moodColor }}>{suspicion}%</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#111" }}>
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${suspicion}%`, background: moodColor, boxShadow: suspicion > 60 ? `0 0 6px ${moodColor}` : "none" }} />
                      </div>
                    </div>

                    {/* Patience pips */}
                    <div>
                      <div className="flex justify-between text-[11px] mb-1.5">
                        <span style={{ color: "#333" }}>Paciência</span>
                        <div className="flex gap-0.5">
                          {Array.from({ length: customer.patience }).map((_, i) => (
                            <span key={i} className="text-[9px] transition-colors duration-300"
                              style={{ color: i < customer.patience - customer.offersReceived ? "#22c55e" : "#1f1f1f" }}>
                              ●
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {(player?.level ?? 1) >= 3 && !inspectorRevealed && (
                      <p className="text-[10px] text-[#2a2a2a] italic border-t border-[#111] pt-2">
                        Espera até <span style={{ color: "#444" }}>${customer.requestedPriceExpectation}/g</span>
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 rounded-3xl border border-dashed border-[#1a1a1a] flex flex-col items-center justify-center text-center gap-3 min-h-[280px]"
                  style={{ background: "rgba(0,0,0,0.3)" }}>
                  <p className="text-6xl opacity-[0.06]">👤</p>
                  <p className="text-[#2a2a2a] text-xs tracking-widest uppercase font-bold">Sem cliente</p>
                </div>
              )}

              {/* Session stats */}
              <div className="rounded-2xl border border-[#141414] p-3 flex items-center justify-between"
                style={{ background: "rgba(0,0,0,0.6)" }}>
                <span className="text-[#333] text-xs">{sessionDeals} negócios</span>
                <span className="text-green-400 font-black text-sm">${sessionEarned.toLocaleString()}</span>
              </div>
            </div>

            {/* ── CENTER — DIALOGUE + ACTIONS ───────────────────────────── */}
            <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto min-w-0">

              {/* ── DIALOGUE BOX ── */}
              <div className="relative rounded-2xl overflow-hidden"
                style={{
                  background: "rgba(6,6,10,0.95)",
                  border: `1px solid ${customer ? moodColor + "28" : "#151515"}`,
                  boxShadow: customer ? `0 0 30px ${moodColor}0d` : "none",
                  transition: "border-color 0.5s, box-shadow 0.5s",
                  minHeight: "110px",
                }}>
                <div className="absolute inset-0 pointer-events-none opacity-[0.015]"
                  style={{ backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 2px,#fff 2px,#fff 3px)" }} />
                <div className="relative z-10 p-5">
                  {typedDialogue ? (
                    <>
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] mb-3" style={{ color: moodColor + "99" }}>
                        {customer ? customer.name.toUpperCase() : "SISTEMA"}
                      </p>
                      <p className="text-white text-[15px] leading-relaxed font-medium italic">
                        &ldquo;{renderDialogueWithHighlights(typedDialogue, customer)}&rdquo;
                        {!dialogueDone && <span className="inline-block w-0.5 h-4 bg-white ml-0.5 align-middle animate-pulse" />}
                      </p>
                    </>
                  ) : (
                    <p className="text-[#222] text-sm italic">Chama o próximo cliente para começar...</p>
                  )}
                </div>
              </div>

              {/* ── DECISION TIMER ── */}
              {(phase === "customer" || phase === "counter") && (
                <div>
                  <div className="h-0.5 bg-[#111] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-1000 ${timerSecs <= 10 ? "bg-red-600" : "bg-cyan-600"}`}
                      style={{ width: `${(timerSecs / DECISION_SECS) * 100}%` }} />
                  </div>
                  {timerSecs <= 10 && (
                    <p className="text-right text-xs text-red-500 danger-text mt-1 font-black">{timerSecs}s</p>
                  )}
                </div>
              )}

              {/* ── DEAL ACCEPTED RESULT ── */}
              {phase === "result" && lastOutcome === "accept" && (
                <div className="rounded-2xl border border-green-800/40 p-6 text-center btn-reveal"
                  style={{ background: "linear-gradient(135deg,rgba(20,83,45,0.5),rgba(0,0,0,0.5))" }}>
                  <p className="text-green-400 font-black text-lg mb-1">✅ NEGÓCIO FEITO</p>
                  <p className="text-green-300 font-black text-4xl">${lastEarned.toLocaleString()}</p>
                  <p className="text-green-800 text-xs mt-1 mb-4">dinheiro sujo</p>
                  <button onClick={callNextCustomer}
                    className="px-8 py-3 rounded-xl font-black text-sm text-white transition-all hover:scale-105 active:scale-95"
                    style={{ background: "linear-gradient(135deg,#166534,#15803d)" }}>
                    Próximo Cliente →
                  </button>
                </div>
              )}

              {/* ── COUNTER-OFFER ── */}
              {phase === "counter" && counterPrice != null && counterQty != null && (
                <div className="rounded-2xl border border-yellow-900/40 p-5 btn-reveal"
                  style={{ background: "linear-gradient(135deg,rgba(78,52,10,0.4),rgba(0,0,0,0.5))" }}>
                  <p className="text-yellow-600 font-black text-xs uppercase tracking-widest mb-3">↔ Contra-proposta</p>
                  <div className="text-center mb-4">
                    <p className="text-yellow-300 font-black text-3xl">${(counterPrice * counterQty).toLocaleString()}</p>
                    <p className="text-yellow-800 text-xs mt-0.5">${counterPrice}/g × {counterQty}g</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={acceptCounter}
                      className="py-3 rounded-xl font-black text-sm text-white transition-all hover:scale-105 active:scale-95"
                      style={{ background: "linear-gradient(135deg,#166534,#15803d)" }}>
                      ✅ Aceitar
                    </button>
                    <button onClick={() => { setPhase("customer"); startTimer(); addLog(`↩ Rejeitaste a contra-proposta`, "text-orange-400"); }}
                      className="py-3 rounded-xl border border-[#2a2a2a] font-black text-sm text-[#888] hover:text-white transition-all hover:scale-105 active:scale-95"
                      style={{ background: "#111" }}>
                      ❌ Rejeitar
                    </button>
                  </div>
                </div>
              )}

              {/* ── NEGOTIATION BUTTONS ── */}
              {phase === "customer" && dialogueDone && (
                <div className="flex flex-col gap-2 btn-reveal">
                  <button
                    onClick={() => {
                      if (!customer) return;
                      setPricePerUnit(fairPrice);
                      setQuantity(customer.requestedQty);
                      submitOffer("offer", fairPrice, customer.requestedQty);
                    }}
                    disabled={!selectedDrug}
                    className="w-full py-4 rounded-2xl font-black text-base text-white transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30 flex items-center justify-center gap-3"
                    style={{ background: "linear-gradient(135deg,#166534,#16a34a)", boxShadow: "0 0 20px rgba(34,197,94,0.2)" }}>
                    <span>💰 Aceitar Pedido</span>
                    <span className="text-green-200 text-sm font-medium opacity-80">
                      ${fairPrice}/g × {customer?.requestedQty ?? quantity}g = ${(fairPrice * (customer?.requestedQty ?? quantity)).toLocaleString()}
                    </span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => submitOffer("push", highPrice, quantity)}
                      disabled={!selectedDrug}
                      className="py-3.5 rounded-xl font-bold text-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-30 flex flex-col items-center gap-0.5"
                      style={{ background: "#120a00", border: "1px solid #3a1a00", color: "#f97316" }}>
                      <span>💪 Pedir Mais</span>
                      <span className="text-[10px] opacity-60">${highPrice}/g</span>
                    </button>
                    <button
                      onClick={() => submitOffer("discount", lowPrice, quantity)}
                      disabled={!selectedDrug}
                      className="py-3.5 rounded-xl font-bold text-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-30 flex flex-col items-center gap-0.5"
                      style={{ background: "#000d14", border: "1px solid #001a2a", color: "#38bdf8" }}>
                      <span>🎁 Dar Desconto</span>
                      <span className="text-[10px] opacity-60">${lowPrice}/g</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => submitOffer("offer", pricePerUnit, lessQty)}
                      disabled={!selectedDrug || quantity <= 1}
                      className="py-3 rounded-xl font-bold text-xs transition-all hover:scale-105 active:scale-95 disabled:opacity-30 flex flex-col items-center gap-0.5"
                      style={{ background: "#0a0a14", border: "1px solid #1a1a2a", color: "#a78bfa" }}>
                      <span>📦 Menos Qty</span>
                      <span className="text-[10px] opacity-60">{lessQty}g</span>
                    </button>
                    <button
                      onClick={() => {
                        if (nextDrug) {
                          setSelectedDrug(nextDrug);
                          setPricePerUnit(Math.round(nextDrug.items.base_price * 1.2));
                          setQuantity(Math.min(customer?.requestedQty ?? 5, nextDrug.quantity));
                        }
                      }}
                      disabled={!nextDrug}
                      className="py-3 rounded-xl font-bold text-xs transition-all hover:scale-105 active:scale-95 disabled:opacity-30 flex flex-col items-center gap-0.5"
                      style={{ background: "#0a1400", border: "1px solid #1a2a00", color: "#86efac" }}>
                      <span>🔄 Trocar</span>
                      <span className="text-[10px] opacity-60 truncate max-w-full px-1">{nextDrug?.items.name ?? "—"}</span>
                    </button>
                    <button
                      onClick={rejectCustomer}
                      className="py-3 rounded-xl font-bold text-xs transition-all hover:scale-105 active:scale-95 flex flex-col items-center gap-0.5"
                      style={{ background: "#0a0a0a", border: "1px solid #1f1f1f", color: "#4a4a4a" }}>
                      <span>⏩ Ignorar</span>
                      <span className="text-[10px] opacity-60">seguinte</span>
                    </button>
                  </div>

                  {selectedDrug && (
                    <p className="text-center text-[10px]" style={{ color: "#222" }}>
                      Produto: <span style={{ color: "#333" }}>{selectedDrug.items.name}</span> · {selectedDrug.quantity}g disponível
                    </p>
                  )}
                </div>
              )}

              {/* ── IDLE — CALL NEXT ── */}
              {phase === "idle" && (
                <button onClick={callNextCustomer} disabled={noDrugs || !!inJail}
                  className="w-full py-5 rounded-2xl font-black text-base text-white transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg,#0e7490,#0891b2)", boxShadow: "0 0 24px rgba(8,145,178,0.2)" }}>
                  👤 Chamar Próximo Cliente
                </button>
              )}

              {/* ── SPINNERS ── */}
              {(phase === "negotiating" || (phase === "loading" && session)) && (
                <div className="rounded-xl border border-[#141414] bg-[#080808] p-6 text-center">
                  <div className={`w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-2 ${phase === "negotiating" ? "border-cyan-500" : "border-green-500"}`} />
                  <p className="text-[#333] text-sm">{phase === "negotiating" ? "A negociar..." : "A carregar..."}</p>
                </div>
              )}

              {/* ── END SESSION ── */}
              {session && phase !== "negotiating" && phase !== "loading" && (
                <button onClick={endSession}
                  className="w-full py-2.5 rounded-xl font-semibold text-xs transition-all hover:scale-[1.01] active:scale-95"
                  style={{ background: "rgba(127,29,29,0.12)", border: "1px solid rgba(127,29,29,0.3)", color: "#6b2020" }}>
                  🚪 Sair da Rua
                </button>
              )}
            </div>

            {/* ── RIGHT — STREET LOG ────────────────────────────────────── */}
            <div className="hidden xl:flex w-56 shrink-0 border-l border-[#0f0f0f] flex-col p-4"
              style={{ background: "rgba(0,0,0,0.6)" }}>
              <p className="text-[9px] font-black text-[#1f1f1f] uppercase tracking-[0.25em] mb-3">Registo</p>
              <div ref={logRef} className="flex-1 overflow-y-auto space-y-2"
                style={{ scrollbarWidth: "none" }}>
                {log.length === 0 && <p className="text-[#181818] text-[10px] italic">Sem actividade...</p>}
                {log.map((entry, i) => (
                  <div key={i} className="text-[10px] flex gap-1.5 items-start leading-snug">
                    <span className="text-[#1e1e1e] shrink-0 tabular-nums">{entry.time}</span>
                    <span className={entry.color}>{entry.text}</span>
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

// ─── Utils ────────────────────────────────────────────────────────────────────

function heatStageFor(heat: number): HeatStage {
  if (heat >= 100) return "busted";
  if (heat >= 70)  return "danger";
  if (heat >= 40)  return "warning";
  return "safe";
}

function renderDialogueWithHighlights(text: string, customer: Customer | null): React.ReactNode {
  if (!customer) return text;
  const drugName = customer.requestedDrugName;
  if (!drugName) return text;
  const escaped = drugName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped}|\\d+g)`, "gi"));
  return parts.map((part, i) => {
    if (part.toLowerCase() === drugName.toLowerCase()) {
      return <span key={i} style={{ color: "#4ade80", fontWeight: 900, textShadow: "0 0 8px #4ade8066" }}>{part}</span>;
    }
    if (/^\d+g$/i.test(part)) {
      return <span key={i} style={{ color: "#818cf8", fontWeight: 900, textShadow: "0 0 8px #818cf866" }}>{part}</span>;
    }
    return part;
  });
}

