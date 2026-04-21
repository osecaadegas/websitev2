"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Business {
  id: string;
  name: string;
  type: string;
  description: string;
  purchase_price: number;
  base_income_per_hour: number;
  max_employees: number;
  employee_cost_per_hour: number;
  required_level: number;
}

interface OwnedBusiness {
  id: string;
  business_id: string;
  employees: number;
  max_employees: number;
  last_collection: string;
  last_wage_payment: string;
  business: Business;
}

export default function BusinessesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [ownedBusinesses, setOwnedBusinesses] = useState<OwnedBusiness[]>([]);
  const [player, setPlayer] = useState<any>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<string | null>(null);
  const [launderAmount, setLaunderAmount] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/crime-empire/businesses");
      const data = await res.json();
      setBusinesses(data.businesses || []);
      setOwnedBusinesses(data.ownedBusinesses || []);
      setPlayer(data.player);
    } catch (error) {
      console.error("Error fetching businesses:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: string, businessId: string, amount?: number) => {
    setProcessing(true);
    try {
      const res = await fetch("/api/crime-empire/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, businessId, amount }),
      });

      const data = await res.json();

      if (data.success) {
        alert(data.message || `${action} successful!`);
        fetchData();
      } else {
        alert(data.error || `Failed to ${action}`);
      }
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred");
    } finally {
      setProcessing(false);
      setSelectedBusiness(null);
      setLaunderAmount("");
    }
  };

  const getTimeSinceCollection = (lastCollection: string) => {
    const now = new Date();
    const last = new Date(lastCollection);
    const hours = (now.getTime() - last.getTime()) / (1000 * 60 * 60);
    if (hours < 1) return `${Math.floor(hours * 60)}m`;
    return `${Math.floor(hours)}h`;
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-white text-xl">A carregar...</div>
      </div>
    );
  }

  const availableBusinesses = businesses.filter(
    (b) => !ownedBusinesses.find((ob) => ob.business_id === b.id)
  );

  return (
    <div className="flex-1 text-white py-12 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-4xl font-black mb-2 bg-gradient-to-r from-[#ff6a00] to-[#ff8533] bg-clip-text text-transparent">
              🏢 NEGÓCIOS
            </h1>
            <p className="text-[#888888]">
              Gere os teus negócios ilegais e maximiza os lucros
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-[#888888]">Dinheiro Limpo</p>
            <p className="text-2xl font-bold text-green-400">
              ${player?.cash.toLocaleString()}
            </p>
            <p className="text-sm text-[#888888] mt-2">Dinheiro Sujo</p>
            <p className="text-xl font-bold text-yellow-400">
              ${player?.dirty_cash.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Owned Businesses */}
        {ownedBusinesses.length > 0 && (
          <>
            <h2 className="text-2xl font-bold mb-4">Os Teus Negócios</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
              {ownedBusinesses.map((ob) => (
                <div
                  key={ob.id}
                  className="p-6 rounded-xl bg-gradient-to-br from-[#1a1a1a] to-[#121212] border-2 border-[#ff6a00]"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-[#ff6a00]">
                        {ob.business.name}
                      </h3>
                      <p className="text-sm text-[#888888]">{ob.business.description}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-3 rounded-lg bg-[#0a0a0a]">
                      <p className="text-xs text-[#888888]">Workers</p>
                      <p className="text-lg font-bold">
                        {ob.employees}/{ob.max_employees}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-[#0a0a0a]">
                      <p className="text-xs text-[#888888]">Última Coleta</p>
                      <p className="text-lg font-bold">
                        {getTimeSinceCollection(ob.last_collection)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <button
                      onClick={() =>
                        ob.employees < ob.max_employees &&
                        handleAction("hire", ob.business_id, 1)
                      }
                      disabled={processing || ob.employees >= ob.max_employees}
                      className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm transition-all"
                    >
                      + Contratar
                    </button>
                    <button
                      onClick={() =>
                        ob.employees > 0 && handleAction("fire", ob.business_id, 1)
                      }
                      disabled={processing || ob.employees === 0}
                      className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm transition-all"
                    >
                      - Despedir
                    </button>
                  </div>

                  {ob.business.type === "chop_shop" ? (
                    <div>
                      <input
                        type="number"
                        placeholder="Quantia sujo"
                        value={launderAmount}
                        onChange={(e) => setLaunderAmount(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg bg-[#0a0a0a] border border-[#222222] mb-2 text-white"
                      />
                      <button
                        onClick={() => {
                          const amount = parseInt(launderAmount);
                          if (amount > 0) {
                            handleAction("launder", ob.business_id, amount);
                          }
                        }}
                        disabled={processing || !launderAmount || parseInt(launderAmount) <= 0}
                        className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed font-bold transition-all"
                      >
                        💧 Lavar Dinheiro ({ob.employees > 0 ? `${60 + ob.employees * 3}%` : "Precisa Workers"})
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleAction("collect", ob.business_id)}
                      disabled={processing}
                      className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-[#ff6a00] to-[#ff8533] hover:from-[#ff8533] hover:to-[#ff6a00] disabled:opacity-50 disabled:cursor-not-allowed font-bold transition-all"
                    >
                      💰 Coletar
                    </button>
                  )}

                  <p className="text-xs text-[#666666] mt-3 text-center">
                    Custo semanal: ${(ob.employees * ob.business.employee_cost_per_hour * 168).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Available Businesses */}
        <h2 className="text-2xl font-bold mb-4">Negócios Disponíveis</h2>
        {availableBusinesses.length === 0 ? (
          <div className="p-8 rounded-xl bg-[#121212] border border-[#222222] text-center">
            <p className="text-[#888888]">
              🎉 Já tens todos os negócios disponíveis!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableBusinesses.map((business) => {
              const canAfford = player.cash >= business.purchase_price;
              const meetsLevel = player.level >= business.required_level;
              const canPurchase = canAfford && meetsLevel;

              return (
                <div
                  key={business.id}
                  className={`p-6 rounded-xl border-2 transition-all ${
                    canPurchase
                      ? "bg-[#1a1a1a] border-[#333333] hover:border-[#ff6a00]"
                      : "bg-[#0f0f0f] border-[#222222] opacity-60"
                  }`}
                >
                  <h3 className="text-xl font-bold mb-2">{business.name}</h3>
                  <p className="text-sm text-[#888888] mb-4 h-12">
                    {business.description}
                  </p>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#888888]">Preço:</span>
                      <span className={canAfford ? "text-green-400" : "text-red-400"}>
                        ${business.purchase_price.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#888888]">Level Required:</span>
                      <span className={meetsLevel ? "text-green-400" : "text-red-400"}>
                        {business.required_level}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#888888]">Max Workers:</span>
                      <span className="text-blue-400">{business.max_employees}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleAction("purchase", business.id)}
                    disabled={!canPurchase || processing}
                    className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-[#ff6a00] to-[#ff8533] hover:from-[#ff8533] hover:to-[#ff6a00] disabled:opacity-50 disabled:cursor-not-allowed font-bold transition-all"
                  >
                    {!meetsLevel
                      ? `Level ${business.required_level} Necessário`
                      : !canAfford
                      ? "Sem Dinheiro"
                      : "Comprar"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 text-center">
          <Link
            href="/jogos/crime-empire/dashboard"
            className="inline-block px-6 py-3 rounded-lg bg-[#222222] hover:bg-[#2a2a2a] border border-[#333333] font-medium transition-all"
          >
            ← Voltar ao Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
