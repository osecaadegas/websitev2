"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const BASE = "/jogos/crime-empire/admin";

interface Stats {
  players: number;
  crimes: number;
  businesses: number;
  items: number;
  shop_listings: number;
  jailed: number;
  contracts: number;
  pvp_battles: number;
  police_intensity: number;
  maintenance: boolean;
}

export default function CEAdminHub() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/crime-empire/players?limit=1").then((r) => r.json()),
      fetch("/api/admin/crime-empire/crimes?limit=1").then((r) => r.json()),
      fetch("/api/admin/crime-empire/businesses?limit=1").then((r) => r.json()),
      fetch("/api/admin/crime-empire/items?limit=1").then((r) => r.json()),
      fetch("/api/admin/crime-empire/shop?limit=1").then((r) => r.json()),
      fetch("/api/admin/crime-empire/players?jailed=true&limit=1").then((r) => r.json()),
      fetch("/api/admin/crime-empire/system").then((r) => r.json()),
      fetch("/api/admin/crime-empire/logs?limit=8").then((r) => r.json()),
      fetch("/api/admin/crime-empire/contracts?limit=1").then((r) => r.json()),
      fetch("/api/admin/crime-empire/pvp?limit=1").then((r) => r.json()),
    ]).then(([p, c, b, i, s, j, sys, l, ct, pvp]) => {
      setStats({
        players: p.total ?? 0,
        crimes: c.total ?? 0,
        businesses: b.total ?? 0,
        items: i.total ?? 0,
        shop_listings: s.total ?? 0,
        jailed: j.total ?? 0,
        contracts: ct.total ?? 0,
        pvp_battles: pvp.total ?? 0,
        police_intensity: Number(sys.settings?.police_intensity ?? 0),
        maintenance: sys.settings?.maintenance_mode === true || sys.settings?.maintenance_mode === "true",
      });
      setLogs(l.logs ?? []);
    });
  }, []);

  const STAT_CARDS = [
    { label: "Jogadores",       value: stats?.players,       icon: "👥", href: `${BASE}/players`,              color: "#3b82f6" },
    { label: "Crimes",          value: stats?.crimes,        icon: "💰", href: `${BASE}/crimes`,               color: "#f59e0b" },
    { label: "Negócios",        value: stats?.businesses,    icon: "🏢", href: `${BASE}/businesses`,           color: "#22c55e" },
    { label: "Items",           value: stats?.items,         icon: "⚔️", href: `${BASE}/items`,                color: "#a855f7" },
    { label: "Na Prisão",       value: stats?.jailed,        icon: "🚔", href: `${BASE}/players?jailed=true`,  color: "#ef4444" },
    { label: "Loja (listings)", value: stats?.shop_listings, icon: "🏪", href: `${BASE}/shop`,                 color: "#ff6a00" },
    { label: "Contratos",        value: stats?.contracts,      icon: "🎯", href: `${BASE}/contracts`,            color: "#ef4444" },
    { label: "Batalhas PvP",     value: stats?.pvp_battles,   icon: "⚔️", href: `${BASE}/pvp`,                  color: "#ef4444" },
  ];

  const actionColor = (action: string) => {
    if (action === "create") return "text-green-400";
    if (action === "delete") return "text-red-400";
    if (action === "player_action") return "text-blue-400";
    if (action === "system") return "text-yellow-400";
    return "text-[#888]";
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-white">🕴️ Crime Empire Admin</h1>
          <p className="text-[#555] mt-1 text-sm">Painel de controlo completo do jogo</p>
        </div>
        <div className="flex gap-2">
          {stats?.maintenance && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-600/20 text-red-400 border border-red-600/30">
              ⚠️ MANUTENÇÃO ATIVA
            </span>
          )}
          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
            (stats?.police_intensity ?? 0) >= 70
              ? "bg-red-600/20 text-red-400 border-red-600/30"
              : (stats?.police_intensity ?? 0) >= 30
              ? "bg-yellow-600/20 text-yellow-400 border-yellow-600/30"
              : "bg-green-600/20 text-green-400 border-green-600/30"
          }`}>
            🚔 Polícia: {stats?.police_intensity ?? "–"}%
          </span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {STAT_CARDS.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="bg-[#0e0e0e] border border-[#1e1e1e] rounded-xl p-4 hover:border-[#333] transition-all group"
          >
            <div className="text-2xl mb-2">{card.icon}</div>
            <div className="text-2xl font-black text-white group-hover:text-[#ff6a00] transition-colors">
              {stats ? (card.value ?? 0).toLocaleString() : "–"}
            </div>
            <div className="text-xs text-[#555] mt-1">{card.label}</div>
          </Link>
        ))}
      </div>

      {/* Quick links + Recent logs */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Quick actions */}
        <div className="bg-[#0e0e0e] border border-[#1e1e1e] rounded-xl p-5">
          <h2 className="font-bold text-white mb-4">Ações Rápidas</h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: `${BASE}/items`,      label: "+ Novo Item",    color: "bg-purple-600/20 text-purple-400 hover:bg-purple-600/30" },
              { href: `${BASE}/crimes`,     label: "+ Novo Crime",   color: "bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30" },
              { href: `${BASE}/businesses`, label: "+ Novo Negócio", color: "bg-green-600/20 text-green-400 hover:bg-green-600/30" },
              { href: `${BASE}/shop`,       label: "+ Listing Loja", color: "bg-orange-600/20 text-orange-400 hover:bg-orange-600/30" },
              { href: `${BASE}/system`,     label: "🎛️ Controlo",    color: "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30" },
              { href: `${BASE}/logs`,       label: "📋 Ver Logs",    color: "bg-[#1a1a1a] text-[#888] hover:text-white" },
              { href: `${BASE}/system`,     label: "🛣️ Config Ruas", color: "bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 col-span-2" },
            ].map((btn) => (
              <Link
                key={btn.label}
                href={btn.href}
                className={`px-3 py-2.5 rounded-lg text-xs font-bold text-center transition-all ${btn.color}`}
              >
                {btn.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Recent audit logs */}
        <div className="bg-[#0e0e0e] border border-[#1e1e1e] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-white">Logs Recentes</h2>
            <Link href={`${BASE}/logs`} className="text-xs text-[#ff6a00] hover:underline">Ver todos →</Link>
          </div>
          {logs.length === 0 ? (
            <p className="text-[#444] text-sm text-center py-4">Nenhum log ainda</p>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-2 text-xs">
                  <span className={`font-bold shrink-0 ${actionColor(log.action)}`}>{log.action}</span>
                  <span className="text-[#555]">{log.entity_type}</span>
                  {log.entity_name && <span className="text-white truncate">{log.entity_name}</span>}
                  <span className="ml-auto text-[#333] shrink-0">
                    {new Date(log.created_at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
