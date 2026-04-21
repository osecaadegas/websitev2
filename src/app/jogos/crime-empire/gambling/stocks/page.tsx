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
  change7d: number;
  sparkline: number[];
};

type Position = {
  id: string;
  coinId: string;
  displayName: string;
  symbol: string;
  color: string;
  invested: number;
  boughtPrice: number;
  currentPrice: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
  boughtAt: string;
};

// ── Mini sparkline (inline table) ────────────────────────────
function MiniSparkline({ prices }: { prices: number[] }) {
  if (!prices || prices.length < 2) return <div className="w-20 h-6 rounded bg-[#1a1a1a]" />;
  const step = Math.max(1, Math.floor(prices.length / 40));
  const s = prices.filter((_, i) => i % step === 0);
  const min = Math.min(...s), max = Math.max(...s);
  const range = max - min || 1;
  const W = 80, H = 24;
  const pts = s.map((p, i) => `${(i / (s.length - 1)) * W},${H - ((p - min) / range) * H}`).join(" ");
  const up = s[s.length - 1] >= s[0];
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={up ? "#22c55e" : "#ef4444"} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Detail chart (7-day area chart) ─────────────────────────
function DetailChart({ prices, buyPrice }: { prices: number[]; buyPrice?: number }) {
  if (!prices || prices.length < 2) {
    return <div className="w-full h-28 rounded bg-[#1a1a1a] flex items-center justify-center text-xs text-[#555]">Sem dados históricos</div>;
  }
  const step = Math.max(1, Math.floor(prices.length / 100));
  const s = prices.filter((_, i) => i % step === 0);
  const minVal = Math.min(...s), maxVal = Math.max(...s);
  const padding = (maxVal - minVal) * 0.08 || maxVal * 0.02;
  const lo = minVal - padding, hi = maxVal + padding;
  const range = hi - lo;
  const W = 500, H = 100, PX = 4, PY = 6;
  const toX = (i: number) => PX + (i / (s.length - 1)) * (W - PX * 2);
  const toY = (p: number) => H - PY - ((p - lo) / range) * (H - PY * 2);
  const linePts = s.map((p, i) => `${toX(i)},${toY(p)}`).join(" ");
  const areaPath = `M ${toX(0)},${H - PY} ${s.map((p, i) => `L ${toX(i)},${toY(p)}`).join(" ")} L ${toX(s.length - 1)},${H - PY} Z`;
  const up = s[s.length - 1] >= s[0];
  const lineColor = up ? "#22c55e" : "#ef4444";
  const buyY = buyPrice !== undefined ? toY(buyPrice) : null;
  const gradId = `cg${Math.abs(Math.round(prices[0] * 1000)) % 99999}`;
  const labels = ["7d", "6d", "5d", "4d", "3d", "2d", "1d", "Agora"];
  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-28" preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradId})`} />
        <polyline points={linePts} fill="none" stroke={lineColor} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
        {buyY !== null && (
          <line x1={PX} y1={buyY} x2={W - PX} y2={buyY} stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="5,3" opacity="0.85" />
        )}
      </svg>
      <div className="flex justify-between px-0.5 -mt-1">
        {labels.map((l, i) => <span key={i} className="text-[9px] text-[#444]">{l}</span>)}
      </div>
      {buyY !== null && <div className="text-[10px] text-yellow-600 mt-0.5">— Preço de compra</div>}
    </div>
  );
}

function holdDuration(boughtAt: string) {
  const ms = Date.now() - new Date(boughtAt).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `há ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `há ${hrs}h`;
  return `há ${Math.floor(hrs / 24)}d`;
}

export default function StocksPage() {
  const [player, setPlayer] = useState<{ dirty_cash: number; crypto: number } | null>(null);
  const [market, setMarket] = useState<Coin[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCoinId, setSelectedCoinId] = useState<string | null>(null);
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

  const selectedCoin = market.find((c) => c.id === selectedCoinId) ?? null;
  const positionForSelected = positions.find((p) => p.coinId === selectedCoinId) ?? null;

  const buy = async () => {
    if (!selectedCoinId) { showMsg("Seleciona uma moeda!", false); return; }
    setActing(true);
    const res = await fetch("/api/crime-empire/gambling/stocks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "buy", coinId: selectedCoinId, amount: buyAmount }),
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
      const sign = data.profit >= 0 ? "+" : "";
      showMsg(`Vendido! 🪙 ${data.payout.toLocaleString()} crypto (${sign}${data.profit.toLocaleString()})`, true);
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
          <p className="text-sm text-[#888]">Investe em ativos digitais anónimos com dinheiro sujo. Os preços são reais.</p>
        </div>

        {player && (
          <div className="flex gap-4 mb-6 text-sm">
            <div className="px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#333]">💵 <span className="text-green-400 font-bold">${player.dirty_cash.toLocaleString()}</span></div>
            <div className="px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#333]">🪙 <span className="text-yellow-400 font-bold">{player.crypto.toLocaleString()}</span></div>
          </div>
        )}

        {msg && (
          <div className={`mb-4 p-3 rounded-lg border text-sm font-bold ${msg.ok ? "bg-green-900/30 border-green-600 text-green-400" : "bg-red-900/30 border-red-600 text-red-400"}`}>
            {msg.text}
          </div>
        )}

        {/* Market table */}
        <div className="rounded-xl bg-[#0f0f0f] border border-[#222] mb-4 overflow-hidden">
          <div className="px-4 py-3 border-b border-[#222] flex items-center justify-between">
            <span className="text-sm font-bold text-[#888]">MERCADO</span>
            <span className="text-xs text-[#555]">Clica para selecionar + ver gráfico</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#555] text-xs uppercase">
                <th className="px-4 py-2 text-left">Ativo</th>
                <th className="px-4 py-2 text-right">Preço</th>
                <th className="px-4 py-2 text-right">24h</th>
                <th className="px-4 py-2 text-right">7d</th>
                <th className="px-4 py-2 text-right pr-5">Gráfico</th>
              </tr>
            </thead>
            <tbody>
              {market.map((coin) => {
                const isSelected = selectedCoinId === coin.id;
                const hasPos = positions.some((p) => p.coinId === coin.id);
                return (
                  <tr key={coin.id} onClick={() => setSelectedCoinId(isSelected ? null : coin.id)}
                    className={`cursor-pointer border-t border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors ${isSelected ? "bg-[#161616]" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: coin.color }} />
                        <span className="font-bold">{coin.displayName}</span>
                        <span className="text-[#555] text-xs">{coin.symbol}</span>
                        {hasPos && <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-900/30 text-yellow-500 border border-yellow-800/40">HOLD</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      ${coin.price.toLocaleString(undefined, { maximumFractionDigits: coin.price < 1 ? 4 : 2 })}
                    </td>
                    <td className={`px-4 py-3 text-right font-bold text-xs ${coin.change24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {coin.change24h >= 0 ? "+" : ""}{coin.change24h.toFixed(2)}%
                    </td>
                    <td className={`px-4 py-3 text-right font-bold text-xs ${coin.change7d >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {coin.change7d >= 0 ? "+" : ""}{coin.change7d.toFixed(2)}%
                    </td>
                    <td className="px-3 py-2 text-right">
                      <MiniSparkline prices={coin.sparkline} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Expanded detail panel (shows on coin click) */}
        {selectedCoin && (
          <div className="rounded-xl bg-[#0a0a0a] border border-[#2a2a2a] mb-4 p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: selectedCoin.color }} />
                <span className="font-black text-lg">{selectedCoin.displayName}</span>
                <span className="text-[#555] text-sm">{selectedCoin.symbol}</span>
              </div>
              <div className="text-right">
                <p className="text-xl font-black">${selectedCoin.price.toLocaleString(undefined, { maximumFractionDigits: selectedCoin.price < 1 ? 6 : 2 })}</p>
                <div className="flex gap-3 text-xs justify-end mt-0.5">
                  <span className={selectedCoin.change24h >= 0 ? "text-green-400" : "text-red-400"}>24h: {selectedCoin.change24h >= 0 ? "+" : ""}{selectedCoin.change24h.toFixed(2)}%</span>
                  <span className={selectedCoin.change7d >= 0 ? "text-green-400" : "text-red-400"}>7d: {selectedCoin.change7d >= 0 ? "+" : ""}{selectedCoin.change7d.toFixed(2)}%</span>
                </div>
              </div>
            </div>
            <DetailChart prices={selectedCoin.sparkline} buyPrice={positionForSelected?.boughtPrice} />
            {positionForSelected && (
              <div className="mt-3 p-3 rounded-lg bg-[#111] border border-[#2a2a2a] text-xs flex gap-5 flex-wrap">
                <div><span className="text-[#555]">Comprado a </span><span className="font-bold">${positionForSelected.boughtPrice.toLocaleString(undefined, { maximumFractionDigits: positionForSelected.boughtPrice < 1 ? 6 : 2 })}</span></div>
                <div><span className="text-[#555]">Investido </span><span className="font-bold text-green-400">${positionForSelected.invested.toLocaleString()}</span></div>
                <div><span className="text-[#555]">Valor atual </span><span className="font-bold">${positionForSelected.currentValue.toLocaleString()}</span></div>
                <div><span className="text-[#555]">P&L </span>
                  <span className={`font-bold ${positionForSelected.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {positionForSelected.pnlPercent >= 0 ? "+" : ""}{positionForSelected.pnlPercent.toFixed(2)}%
                  </span>
                </div>
                <div><span className="text-[#555]">A segurar </span><span className="font-bold text-yellow-400">{holdDuration(positionForSelected.boughtAt)}</span></div>
              </div>
            )}
          </div>
        )}

        {/* Buy form */}
        <div className="rounded-xl bg-[#0f0f0f] border border-[#222] mb-6 p-4">
          <p className="text-sm font-bold text-[#888] mb-3">COMPRAR</p>
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-40">
              <label className="text-xs text-[#555]">Ativo selecionado</label>
              <div className="mt-1 px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#333] text-sm min-h-[38px] flex items-center gap-2">
                {selectedCoin ? (
                  <>
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: selectedCoin.color }} />
                    <span className="font-bold" style={{ color: selectedCoin.color }}>{selectedCoin.displayName}</span>
                    <span className="text-[#555] text-xs">${selectedCoin.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </>
                ) : <span className="text-[#444]">Clica numa moeda acima</span>}
              </div>
            </div>
            <div>
              <label className="text-xs text-[#555]">Investimento ($)</label>
              <input type="number" value={buyAmount} onChange={(e) => setBuyAmount(Math.max(1000, parseInt(e.target.value) || 0))}
                className="mt-1 w-32 px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#333] text-white text-sm" min={1000} step={500} />
            </div>
            <div className="flex items-end">
              <button onClick={buy} disabled={acting || !selectedCoinId}
                className="px-6 py-2 rounded-lg bg-yellow-700 hover:bg-yellow-600 font-bold text-sm disabled:opacity-40 transition-colors">
                {acting ? "..." : "Comprar"}
              </button>
            </div>
          </div>
          {selectedCoin && buyAmount >= 1000 ? (
            <p className="text-xs text-[#555] mt-2">≈ {(buyAmount / selectedCoin.price).toFixed(selectedCoin.price < 1 ? 2 : 6)} {selectedCoin.symbol} ao preço atual</p>
          ) : (
            <p className="text-xs text-[#555] mt-2">Mínimo: $1,000. Recebe em crypto ao vender.</p>
          )}
        </div>

        {/* Open positions */}
        <div className="rounded-xl bg-[#0f0f0f] border border-[#222] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#222] flex items-center justify-between">
            <span className="text-sm font-bold text-[#888]">AS TUAS POSIÇÕES</span>
            <span className="text-xs text-[#555]">{positions.length} ativo{positions.length !== 1 ? "s" : ""} em carteira</span>
          </div>
          {positions.length === 0 ? (
            <div className="text-center text-[#555] py-10 text-sm">Sem posições. Investe num ativo acima e vende quando quiseres!</div>
          ) : (
            <div className="divide-y divide-[#1a1a1a]">
              {positions.map((pos) => {
                const coinData = market.find((c) => c.id === pos.coinId);
                return (
                  <div key={pos.id} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: pos.color }} />
                          <span className="font-bold">{pos.displayName}</span>
                          <span className="text-[#555] text-xs">{pos.symbol}</span>
                          <span className="text-[10px] text-[#555]">{holdDuration(pos.boughtAt)}</span>
                        </div>
                        {coinData && coinData.sparkline.length > 1 && (
                          <div className="mb-2">
                            <DetailChart prices={coinData.sparkline} buyPrice={pos.boughtPrice} />
                          </div>
                        )}
                        <div className="flex gap-4 text-xs flex-wrap">
                          <div><span className="text-[#555]">Investido </span><span className="font-bold">${pos.invested.toLocaleString()}</span></div>
                          <div><span className="text-[#555]">Comprado a </span><span className="font-bold">${pos.boughtPrice.toLocaleString(undefined, { maximumFractionDigits: pos.boughtPrice < 1 ? 6 : 2 })}</span></div>
                          <div><span className="text-[#555]">Preço atual </span><span className="font-bold">${pos.currentPrice.toLocaleString(undefined, { maximumFractionDigits: pos.currentPrice < 1 ? 6 : 2 })}</span></div>
                          <div><span className="text-[#555]">Valor </span><span className={`font-bold ${pos.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>${pos.currentValue.toLocaleString()}</span></div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-3 flex-shrink-0">
                        <div className={`text-right ${pos.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                          <p className="text-lg font-black">{pos.pnlPercent >= 0 ? "+" : ""}{pos.pnlPercent.toFixed(2)}%</p>
                          <p className="text-xs font-bold">{pos.pnl >= 0 ? "+" : ""}${pos.pnl.toLocaleString()}</p>
                        </div>
                        <button onClick={() => sell(pos.id)} disabled={acting}
                          className="px-4 py-2 rounded-lg bg-red-900/40 border border-red-700/60 hover:bg-red-700/40 text-red-400 text-xs font-bold disabled:opacity-40 transition-colors">
                          Vender 🪙
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
