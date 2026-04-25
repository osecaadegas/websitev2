"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import RaidEscape from "@/components/crime-empire/raid/RaidEscape";

interface Item {
  name: string;
  description: string;
  category: string;
  power_bonus: number;
  intelligence_bonus: number;
  charisma_bonus: number;
  hp_bonus: number;
  base_price: number;
}

interface Listing {
  id: string;
  seller_id: string;
  item_id: string;
  quantity: number;
  crypto_price_per_unit: number;
  total_crypto: number;
  expires_at: string;
  created_at: string;
  items: Item;
  crime_players?: {
    username: string;
    display_name: string;
    level: number;
    prestige_level: number;
  };
}

interface InventoryItem {
  id: string;
  item_id: string;
  quantity: number;
  items: Item;
}

export default function BlackMarket() {
  const { user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<"browse" | "my-listings" | "sell" | "history">("browse");
  const [listings, setListings] = useState<Listing[]>([]);
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [playerCrypto, setPlayerCrypto] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tradeHistory, setTradeHistory] = useState<any[]>([]);
  
  // Sell form state
  const [selectedItemId, setSelectedItemId] = useState("");
  const [sellQuantity, setSellQuantity] = useState(1);
  const [cryptoPrice, setCryptoPrice] = useState(10);
  const [selling, setSelling] = useState(false);
  const [arrestEscape, setArrestEscape] = useState<{ token: string; jailMinutes: number } | null>(null);

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }
    fetchData();
  }, [user, tab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (tab === "browse") {
        const res = await fetch("/api/crime-empire/black-market");
        const data = await res.json();
        setListings(data.listings || []);
        setPlayerCrypto(data.playerCrypto || 0);
      } else if (tab === "my-listings") {
        const res = await fetch("/api/crime-empire/black-market?action=my-listings");
        const data = await res.json();
        setMyListings(data.listings || []);
      } else if (tab === "sell") {
        // Fetch player's inventory
        const res = await fetch("/api/crime-empire/player");
        const data = await res.json();
        if (data.player) {
          setPlayerCrypto(data.player.crypto);
        }
        
        const invRes = await fetch("/api/crime-empire/businesses?action=inventory");
        const invData = await invRes.json();
        const tradeableItems = (invData.inventory || []).filter((item: InventoryItem) => {
          return item.quantity > 0;
        });
        setInventory(tradeableItems);
      } else if (tab === "history") {
        const res = await fetch("/api/crime-empire/black-market?action=history");
        const data = await res.json();
        setTradeHistory(data.trades || []);
      }
    } catch (error) {
      console.error("Error fetching black market data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = async (listingId: string) => {
    if (!confirm("Confirmar compra? Existe 5% de risco de seres apanhado e preso!")) return;

    try {
      const res = await fetch("/api/crime-empire/black-market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "buy", listingId }),
      });

      const data = await res.json();

      if (data.success) {
        alert(data.message);
        fetchData();
      } else {
        alert(data.error || "Erro ao comprar");
      }
    } catch (error) {
      console.error("Error buying:", error);
      alert("Erro ao comprar");
    }
  };

  const handleCancel = async (listingId: string) => {
    if (!confirm("Cancelar esta listagem? Os itens serão devolvidos ao teu inventário.")) return;

    try {
      const res = await fetch("/api/crime-empire/black-market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", listingId }),
      });

      const data = await res.json();

      if (data.success) {
        alert(data.message);
        fetchData();
      } else {
        alert(data.error || "Erro ao cancelar");
      }
    } catch (error) {
      console.error("Error canceling:", error);
      alert("Erro ao cancelar");
    }
  };

  const handleSell = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedItemId) {
      alert("Seleciona um item para vender");
      return;
    }

    const selectedItem = inventory.find(item => item.item_id === selectedItemId);
    if (!selectedItem || sellQuantity > selectedItem.quantity) {
      alert("Quantidade inválida");
      return;
    }

    setSelling(true);
    try {
      const res = await fetch("/api/crime-empire/black-market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          itemId: selectedItemId,
          quantity: sellQuantity,
          cryptoPricePerUnit: cryptoPrice,
        }),
      });

      const data = await res.json();

      if (data.success) {
        alert(data.message);
        setSelectedItemId("");
        setSellQuantity(1);
        setCryptoPrice(10);
        setTab("my-listings");
      } else {
        alert(data.error || "Erro ao criar listagem");
      }
    } catch (error) {
      console.error("Error creating listing:", error);
      alert("Erro ao criar listagem");
    } finally {
      setSelling(false);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "weapon": return "text-red-400";
      case "armor": return "text-blue-400";
      case "consumable": return "text-green-400";
      case "material": return "text-yellow-400";
      case "special": return "text-purple-400";
      default: return "text-gray-400";
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "weapon": return "🔫";
      case "armor": return "🛡️";
      case "consumable": return "💊";
      case "material": return "📦";
      case "special": return "⭐";
      default: return "❓";
    }
  };

  return (
    <div className="flex-1 text-white py-12 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <Link
              href="/jogos/crime-empire/dashboard"
              className="text-sm text-[#888888] hover:text-[#ff6a00] mb-2 inline-block"
            >
              ← Voltar ao Dashboard
            </Link>
            <h1 className="text-5xl md:text-6xl font-black bg-gradient-to-r from-purple-500 to-purple-700 bg-clip-text text-transparent">
              💎 MERCADO NEGRO
            </h1>
            <p className="text-lg text-[#888888] mt-2">
              Compra e vende itens com outros jogadores usando Crypto
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-[#888888]">O Teu Crypto</p>
            <p className="text-3xl font-bold text-purple-400">₿ {(playerCrypto || 0).toLocaleString()}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-[#222222]">
          <button
            onClick={() => setTab("browse")}
            className={`px-6 py-3 font-bold transition-all ${
              tab === "browse"
                ? "border-b-2 border-purple-500 text-purple-400"
                : "text-[#888888] hover:text-white"
            }`}
          >
            🛒 Comprar
          </button>
          <button
            onClick={() => setTab("my-listings")}
            className={`px-6 py-3 font-bold transition-all ${
              tab === "my-listings"
                ? "border-b-2 border-purple-500 text-purple-400"
                : "text-[#888888] hover:text-white"
            }`}
          >
            📋 Minhas Listagens
          </button>
          <button
            onClick={() => setTab("sell")}
            className={`px-6 py-3 font-bold transition-all ${
              tab === "sell"
                ? "border-b-2 border-purple-500 text-purple-400"
                : "text-[#888888] hover:text-white"
            }`}
          >
            💰 Vender
          </button>
          <button
            onClick={() => setTab("history")}
            className={`px-6 py-3 font-bold transition-all ${
              tab === "history"
                ? "border-b-2 border-purple-500 text-purple-400"
                : "text-[#888888] hover:text-white"
            }`}
          >
            📜 Histórico
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-xl text-[#888888]">A carregar...</div>
          </div>
        ) : (
          <>
            {/* Browse Listings */}
            {tab === "browse" && (
              <div>
                {listings.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">📭</div>
                    <p className="text-xl text-[#888888]">
                      Nenhuma listagem disponível no momento
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {listings.map((listing) => (
                      <div
                        key={listing.id}
                        className="p-6 rounded-xl bg-[#121212] border border-purple-500/30 hover:border-purple-500 transition-all"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="text-3xl mb-2">
                              {getCategoryIcon(listing.items.category)}
                            </div>
                            <h3 className="text-lg font-bold">{listing.items.name}</h3>
                            <p className={`text-xs ${getCategoryColor(listing.items.category)}`}>
                              {listing.items.category.toUpperCase()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-[#888888]">Quantidade</p>
                            <p className="text-xl font-bold">x{listing.quantity}</p>
                          </div>
                        </div>

                        {listing.items.description && (
                          <p className="text-sm text-[#888888] mb-4">{listing.items.description}</p>
                        )}

                        {/* Stats */}
                        {(listing.items.power_bonus > 0 || listing.items.intelligence_bonus > 0 || 
                          listing.items.charisma_bonus > 0 || listing.items.hp_bonus > 0) && (
                          <div className="flex flex-wrap gap-2 mb-4">
                            {listing.items.power_bonus > 0 && (
                              <span className="text-xs px-2 py-1 rounded bg-red-900/30 text-red-400">
                                💪 +{listing.items.power_bonus}
                              </span>
                            )}
                            {listing.items.intelligence_bonus > 0 && (
                              <span className="text-xs px-2 py-1 rounded bg-blue-900/30 text-blue-400">
                                🧠 +{listing.items.intelligence_bonus}
                              </span>
                            )}
                            {listing.items.charisma_bonus > 0 && (
                              <span className="text-xs px-2 py-1 rounded bg-purple-900/30 text-purple-400">
                                ✨ +{listing.items.charisma_bonus}
                              </span>
                            )}
                            {listing.items.hp_bonus > 0 && (
                              <span className="text-xs px-2 py-1 rounded bg-green-900/30 text-green-400">
                                ❤️ +{listing.items.hp_bonus}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Seller Info */}
                        {listing.crime_players && (
                          <div className="mb-4 pb-4 border-b border-[#222222]">
                            <p className="text-xs text-[#888888]">Vendedor</p>
                            <p className="text-sm font-semibold">
                              {listing.crime_players.display_name}
                              <span className="text-[#888888] ml-2">
                                Nv. {listing.crime_players.level}
                                {listing.crime_players.prestige_level > 0 && " ⭐"}
                              </span>
                            </p>
                          </div>
                        )}

                        {/* Price */}
                        <div className="flex justify-between items-center mb-4">
                          <div>
                            <p className="text-xs text-[#888888]">Preço Total</p>
                            <p className="text-2xl font-bold text-purple-400">
                              ₿ {listing.total_crypto.toLocaleString()}
                            </p>
                            <p className="text-xs text-[#666666]">
                              ₿{listing.crypto_price_per_unit}/unidade
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => handleBuy(listing.id)}
                          disabled={playerCrypto < listing.total_crypto}
                          className={`w-full px-4 py-3 rounded-xl font-bold transition-all ${
                            playerCrypto < listing.total_crypto
                              ? "bg-[#222222] text-[#666666] cursor-not-allowed"
                              : "bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 hover:scale-105"
                          }`}
                        >
                          {playerCrypto < listing.total_crypto ? "Crypto Insuficiente" : "💎 Comprar"}
                        </button>

                        <p className="text-xs text-yellow-400 mt-2 text-center">
                          ⚠️ 5% de risco de prisão
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* My Listings */}
            {tab === "my-listings" && (
              <div>
                {myListings.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">📋</div>
                    <p className="text-xl text-[#888888] mb-4">
                      Não tens listagens ativas
                    </p>
                    <button
                      onClick={() => setTab("sell")}
                      className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 font-bold"
                    >
                      Vender Itens
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {myListings.map((listing) => (
                      <div
                        key={listing.id}
                        className="p-6 rounded-xl bg-[#121212] border border-[#222222]"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="text-3xl mb-2">
                              {getCategoryIcon(listing.items.category)}
                            </div>
                            <h3 className="text-lg font-bold">{listing.items.name}</h3>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-[#888888]">Quantidade</p>
                            <p className="text-xl font-bold">x{listing.quantity}</p>
                          </div>
                        </div>

                        <div className="mb-4">
                          <p className="text-sm text-[#888888]">Preço Total</p>
                          <p className="text-2xl font-bold text-purple-400">
                            ₿ {listing.total_crypto.toLocaleString()}
                          </p>
                        </div>

                        <div className="mb-4">
                          <p className="text-xs text-[#888888]">Expira em</p>
                          <p className="text-sm">
                            {new Date(listing.expires_at).toLocaleDateString()}
                          </p>
                        </div>

                        <button
                          onClick={() => handleCancel(listing.id)}
                          className="w-full px-4 py-3 rounded-xl bg-red-900/30 border border-red-600 hover:bg-red-900/50 font-bold transition-all"
                        >
                          🗑️ Cancelar Listagem
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Sell Tab */}
            {tab === "sell" && (
              <div className="max-w-2xl mx-auto">
                <div className="p-8 rounded-xl bg-[#121212] border border-[#222222]">
                  <h2 className="text-2xl font-bold mb-6">Vender Item no Mercado Negro</h2>

                  {inventory.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-6xl mb-4">📦</div>
                      <p className="text-xl text-[#888888]">
                        Não tens itens para vender
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleSell}>
                      {/* Select Item */}
                      <div className="mb-6">
                        <label className="block text-sm font-bold mb-2">Item para Vender</label>
                        <select
                          value={selectedItemId}
                          onChange={(e) => {
                            setSelectedItemId(e.target.value);
                            const item = inventory.find(i => i.item_id === e.target.value);
                            if (item) setSellQuantity(Math.min(1, item.quantity));
                          }}
                          className="w-full px-4 py-3 rounded-xl bg-[#1a1a1a] border border-[#333333] focus:border-purple-500 outline-none"
                          required
                        >
                          <option value="">Seleciona um item</option>
                          {inventory.map((item) => (
                            <option key={item.id} value={item.item_id}>
                              {item.items.name} (x{item.quantity})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity */}
                      <div className="mb-6">
                        <label className="block text-sm font-bold mb-2">
                          Quantidade (máx:{" "}
                          {inventory.find(i => i.item_id === selectedItemId)?.quantity || 0})
                        </label>
                        <input
                          type="number"
                          value={sellQuantity}
                          onChange={(e) => setSellQuantity(Number(e.target.value))}
                          min={1}
                          max={inventory.find(i => i.item_id === selectedItemId)?.quantity || 1}
                          className="w-full px-4 py-3 rounded-xl bg-[#1a1a1a] border border-[#333333] focus:border-purple-500 outline-none"
                          required
                        />
                      </div>

                      {/* Crypto Price Per Unit */}
                      <div className="mb-6">
                        <label className="block text-sm font-bold mb-2">
                          Preço em Crypto (por unidade)
                        </label>
                        <input
                          type="number"
                          value={cryptoPrice}
                          onChange={(e) => setCryptoPrice(Number(e.target.value))}
                          min={1}
                          className="w-full px-4 py-3 rounded-xl bg-[#1a1a1a] border border-[#333333] focus:border-purple-500 outline-none"
                          required
                        />
                        <p className="text-sm text-[#888888] mt-2">
                          Preço total: ₿ {(cryptoPrice * sellQuantity).toLocaleString()}
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={selling || !selectedItemId}
                        className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 font-bold text-lg hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {selling ? "A criar listagem..." : "💎 Criar Listagem"}
                      </button>

                      <p className="text-xs text-[#888888] mt-4 text-center">
                        A listagem expira em 7 dias. Podes cancelá-la a qualquer momento.
                      </p>
                    </form>
                  )}
                </div>
              </div>
            )}

            {/* History Tab */}
            {tab === "history" && (
              <div>
                {tradeHistory.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">📜</div>
                    <p className="text-xl text-[#888888]">Sem transações registadas.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tradeHistory.map((trade: any) => {
                      const isBuyer = trade.role === "buyer";
                      return (
                        <div
                          key={trade.id}
                          className={`p-4 rounded-xl border ${isBuyer ? "bg-green-900/10 border-green-700/40" : "bg-blue-900/10 border-blue-700/40"}`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full mr-2 ${isBuyer ? "bg-green-900/40 text-green-400" : "bg-blue-900/40 text-blue-400"}`}>
                                {isBuyer ? "COMPREI" : "VENDI"}
                              </span>
                              <span className="font-bold">{trade.item_name || "Item"}</span>
                              <span className="text-[#888] text-sm ml-2">×{trade.quantity}</span>
                            </div>
                            <div className="text-right">
                              <p className={`font-bold ${isBuyer ? "text-red-400" : "text-green-400"}`}>
                                {isBuyer ? "-" : "+"}₿{trade.total_crypto?.toLocaleString()}
                              </p>
                              <p className="text-xs text-[#888]">{new Date(trade.created_at).toLocaleDateString("pt-PT")}</p>
                            </div>
                          </div>
                          {(trade.buyer_caught || trade.seller_caught) && (
                            <p className="text-xs text-red-400 mt-1">⚠️ Apanhado — {trade.jail_time_minutes}min de prisão</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
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
            router.push("/jogos/crime-empire/jail");
          }}
        />
      )}
    </div>
  );
}
