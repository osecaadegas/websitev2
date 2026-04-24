"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { CEToast } from "@/components/CEToast";
import RaidEscape from "@/components/crime-empire/raid/RaidEscape";
import { HEAT_STAGE_STYLE, CUSTOMER_TYPE_META, type HeatStage, type CustomerType } from "@/lib/street-defs";

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Decision Timer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const DECISION_SECS = 30;

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function StreetsPage() {
  const { user } = useAuth();
  const router = useRouter();

  // â”€â”€ Server data
  const [drugs, setDrugs] = useState<DrugItem[]>([]);
  const [player, setPlayer] = useState<PlayerInfo | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);

  // â”€â”€ Session state
  const [session, setSession] = useState<Session | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [greeting, setGreeting] = useState("");
  const [dialogue, setDialogue] = useState("");
  const [lastOutcome, setLastOutcome] = useState<string | null>(null);
  const [lastEarned, setLastEarned] = useState<number>(0);
  const [sessionEarned, setSessionEarned] = useState(0);
  const [sessionDeals, setSessionDeals] = useState(0);

  // â”€â”€ Player controls
  const [selectedDrug, setSelectedDrug] = useState<DrugItem | null>(null);
  const [pricePerUnit, setPricePerUnit] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [counterPrice, setCounterPrice] = useState<number | null>(null);
  const [counterQty, setCounterQty] = useState<number | null>(null);

  // â”€â”€ Heat / suspicion
  const [heat, setHeat] = useState(0);
  const [suspicion, setSuspicion] = useState(0);
  const [heatStage, setHeatStage] = useState<HeatStage>("safe");

  // â”€â”€ Timer
  const [timerSecs, setTimerSecs] = useState(DECISION_SECS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // â”€â”€ Arrest escape
  const [arrestEscape, setArrestEscape] = useState<{ token: string; jailMinutes: number } | null>(null);

  // â”€â”€ Log
  const [log, setLog] = useState<LogEntry[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  // â”€â”€ Toast
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  // â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
          // Time's up â€” auto rush
          stopTimer();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, [stopTimer]);

  // â”€â”€â”€ Fetch initial data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€â”€ Actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async function startSession(zoneId: string) {
    setPhase("loading");
    const res = await fetch("/api/crime-empire/streets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start_session", zoneId }),
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || "Erro", false); setPhase("zone_select"); return; }
    setSession(data.session);
    setHeat(0);
    setHeatStage("safe");
    setSessionEarned(0);
    setSessionDeals(0);
    setLog([]);
    addLog(`ðŸ™ï¸ SessÃ£o iniciada em ${zones.find(z => z.id === zoneId)?.name ?? zoneId}`, "text-cyan-400");
    setPhase("idle");
  }

  async function callNextCustomer() {
    if (!session) return;
    setPhase("loading");
    setDialogue("");
    setLastOutcome(null);
    setSuspicion(0);

    const res = await fetch("/api/crime-empire/streets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "next_customer", sessionId: session.id }),
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || "Erro", false); setPhase("idle"); return; }

    setCustomer({ ...data.customer, offersReceived: 0, suspicion: 0 });
    setGreeting(data.greeting);
    setDialogue(data.greeting);
    setSession((s) => s ? { ...s, heat: data.session.heat } : s);
    setHeat(data.session.heat);
    setHeatStage(heatStageFor(data.session.heat));
    setPhase("customer");
    startTimer();
    addLog(`ðŸ‘¤ ${data.customer.name} (${CUSTOMER_TYPE_META[data.customer.type as CustomerType]?.label ?? data.customer.type}) aproximou-se`, "text-yellow-300");
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
    setDialogue(data.dialogue ?? "");
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
    setDialogue(data.dialogue ?? "");
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
    addLog(`â© Ignoraste ${customer?.name}`, "text-gray-500");
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
    addLog("ðŸšª SaÃ­ste da rua", "text-gray-400");
  }

  async function handleOutcome(data: any) {
    const outcome = data.outcome;
    setLastOutcome(outcome);

    if (outcome === "accept") {
      const earned = data.earned ?? 0;
      setLastEarned(earned);
      setSessionEarned((s) => s + earned);
      setSessionDeals((s) => s + 1);
      addLog(`âœ… ${customer?.name} aceitou â€” +$${earned.toLocaleString()} sujos`, "text-green-400");
      setCustomer(null);
      setPhase("result");
      await fetchDrugs();
    } else if (outcome === "counter") {
      setCounterPrice(data.counterPrice ?? null);
      setCounterQty(data.counterQty ?? null);
      addLog(`â†”ï¸ ${customer?.name} contra-propÃ´s $${data.counterPrice}/u Ã— ${data.counterQty}g`, "text-yellow-400");
      setPhase("counter");
      startTimer();
    } else if (outcome === "reject") {
      addLog(`âŒ ${customer?.name} recusou a oferta`, "text-orange-400");
      setPhase("customer");
      startTimer();
    } else if (outcome === "hostile") {
      addLog(`âš¡ ${customer?.name} ficou hostil e foi embora`, "text-red-400");
      setCustomer(null);
      setPhase("idle");
      await fetchDrugs();
    } else if (outcome === "snitch") {
      addLog(`ðŸš¨ ${customer?.name} delatou-te! Calor disparou!`, "text-red-500");
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
      addLog("ðŸš” APANHADO! A polÃ­cia estÃ¡ aqui!", "text-red-600");
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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Render helpers
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const currentZone = session ? zones.find((z) => z.id === session.zone) : null;
  const heatStyle = HEAT_STAGE_STYLE[heatStage];
  const customerMeta = customer ? CUSTOMER_TYPE_META[customer.type] : null;

  const inJail = player?.in_jail;
  const noDrugs = drugs.length === 0;

  // â”€â”€â”€ Loading â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (phase === "loading" && !session && !player) {
    return (
      <div className="flex-1 flex items-center justify-center text-white">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#888]">A carregar...</p>
        </div>
      </div>
    );
  }

  // â”€â”€â”€ Arrest escape â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (phase === "arrested" && arrestEscape) {
    return (
      <div className="flex-1 text-white py-8 px-4">
        {toast && <CEToast msg={toast.msg} ok={toast.ok} />}
        <RaidEscape
          difficulty="high"
          cashAtRisk={0}
          onEscape={async () => {
            const token = arrestEscape.token;
            setArrestEscape(null);
            await fetch("/api/crime-empire/escape-attempt", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token, escaped: true }),
            });
            setPhase("zone_select");
            showToast("Escapaste!", true);
          }}
          onArrested={async () => {
            const token = arrestEscape.token;
            setArrestEscape(null);
            await fetch("/api/crime-empire/escape-attempt", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token, escaped: false }),
            });
            router.push("/jogos/crime-empire/jail");
          }}
        />
      </div>
    );
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Main layout
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  return (
    <div className="flex-1 text-white flex flex-col gap-0 min-h-screen bg-[#0a0a0a]">
      {toast && <CEToast msg={toast.msg} ok={toast.ok} />}

      {/* â”€â”€ TOP BAR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-[#1a1a1a] bg-[#0d0d0d]">
        <Link href="/jogos/crime-empire/dashboard" className="text-[#ff6a00] hover:text-[#ff8533] text-sm transition-colors">
          â† Voltar
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-xs text-[#666]">Nv.{player?.level}</span>
          <span className="text-xs text-green-400 font-semibold">${player?.dirty_cash?.toLocaleString() ?? 0} sujos</span>
          {currentZone && (
            <span className="text-xs text-cyan-400">{currentZone.icon} {currentZone.name}</span>
          )}
        </div>
      </div>

      {/* â”€â”€ HEAT BAR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {session && (
        <div className="px-4 md:px-6 pt-3 pb-1">
          <div className="flex items-center justify-between mb-1">
            <span className={`text-xs font-bold ${heatStyle.color}`}>
              ðŸŒ¡ï¸ CALOR: {heat}/100 â€” {heatStyle.label}
            </span>
            {currentZone && (
              <span className="text-xs text-[#555]">+{currentZone.heatPerDeal} por negÃ³cio</span>
            )}
          </div>
          <div className="h-3 bg-[#1a1a1a] rounded-full overflow-hidden border border-[#2a2a2a]">
            <div
              className={`h-full transition-all duration-700 rounded-full ${heatStyle.bg}`}
              style={{ width: `${heat}%` }}
            />
          </div>
        </div>
      )}

      {/* â”€â”€ JAIL BANNER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {inJail && player?.jail_release_at && (
        <div className="mx-4 md:mx-6 mt-3 p-3 rounded-xl bg-red-900/40 border border-red-600 text-red-300 text-sm">
          ðŸš” EstÃ¡s preso! SaÃ­da: {new Date(player.jail_release_at).toLocaleTimeString("pt-PT")}
          <Link href="/jogos/crime-empire/jail" className="ml-3 underline text-red-400 hover:text-red-300">Ir Ã  cela</Link>
        </div>
      )}

      {/* â”€â”€ ZONE SELECT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {(phase === "zone_select" || phase === "session_end") && (
        <div className="flex-1 px-4 md:px-8 py-8">
          {phase === "session_end" && (
            <div className="mb-6 p-5 rounded-2xl bg-green-900/30 border border-green-700 text-center">
              <p className="text-green-400 font-black text-2xl mb-1">SessÃ£o Terminada</p>
              <p className="text-green-300">
                {sessionDeals} negÃ³cios â€¢ <span className="font-black">${sessionEarned.toLocaleString()}</span> ganhos
              </p>
            </div>
          )}

          <h1 className="text-3xl font-black bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent mb-2">
            ðŸŒ¿ Ruas
          </h1>
          <p className="text-[#888] mb-6 text-sm">Escolhe uma zona para vender. Cada zona tem riscos e recompensas diferentes.</p>

          {inJail ? (
            <p className="text-red-400">NÃ£o podes iniciar uma sessÃ£o enquanto estÃ¡s preso.</p>
          ) : noDrugs ? (
            <div className="p-8 rounded-2xl bg-[#111] border border-[#222] text-center">
              <p className="text-4xl mb-3">ðŸŒ¿</p>
              <p className="text-[#888]">NÃ£o tens drogas no inventÃ¡rio.</p>
              <Link href="/jogos/crime-empire/black-market" className="inline-block mt-4 px-5 py-2 rounded-lg bg-green-700 hover:bg-green-600 text-sm font-semibold transition-colors">
                Ir ao Black Market
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
              {zones.map((zone) => {
                const locked = (player?.level ?? 1) < zone.unlockLevel;
                return (
                  <button
                    key={zone.id}
                    onClick={() => !locked && startSession(zone.id)}
                    disabled={locked || !!inJail}
                    className={`p-5 rounded-2xl border text-left transition-all ${
                      locked
                        ? "border-[#222] bg-[#0e0e0e] opacity-50 cursor-not-allowed"
                        : "border-[#2a2a2a] bg-[#111] hover:border-green-600 hover:bg-[#151515] active:scale-95"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{zone.icon}</span>
                      <span className="font-black text-white">{zone.name}</span>
                      {locked && <span className="ml-auto text-xs text-[#555]">Nv.{zone.unlockLevel}</span>}
                    </div>
                    <p className="text-xs text-[#777] mb-3">{zone.description}</p>
                    <div className="flex gap-3 text-xs">
                      <span className="text-green-400">+{Math.round((zone.rewardMult - 1) * 100)}% lucro</span>
                      <span className="text-yellow-400">+{zone.heatPerDeal} calor/deal</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* â”€â”€ ACTIVE SESSION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {session && phase !== "zone_select" && phase !== "session_end" && phase !== "arrested" && (
        <div className="flex-1 flex flex-col lg:flex-row gap-0 overflow-hidden">

          {/* LEFT â€” Customer card */}
          <div className="w-full lg:w-72 flex-shrink-0 border-b lg:border-b-0 lg:border-r border-[#1a1a1a] bg-[#0d0d0d] p-4 flex flex-col gap-3">
            <h2 className="text-xs font-bold text-[#555] uppercase tracking-widest">Cliente Atual</h2>

            {customer ? (
              <div className="rounded-2xl border border-[#222] bg-[#111] p-4 flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-[#1a1a1a] border border-[#333] flex items-center justify-center text-2xl">
                    {customerMeta?.icon ?? "ðŸ‘¤"}
                  </div>
                  <div>
                    <p className="font-black text-white">{customer.name}</p>
                    <p className={`text-xs font-semibold ${customerMeta?.color ?? "text-gray-400"}`}>
                      {customerMeta?.label ?? customer.type}
                    </p>
                  </div>
                </div>

                {/* Suspicion bar */}
                <div className="mb-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#666]">Suspeita</span>
                    <span className={suspicion >= 70 ? "text-red-400" : suspicion >= 40 ? "text-yellow-400" : "text-green-400"}>
                      {suspicion}%
                    </span>
                  </div>
                  <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        suspicion >= 70 ? "bg-red-500" : suspicion >= 40 ? "bg-yellow-500" : "bg-green-500"
                      }`}
                      style={{ width: `${suspicion}%` }}
                    />
                  </div>
                </div>

                {/* Patience */}
                <div className="flex justify-between text-xs text-[#666]">
                  <span>PaciÃªncia</span>
                  <span className="text-white">
                    {"â– ".repeat(Math.max(0, customer.patience - customer.offersReceived))}
                    {"â–¡".repeat(Math.min(customer.offersReceived, customer.patience))}
                  </span>
                </div>

                {/* Hint for high-level players */}
                {(player?.level ?? 1) >= 3 && (
                  <p className="mt-3 text-xs text-[#555] italic">{customerMeta?.hint}</p>
                )}
              </div>
            ) : (
              <div className="flex-1 rounded-2xl border border-dashed border-[#222] bg-[#0d0d0d] flex items-center justify-center p-6 text-center">
                <div>
                  <p className="text-3xl mb-2 opacity-30">ðŸ‘¤</p>
                  <p className="text-[#444] text-sm">Nenhum cliente no momento</p>
                </div>
              </div>
            )}

            {/* Session summary */}
            <div className="rounded-xl bg-[#111] border border-[#1a1a1a] p-3 text-xs">
              <p className="text-[#555] mb-1">SessÃ£o atual</p>
              <p className="text-white">{sessionDeals} negÃ³cios â€¢ <span className="text-green-400 font-bold">${sessionEarned.toLocaleString()}</span></p>
            </div>
          </div>

          {/* CENTER â€” Dialogue + Controls */}
          <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">

            {/* Dialogue box */}
            <div className="rounded-2xl border border-[#222] bg-[#0f0f0f] p-5 min-h-[80px] relative">
              {dialogue ? (
                <>
                  <p className="text-xs text-[#555] mb-1 font-semibold uppercase tracking-widest">
                    {customer ? customer.name : "Sistema"}
                  </p>
                  <p className="text-white text-base leading-relaxed italic">"{dialogue}"</p>
                </>
              ) : (
                <p className="text-[#444] text-sm italic">Chama o prÃ³ximo cliente para comeÃ§ar a negociar...</p>
              )}
            </div>

            {/* Last outcome badge */}
            {phase === "result" && lastOutcome === "accept" && (
              <div className="rounded-xl bg-green-900/30 border border-green-700 p-4 text-center animate-pulse">
                <p className="text-green-400 font-black text-xl">âœ… NEGÃ“CIO FEITO!</p>
                <p className="text-green-300 text-lg font-bold">+${lastEarned.toLocaleString()} sujos</p>
                <button
                  onClick={callNextCustomer}
                  className="mt-3 px-6 py-2 rounded-xl bg-green-700 hover:bg-green-600 text-white font-bold text-sm transition-all hover:scale-105"
                >
                  PrÃ³ximo Cliente â†’
                </button>
              </div>
            )}

            {/* Decision timer */}
            {(phase === "customer" || phase === "counter") && (
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#666]">Tempo de decisÃ£o</span>
                  <span className={timerSecs <= 10 ? "text-red-400 font-bold animate-pulse" : "text-[#888]"}>
                    {timerSecs}s
                  </span>
                </div>
                <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 rounded-full ${timerSecs <= 10 ? "bg-red-500" : "bg-cyan-500"}`}
                    style={{ width: `${(timerSecs / DECISION_SECS) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* COUNTER-OFFER panel */}
            {phase === "counter" && counterPrice != null && counterQty != null && (
              <div className="rounded-2xl border border-yellow-600/40 bg-yellow-900/20 p-5">
                <p className="text-yellow-400 font-black mb-2">â†”ï¸ Contra-Proposta</p>
                <p className="text-white mb-4">
                  {customer?.name} propÃµe{" "}
                  <span className="font-black text-yellow-300">${counterPrice}/g Ã— {counterQty}g</span>
                  {" "}= <span className="font-black text-yellow-400">${(counterPrice * counterQty).toLocaleString()}</span>
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={acceptCounter}
                    className="flex-1 py-2 rounded-xl bg-green-700 hover:bg-green-600 text-white font-bold text-sm transition-all hover:scale-105"
                  >
                    âœ… Aceitar
                  </button>
                  <button
                    onClick={() => { setPhase("customer"); startTimer(); addLog(`â†© Rejeitaste a contra-proposta de ${customer?.name}`, "text-orange-400"); }}
                    className="flex-1 py-2 rounded-xl bg-[#1e1e1e] hover:bg-[#2a2a2a] text-white font-bold text-sm border border-[#333] transition-all hover:scale-105"
                  >
                    âŒ Rejeitar
                  </button>
                </div>
              </div>
            )}

            {/* CONTROLS */}
            {(phase === "customer" || phase === "idle") && (
              <div className="rounded-2xl border border-[#222] bg-[#0f0f0f] p-5 space-y-4">
                <h3 className="text-xs text-[#555] font-bold uppercase tracking-widest">Oferta</h3>

                {/* Drug selector */}
                <div>
                  <label className="text-xs text-[#666] block mb-1">Produto</label>
                  <select
                    value={selectedDrug?.id ?? ""}
                    onChange={(e) => {
                      const d = drugs.find((x) => x.id === e.target.value);
                      if (d) setSelectedDrug(d);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-[#1a1a1a] border border-[#333] text-white text-sm focus:outline-none focus:border-green-500"
                    disabled={phase !== "customer"}
                  >
                    {drugs.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.items.name} â€” {d.quantity}g disponÃ­vel
                      </option>
                    ))}
                    {drugs.length === 0 && <option value="">Sem stock</option>}
                  </select>
                </div>

                {/* Price + Quantity */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#666] block mb-1">
                      PreÃ§o/g
                      {selectedDrug && (
                        <span className="text-[#444] ml-1">(base: ${selectedDrug.items.base_price})</span>
                      )}
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={pricePerUnit}
                      onChange={(e) => setPricePerUnit(Math.max(1, Number(e.target.value)))}
                      className="w-full px-3 py-2 rounded-xl bg-[#1a1a1a] border border-[#333] text-white text-sm focus:outline-none focus:border-green-500"
                      disabled={phase !== "customer"}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#666] block mb-1">
                      Quantidade (g)
                      {selectedDrug && <span className="text-[#444] ml-1">max {selectedDrug.quantity}</span>}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={selectedDrug?.quantity ?? 1}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Math.min(selectedDrug?.quantity ?? 1, Number(e.target.value))))}
                      className="w-full px-3 py-2 rounded-xl bg-[#1a1a1a] border border-[#333] text-white text-sm focus:outline-none focus:border-green-500"
                      disabled={phase !== "customer"}
                    />
                  </div>
                </div>

                {/* Total preview */}
                {selectedDrug && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[#666]">Total ofertado:</span>
                    <span className="text-white font-bold">${(pricePerUnit * quantity).toLocaleString()}</span>
                  </div>
                )}

                {/* Action buttons */}
                {phase === "customer" && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => submitOffer("offer")}
                      disabled={!selectedDrug || drugs.length === 0}
                      className="col-span-2 py-3 rounded-xl bg-green-700 hover:bg-green-600 text-white font-black text-base transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      ðŸ’° Fazer Oferta
                    </button>
                    <button
                      onClick={() => submitOffer("push")}
                      disabled={!selectedDrug || drugs.length === 0}
                      title="Aumenta o risco mas pode intimidar o cliente a aceitar"
                      className="py-2 rounded-xl bg-orange-700 hover:bg-orange-600 text-white font-bold text-sm transition-all hover:scale-105 disabled:opacity-40"
                    >
                      ðŸ’ª Push
                    </button>
                    <button
                      onClick={() => submitOffer("discount")}
                      disabled={!selectedDrug || drugs.length === 0}
                      title="Reduz suspeita, aumenta chance de aceitaÃ§Ã£o"
                      className="py-2 rounded-xl bg-blue-700 hover:bg-blue-600 text-white font-bold text-sm transition-all hover:scale-105 disabled:opacity-40"
                    >
                      ðŸŽ Desconto
                    </button>
                    <button
                      onClick={() => submitOffer("rush")}
                      disabled={!selectedDrug || drugs.length === 0}
                      title="Apressa o cliente â€” reduz paciÃªncia dele"
                      className="py-2 rounded-xl bg-purple-700 hover:bg-purple-600 text-white font-bold text-sm transition-all hover:scale-105 disabled:opacity-40"
                    >
                      âš¡ Rush
                    </button>
                    <button
                      onClick={rejectCustomer}
                      className="py-2 rounded-xl bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-[#333] text-[#888] font-semibold text-sm transition-all hover:scale-105"
                    >
                      â© Ignorar
                    </button>
                  </div>
                )}

                {/* Call next / idle state */}
                {phase === "idle" && (
                  <button
                    onClick={callNextCustomer}
                    disabled={noDrugs || !!inJail}
                    className="w-full py-3 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white font-black text-base transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ðŸ‘¤ Chamar PrÃ³ximo Cliente
                  </button>
                )}
              </div>
            )}

            {phase === "negotiating" && (
              <div className="rounded-xl border border-[#222] bg-[#0f0f0f] p-4 text-center">
                <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-[#888] text-sm">A negociar...</p>
              </div>
            )}

            {phase === "loading" && session && (
              <div className="rounded-xl border border-[#222] bg-[#0f0f0f] p-4 text-center">
                <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-[#888] text-sm">A carregar...</p>
              </div>
            )}

            {/* End session button */}
            {session && phase !== "negotiating" && phase !== "loading" && (
              <button
                onClick={endSession}
                className="w-full py-2 rounded-xl border border-red-800 bg-red-900/20 hover:bg-red-900/40 text-red-400 font-semibold text-sm transition-all"
              >
                ðŸšª Sair da Rua
              </button>
            )}
          </div>

          {/* RIGHT â€” Action log */}
          <div className="w-full lg:w-72 flex-shrink-0 border-t lg:border-t-0 lg:border-l border-[#1a1a1a] bg-[#0d0d0d] p-4 flex flex-col">
            <h2 className="text-xs font-bold text-[#555] uppercase tracking-widest mb-3">Registo</h2>
            <div
              ref={logRef}
              className="flex-1 overflow-y-auto space-y-1 max-h-[400px] lg:max-h-full pr-1"
              style={{ scrollbarWidth: "none" }}
            >
              {log.length === 0 && (
                <p className="text-[#333] text-xs italic">Sem actividade ainda...</p>
              )}
              {log.map((entry, i) => (
                <div key={i} className="text-xs">
                  <span className="text-[#444] mr-1">{entry.time}</span>
                  <span className={entry.color}>{entry.text}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

// â”€â”€â”€ Util â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function heatStageFor(heat: number): HeatStage {
  if (heat >= 100) return "busted";
  if (heat >= 70)  return "danger";
  if (heat >= 40)  return "warning";
  return "safe";
}

