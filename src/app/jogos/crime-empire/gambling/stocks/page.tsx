"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import RaidEscape from "@/components/crime-empire/raid/RaidEscape";

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
  source: string;
};

function MiniSparkline({ prices, h = 24 }: { prices: number[]; h?: number }) {
  if (!prices || prices.length < 2) return <div className="w-full rounded bg-[#1a1a1a]" style={{ height: h }} />;
  const step = Math.max(1, Math.floor(prices.length / 50));
  const s = prices.filter((_, i) => i % step === 0);
  const min = Math.min(...s), max = Math.max(...s), range = max - min || 1;
  const W = 200;
  const pts = s.map((p, i) => `${(i / (s.length - 1)) * W},${h - ((p - min) / range) * h}`).join(" ");
  const up = s[s.length - 1] >= s[0];
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none" className="overflow-visible">
      <polyline points={pts} fill="none" stroke={up ? "#22c55e" : "#ef4444"} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function DetailChart({ prices, buyPrice, tall }: { prices: number[]; buyPrice?: number; tall?: boolean }) {
  if (!prices || prices.length < 2) {
    return <div className={`w-full rounded bg-[#1a1a1a] flex items-center justify-center text-xs text-[#555] ${tall ? "h-40" : "h-28"}`}>Sem dados</div>;
  }
  const step = Math.max(1, Math.floor(prices.length / 100));
  const s = prices.filter((_, i) => i % step === 0);
  const minVal = Math.min(...s), maxVal = Math.max(...s);
  const pad = (maxVal - minVal) * 0.08 || maxVal * 0.02;
  const lo = minVal - pad, hi = maxVal + pad, range = hi - lo;
  const W = 500, H = tall ? 140 : 100, PX = 4, PY = 6;
  const toX = (i: number) => PX + (i / (s.length - 1)) * (W - PX * 2);
  const toY = (p: number) => H - PY - ((p - lo) / range) * (H - PY * 2);
  const linePts = s.map((p, i) => `${toX(i)},${toY(p)}`).join(" ");
  const areaPath = `M ${toX(0)},${H - PY} ${s.map((p, i) => `L ${toX(i)},${toY(p)}`).join(" ")} L ${toX(s.length - 1)},${H - PY} Z`;
  const up = s[s.length - 1] >= s[0];
  const lc = up ? "#22c55e" : "#ef4444";
  const buyY = buyPrice !== undefined ? toY(buyPrice) : null;
  const gid = `cg${Math.abs(Math.round((prices[0] ?? 0) * 1000)) % 99999}${tall ? "t" : ""}`;
  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className={`w-full ${tall ? "h-40" : "h-28"}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lc} stopOpacity="0.28" />
            <stop offset="100%" stopColor={lc} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gid})`} />
        <polyline points={linePts} fill="none" stroke={lc} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
        {buyY !== null && (
          <line x1={PX} y1={buyY} x2={W - PX} y2={buyY} stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="5,3" opacity="0.85" />
        )}
      </svg>
      <div className="flex justify-between px-0.5 -mt-1">
        {["7d","6d","5d","4d","3d","2d","1d","Agora"].map((l, i) => (
          <span key={i} className="text-[9px] text-[#444]">{l}</span>
        ))}
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

const HOLD_MS = 24 * 60 * 60 * 1000;
const FARM_HOLD_MS = 2 * 60 * 60 * 1000;

function canSellNow(boughtAt: string, source?: string) {
  const holdLimit = source === "farmed" ? FARM_HOLD_MS : HOLD_MS;
  return Date.now() - new Date(boughtAt).getTime() >= holdLimit;
}

function sellCountdown(boughtAt: string, source?: string) {
  const holdLimit = source === "farmed" ? FARM_HOLD_MS : HOLD_MS;
  const ms = holdLimit - (Date.now() - new Date(boughtAt).getTime());
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

export default function StocksPage() {
  const router = useRouter();
  const [player, setPlayer] = useState<{ dirty_cash: number; crypto: number } | null>(null);
  const [market, setMarket] = useState<Coin[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCoinId, setSelectedCoinId] = useState<string | null>(null);
  const [buyAmount, setBuyAmount] = useState(500);
  const [acting, setActing] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [arrestEscape, setArrestEscape] = useState<{ token: string; jailMinutes: number; cryptoAtRisk: number } | null>(null);

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
      showMsg(`Comprado! ${data.quantity.toFixed(6)} ${data.symbol} @ $${data.price.toLocaleString()} · taxa $${data.fee.toLocaleString()}`, true);
      await fetchData();
    } else { showMsg(data.error, false); }
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
      showMsg(`Vendido! 🪙 ${data.payout.toLocaleString()} crypto (taxa $${data.fee.toLocaleString()} · ${sign}${data.profit.toLocaleString()})`, true);
      if (data.escape_token) {
        setArrestEscape({ token: data.escape_token, jailMinutes: data.jailMinutes ?? 20, cryptoAtRisk: data.crypto_at_risk ?? 0 });
      }
      await fetchData();
    } else { showMsg(data.error, false); }
    setActing(false);
  };

  if (loading) return <div className="flex-1 flex items-center justify-center text-white">A carregar...</div>;

  return (
    <div className="flex-1 text-white py-6 px-4 xl:px-8 overflow-auto">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <Link href="/jogos/crime-empire/gambling" className="text-xs text-[#888] hover:text-[#ff6a00] mb-1 inline-block">← Casino</Link>
          <h1 className="text-3xl font-black text-yellow-400 leading-none">📈 MERCADO NEGRO</h1>
          <p className="text-xs text-[#666] mt-1">Investe em ativos digitais anónimos com dinheiro sujo. Os preços são reais.</p>
        </div>
        {player && (
          <div className="flex gap-3 text-sm">
            <div className="px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#333]">💵 <span className="text-green-400 font-bold">${player.dirty_cash.toLocaleString()}</span></div>
            <div className="px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#333]">🪙 <span className="text-yellow-400 font-bold">{player.crypto.toLocaleString()}</span></div>
          </div>
        )}
      </div>

      {msg && (
        <div className={`mb-4 p-3 rounded-lg border text-sm font-bold ${msg.ok ? "bg-green-900/30 border-green-600 text-green-400" : "bg-red-900/30 border-red-600 text-red-400"}`}>
          {msg.text}
        </div>
      )}

      {/* ── 3-column grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)_300px] gap-4 items-start">

        {/* ──────────────────────────────────────────────
            LEFT: AS TUAS POSIÇÕES
        ────────────────────────────────────────────── */}
        <div className="rounded-xl bg-[#0f0f0f] border border-[#222] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#222] flex items-center justify-between">
            <span className="text-sm font-bold text-[#888]">AS TUAS POSIÇÕES</span>
            <span className="text-xs text-[#555]">{positions.length} ativo{positions.length !== 1 ? "s" : ""}</span>
          </div>
          {positions.length === 0 ? (
            <div className="text-center text-[#555] py-10 text-xs px-4">Sem posições.<br />Investe num ativo e vende quando quiseres!</div>
          ) : (
            <div className="divide-y divide-[#1a1a1a]">
              {positions.map((pos) => {
                const coinData = market.find((c) => c.id === pos.coinId);
                return (
                  <div key={pos.id} className="px-3 py-3">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: pos.color }} />
                        <span className="font-bold text-sm truncate">{pos.displayName}</span>
                        <span className="text-[#555] text-xs flex-shrink-0">{pos.symbol}</span>
                        {pos.source === "farmed" && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-cyan-900/40 border border-cyan-700/40 text-cyan-400 flex-shrink-0">⛏️ Farm</span>
                        )}
                      </div>
                      <span className={`text-sm font-black flex-shrink-0 ${pos.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {pos.pnlPercent >= 0 ? "+" : ""}{pos.pnlPercent.toFixed(1)}%
                      </span>
                    </div>
                    {coinData && coinData.sparkline.length > 1 && (
                      <div className="mb-2">
                        <DetailChart prices={coinData.sparkline} buyPrice={pos.boughtPrice} />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs mb-2">
                      <div><span className="text-[#555]">Investido </span><span className="font-bold">${pos.invested.toLocaleString()}</span></div>
                      <div><span className="text-[#555]">Valor </span><span className={`font-bold ${pos.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>${pos.currentValue.toLocaleString()}</span></div>
                      <div><span className="text-[#555]">P&L </span><span className={`font-bold ${pos.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>{pos.pnl >= 0 ? "+" : ""}${pos.pnl.toLocaleString()}</span></div>
                      <div><span className="text-[#555]">Hold </span><span className="font-bold text-yellow-500">{holdDuration(pos.boughtAt)}</span></div>
                    </div>
                    {(() => {
                      const ok = canSellNow(pos.boughtAt, pos.source);
                      const countdown = sellCountdown(pos.boughtAt, pos.source);
                      return (
                        <button
                          onClick={() => sell(pos.id)}
                          disabled={acting || !ok}
                          title={ok ? undefined : `Podes vender em ${countdown}`}
                          className={`w-full py-1.5 rounded-lg border text-xs font-bold transition-colors ${
                            ok
                              ? "bg-red-900/40 border-red-700/50 hover:bg-red-700/40 text-red-400 disabled:opacity-40"
                              : "bg-[#1a1a1a] border-[#333] text-[#555] cursor-not-allowed"
                          }`}
                        >
                          {ok ? "Vender 🪙" : `🔒 ${countdown}`}
                        </button>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ──────────────────────────────────────────────
            CENTER: Chart (when selected) + Market table
        ────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">

          {/* Detail chart panel */}
          {selectedCoin ? (
            <div className="rounded-xl bg-[#0a0a0a] border border-[#2a2a2a] p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: selectedCoin.color }} />
                  <span className="font-black text-xl">{selectedCoin.displayName}</span>
                  <span className="text-[#555] text-sm">{selectedCoin.symbol}</span>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black">${selectedCoin.price.toLocaleString(undefined, { maximumFractionDigits: selectedCoin.price < 1 ? 6 : 2 })}</p>
                  <div className="flex gap-3 text-xs justify-end mt-0.5">
                    <span className={selectedCoin.change24h >= 0 ? "text-green-400" : "text-red-400"}>24h: {selectedCoin.change24h >= 0 ? "+" : ""}{selectedCoin.change24h.toFixed(2)}%</span>
                    <span className={selectedCoin.change7d >= 0 ? "text-green-400" : "text-red-400"}>7d: {selectedCoin.change7d >= 0 ? "+" : ""}{selectedCoin.change7d.toFixed(2)}%</span>
                  </div>
                </div>
              </div>
              <DetailChart prices={selectedCoin.sparkline} buyPrice={positionForSelected?.boughtPrice} tall />
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
          ) : (
            <div className="rounded-xl bg-[#0a0a0a] border border-[#2a2a2a] p-4 flex items-center justify-center h-32 text-xs text-[#444]">
              Clica num ativo para ver o gráfico detalhado
            </div>
          )}

          {/* Market table */}
          <div className="rounded-xl bg-[#0f0f0f] border border-[#222] overflow-hidden">
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
                  <th className="px-4 py-2 text-right pr-4">7d Gráfico</th>
                </tr>
              </thead>
              <tbody>
                {market.map((coin) => {
                  const isSelected = selectedCoinId === coin.id;
                  const hasPos = positions.some((p) => p.coinId === coin.id);
                  return (
                    <tr key={coin.id} onClick={() => setSelectedCoinId(isSelected ? null : coin.id)}
                      className={`cursor-pointer border-t border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors ${isSelected ? "bg-[#161616] ring-1 ring-inset ring-yellow-900/50" : ""}`}>
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
                      <td className="px-3 py-2 text-right w-28">
                        <MiniSparkline prices={coin.sparkline} h={28} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>

        {/* ──────────────────────────────────────────────
            RIGHT: COMPRAR
        ────────────────────────────────────────────── */}
        <div className="rounded-xl bg-[#0f0f0f] border border-[#222] p-4 flex flex-col gap-4">
          <p className="text-sm font-bold text-[#888]">COMPRAR</p>

          {/* Selected coin display */}
          <div>
            <label className="text-xs text-[#555]">Ativo selecionado</label>
            <div className="mt-1 px-3 py-2.5 rounded-lg bg-[#1a1a1a] border border-[#333] text-sm min-h-[42px] flex items-center gap-2">
              {selectedCoin ? (
                <>
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: selectedCoin.color }} />
                  <div className="min-w-0">
                    <p className="font-bold text-sm leading-tight" style={{ color: selectedCoin.color }}>{selectedCoin.displayName}</p>
                    <p className="text-[#666] text-xs">${selectedCoin.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                  </div>
                </>
              ) : <span className="text-[#444] text-xs">Clica numa moeda no mercado</span>}
            </div>
          </div>

          {/* Amount input */}
          <div>
            <label className="text-xs text-[#555]">Investimento (Dinheiro Sujo)</label>
            <div className="flex gap-2 mt-1">
              <input type="number" value={buyAmount} onChange={(e) => setBuyAmount(Math.min(10000, Math.max(100, parseInt(e.target.value) || 100)))}
                className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#333] text-white text-sm" min={100} max={10000} step={100} />
            </div>
            {/* Quick amounts */}
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {[100, 500, 1000, 5000, 10000].map((v) => (
                <button key={v} onClick={() => setBuyAmount(v)}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${buyAmount === v ? "bg-yellow-900/40 border-yellow-700/60 text-yellow-400" : "bg-[#1a1a1a] border-[#333] text-[#666] hover:text-white"}`}>
                  ${v >= 1000 ? `${v / 1000}k` : v}
                </button>
              ))}
            </div>
          </div>

          {/* Fee breakdown */}
          {selectedCoin && buyAmount >= 100 && (
            <div className="rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] px-3 py-2.5 text-xs space-y-1">
              <div className="flex justify-between text-[#666]">
                <span>Investimento</span>
                <span>${buyAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-red-400">
                <span>Taxa (5%)</span>
                <span>-${Math.floor(buyAmount * 0.05).toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold border-t border-[#333] pt-1">
                <span className="text-[#999]">Total debitado</span>
                <span className="text-yellow-400">${(buyAmount + Math.floor(buyAmount * 0.05)).toLocaleString()}</span>
              </div>
            </div>
          )}

          <button onClick={buy} disabled={acting || !selectedCoinId}
            className="w-full py-3 rounded-lg bg-yellow-700 hover:bg-yellow-600 font-black text-sm disabled:opacity-40 transition-colors">
            {acting ? "A processar..." : "💰 Comprar"}
          </button>

          {player && (
            <p className="text-xs text-orange-400/70 text-center">
              ⚠️ 15% risco de prisão ao vender (7.5% Scammer) · 💎 em risco = valor investido
            </p>
          )}

          <p className="text-[10px] text-[#444] text-center">Min $100 · Máx $10,000. Investimento em dinheiro sujo, retorno em 🪙 crypto.</p>
        </div>

      </div>
      {arrestEscape && (
        <RaidEscape
          difficulty="medium"
          cashAtRisk={buyAmount}
          cryptoAtRisk={arrestEscape.cryptoAtRisk}
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
