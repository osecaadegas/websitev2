"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { CEToast } from "@/components/CEToast";

/* ── Types ── */
interface LootItem {
  item_id: string;
  item_name: string;
  quantity: number;
  unit_value: number;
  category: string;
  rarity: string;
  image_url?: string | null;
}

interface PlaneCrash {
  id: string;
  week_number: number;
  week_year: number;
  scheduled_at: string;
  active_until: string;
  location_name: string;
  info_cost: number;
  loot: LootItem[];
  total_loot_value: number;
  status: "upcoming" | "active" | "expired";
}

interface Interaction {
  crash_id: string;
  info_purchased: boolean;
  scraped: boolean;
  items_received: LootItem[] | null;
}

interface Player {
  id: string;
  dirty_cash: number;
  in_jail: boolean;
  hp: number;
}

/* ── Helpers ── */
const RARITY: Record<string, { color: string; label: string }> = {
  common:    { color: "#888",    label: "Comum" },
  rare:      { color: "#3b82f6", label: "Raro" },
  epic:      { color: "#a855f7", label: "Épico" },
  legendary: { color: "#f59e0b", label: "Lendário" },
};

function fmt(n: number) {
  return n.toLocaleString("pt-PT");
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "00:00:00";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-PT", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/* ── Countdown hook ── */
function useCountdown(targetDate: string) {
  const [remaining, setRemaining] = useState(() => Math.max(0, new Date(targetDate).getTime() - Date.now()));
  useEffect(() => {
    const target = new Date(targetDate).getTime();
    const tick = () => setRemaining(Math.max(0, target - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);
  return remaining;
}

/* ── ScrapeResultModal ── */
function ScrapeResultModal({ items, totalValue, onClose }: { items: LootItem[]; totalValue: number; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#0e0e0e] border border-orange-700/60 rounded-2xl p-6 max-w-md w-full shadow-2xl shadow-orange-900/30"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-5">
          <div className="text-5xl mb-3">✈️</div>
          <h2 className="text-xl font-black text-white">Saque Completo!</h2>
          <p className="text-[#888] text-sm mt-1">Mercadoria encontrada nos destroços</p>
        </div>

        <div className="space-y-2 mb-5 max-h-64 overflow-y-auto">
          {items.map((item, i) => {
            const rar = RARITY[item.rarity] ?? RARITY.common;
            return (
              <div key={i} className="flex items-center gap-3 bg-[#141414] rounded-xl px-3 py-2.5 border border-[#222]">
                {item.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image_url} alt={item.item_name} className="w-8 h-8 object-contain flex-shrink-0 rounded" />
                ) : (
                  <div className="w-8 h-8 rounded bg-[#1a1a1a] flex items-center justify-center text-base flex-shrink-0">
                    {item.category === "drug" ? "💊" : "⭐"}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{item.item_name}</p>
                  <p className="text-xs" style={{ color: rar.color }}>{rar.label}</p>
                </div>
                <div className="text-right">
                  <p className="text-white font-black text-sm">×{item.quantity}</p>
                  <p className="text-[#555] text-xs">💵{fmt(item.unit_value * item.quantity)}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between bg-[#0a0a0a] rounded-xl px-4 py-3 mb-4 border border-[#1e1e1e]">
          <span className="text-[#888] text-sm">Valor total</span>
          <span className="text-green-400 font-black text-lg">💵 {fmt(totalValue)}</span>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-orange-700 hover:bg-orange-600 text-white font-bold text-sm transition-colors"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}

/* ── Crash Card ── */
function CrashCard({
  crash,
  interaction,
  player,
  processing,
  onBuyInfo,
  onScrape,
  onRefresh,
}: {
  crash: PlaneCrash;
  interaction: Interaction | undefined;
  player: Player;
  processing: boolean;
  onBuyInfo: (id: string) => Promise<void>;
  onScrape: (id: string) => Promise<void>;
  onRefresh: () => void;
}) {
  const isActive = crash.status === "active";
  const isUpcoming = crash.status === "upcoming";
  const isExpired = crash.status === "expired";

  const countdownTarget = isActive ? crash.active_until : crash.scheduled_at;
  const remaining = useCountdown(countdownTarget);

  const infoBought = interaction?.info_purchased ?? false;
  const scraped = interaction?.scraped ?? false;
  const canAfford = player.dirty_cash >= crash.info_cost;
  const canAct = !player.in_jail && player.hp > 0;

  const notifiedRef = useRef(false);
  useEffect(() => {
    if (isActive && remaining === 0 && !notifiedRef.current) {
      notifiedRef.current = true;
      setTimeout(onRefresh, 2000);
    }
  }, [isActive, remaining, onRefresh]);

  return (
    <div
      className={`relative rounded-2xl border overflow-hidden transition-all ${
        isActive
          ? "bg-gradient-to-br from-[#1a0a00] to-[#0e0e0e] border-orange-700/70 shadow-xl shadow-orange-900/20"
          : isUpcoming
          ? "bg-[#0e0e0e] border-[#222]"
          : "bg-[#0a0a0a] border-[#1a1a1a] opacity-50"
      }`}
    >
      {isActive && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500" />
          </span>
          <span className="text-orange-400 text-xs font-bold uppercase tracking-widest">Ativo</span>
        </div>
      )}

      <div className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className={`text-3xl flex-shrink-0 mt-0.5 ${isExpired ? "grayscale" : ""}`}>✈️</div>
          <div className="flex-1 min-w-0">
            <h3 className={`font-black text-base ${isExpired ? "text-[#555]" : "text-white"}`}>
              {isActive && infoBought
                ? crash.location_name
                : isActive
                ? "Localização Desconhecida"
                : isUpcoming
                ? "Localização Classificada"
                : crash.location_name}
            </h3>
            <p className={`text-xs mt-0.5 ${isExpired ? "text-[#333]" : "text-[#666]"}`}>
              {isActive
                ? `Acidente em ${formatDate(crash.scheduled_at)}`
                : isUpcoming
                ? `Previsto para ${formatDate(crash.scheduled_at)}`
                : `Ocorreu a ${formatDate(crash.scheduled_at)} · Expirou`}
            </p>
          </div>
        </div>

        {(isActive || isUpcoming) && (
          <div className={`flex items-center justify-between rounded-xl px-4 py-2.5 mb-4 ${isActive ? "bg-orange-900/20 border border-orange-800/40" : "bg-[#111] border border-[#1e1e1e]"}`}>
            <span className={`text-xs font-semibold uppercase tracking-widest ${isActive ? "text-orange-400" : "text-[#555]"}`}>
              {isActive ? "⏱ Janela expira em" : "⏳ Acidente em"}
            </span>
            <span className={`font-black text-lg tabular-nums ${isActive ? "text-orange-300" : "text-[#444]"}`}>
              {formatCountdown(remaining)}
            </span>
          </div>
        )}

        {!isExpired && (
          <div className="flex items-center justify-between mb-4 text-sm">
            <span className="text-[#666]">Custo das informações</span>
            <span className={`font-bold ${canAfford ? "text-yellow-400" : "text-red-400"}`}>
              💵 {fmt(crash.info_cost)} sujo
            </span>
          </div>
        )}

        {(infoBought || isExpired) && crash.loot.length > 0 && (
          <div className="mb-4">
            <p className="text-[10px] uppercase tracking-widest text-[#555] mb-2 font-semibold">Carga</p>
            <div className="space-y-1">
              {crash.loot.map((item, i) => {
                const rar = RARITY[item.rarity] ?? RARITY.common;
                return (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span>{item.category === "drug" ? "💊" : "⭐"}</span>
                      <span style={{ color: rar.color }} className="font-medium">{item.item_name}</span>
                    </div>
                    <span className="text-[#666]">×{item.quantity} · 💵{fmt(item.unit_value * item.quantity)}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 pt-2 border-t border-[#1e1e1e] flex justify-between text-xs">
              <span className="text-[#555]">Valor estimado</span>
              <span className="text-green-400 font-bold">💵 {fmt(crash.total_loot_value)}</span>
            </div>
          </div>
        )}

        {isActive && !infoBought && (
          <div className="mb-4 px-3 py-2.5 rounded-xl bg-[#111] border border-[#1e1e1e]">
            <p className="text-[#555] text-xs text-center">
              🔒 Carga desconhecida · Compra as informações para ver o conteúdo
            </p>
            <p className="text-[#444] text-xs text-center mt-1">
              Valor estimado: 💵 {fmt(Math.floor(crash.total_loot_value * 0.8))}–{fmt(Math.floor(crash.total_loot_value * 1.2))}
            </p>
          </div>
        )}

        {scraped && (
          <div className="mb-4 px-3 py-2.5 rounded-xl bg-green-900/10 border border-green-800/40">
            <p className="text-green-400 text-xs font-bold text-center">✓ Saqueado com sucesso</p>
          </div>
        )}

        {isActive && !scraped && canAct && (
          <div className="space-y-2">
            {!infoBought && (
              <button
                disabled={processing || !canAfford}
                onClick={() => onBuyInfo(crash.id)}
                className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all ${
                  processing
                    ? "bg-[#222] text-[#555] cursor-wait"
                    : canAfford
                    ? "bg-gradient-to-r from-yellow-700 to-yellow-600 hover:from-yellow-600 hover:to-yellow-500 text-white shadow-md shadow-yellow-900/30"
                    : "bg-[#1a1a1a] text-[#444] cursor-not-allowed"
                }`}
              >
                {processing ? "A processar..." : canAfford ? `🕵️ Comprar Informações · 💵${fmt(crash.info_cost)}` : "💵 Dinheiro sujo insuficiente"}
              </button>
            )}
            {infoBought && (
              <button
                disabled={processing}
                onClick={() => onScrape(crash.id)}
                className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all ${
                  processing
                    ? "bg-[#222] text-[#555] cursor-wait"
                    : "bg-gradient-to-r from-orange-700 to-red-700 hover:from-orange-600 hover:to-red-600 text-white shadow-md shadow-red-900/30"
                }`}
              >
                {processing ? "A saquear..." : "✈️ Saquear Destroços"}
              </button>
            )}
          </div>
        )}

        {isActive && !scraped && !canAct && (
          <p className="text-center text-xs text-red-400 font-semibold">
            {player.in_jail ? "🚔 Estás na prisão" : "🏥 Estás no hospital"}
          </p>
        )}

        {isUpcoming && (
          <div className="text-center py-1">
            <p className="text-[#444] text-xs">Aguarda o acidente para poder agir</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function AcidenteDeAviaoPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [crashes, setCrashes] = useState<PlaneCrash[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [player, setPlayer] = useState<Player | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [scrapeResult, setScrapeResult] = useState<{ items: LootItem[]; totalValue: number } | null>(null);
  const [showExpired, setShowExpired] = useState(false);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 5000);
  };

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/crime-empire/plane-crash");
    if (!res.ok) return;
    const data = await res.json();
    setCrashes(data.crashes || []);
    setInteractions(data.interactions || []);
    setPlayer(data.player || null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) { router.push("/"); return; }
    fetchData();
  }, [user, fetchData, router]);

  const getInteraction = (crashId: string) =>
    interactions.find((i) => i.crash_id === crashId);

  const handleBuyInfo = async (crashId: string) => {
    setProcessing(crashId);
    try {
      const res = await fetch("/api/crime-empire/plane-crash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "buy_info", crashId }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Erro", false);
      } else {
        showToast(`📍 Localização: ${data.location}`, true);
        await fetchData();
      }
    } finally {
      setProcessing(null);
    }
  };

  const handleScrape = async (crashId: string) => {
    setProcessing(crashId);
    try {
      const res = await fetch("/api/crime-empire/plane-crash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scrape", crashId }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Erro", false);
      } else {
        setScrapeResult({ items: data.items_received, totalValue: data.total_value });
        await fetchData();
      }
    } finally {
      setProcessing(null);
    }
  };

  const activeCrashes = crashes.filter((c) => c.status === "active");
  const upcomingCrashes = crashes.filter((c) => c.status === "upcoming");
  const expiredCrashes = crashes.filter((c) => c.status === "expired");

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh] text-white">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse">✈️</div>
          <p className="text-[#888]">A verificar relatórios de acidentes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 text-white py-10 px-4 md:px-8">
      {toast && <CEToast msg={toast.msg} ok={toast.ok} />}
      {scrapeResult && (
        <ScrapeResultModal
          items={scrapeResult.items}
          totalValue={scrapeResult.totalValue}
          onClose={() => setScrapeResult(null)}
        />
      )}

      <div className="max-w-3xl mx-auto">
        <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
              ✈️ Acidente de Avião
            </h1>
            <p className="text-[#666] mt-1 text-sm max-w-md">
              Aviões carregados de mercadoria do cartel caem regularmente. Paga por informações e saqueia os destroços antes que a janela feche.
            </p>
          </div>
          {player && (
            <div className="bg-[#121212] border border-[#222] rounded-xl px-4 py-2 text-center min-w-[140px] flex-shrink-0">
              <p className="text-xs text-[#666] uppercase tracking-wider mb-0.5">Dinheiro Sujo</p>
              <p className="font-black text-yellow-400">💵 {fmt(player.dirty_cash)}</p>
            </div>
          )}
        </div>

        {player?.in_jail && (
          <div className="mb-6 p-4 rounded-xl bg-yellow-900/20 border border-yellow-700 text-yellow-400 font-semibold text-sm">
            🚔 Estás na prisão. Não podes interagir com acidentes.
          </div>
        )}
        {player && player.hp <= 0 && !player.in_jail && (
          <div className="mb-6 p-4 rounded-xl bg-red-900/20 border border-red-700 text-red-400 font-semibold text-sm">
            🏥 Estás no hospital. Vai ao Hospital para te curar.
          </div>
        )}

        {activeCrashes.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
              </span>
              <h2 className="text-sm font-bold uppercase tracking-widest text-orange-400">Acidentes Ativos</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {activeCrashes.map((crash) => (
                <CrashCard
                  key={crash.id}
                  crash={crash}
                  interaction={getInteraction(crash.id)}
                  player={player!}
                  processing={processing === crash.id}
                  onBuyInfo={handleBuyInfo}
                  onScrape={handleScrape}
                  onRefresh={fetchData}
                />
              ))}
            </div>
          </section>
        )}

        {activeCrashes.length === 0 && (
          <div className="mb-8 p-6 rounded-2xl bg-[#0e0e0e] border border-[#1e1e1e] text-center">
            <p className="text-4xl mb-3">🌙</p>
            <p className="text-white font-bold">Nenhum acidente ativo de momento</p>
            <p className="text-[#555] text-sm mt-1">Aguarda o próximo evento abaixo</p>
          </div>
        )}

        {upcomingCrashes.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-bold uppercase tracking-widest text-[#555] mb-3">⏳ Próximos Acidentes</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {upcomingCrashes.map((crash) => (
                <CrashCard
                  key={crash.id}
                  crash={crash}
                  interaction={getInteraction(crash.id)}
                  player={player!}
                  processing={processing === crash.id}
                  onBuyInfo={handleBuyInfo}
                  onScrape={handleScrape}
                  onRefresh={fetchData}
                />
              ))}
            </div>
          </section>
        )}

        {expiredCrashes.length > 0 && (
          <section>
            <button
              onClick={() => setShowExpired((v) => !v)}
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#444] hover:text-[#666] transition-colors mb-3"
            >
              <span>{showExpired ? "▾" : "▸"}</span>
              Acidentes Expirados ({expiredCrashes.length})
            </button>
            {showExpired && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {expiredCrashes.map((crash) => (
                  <CrashCard
                    key={crash.id}
                    crash={crash}
                    interaction={getInteraction(crash.id)}
                    player={player!}
                    processing={processing === crash.id}
                    onBuyInfo={handleBuyInfo}
                    onScrape={handleScrape}
                    onRefresh={fetchData}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        <div className="mt-10 p-4 rounded-xl bg-[#0e0e0e] border border-[#1a1a1a] text-xs text-[#444] space-y-1">
          <p>🔄 3 acidentes por semana — dias e horas completamente aleatórios</p>
          <p>⏱ Cada acidente fica ativo durante <strong className="text-[#555]">6 horas</strong> após o impacto</p>
          <p>💊 Carga garantida com valor superior ao custo das informações</p>
          <p>🔐 Cada jogador saqueia de forma independente — não há competição</p>
        </div>
      </div>
    </div>
  );
}
