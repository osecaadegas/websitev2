"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Player { level: number; dirty_cash: number; crypto: number; username: string; }
interface HistoryItem { game_type: string; bet_amount: number; payout: number; profit: number; created_at: string; }

const GAMES = [
  { href: "/jogos/crime-empire/gambling/blackjack", label: "Blackjack", icon: "🃏", desc: "Bate o dealer. Blackjack paga 2.5x.", color: "from-green-900/40 to-green-800/20 border-green-500/40 hover:border-green-400" },
  { href: "/jogos/crime-empire/gambling/mines", label: "Mines", icon: "💣", desc: "Revela tiles sem explodir. Faz cashout quando quiseres.", color: "from-red-900/40 to-red-800/20 border-red-500/40 hover:border-red-400" },
  { href: "/jogos/crime-empire/gambling/plinko", label: "Plinko", icon: "🎯", desc: "Deixa a bola cair. Risco à tua escolha.", color: "from-blue-900/40 to-blue-800/20 border-blue-500/40 hover:border-blue-400" },
  { href: "/jogos/crime-empire/gambling/keno", label: "Keno", icon: "🎱", desc: "Escolhe até 10 números. 20 sorteados.", color: "from-purple-900/40 to-purple-800/20 border-purple-500/40 hover:border-purple-400" },
  { href: "/jogos/crime-empire/gambling/stocks", label: "Mercado Negro", icon: "📈", desc: "Investe em cripto anónima. Lucro real, risco real.", color: "from-yellow-900/40 to-yellow-800/20 border-yellow-500/40 hover:border-yellow-400" },
];

const GAME_LABELS: Record<string, string> = { blackjack: "Blackjack", mines: "Mines", plinko: "Plinko", keno: "Keno", stocks: "Mercado" };

export default function GamblingPage() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [casinoFee, setCasinoFee] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/crime-empire/gambling");
      const data = await res.json();
      setPlayer(data.player);
      setCasinoFee(data.casinoFee);
      setHistory(data.history || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex-1 flex items-center justify-center"><div className="text-white text-xl">A carregar...</div></div>;

  return (
    <div className="flex-1 text-white py-10 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <Link href="/jogos/crime-empire/dashboard" className="text-sm text-[#888888] hover:text-[#ff6a00] mb-2 inline-block">← Voltar ao Dashboard</Link>
          <h1 className="text-5xl md:text-6xl font-black bg-gradient-to-r from-yellow-400 via-orange-400 to-yellow-400 bg-clip-text text-transparent">🎰 CASINO</h1>
          <p className="text-[#888888] mt-2">Joga com dinheiro sujo. Ganha em crypto.</p>
        </div>

        {/* Balances */}
        {player && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            <div className="p-4 rounded-xl bg-[#1a1a1a] border border-[#333]">
              <p className="text-xs text-[#888]">Dinheiro Sujo</p>
              <p className="text-xl font-bold text-green-400">${player.dirty_cash.toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-xl bg-[#1a1a1a] border border-[#333]">
              <p className="text-xs text-[#888]">Crypto 🪙</p>
              <p className="text-xl font-bold text-yellow-400">🪙{player.crypto.toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-xl bg-[#1a1a1a] border border-yellow-600/40 col-span-2 md:col-span-1">
              <p className="text-xs text-[#888]">Taxa por Jogo</p>
              <p className="text-xl font-bold text-orange-400">${casinoFee === 0 ? "Grátis" : casinoFee.toLocaleString()}</p>
              <p className="text-[10px] text-[#555]">Nível {player.level} — cobrada ao iniciar</p>
            </div>
          </div>
        )}

        {/* Games Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          {GAMES.map((g) => (
            <Link key={g.href} href={g.href} className={`p-6 rounded-2xl bg-gradient-to-br ${g.color} border-2 transition-all group`}>
              <div className="text-4xl mb-3">{g.icon}</div>
              <h3 className="text-xl font-bold mb-1 group-hover:text-white">{g.label}</h3>
              <p className="text-sm text-[#888888]">{g.desc}</p>
            </Link>
          ))}
        </div>

        {/* History */}
        {history.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-4 text-[#888]">Historial Recente</h2>
            <div className="rounded-xl overflow-hidden border border-[#222]">
              <table className="w-full text-sm">
                <thead className="bg-[#1a1a1a] text-[#555] text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Jogo</th>
                    <th className="px-4 py-3 text-right">Aposta</th>
                    <th className="px-4 py-3 text-right">Payout</th>
                    <th className="px-4 py-3 text-right">Lucro</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={i} className="border-t border-[#1a1a1a] hover:bg-[#111]">
                      <td className="px-4 py-3">{GAME_LABELS[h.game_type] ?? h.game_type}</td>
                      <td className="px-4 py-3 text-right text-[#888]">${h.bet_amount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">🪙{h.payout.toLocaleString()}</td>
                      <td className={`px-4 py-3 text-right font-bold ${h.profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {h.profit >= 0 ? "+" : ""}🪙{h.profit.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

