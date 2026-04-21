"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";

interface Brothel {
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

interface OwnedBrothel {
  id: string;
  business_id: string;
  max_employees: number;
  employees: number;
  businesses: Brothel;
}

interface Worker {
  id: string;
  name: string;
  status: string;
  income_per_hour: number;
  charisma_bonus: number;
  intelligence_bonus: number;
}

export default function RuaDasLuzesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [brothels, setBrothels] = useState<Brothel[]>([]);
  const [ownedBrothels, setOwnedBrothels] = useState<OwnedBrothel[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [playerClass, setPlayerClass] = useState("");
  const [playerLevel, setPlayerLevel] = useState(0);
  const [workerName, setWorkerName] = useState("");
  const [selectedBrothel, setSelectedBrothel] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/crime-empire/brothels");
      const data = await res.json();
      setBrothels(data.brothels || []);
      setOwnedBrothels(data.ownedBrothels || []);
      setWorkers(data.workers || []);
      setPlayerClass(data.playerClass || "");
      setPlayerLevel(data.playerLevel || 0);
    } catch (error) {
      console.error("Error fetching brothels:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (brothelId: string) => {
    try {
      const res = await fetch("/api/crime-empire/brothels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "purchase", brothelId }),
      });

      const data = await res.json();

      if (data.success) {
        alert(data.message);
        fetchData();
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error("Error purchasing brothel:", error);
      alert("Erro ao comprar bordel!");
    }
  };

  const handleHire = async (playerBusinessId: string) => {
    if (!workerName.trim()) {
      alert("Dá um nome à worker!");
      return;
    }

    try {
      const res = await fetch("/api/crime-empire/brothels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "hire", playerBusinessId, workerName }),
      });

      const data = await res.json();

      if (data.success) {
        alert(data.message);
        setWorkerName("");
        setSelectedBrothel(null);
        fetchData();
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error("Error hiring worker:", error);
      alert("Erro ao contratar worker!");
    }
  };

  const handleFire = async (workerId: string) => {
    if (!confirm("Tens a certeza que queres despedir esta worker?")) return;

    try {
      const res = await fetch("/api/crime-empire/brothels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fire", workerId }),
      });

      const data = await res.json();

      if (data.success) {
        alert(data.message);
        fetchData();
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error("Error firing worker:", error);
    }
  };

  const handleCollect = async () => {
    try {
      const res = await fetch("/api/crime-empire/brothels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "collect" }),
      });

      const data = await res.json();

      if (data.success) {
        alert(data.message);
        fetchData();
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error("Error collecting income:", error);
    }
  };

  const totalIncome = workers
    .filter((w) => w.status === "healthy")
    .reduce((sum, w) => sum + w.income_per_hour, 0);

  const incomeWithBonus = playerClass === "pimp" ? Math.floor(totalIncome * 1.2) : totalIncome;

  const availableBrothels = brothels.filter(
    (b) => !ownedBrothels.find((ob) => ob.business_id === b.id)
  );

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-white text-xl">A carregar...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 text-white py-12 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/jogos/crime-empire/dashboard"
            className="text-sm text-[#888888] hover:text-[#ff6a00] mb-2 inline-block"
          >
            ← Voltar ao Dashboard
          </Link>
          <h1 className="text-5xl md:text-6xl font-black bg-gradient-to-r from-pink-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            💋 RUA DAS LUZES
          </h1>
          <p className="text-lg text-[#888888] mt-2">
            Compra bordéis e contrata workers para gerar rendimento passivo
            {playerClass === "pimp" && (
              <span className="ml-2 text-pink-400 font-bold">
                👑 PIMP: 2x Workers + 20% Rendimento
              </span>
            )}
          </p>
        </div>

        {/* Income Summary */}
        {workers.length > 0 && (
          <div className="mb-8 p-6 rounded-xl bg-gradient-to-br from-pink-900/20 to-purple-900/20 border-2 border-pink-500">
            <div className="flex justify-between items-center mb-4">
              <div>
                <p className="text-sm text-[#888888]">Rendimento por Hora</p>
                <p className="text-3xl font-bold text-pink-400">
                  ${incomeWithBonus.toLocaleString()}/h
                </p>
                {playerClass === "pimp" && (
                  <p className="text-xs text-purple-300">
                    (Base: ${totalIncome.toLocaleString()} + 20% PIMP Bonus)
                  </p>
                )}
              </div>
              <button
                onClick={handleCollect}
                className="px-6 py-3 rounded-lg bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 font-bold transition-all"
              >
                💰 Coletar Rendimento
              </button>
            </div>
            <p className="text-sm text-[#888888]">
              {workers.length} Worker{workers.length !== 1 ? "s" : ""} Contratada
              {workers.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}

        {/* Owned Brothels */}
        {ownedBrothels.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-4">Os Teus Bordéis</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ownedBrothels.map((ob) => (
                <div
                  key={ob.id}
                  className="p-6 rounded-xl bg-[#1a1a1a] border border-pink-500/30"
                >
                  <h3 className="text-xl font-bold text-pink-400 mb-2">
                    {ob.businesses.name}
                  </h3>
                  <p className="text-sm text-[#888888] mb-4">
                    {ob.businesses.description}
                  </p>
                  <div className="mb-4">
                    <p className="text-sm text-[#888888]">
                      Workers: {workers.length} / {ob.max_employees}
                    </p>
                    <div className="w-full bg-[#222222] rounded-full h-2 mt-1">
                      <div
                        className="bg-gradient-to-r from-pink-500 to-purple-500 h-2 rounded-full"
                        style={{
                          width: `${(workers.length / ob.max_employees) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  {workers.length < ob.max_employees && (
                    <div>
                      {selectedBrothel === ob.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={workerName}
                            onChange={(e) => setWorkerName(e.target.value)}
                            placeholder="Nome da worker..."
                            className="w-full px-4 py-2 rounded-lg bg-[#222222] border border-pink-500/30 text-white"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleHire(ob.id)}
                              className="flex-1 px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 font-bold"
                            >
                              Contratar ($10,000)
                            </button>
                            <button
                              onClick={() => {
                                setSelectedBrothel(null);
                                setWorkerName("");
                              }}
                              className="px-4 py-2 rounded-lg bg-[#222222] hover:bg-[#2a2a2a] border border-[#333333]"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setSelectedBrothel(ob.id)}
                          className="w-full px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 font-bold"
                        >
                          + Contratar Worker
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Workers List */}
        {workers.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-4">As Tuas Workers</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {workers.map((w) => (
                <div
                  key={w.id}
                  className="p-4 rounded-xl bg-[#1a1a1a] border border-pink-500/30"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-bold text-pink-300">{w.name}</h4>
                      <p className="text-xs text-[#888888]">{w.status}</p>
                    </div>
                    <button
                      onClick={() => handleFire(w.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      🗑️ Despedir
                    </button>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="text-[#888888]">Rendimento:</span>{" "}
                      <span className="text-green-400">
                        ${w.income_per_hour}/h
                      </span>
                    </p>
                    <p>
                      <span className="text-[#888888]">Carisma:</span> +{w.charisma_bonus}
                    </p>
                    <p>
                      <span className="text-[#888888]">Inteligência:</span> +
                      {w.intelligence_bonus}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Available Brothels */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Bordéis Disponíveis</h2>
          {availableBrothels.length === 0 ? (
            <div className="p-8 rounded-xl bg-[#121212] border border-[#222222] text-center">
              <p className="text-[#888888]">
                🎉 Já compraste todos os bordéis disponíveis!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {availableBrothels.map((brothel) => (
                <div
                  key={brothel.id}
                  className="p-6 rounded-xl bg-[#1a1a1a] border-2 border-pink-500/30 hover:border-pink-500 transition-all"
                >
                  <h3 className="text-2xl font-bold text-pink-400 mb-2">
                    {brothel.name}
                  </h3>
                  <p className="text-sm text-[#888888] mb-4">
                    {brothel.description}
                  </p>

                  <div className="space-y-2 mb-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#888888]">Preço:</span>
                      <span className="text-yellow-400 font-bold">
                        ${brothel.purchase_price.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#888888]">Rendimento Base:</span>
                      <span className="text-green-400">
                        ${brothel.base_income_per_hour}/h
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#888888]">Capacidade:</span>
                      <span className="text-pink-400">
                        {playerClass === "pimp"
                          ? brothel.max_employees * 2
                          : brothel.max_employees}{" "}
                        workers
                        {playerClass === "pimp" && (
                          <span className="text-xs ml-1">(2x PIMP)</span>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#888888]">Nível Requerido:</span>
                      <span className="text-[#ff6a00]">
                        Nível {brothel.required_level}
                      </span>
                    </div>
                  </div>

                  {playerLevel < brothel.required_level ? (
                    <div className="w-full px-4 py-3 rounded-lg bg-[#111111] border border-[#333333] font-bold text-center text-[#555555] flex items-center justify-center gap-2 cursor-not-allowed">
                      🔒 Nível {brothel.required_level} Necessário
                    </div>
                  ) : (
                    <button
                      onClick={() => handlePurchase(brothel.id)}
                      className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 font-bold transition-all"
                    >
                      💰 Comprar
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
