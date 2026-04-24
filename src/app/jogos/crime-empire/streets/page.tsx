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
  icon: string;
  title: string;
  desc: string;
  time: string;
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
  const maxTimerSecsRef = useRef(DECISION_SECS);

  // -- Mobile detection
  const isMobileRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    isMobileRef.current = mq.matches;
    const handler = (e: MediaQueryListEvent) => { isMobileRef.current = e.matches; };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // -- Arrest escape
  const [arrestEscape, setArrestEscape] = useState<{ token: string; jailMinutes: number; pendingCash: number } | null>(null);

  // -- Log
  const [log, setLog] = useState<LogEntry[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  // -- Session stats (bottom bar)
  const [sessionsToday, setSessionsToday] = useState(0);
  const [escapesSuccess, setEscapesSuccess] = useState(0);
  const [escapesTotal, setEscapesTotal] = useState(0);

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

  const addLog = useCallback((icon: string, title: string, desc: string) => {
    const time = new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLog((prev) => [...prev.slice(-49), { icon, title, desc, time }]);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    const secs = isMobileRef.current ? DECISION_SECS + 4 : DECISION_SECS;
    maxTimerSecsRef.current = secs;
    setTimerSecs(secs);
    timerRef.current = setInterval(() => {
      setTimerSecs((s) => {
        if (s <= 1) {
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

  // Track phase and customer name in refs for the timer-expiry effect
  const phaseRef = useRef<Phase>("loading");
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  const customerNameRef = useRef<string | null>(null);
  useEffect(() => { customerNameRef.current = customer?.name ?? null; }, [customer]);

  // Customer walks away when countdown reaches zero
  useEffect(() => {
    if (timerSecs !== 0) return;
    if (phaseRef.current !== "customer" && phaseRef.current !== "counter") return;
    const name = customerNameRef.current ?? "O cliente";
    addLog("🚶", "Cliente foi embora", `${name} perdeu a paciência e foi embora.`);
    setCustomer(null);
    setTypedDialogue("");
    setDialogueDone(true);
    setPhase("idle");
  }, [timerSecs, addLog]);

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
    setSessionsToday((s) => s + 1);
    const _zoneName = zones.find(z => z.id === zoneId)?.name ?? zoneId;
    addLog("🌍", "Sessão Iniciada", `Entraste em ${_zoneName}. Mantém a calma.`);
    addLog("👁️", "A examinar a zona", "A rua parece calma... por agora.");
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
    if (!res.ok) { showToast(data.error || "Erro ao chamar cliente", false); addLog("❌", "Erro", data.error ?? "Não há clientes disponíveis."); setPhase("idle"); return; }

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
    addLog("👤", "Novo cliente chegou", `${data.customer.name} aproximou-se.`);
    addLog("💬", data.customer.name, data.greeting);
    addLog("👁️", "A examinar a zona", data.session.heat > 50 ? "Há muita agitação por aqui..." : "A rua parece calma... por agora.");
    addLog("🛡️", "Nível de Calor", `Calor atual: ${data.session.heat}%`);
    if (data.session.heat > 40) {
      addLog("ℹ️", "Dica", "Calor elevado aumenta a probabilidade de presença policial.");
    } else {
      addLog("❓", "Quem está a observar?", "Difícil dizer por agora...");
    }

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
    addLog("⏩", "Cliente ignorado", `Mandaste ${customer?.name ?? "o cliente"} embora.`);
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
    addLog("🚪", "Sessão Encerrada", "Saíste da rua com segurança.");
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
      addLog("✅", "Negócio Fechado", `${customer?.name} aceitou — +$${earned.toLocaleString()} sujos`);
      addLog("🛡️", "Nível de Calor", `Calor atual: ${data.heat ?? heat}%`);
      setCustomer(null);
      setPhase("result");
      await fetchDrugs();
    } else if (outcome === "counter") {
      setCounterPrice(data.counterPrice ?? null);
      setCounterQty(data.counterQty ?? null);
      addLog("↔️", "Contra-proposta", `${customer?.name} propõe $${data.counterPrice}/u × ${data.counterQty}g`);
      setPhase("counter");
      startTimer();
    } else if (outcome === "reject") {
      addLog("❌", "Recusa", `${customer?.name} recusou a tua oferta.`);
      setPhase("customer");
      startTimer();
    } else if (outcome === "hostile") {
      addLog("⚡", "Cliente Hostil", `${customer?.name} ficou hostil e foi embora.`);
      setCustomer(null);
      setPhase("idle");
      await fetchDrugs();
    } else if (outcome === "snitch") {
      addLog("🚨", "Delator!", `${customer?.name} delatou-te! Calor disparou!`);
      setCustomer(null);
      if (data.heat >= 100) {
        // bust triggers arrest
        setArrestEscape({ token: data.escape_token, jailMinutes: data.jail_minutes, pendingCash: 0 });
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
      addLog("🚔", "APANHADO!", "A polícia chegou. Tens de fugir agora!");
      setEscapesTotal((t) => t + 1);
      setArrestEscape({ token: data.escape_token, jailMinutes: data.jail_minutes, pendingCash: data.earned_pending ?? 0 });
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
  const moodLabel = suspicion >= 70 ? "Muito Suspeito" : suspicion >= 40 ? "Desconfiado" : "Calmo";

  const basePrice  = selectedDrug?.items.base_price ?? 100;
  const vignetteAlpha = Math.max(0, (heat - 20) / 80) * 0.65;

  const fairPrice = customer ? Math.round(customer.requestedPriceExpectation) : Math.round(basePrice * 1.0);
  const highPrice = Math.round(pricePerUnit * 1.2);
  const lessQty   = Math.max(1, quantity - 2);
  const nextDrug  = drugs.length > 1 ? drugs[(drugs.indexOf(selectedDrug!) + 1) % drugs.length] ?? drugs[0] : null;
  const portrait  = customer ? pickPortrait(customer.type, customer.id) : null;

  const totalInventoryKg = drugs.reduce((sum, d) => sum + d.quantity, 0) / 1000;
  const repLabel = reputationLabel(player?.level ?? 1);
  const repPct   = Math.min(100, ((player?.level ?? 1) / 25) * 100);
  const minExpected = customer ? Math.round(customer.requestedPriceExpectation * 0.85) : 0;
  const maxExpected = customer ? Math.round(customer.requestedPriceExpectation * 1.15) : 0;

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (phase === "loading" && !session && !player) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0a0a0b] text-white">
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
          cashAtRisk={arrestEscape.pendingCash}
          onEscape={async () => {
            const token = arrestEscape.token; setArrestEscape(null);
            await fetch("/api/crime-empire/escape-attempt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, escaped: true }) });
            setEscapesSuccess((s) => s + 1);
            setPlayer(p => p ? { ...p, in_jail: false, jail_release_at: null } : p);
            showToast("Escapaste!", true);
            await fetchData();
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
          to   { opacity: 1; transform: translateX(0) scale(1); filter: blur(0); }
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
          0%, 100% { background: rgba(185,28,28,0.25); }
          25%      { background: rgba(185,28,28,0.7); box-shadow: 0 0 60px rgba(239,68,68,0.7); }
          75%      { background: rgba(185,28,28,0.6); box-shadow: 0 0 50px rgba(239,68,68,0.6); }
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
        @keyframes logEntry {
          from { opacity: 0; transform: translateX(10px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .float-money      { animation: floatUp 1.8s ease-out forwards; }
        .client-enter     { animation: clientSlideIn 0.5s cubic-bezier(.22,.68,0,1.2) forwards; }
        .heat-vignette    { animation: heatPulse 2s ease-in-out infinite; }
        .danger-text      { animation: dangerFlicker 0.9s ease-in-out infinite; }
        .inspector-reveal { animation: inspectorFlash 0.5s ease-in-out 3; }
        .btn-reveal       { animation: btnReveal 0.3s ease-out forwards; }
        .suspicion-shake  { animation: suspicionShake 0.35s ease-in-out; }
        .log-entry        { animation: logEntry 0.25s ease-out forwards; }
        .heat-bar-gradient {
          background: linear-gradient(90deg,#22c55e 0%,#86efac 20%,#eab308 45%,#f97316 65%,#ef4444 85%,#dc2626 100%);
        }
      `}</style>

      <div className="flex-1 text-white flex flex-col overflow-hidden" style={{ background: "#0a0a0b" }}>

        {/* ── Heat vignette ── */}
        {heat > 20 && (
          <div className="pointer-events-none fixed inset-0 z-0 heat-vignette"
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
        <div className="relative z-20 shrink-0 flex items-center gap-4 px-5 h-14 border-b border-[#161618]"
          style={{ background: "rgba(10,10,11,0.98)", backdropFilter: "blur(12px)" }}>

          {/* Left — title */}
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/jogos/crime-empire/dashboard"
              className="text-[#444] hover:text-white text-base transition-colors leading-none">&#8592;</Link>
            <h1 className="text-xs font-black tracking-[0.18em] text-white uppercase">Negócios na Rua</h1>
          </div>

          {/* Center — heat bar */}
          {session ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-1 px-2 sm:px-6 max-w-xl mx-auto">
              <div className="flex items-center gap-3 w-full">
                <span className="hidden sm:inline text-[10px] font-bold text-[#3a3a3a] tracking-widest uppercase shrink-0">Nível de Calor</span>
                <span className="hidden sm:inline text-[9px] text-[#2a2a2a] shrink-0">ⓘ</span>
                <div className="flex-1 relative h-2 bg-[#181818] rounded-full overflow-hidden">
                  <div className="absolute inset-0 heat-bar-gradient opacity-20 rounded-full" />
                  <div className="absolute inset-y-0 left-0 heat-bar-gradient rounded-full transition-all duration-700"
                    style={{ width: `${heat}%` }} />
                  {[25, 50, 75].map((p) => (
                    <div key={p} className="absolute top-0 bottom-0 w-px bg-[#0a0a0b]" style={{ left: `${p}%`, opacity: 0.6 }} />
                  ))}
                </div>
                <span className={`text-sm font-black tabular-nums shrink-0 ${heatStage === "danger" ? "danger-text text-red-400" : heatStage === "warning" ? "text-orange-400" : "text-white"}`}>
                  {heat}%
                </span>
                <span className={`hidden sm:inline text-[10px] font-black tracking-wider shrink-0 w-20 ${heatStage === "danger" ? "danger-text text-red-400" : heatStage === "warning" ? "text-orange-400" : "text-green-400"}`}>
                  {heatStyle.label.toUpperCase()}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex-1" />
          )}

          {/* Right — leave button */}
          {session ? (
            <button onClick={endSession}
              className="shrink-0 flex items-center gap-2 px-4 py-1.5 rounded-lg border border-[#252528] text-[#555] hover:text-white hover:border-[#3a3a3a] transition-all text-[11px] font-bold tracking-wide">
              ⬡ SAIR DA RUA
            </button>
          ) : (
            <Link href="/jogos/crime-empire/dashboard"
              className="shrink-0 px-4 py-1.5 rounded-lg border border-[#252528] text-[#555] hover:text-white hover:border-[#3a3a3a] transition-all text-[11px] font-bold tracking-wide">
              ← VOLTAR
            </Link>
          )}
        </div>

        {/* Jail banner */}
        {inJail && player?.jail_release_at && (
          <div className="relative z-20 mx-4 mt-2 p-3 rounded-xl bg-red-950/50 border border-red-800/40 text-red-300 text-sm flex items-center gap-2 shrink-0">
            <span>🚔</span>
            <span>Estás preso até <strong>{new Date(player.jail_release_at).toLocaleTimeString("pt-PT")}</strong></span>
            <Link href="/jogos/crime-empire/jail" className="ml-auto text-xs underline">Ir à cela →</Link>
          </div>
        )}

        {/* ══ ZONE SELECT / SESSION END ════════════════════════════════════ */}
        {(phase === "zone_select" || phase === "session_end") && (
          <div className="relative z-20 flex-1 overflow-y-auto px-6 py-8">
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

        {/* ══ ACTIVE SESSION — CINEMATIC THREE-COLUMN LAYOUT ═══════════════ */}
        {session && phase !== "zone_select" && phase !== "session_end" && phase !== "arrested" && (
          <div className="relative z-20 flex-1 flex min-h-0">

            {/* ── LEFT — CLIENT PORTRAIT ──────────────────────────────────── */}
            <div className="hidden md:flex md:w-[290px] xl:w-[320px] shrink-0 border-r border-[#161618] flex-col"
              style={{ background: "#0c0c0e" }}>

              {customer ? (
                <div className={`flex flex-col h-full ${customerAnim ? "client-enter" : ""}`}>

                  {/* Portrait — top, grows to fill space */}
                  <div className={`flex-1 relative overflow-hidden min-h-0 ${inspectorRevealed ? "inspector-reveal" : ""}`}>
                    {portrait ? (
                      <>
                        <img
                          src={portrait}
                          alt={customer.name}
                          className="absolute inset-0 w-full h-full object-cover object-top"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                        <div className="absolute inset-0"
                          style={{ background: "linear-gradient(to bottom, transparent 55%, rgba(12,12,14,0.55) 100%)" }} />
                        <div className="absolute inset-0"
                          style={{ background: "linear-gradient(to right, rgba(0,0,0,0.25) 0%, transparent 40%)" }} />
                      </>
                    ) : (
                      <div className="absolute inset-0" style={{ background: "linear-gradient(160deg,#111,#0a0a0a)" }} />
                    )}

                    {/* Inspector reveal overlay */}
                    {inspectorRevealed && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center"
                        style={{ background: "rgba(10,0,0,0.7)" }}>
                        <div className="text-center">
                          <p className="text-7xl mb-3">🚔</p>
                          <p className="text-red-400 font-black text-3xl tracking-widest danger-text">POLÍCIA</p>
                          <p className="text-red-700 text-sm mt-1">Estás detido</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Info — bottom fixed section */}
                  {!inspectorRevealed && (
                    <div className="shrink-0 px-4 py-4 border-t border-[#161618]" style={{ background: "#0c0c0e" }}>
                      <p className="font-black italic text-white leading-none mb-1 drop-shadow-lg"
                        style={{ fontSize: "clamp(20px,2.4vw,30px)", fontFamily: "Georgia, serif", textShadow: "0 2px 12px rgba(0,0,0,1)" }}>
                        {customer.name.toUpperCase()}
                      </p>
                      <p className="text-[#aaa] text-xs font-medium mb-2">
                        {customerMeta?.icon} {customerMeta?.label ?? customer.type}
                      </p>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold mb-2.5"
                        style={{ background: `${moodColor}1a`, border: `1px solid ${moodColor}44`, color: moodColor }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: moodColor }} />
                        {moodLabel.toUpperCase()}
                      </div>
                      {(player?.level ?? 1) >= 3 && (
                        <p className="text-[#444] text-[11px] font-mono italic leading-snug mb-2.5">
                          &ldquo;{hintQuote(customer)}&rdquo;
                        </p>
                      )}
                      {/* Suspicion bar */}
                      <div className={`${suspicion > 60 ? "suspicion-shake" : ""}`}>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-[#333]">Suspeita</span>
                          <span className="font-black tabular-nums" style={{ color: moodColor }}>{suspicion}%</span>
                        </div>
                        <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${suspicion}%`, background: moodColor }} />
                        </div>
                      </div>
                      {/* Patience pips */}
                      <div className="mt-2 flex items-center gap-1">
                        <span className="text-[10px] text-[#333] mr-1">Paciência</span>
                        {Array.from({ length: customer.patience }).map((_, i) => (
                          <span key={i} className="w-1.5 h-1.5 rounded-full transition-colors duration-300"
                            style={{ background: i < customer.patience - customer.offersReceived ? "#22c55e" : "#1f1f1f" }} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* No customer */
                <div className="flex-1 flex flex-col items-center justify-center gap-4"
                  style={{ background: "linear-gradient(180deg, #0c0c0e 0%, #0a0a0b 100%)" }}>
                  <div className="w-20 h-20 rounded-full flex items-center justify-center"
                    style={{ background: "#111", border: "1px solid #1a1a1a" }}>
                    <span className="text-3xl opacity-20">👤</span>
                  </div>
                  <p className="text-[#252528] text-xs tracking-widest uppercase font-bold">À espera de cliente</p>
                  {phase === "idle" && (
                    <button onClick={callNextCustomer} disabled={noDrugs || !!inJail}
                      className="mt-1 px-5 py-2 rounded-xl font-black text-xs text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-30"
                      style={{ background: "linear-gradient(135deg,#166534,#15803d)" }}>
                      👤 Chamar Cliente
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* ── CENTER — MAIN INTERACTION ──────────────────────────────── */}
            <div className="flex-1 flex flex-col overflow-y-auto md:overflow-y-hidden min-w-0" style={{ background: "#0a0a0b" }}>

              {/* ── MOBILE portrait card (shows actual portrait, replaces sidebar on mobile) ── */}
              {customer && (
                <div className={`md:hidden relative shrink-0 border-b border-[#141416] overflow-hidden ${customerAnim ? "client-enter" : ""}`}
                  style={{ height: "210px" }}>

                  {/* Section label */}
                  <div className="absolute top-0 left-0 z-20 px-3 pt-2">
                    <span className="text-[9px] font-black tracking-[0.18em] text-[#666] uppercase">Cliente chegou</span>
                  </div>

                  {/* Portrait */}
                  {portrait ? (
                    <img src={portrait} alt={customer.name}
                      className="absolute inset-0 w-full h-full object-cover object-top"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <div className="absolute inset-0" style={{ background: "linear-gradient(160deg,#111,#0a0a0a)" }} />
                  )}

                  {/* Gradient overlays */}
                  <div className="absolute inset-0 z-10"
                    style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, transparent 30%, rgba(0,0,0,0.75) 78%, rgba(0,0,0,0.97) 100%)" }} />
                  <div className="absolute inset-0 z-10"
                    style={{ background: "linear-gradient(to right, rgba(0,0,0,0.45) 0%, transparent 55%)" }} />

                  {/* Inspector reveal */}
                  {inspectorRevealed && (
                    <div className="absolute inset-0 z-30 flex items-center justify-center" style={{ background: "rgba(10,0,0,0.75)" }}>
                      <div className="text-center">
                        <p className="text-5xl mb-2">🚔</p>
                        <p className="text-red-400 font-black text-2xl tracking-widest danger-text">POLÍCIA</p>
                      </div>
                    </div>
                  )}

                  {/* Bottom info overlay */}
                  {!inspectorRevealed && (
                    <div className="absolute bottom-0 left-0 right-0 z-20 px-3 pb-2 flex items-end justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-black italic text-white text-xl leading-tight drop-shadow-lg"
                          style={{ fontFamily: "Georgia, serif", textShadow: "0 2px 12px rgba(0,0,0,1)" }}>
                          {customer.name.toUpperCase()}
                        </p>
                        <p className="text-[#aaa] text-[10px] mt-0.5">{customerMeta?.icon} {customerMeta?.label ?? customer.type}</p>
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold mt-1"
                          style={{ background: `${moodColor}18`, border: `1px solid ${moodColor}44`, color: moodColor }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: moodColor }} />
                          {moodLabel.toUpperCase()}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[9px] text-[#555] mb-0.5">Suspeita</p>
                        <p className="font-black text-base" style={{ color: moodColor }}>{suspicion}%</p>
                        <div className="flex gap-0.5 mt-1 justify-end">
                          {Array.from({ length: customer.patience }).map((_, i) => (
                            <span key={i} className="w-1 h-3 rounded-sm transition-colors duration-300"
                              style={{ background: i < customer.patience - customer.offersReceived ? "#22c55e" : "#1f1f1f" }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Dialogue box */}
              <div className="p-4 border-b border-[#141416] shrink-0">
                <div className="rounded-xl overflow-hidden" style={{ background: "#0d0d0f", border: "1px solid #1c1c1e", minHeight: "110px" }}>
                  <div className="px-4 py-2 border-b border-[#181818] flex items-center justify-between">
                    <span className="text-[10px] font-black tracking-[0.18em] text-[#3a3a3a] uppercase">
                      {customer ? `${customer.name} diz...` : "À espera de cliente..."}
                    </span>
                    {typedDialogue && !dialogueDone && (
                      <span className="flex gap-1">
                        <span className="w-1 h-1 rounded-full bg-[#333] animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1 h-1 rounded-full bg-[#333] animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1 h-1 rounded-full bg-[#333] animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    {typedDialogue ? (
                      <p className="text-white text-[14px] leading-relaxed font-mono">
                        &ldquo;{renderDialogueWithHighlights(typedDialogue, customer)}&rdquo;
                        {!dialogueDone && <span className="inline-block w-0.5 h-4 bg-white ml-0.5 align-middle animate-pulse" />}
                      </p>
                    ) : (phase === "idle" || (phase === "loading" && !customer)) ? (
                      <p className="text-[#252528] text-sm font-mono italic">Chama um cliente para começar a negociar...</p>
                    ) : (
                      <p className="text-[#252528] text-sm font-mono italic">A aguardar...</p>
                    )}
                  </div>
                </div>
              </div>

              {/* They Want card */}
              {customer && (
                <div className="px-4 py-3 border-b border-[#141416] shrink-0">
                  <p className="text-[9px] font-black tracking-[0.2em] text-[#333] uppercase mb-2">Pedido do Cliente:</p>
                  <div className="rounded-xl p-3" style={{ background: "#0d0d0f", border: "1px solid #1c1c1e" }}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: "#161618", border: "1px solid #222" }}>
                        {selectedDrug?.items.image_url
                          ? <img src={selectedDrug.items.image_url} className="w-7 h-7 object-contain" alt="" />
                          : <span className="text-xl">🌿</span>
                        }
                      </div>
                      <div className="flex-1">
                        <p className="font-black text-[14px]" style={{ color: "#4dd9ac" }}>
                          {customer.requestedDrugName.toUpperCase()}
                        </p>
                        {selectedDrug && selectedDrug.items.name.toLowerCase() !== customer.requestedDrugName.toLowerCase() && (
                          <p className="text-yellow-600 text-[10px] font-bold">⚠ produto diferente selecionado</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[9px] text-[#444] uppercase tracking-wider font-bold">Quantidade</p>
                        <p className="text-white font-black text-lg">{customer.requestedQty}g</p>
                      </div>
                    </div>
                    <div className="mt-2.5 pt-2.5 border-t border-[#1a1a1c] flex items-center justify-between">
                      <p className="text-[9px] text-[#444] uppercase tracking-wider font-bold">Gama de preço:</p>
                      <p className="font-black text-sm" style={{ color: "#4ade80" }}>
                        ${minExpected.toLocaleString()} – ${maxExpected.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Decision timer */}
                  {(phase === "customer" || phase === "counter") && (
                    <div className="mt-2">
                      <div className="h-0.5 bg-[#111] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-1000 ${timerSecs <= 10 ? "bg-red-600" : "bg-cyan-600"}`}
                          style={{ width: `${(timerSecs / maxTimerSecsRef.current) * 100}%` }} />
                      </div>
                      {timerSecs <= 10 && (
                        <p className="text-right text-[10px] text-red-500 danger-text mt-0.5 font-black">{timerSecs}s</p>
                      )}
                    </div>
                  )}

                  {/* Tip bar */}
                  <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-lg" style={{ background: "#0d0d0f", border: "1px solid #181818" }}>
                    <span className="text-[#333] text-[11px] shrink-0 mt-px">ⓘ</span>
                    <p className="text-[#3a3a3a] text-[11px] leading-relaxed">
                      {heat > 60
                        ? "Calor elevado — risco de detenção muito aumentado. Termina a sessão se possível."
                        : heat > 30
                        ? "Boa negociação constrói reputação. Más decisões aumentam o calor."
                        : "Bons negócios constroem a tua reputação. Mantém a calma."}
                    </p>
                  </div>
                </div>
              )}

              {/* Counter-offer */}
              {phase === "counter" && counterPrice != null && counterQty != null && (
                <div className="px-4 py-3 border-b border-[#141416] btn-reveal shrink-0">
                  <div className="rounded-xl p-4" style={{ background: "linear-gradient(135deg,rgba(78,52,10,0.5),rgba(14,14,16,0.9))", border: "1px solid #3a2800" }}>
                    <p className="text-yellow-600 font-black text-[10px] uppercase tracking-widest mb-2">↔ Contra-proposta</p>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-yellow-300 font-black text-2xl">${(counterPrice * counterQty).toLocaleString()}</p>
                      <p className="text-yellow-800 text-xs">${counterPrice}/g × {counterQty}g</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={acceptCounter}
                        className="py-2.5 rounded-lg font-black text-sm text-white transition-all hover:scale-105 active:scale-95"
                        style={{ background: "linear-gradient(135deg,#166534,#15803d)" }}>
                        ✅ Aceitar
                      </button>
                      <button onClick={() => { setPhase("customer"); startTimer(); addLog("↩", "Contra-proposta rejeitada", "Recusaste a proposta do cliente."); }}
                        className="py-2.5 rounded-lg border border-[#2a2a2a] font-bold text-sm text-[#888] hover:text-white transition-all hover:scale-105 active:scale-95"
                        style={{ background: "#111" }}>
                        ❌ Rejeitar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Deal accepted result */}
              {phase === "result" && lastOutcome === "accept" && (
                <div className="px-4 py-3 border-b border-[#141416] shrink-0">
                  <div className="rounded-xl p-5 text-center btn-reveal"
                    style={{ background: "linear-gradient(135deg,rgba(20,83,45,0.5),rgba(13,13,15,0.9))", border: "1px solid rgba(34,197,94,0.2)" }}>
                    <p className="text-green-400 font-black text-xs uppercase tracking-widest mb-1">✅ Negócio Fechado</p>
                    <p className="text-green-300 font-black text-4xl mb-1">${lastEarned.toLocaleString()}</p>
                    <p className="text-green-900 text-xs mb-4">dinheiro sujo gerado</p>
                    <button onClick={callNextCustomer}
                      className="px-8 py-2.5 rounded-xl font-black text-sm text-white transition-all hover:scale-105 active:scale-95"
                      style={{ background: "linear-gradient(135deg,#166534,#15803d)" }}>
                      Próximo Cliente →
                    </button>
                  </div>
                </div>
              )}

              {/* ── WHAT WILL YOU DO? — action buttons ── */}
              {phase === "customer" && dialogueDone && (
                <div className="px-4 py-3 btn-reveal shrink-0">
                  <p className="text-[9px] font-black tracking-[0.2em] text-[#333] uppercase mb-3">O Que Vai Fazer?</p>

                  {/* ── MOBILE: full-width list ── */}
                  <div className="flex flex-col gap-2 md:hidden">
                    {/* ACCEPT */}
                    <button
                      onClick={() => { if (!customer) return; setPricePerUnit(fairPrice); setQuantity(customer.requestedQty); submitOffer("offer", fairPrice, customer.requestedQty); }}
                      disabled={!selectedDrug}
                      className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl transition-all active:scale-95 disabled:opacity-30"
                      style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(34,197,94,0.14)" }}>
                        <span className="text-lg">🤝</span>
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-white font-black text-sm leading-tight">ACEITAR NEGÓCIO</p>
                        <p className="text-[#555] text-[11px] mt-0.5">Fechar o acordo por um preço justo.</p>
                      </div>
                      <p className="font-black text-sm shrink-0" style={{ color: "#4ade80" }}>${fairPrice.toLocaleString()}</p>
                      <span className="text-[#333] shrink-0">›</span>
                    </button>

                    {/* RAISE PRICE */}
                    <button
                      onClick={() => submitOffer("push", highPrice, quantity)}
                      disabled={!selectedDrug}
                      className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl transition-all active:scale-95 disabled:opacity-30"
                      style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.2)" }}>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(99,102,241,0.14)" }}>
                        <span className="text-lg">📈</span>
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-white font-black text-sm leading-tight">AUMENTAR PREÇO</p>
                        <p className="text-[#555] text-[11px] mt-0.5">Tentar ganhar mais.</p>
                      </div>
                      <span className="text-[#333] shrink-0">›</span>
                    </button>

                    {/* LOWER QTY */}
                    <button
                      onClick={() => submitOffer("offer", pricePerUnit, lessQty)}
                      disabled={!selectedDrug || quantity <= 1}
                      className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl transition-all active:scale-95 disabled:opacity-30"
                      style={{ background: "rgba(148,163,184,0.04)", border: "1px solid rgba(148,163,184,0.12)" }}>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(148,163,184,0.08)" }}>
                        <span className="text-lg">🎒</span>
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-white font-black text-sm leading-tight">REDUZIR QUANTIDADE</p>
                        <p className="text-[#555] text-[11px] mt-0.5">Oferecer menos.</p>
                      </div>
                      <span className="text-[#333] shrink-0">›</span>
                    </button>

                    {/* SWAP */}
                    <button
                      onClick={() => { if (nextDrug) { setSelectedDrug(nextDrug); setPricePerUnit(Math.round(nextDrug.items.base_price * 1.2)); setQuantity(Math.min(customer?.requestedQty ?? 5, nextDrug.quantity)); } }}
                      disabled={!nextDrug}
                      className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl transition-all active:scale-95 disabled:opacity-30"
                      style={{ background: "rgba(148,163,184,0.04)", border: "1px solid rgba(148,163,184,0.12)" }}>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(148,163,184,0.08)" }}>
                        <span className="text-lg">🔄</span>
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-white font-black text-sm leading-tight">TROCAR PRODUTO</p>
                        <p className="text-[#555] text-[11px] mt-0.5">Oferecer algo diferente.</p>
                      </div>
                      <span className="text-[#333] shrink-0">›</span>
                    </button>

                    {/* REJECT */}
                    <button
                      onClick={rejectCustomer}
                      className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl transition-all active:scale-95"
                      style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)" }}>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(239,68,68,0.12)" }}>
                        <span className="text-lg">✖</span>
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-white font-black text-sm leading-tight">RECUSAR</p>
                        <p className="text-[11px] mt-0.5" style={{ color: "#f87171" }}>Dispensar o cliente.</p>
                      </div>
                      <span className="text-[#333] shrink-0">›</span>
                    </button>
                  </div>

                  {/* ── DESKTOP/TABLET: original 5-column grid ── */}
                  <div className="hidden md:grid grid-cols-5 gap-2">

                    {/* ACCEPT DEAL */}
                    <button
                      onClick={() => {
                        if (!customer) return;
                        setPricePerUnit(fairPrice);
                        setQuantity(customer.requestedQty);
                        submitOffer("offer", fairPrice, customer.requestedQty);
                      }}
                      disabled={!selectedDrug}
                      className="flex flex-col items-center gap-2 py-4 px-1 rounded-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-30"
                      style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.18)" }}>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center"
                        style={{ background: "rgba(34,197,94,0.14)" }}>
                        <span className="text-lg">🤝</span>
                      </div>
                      <div className="text-center">
                        <p className="text-white font-black text-[10px] leading-tight">ACEITAR</p>
                        <p className="font-black text-[11px] mt-0.5" style={{ color: "#4ade80" }}>${fairPrice.toLocaleString()}</p>
                      </div>
                    </button>

                    {/* RAISE PRICE */}
                    <button
                      onClick={() => submitOffer("push", highPrice, quantity)}
                      disabled={!selectedDrug}
                      className="flex flex-col items-center gap-2 py-4 px-1 rounded-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-30"
                      style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.18)" }}>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center"
                        style={{ background: "rgba(99,102,241,0.14)" }}>
                        <span className="text-lg">📈</span>
                      </div>
                      <div className="text-center">
                        <p className="text-white font-black text-[10px] leading-tight">SUBIR PREÇO</p>
                        <p className="text-[10px] mt-0.5" style={{ color: "#818cf8" }}>Pedir mais</p>
                      </div>
                    </button>

                    {/* LOWER QUANTITY */}
                    <button
                      onClick={() => submitOffer("offer", pricePerUnit, lessQty)}
                      disabled={!selectedDrug || quantity <= 1}
                      className="flex flex-col items-center gap-2 py-4 px-1 rounded-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-30"
                      style={{ background: "rgba(148,163,184,0.04)", border: "1px solid rgba(148,163,184,0.1)" }}>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center"
                        style={{ background: "rgba(148,163,184,0.08)" }}>
                        <span className="text-lg">🎒</span>
                      </div>
                      <div className="text-center">
                        <p className="text-white font-black text-[10px] leading-tight">MENOS QTD</p>
                        <p className="text-[10px] mt-0.5 text-[#555]">Oferecer menos</p>
                      </div>
                    </button>

                    {/* SWAP PRODUCT */}
                    <button
                      onClick={() => {
                        if (nextDrug) {
                          setSelectedDrug(nextDrug);
                          setPricePerUnit(Math.round(nextDrug.items.base_price * 1.2));
                          setQuantity(Math.min(customer?.requestedQty ?? 5, nextDrug.quantity));
                        }
                      }}
                      disabled={!nextDrug}
                      className="flex flex-col items-center gap-2 py-4 px-1 rounded-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-30"
                      style={{ background: "rgba(148,163,184,0.04)", border: "1px solid rgba(148,163,184,0.1)" }}>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center"
                        style={{ background: "rgba(148,163,184,0.08)" }}>
                        <span className="text-lg">🔄</span>
                      </div>
                      <div className="text-center">
                        <p className="text-white font-black text-[10px] leading-tight">TROCAR</p>
                        <p className="text-[10px] mt-0.5 text-[#555] truncate max-w-full px-1">{nextDrug?.items.name ?? "—"}</p>
                      </div>
                    </button>

                    {/* REJECT */}
                    <button
                      onClick={rejectCustomer}
                      className="flex flex-col items-center gap-2 py-4 px-1 rounded-xl transition-all hover:scale-105 active:scale-95"
                      style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)" }}>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center"
                        style={{ background: "rgba(239,68,68,0.12)" }}>
                        <span className="text-lg">✖</span>
                      </div>
                      <div className="text-center">
                        <p className="text-white font-black text-[10px] leading-tight">REJEITAR</p>
                        <p className="text-[10px] mt-0.5" style={{ color: "#f87171" }}>Mandar embora</p>
                      </div>
                    </button>
                  </div>

                  {selectedDrug && (
                    <p className="mt-3 text-[10px] text-[#252528] text-center">
                      Produto: <span className="text-[#3a3a3a]">{selectedDrug.items.name}</span> · {selectedDrug.quantity}g disponível
                    </p>
                  )}
                </div>
              )}

              {/* ── IDLE — call next ── */}
              {phase === "idle" && (
                <div className="px-4 py-3 shrink-0">
                  <button onClick={callNextCustomer} disabled={noDrugs || !!inJail}
                    className="w-full py-4 rounded-xl font-black text-sm text-white transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{ background: "linear-gradient(135deg,#166534,#15803d)", boxShadow: "0 0 20px rgba(22,101,52,0.25)" }}>
                    👤 Chamar Próximo Cliente
                  </button>
                </div>
              )}

              {/* ── Spinners ── */}
              {(phase === "negotiating" || (phase === "loading" && session)) && (
                <div className="px-4 py-3 shrink-0">
                  <div className="rounded-xl border border-[#141416] bg-[#0d0d0f] p-6 text-center">
                    <div className={`w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-2 ${phase === "negotiating" ? "border-cyan-500" : "border-green-500"}`} />
                    <p className="text-[#333] text-sm">{phase === "negotiating" ? "A negociar..." : "A carregar..."}</p>
                  </div>
                </div>
              )}

              {/* ── MOBILE log preview ── */}
              {log.length > 0 && (
                <div className="lg:hidden border-t border-[#161618] shrink-0" style={{ background: "#0c0c0e" }}>
                  <div className="px-4 py-2.5 flex items-center justify-between">
                    <span className="text-[9px] font-black tracking-[0.15em] text-white uppercase">Registo da Rua</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500" style={{ boxShadow: "0 0 6px #ef4444" }} />
                  </div>
                  <div>
                    {log.slice(-4).map((entry, i) => (
                      <div key={i} className="px-4 py-2 flex items-start gap-2.5 border-t border-[#0f0f11]">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px]"
                          style={{ background: "#17171a" }}>
                          {entry.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <p className="text-white text-[10px] font-bold leading-tight truncate">{entry.title}</p>
                            <span className="text-[#252528] text-[9px] shrink-0 tabular-nums ml-auto">{entry.time}</span>
                          </div>
                          <p className="text-[#484848] text-[10px] leading-snug mt-0.5 break-words">{entry.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── RIGHT — STREET LOG ───────────────────────────────────────── */}
            <div className="hidden lg:flex lg:w-[260px] xl:w-[290px] shrink-0 border-l border-[#161618] flex-col"
              style={{ background: "#0c0c0e" }}>
              {/* Header */}
              <div className="px-4 py-3 border-b border-[#161618] flex items-center gap-2.5 shrink-0">
                <span className="text-[11px] font-black tracking-[0.15em] text-white uppercase">Registo da Rua</span>
                <div className="w-2 h-2 rounded-full bg-red-500 ml-auto"
                  style={{ boxShadow: "0 0 6px #ef4444", animation: "heatPulse 2s ease-in-out infinite" }} />
              </div>

              {/* Log entries — capped at 14 rows, no scroll */}
              <div className="flex-1 overflow-hidden py-1">
                {log.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-[#1e1e1e] text-xs italic">Mais eventos vão aparecer aqui...</p>
                  </div>
                ) : (
                  log.slice(-14).map((entry, i) => (
                    <div key={i}
                      className="log-entry px-3 py-2 hover:bg-[#111214] transition-colors"
                      style={{ borderBottom: "1px solid #0f0f11" }}>
                      <div className="flex items-start gap-2">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[11px]"
                          style={{ background: "#17171a" }}>
                          {entry.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-white text-[11px] font-bold leading-tight truncate">{entry.title}</p>
                            <span className="text-[#252528] text-[9px] shrink-0 tabular-nums">{entry.time}</span>
                          </div>
                          <p className="text-[#484848] text-[10px] leading-snug mt-0.5 break-words">{entry.desc}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                {log.length > 0 && log.length < 4 && (
                  <p className="text-[#1e1e1e] text-[10px] italic text-center px-4 py-2">Mais eventos vão aparecer aqui...</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══ BOTTOM STATS BAR ═════════════════════════════════════════════ */}
        {session && phase !== "zone_select" && phase !== "session_end" && phase !== "arrested" && (
          <div className="relative z-20 shrink-0 border-t border-[#161618] px-3 sm:px-5 py-2.5 flex items-center gap-3 sm:gap-5 overflow-x-auto"
            style={{ background: "rgba(10,10,11,0.98)", backdropFilter: "blur(12px)" }}>

            {/* Cash */}
            <div className="flex items-center gap-2 shrink-0">
              <span>💰</span>
              <div>
                <p className="text-[9px] text-[#333] uppercase tracking-wider font-bold leading-none mb-0.5">Dinheiro Sujo</p>
                <p className="text-white font-black text-[13px] leading-none">${(player?.dirty_cash ?? 0).toLocaleString()}</p>
              </div>
            </div>

            <div className="w-px h-5 bg-[#1a1a1a] shrink-0" />

            {/* Inventory */}
            <div className="flex items-center gap-2 shrink-0">
              <span>📦</span>
              <div>
                <p className="text-[9px] text-[#333] uppercase tracking-wider font-bold leading-none mb-0.5">Stock</p>
                <p className="text-white font-black text-[13px] leading-none">{totalInventoryKg.toFixed(2)} kg</p>
              </div>
            </div>

            <div className="w-px h-5 bg-[#1a1a1a] shrink-0" />

            {/* Reputation */}
            <div className="flex items-center gap-2 shrink-0">
              <span>👑</span>
              <div>
                <p className="text-[9px] text-[#333] uppercase tracking-wider font-bold leading-none mb-0.5">Reputação</p>
                <div className="flex items-center gap-2">
                  <p className="text-white font-black text-[13px] leading-none">{repLabel}</p>
                  <div className="w-14 h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${repPct}%`, background: "linear-gradient(90deg,#22c55e,#4ade80)" }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="w-px h-5 bg-[#1a1a1a] shrink-0" />

            {/* Sessions today */}
            <div className="flex items-center gap-2 shrink-0">
              <span>👥</span>
              <div>
                <p className="text-[9px] text-[#333] uppercase tracking-wider font-bold leading-none mb-0.5">Sessões Hoje</p>
                <p className="text-white font-black text-[13px] leading-none">{sessionsToday}</p>
              </div>
            </div>

            <div className="w-px h-5 bg-[#1a1a1a] shrink-0" />

            {/* Escapes */}
            <div className="flex items-center gap-2 shrink-0">
              <span>🏃</span>
              <div>
                <p className="text-[9px] text-[#333] uppercase tracking-wider font-bold leading-none mb-0.5">Fugas Bem-suc.</p>
                <p className="text-white font-black text-[13px] leading-none">{escapesSuccess}/{escapesTotal}</p>
              </div>
            </div>

            <div className="hidden sm:block flex-1" />

            {/* Session earnings */}
            <div className="text-right shrink-0">
              <p className="text-[9px] text-[#252528] uppercase tracking-wider font-bold leading-none mb-0.5">Ganho na Sessão</p>
              <p className="text-green-400 font-black text-[13px] leading-none">${sessionEarned.toLocaleString()}</p>
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

function reputationLabel(level: number): string {
  if (level >= 20) return "Lenda";
  if (level >= 15) return "Temido";
  if (level >= 10) return "Respeitado";
  if (level >= 5)  return "Conhecido";
  return "Iniciante";
}

function hintQuote(customer: Customer): string {
  const hints = [
    "Preciso de algo bom, não me faças perder tempo.",
    "Tens o que eu quero?",
    "Apressa-te, não tenho o dia todo.",
    "Faz um preço justo e fazemos negócio.",
    "Já sei o que quero. Não me dececiones.",
    "Sou cliente habitual. Trata-me bem.",
  ];
  const h = customer.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return hints[h % hints.length];
}

function renderDialogueWithHighlights(text: string, customer: Customer | null): React.ReactNode {
  if (!customer) return text;
  const drugName = customer.requestedDrugName;
  if (!drugName) return text;
  const escaped = drugName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped}|\\d+g)`, "gi"));
  return parts.map((part, i) => {
    if (part.toLowerCase() === drugName.toLowerCase()) {
      return <span key={i} style={{ color: "#4dd9ac", fontWeight: 900 }}>{part}</span>;
    }
    if (/^\d+g$/i.test(part)) {
      return <span key={i} style={{ color: "#86efac", fontWeight: 900 }}>{part}</span>;
    }
    return part;
  });
}

