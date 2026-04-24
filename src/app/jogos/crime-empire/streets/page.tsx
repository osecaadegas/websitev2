"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Image from "next/image";
import Link from "next/link";
import { CEToast } from "@/components/CEToast";
import RaidEscape from "@/components/crime-empire/raid/RaidEscape";

interface DrugItem {
  id: string;
  item_id: string;
  quantity: number;
  items: {
    id: string;
    name: string;
    description: string;
    base_price: number;
    image_url: string | null;
  };
}

interface PlayerInfo {
  class: string;
  dirty_cash: number;
  in_jail: boolean;
  jail_release_at: string | null;
  last_street_sale_at: string | null;
}

interface SaleResult {
  success: boolean;
  caught: boolean;
  earned?: number;
  amount_sold?: number;
  drug_name?: string;
  remaining?: number;
  jail_minutes?: number;
  jail_release_at?: string;
  amount_confiscated?: number;
}

export default function StreetsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [drugs, setDrugs] = useState<DrugItem[]>([]);
  const [player, setPlayer] = useState<PlayerInfo | null>(null);
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [selling, setSelling] = useState<string | null>(null);
  const [result, setResult] = useState<SaleResult | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [cooldownSecs, setCooldownSecs] = useState(0);
  const [arrestEscape, setArrestEscape] = useState<{ token: string; jailMinutes: number } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

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
      // Set default amounts
      const defaults: Record<string, number> = {};
      for (const d of data.drugs || []) defaults[d.id] = Math.min(10, d.quantity);
      setAmounts(defaults);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!user) { router.push("/"); return; }
    fetchData();
  }, [user, fetchData, router]);

  // Cooldown countdown
  useEffect(() => {
    if (!player?.last_street_sale_at) { setCooldownSecs(0); return; }
    const update = () => {
      const elapsed = Date.now() - new Date(player.last_street_sale_at!).getTime();
      const remaining = Math.max(0, 300 - Math.floor(elapsed / 1000));
      setCooldownSecs(remaining);
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [player?.last_street_sale_at]);

  const handleSell = async (drug: DrugItem) => {
    const amount = amounts[drug.id] ?? 1;
    setSelling(drug.id);
    setResult(null);
    try {
      const res = await fetch("/api/crime-empire/streets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventoryId: drug.id, amount }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Erro ao vender", false);
        setSelling(null);
        return;
      }
      setResult(data);
      if (data.escape_token) {
        setArrestEscape({ token: data.escape_token, jailMinutes: data.jail_minutes });
      }
      await fetchData();
    } catch {
      showToast("Erro de ligação", false);
    } finally {
      setSelling(null);
    }
  };

  const maxSell = player?.class === "dealer" ? 100 : 50;
  const isDealer = player?.class === "dealer";
  const inCooldown = cooldownSecs > 0;
  const inJail = player?.in_jail;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-white">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#888]">A carregar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 text-white py-10 px-4 md:px-8">
      {toast && <CEToast msg={toast.msg} ok={toast.ok} />}

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <Link href="/jogos/crime-empire/dashboard" className="inline-flex items-center gap-2 text-[#ff6a00] hover:text-[#ff8533] text-sm mb-6 transition-colors">
          ← Voltar
        </Link>

        <div className="mb-8">
          <h1 className="text-4xl font-black bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
            🌿 Vender nas Ruas
          </h1>
          <p className="text-[#888] mt-1">
            Vende as tuas drogas no mercado de rua. Máximo {maxSell}g por transação.
            {isDealer && <span className="ml-2 text-green-400 font-semibold">Dealer: risco reduzido + cap maior ✓</span>}
          </p>
        </div>

        {/* Jail banner */}
        {inJail && player?.jail_release_at && (
          <div className="mb-6 p-4 rounded-xl bg-red-900/40 border border-red-500 text-red-300">
            <p className="font-bold">🚔 Estás preso!</p>
            <p className="text-sm mt-1">Saída: {new Date(player.jail_release_at).toLocaleTimeString("pt-PT")}</p>
          </div>
        )}

        {/* Cooldown bar */}
        {inCooldown && !inJail && (
          <div className="mb-6 p-4 rounded-xl bg-yellow-900/30 border border-yellow-600">
            <p className="text-yellow-400 font-semibold text-sm">
              ⏳ Próxima venda em: {Math.floor(cooldownSecs / 60)}:{String(cooldownSecs % 60).padStart(2, "0")}
            </p>
            <div className="mt-2 h-2 bg-[#333] rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-500 transition-all duration-1000"
                style={{ width: `${((300 - cooldownSecs) / 300) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Drug sell result */}
        {result && (
          <div className={`mb-6 p-5 rounded-xl border-l-4 ${result.caught ? "bg-red-900/40 border-red-500" : "bg-green-900/40 border-green-500"}`}>
            {result.caught ? (
              <>
                <p className="text-red-400 font-black text-lg">🚔 APANHADO!</p>
                <p className="text-red-300 mt-1">
                  A polícia confiscou {result.amount_confiscated}g de {result.drug_name}. Foste preso por {result.jail_minutes} minutos.
                </p>
              </>
            ) : (
              <>
                <p className="text-green-400 font-black text-lg">✅ VENDA EFETUADA!</p>
                <p className="text-green-300 mt-1">
                  Vendeste {result.amount_sold}g de <span className="font-bold">{result.drug_name}</span> por{" "}
                  <span className="font-black">${result.earned?.toLocaleString()}</span> sujos.
                </p>
                {(result.remaining ?? 0) > 0 && (
                  <p className="text-[#888] text-sm mt-1">Restam {result.remaining}g</p>
                )}
              </>
            )}
            <button onClick={() => setResult(null)} className="mt-3 text-xs text-[#666] hover:text-white transition-colors">
              Fechar
            </button>
          </div>
        )}

        {/* No drugs */}
        {drugs.length === 0 && !inJail && (
          <div className="p-8 rounded-2xl bg-[#121212] border border-[#222] text-center">
            <p className="text-5xl mb-4">🌿</p>
            <p className="text-[#888] text-lg">Não tens drogas no inventário.</p>
            <p className="text-[#555] text-sm mt-2">
              Produz drogas nos teus negócios ou compra no Black Market.
            </p>
            <Link
              href="/jogos/crime-empire/black-market"
              className="inline-block mt-4 px-6 py-2 rounded-lg bg-green-700 hover:bg-green-600 text-white font-semibold text-sm transition-colors"
            >
              Ir ao Black Market
            </Link>
          </div>
        )}

        {/* Drug cards */}
        <div className="space-y-4">
          {drugs.map((drug) => {
            const amt = amounts[drug.id] ?? 1;
            const pricePerGram = drug.items.base_price;
            const total = pricePerGram * amt;
            const isSelling = selling === drug.id;
            const disabled = inCooldown || !!inJail || isSelling;

            return (
              <div key={drug.id} className="p-5 rounded-2xl bg-[#121212] border border-[#222] hover:border-green-700 transition-colors">
                <div className="flex items-start gap-4">
                  {/* Drug image/icon */}
                  <div className="w-14 h-14 rounded-xl bg-[#1a1a1a] border border-[#333] flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {drug.items.image_url ? (
                      <Image src={drug.items.image_url} alt={drug.items.name} width={56} height={56} className="object-contain w-full h-full" />
                    ) : (
                      <span className="text-2xl">💊</span>
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <h3 className="text-lg font-black text-white">{drug.items.name}</h3>
                        <p className="text-xs text-[#666]">{drug.items.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[#666]">Stock</p>
                        <p className="text-green-400 font-bold">{drug.quantity}g</p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {/* Price info */}
                      <div className="text-xs text-[#888]">
                        <span className="text-[#555]">$/g:</span>{" "}
                        <span className="text-white font-semibold">${pricePerGram.toLocaleString()}</span>
                      </div>
                      <div className="text-xs text-[#888]">
                        <span className="text-[#555]">Total:</span>{" "}
                        <span className="text-green-400 font-bold">${total.toLocaleString()}</span>
                      </div>
                      <div className="text-xs">
                        <span className="text-red-400">Risco prisão: {isDealer ? "10%" : "20%"}</span>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-3">
                      {/* Amount input */}
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-[#666]">Gramas:</label>
                        <input
                          type="number"
                          min={1}
                          max={Math.min(maxSell, drug.quantity)}
                          value={amt}
                          onChange={(e) =>
                            setAmounts((prev) => ({
                              ...prev,
                              [drug.id]: Math.max(1, Math.min(Math.min(maxSell, drug.quantity), Number(e.target.value))),
                            }))
                          }
                          className="w-20 px-2 py-1 rounded-lg bg-[#1e1e1e] border border-[#333] text-white text-sm text-center focus:outline-none focus:border-green-500"
                          disabled={disabled}
                        />
                        <button
                          onClick={() => setAmounts((prev) => ({ ...prev, [drug.id]: Math.min(maxSell, drug.quantity) }))}
                          className="text-xs text-green-500 hover:text-green-400 transition-colors"
                          disabled={disabled}
                        >
                          MAX
                        </button>
                      </div>

                      {/* Sell button */}
                      <button
                        onClick={() => handleSell(drug)}
                        disabled={disabled}
                        className="px-5 py-2 rounded-xl bg-green-700 hover:bg-green-600 text-white font-bold text-sm transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                      >
                        {isSelling ? "A vender..." : "Vender"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Info box */}
        <div className="mt-8 p-4 rounded-xl bg-[#0e0e0e] border border-[#1e1e1e] text-xs text-[#555] space-y-1">
          <p>• Cada venda tem um cooldown de 5 minutos.</p>
          <p>• Máximo de {maxSell}g por transação{isDealer ? " (bónus de Traficante)" : ""}.</p>
          <p>• Risco de prisão por transação: {isDealer ? "10%" : "20%"}{isDealer ? " (bónus de Traficante)" : ""}.</p>
          <p>• Se fores apanhado, as drogas são confiscadas e vais preso.</p>
          <p>• O dinheiro ganho vai direto para o teu dinheiro sujo.</p>
        </div>
      </div>
      {arrestEscape && (
        <RaidEscape
          difficulty="medium"
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
            fetchData();
          }}
        />
      )}
    </div>
  );
}
