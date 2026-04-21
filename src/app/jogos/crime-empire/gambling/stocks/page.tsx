"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type Coin = {
  id: string;
  displayName: string;
  symbol: string;
  color: string;
  price: number;
  change24h: number;
};

type Position = {
  id: string;
  displayName: string;
  symbol: string;
  color: string;
  quantity: number;
  boughtPrice: number;
  currentPrice: number;
  invested: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
};

export default function StocksPage() {
  const [player, setPlayer] = useState<{ dirty_cash: number; crypto: number } | null>(null);
  const [market, setMarket] = useState<Coin[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCoin, setSelectedCoin] = useState("");
  const [buyAmount, setBuyAmount] = useState(1000);
  const [acting, setActing] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/crime-empire/gambling/stocks");
    const data = await res.json();
    if (data.player) setPlayer(data.player);
    if (data.market) setMarket(data.market);
    if (data.positions) setPositions(data.positions);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const showMsg = (text: string, ok: boolean) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 4000);
  };

  const buy = async () => {
    if (!selectedCoin) { showMsg("Seleciona uma moeda!", false); return; }
    setActing(true);
    const res = await fetch("/api/crime-empire/gambling/stocks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "buy", coinId: selectedCoin, amount: buyAmount }),
    });
    const data = await res.json();
    if (data.success) {
      showMsg(`Comprado! ${data.quantity.toFixed(6)} ${data.symbol} @ $${data.price.toLocaleString()}`, true);
      await fetchData();
    } else {
      showMsg(data.error, false);
    }
    setActing(false);
  };

  const sell = async (positionId: string) => {
    setActing(true);
    const res = await fetch("/api/crime-empire/gambling/stocks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sell", positionId }),
    });
    const data = await res.json();
    if (data.success) {
      showMsg(`Vendido! 🪙 +${data.payout.toLocaleString()} crypto`, true);
      await fetchData();
    } else {
      showMsg(data.error, false);
    }
    setActing(false);
  };

  if (loading) return <div className="flex-1 flex items-center justify-center text-white">A carregar...</div>;

  return (
    <div className="flex-1 text-white py-10 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link href="/jogos/crime-empire/gambling" className="text-sm text-[#888] hover:text-[#ff6a00] mb-2 inline-block">← Casino</Link>
          <h1 className="text-4xl font-black text-yellow-400">📈 MERCADO NEGRO</h1>
          <p className="text-sm text-[#888]">Investe em ativos digitais anónimos. Os preços são reais.</p>
        </div>

        {player && (
          <div className="flex gap-4 mb-6 text-sm">
            <div className="px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#333]">💵 <span className="text-green-400 font-bold">${player.dirty_cash.toLocaleString()}</span></div>
            <div className="px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#333]">🪙 <span className="text-yellow-400 font-bold">{player.crypto.toLocaleString()}</span></div>
          </div>
        )}

        {/* Toast */}
        {msg && (
          <div className={`mb-4 p-3 rounded-lg border text-sm font-bold ${msg.ok ? "bg-green-900/30 border-green-600 text-green-400" : "bg-red-900/30 border-red-600 text-red-400"}`}>
            {msg.text}
          </div>
        )}

        {/* Market */}
        <div className="rounded-xl bg-[#0f0f0f] border border-[#222] mb-6 overflow-hidden">
          <div className="px-4 py-3 border-b border-[#222] text-sm font-bold text-[#888]">MERCADO</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#555] text-xs uppercase">
                <th className="px-4 py-2 text-left">Ativo</th>
                <th className="px-4 py-2 text-right">Preço</th>
                <th className="px-4 py-2 text-right">24h</th>
              </tr>
            </thead>
            <tbody>
              {market.map((coin) => (
                <tr key={coin.id} onClick={() => setSelectedCoin(coin.id)}
                  className={`cursor-pointer border-t border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors ${selectedCoin === coin.id ? "bg-[#1a1a1a] ring-1 ring-inset ring-yellow-600/40" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: coin.color }} />
                      <span className="font-bold">{coin.displayName}</span>
                      <span className="text-[#555] text-xs">{coin.symbol}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">${coin.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                  <td className={`px-4 py-3 text-right font-bold ${coin.change24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {coin.change24h >= 0 ? "+" : ""}{coin.change24h.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Buy */}
        <div className="rounded-xl bg-[#0f0f0f] border border-[#222] mb-6 p-4">
          <p className="text-sm font-bold text-[#888] mb-3">COMPRAR</p>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-[#555]">Ativo (clica na tabela)</label>
              <div className="mt-1 px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#333] text-sm min-h-[38px]">
                {selectedCoin ? (
                  <span className="font-bold" style={{ color: market.find((c) => c.id === selectedCoin)?.color }}>
                    {market.find((c) => c.id === selectedCoin)?.displayName}
                  </span>
                ) : <span className="text-[#444]">Nenhum selecionado</span>}
              </div>
            </div>
            <div>
              <label className="text-xs text-[#555]">Investimento ($)</label>
              <input type="number" value={buyAmount} onChange={(e) => setBuyAmount(Math.max(1000, parseInt(e.target.value) || 0))}
                className="mt-1 w-32 px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#333] text-white text-sm" min={1000} step={500} />
            </div>
            <div className="flex items-end">
              <button onClick={buy} disabled={acting || !selectedCoin}
                className="px-6 py-2 rounded-lg bg-yellow-700 hover:bg-yellow-600 font-bold text-sm disabled:opacity-40">
                {acting ? "..." : "Comprar"}
              </button>
            </div>
          </div>
          <p className="text-xs text-[#555] mt-2">Mínimo: $1,000 em dinheiro sujo. Recebe de volta em crypto quando vender.</p>
        </div>

        {/* Positions */}
        {positions.length > 0 && (
          <div className="rounded-xl bg-[#0f0f0f] border border-[#222] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#222] text-sm font-bold text-[#888]">AS TUAS POSIÇÕES</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[#555] text-xs uppercase">
                  <th className="px-4 py-2 text-left">Ativo</th>
                  <th className="px-4 py-2 text-right">Investido</th>
                  <th className="px-4 py-2 text-right">Atual</th>
                  <th className="px-4 py-2 text-right">P&L</th>
                  <th className="px-4 py-2 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {positions.map((pos) => (
                  <tr key={pos.id} className="border-t border-[#1a1a1a]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: pos.color }} />
                        <span className="font-bold">{pos.displayName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">${pos.invested.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono">${pos.currentValue.toLocaleString()}</td>
                    <td className={`px-4 py-3 text-right font-bold ${pos.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {pos.pnl >= 0 ? "+" : ""}{pos.pnlPercent.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => sell(pos.id)} disabled={acting}
                        className="px-3 py-1 rounded bg-red-900/40 border border-red-700/60 hover:bg-red-700/40 text-red-400 text-xs font-bold disabled:opacity-40">
                        Vender
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {positions.length === 0 && (
          <div className="text-center text-[#555] py-8">Sem posições abertas. Compra um ativo acima!</div>
        )}
      </div>
    </div>
  );
}

