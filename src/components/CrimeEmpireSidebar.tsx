"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";

const CLASS_NAMES: Record<string, string> = {
  thief: "Ladrão", hooligan: "Hooligan", businessman: "Empresário",
  hitman: "Assassino", scammer: "Burlão", brute: "Bruto",
  dealer: "Traficante", pimp: "Chulo",
};
const CLASS_GLOW: Record<string, string> = {
  thief: "#9333ea", hooligan: "#dc2626", businessman: "#2563eb",
  hitman: "#475569", scammer: "#d97706", brute: "#ea580c",
  dealer: "#16a34a", pimp: "#db2777",
};

interface SidebarPlayer {
  username: string; display_name: string; class: string;
  level: number; hp: number; max_hp: number;
  cash: number; dirty_cash: number; in_jail: boolean;
  prestige_level: number; avatar_url?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const GAMBLING_LINKS = [
  { href: "/jogos/crime-empire/gambling/blackjack", label: "Blackjack", icon: "🃏" },
  { href: "/jogos/crime-empire/gambling/mines", label: "Mines", icon: "💣" },
  { href: "/jogos/crime-empire/gambling/keno", label: "Keno", icon: "🎱" },
  { href: "/jogos/crime-empire/gambling/stocks", label: "Stock Market", icon: "📈" },
];

const GAME_SECTIONS = [
  {
    section: "Crime",
    links: [
      { href: "/jogos/crime-empire/crimes", label: "Crimes", icon: "💰" },
      { href: "/jogos/crime-empire/contracts", label: "Contratos", icon: "🎯" },
      { href: "/jogos/crime-empire/businesses", label: "Negócios", icon: "🏢" },
      { href: "/jogos/crime-empire/rua-das-luzes", label: "Rua das Luzes", icon: "💋" },
      { href: "/jogos/crime-empire/black-market", label: "Black Market", icon: "💎" },
      { href: "/jogos/crime-empire/streets", label: "Ruas", icon: "🌿" },
      { href: "/jogos/crime-empire/porto", label: "Porto", icon: "⛵" },
      { href: "/jogos/crime-empire/acidente-de-aviao", label: "Acidente de Avião", icon: "✈️" },
      { href: "/jogos/crime-empire/shop", label: "Loja do Chinês", icon: "🏪" },
    ],
  },
  {
    section: "Personagem",
    links: [
      { href: "/jogos/crime-empire/pvp", label: "PvP", icon: "⚔️" },
    ],
  },
  {
    section: "Outros",
    links: [
      { href: "/jogos/crime-empire/security", label: "Segurança", icon: "🛡️" },
      { href: "/jogos/crime-empire/jail", label: "Prisão", icon: "🚔" },
      { href: "/jogos/crime-empire/hospital", label: "Hospital", icon: "🏥" },
    ],
  },
];

const COMING_SOON_ITEMS = [
  { label: "Conquistas", icon: "🏆" },
  { label: "Gang",       icon: "👥" },
  { label: "Battlepass", icon: "🛡️" },
];

export function CrimeEmpireSidebar({ open, onClose }: Props) {
  const pathname = usePathname();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "configurador";
  const isGamblingActive = pathname.startsWith("/jogos/crime-empire/gambling");
  const [gamblingOpen, setGamblingOpen] = useState(isGamblingActive);
  const [player, setPlayer] = useState<SidebarPlayer | null>(null);
  const [comingSoonToast, setComingSoonToast] = useState<string | null>(null);

  const fetchPlayer = useCallback(async () => {
    try {
      const res = await fetch("/api/crime-empire/player");
      const data = await res.json();
      if (data.player) setPlayer(data.player);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (user) fetchPlayer();
  }, [user, fetchPlayer]);

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`fixed top-16 left-0 h-[calc(100vh-4rem)] w-56 bg-gradient-to-b from-[#121212] to-[#0a0a0a] border-r border-[#ff6a00]/20 z-50 transform transition-transform duration-300 overflow-y-auto ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-3 space-y-4">
          {/* ── Player Profile ── */}
          {player && (() => {
            const glow = CLASS_GLOW[player.class] ?? "#ff6a00";
            const hpPct = Math.min(100, Math.round((player.hp / player.max_hp) * 100));
            return (
              <Link
                href="/jogos/crime-empire/profile"
                onClick={onClose}
                className="block rounded-xl p-2.5 border transition-all hover:opacity-90"
                style={{ background: `${glow}12`, borderColor: `${glow}35` }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-full overflow-hidden border-2" style={{ borderColor: glow }}>
                      <Image
                        src={`/images/crime_empire/characters/${player.class}.png`}
                        alt={player.class}
                        width={40} height={40}
                        className="w-full h-full object-contain bg-[#0a0a0a]"
                      />
                    </div>
                    {player.in_jail && (
                      <span className="absolute -bottom-1 -right-1 text-[9px] bg-red-600 rounded-full px-1">🚔</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-black text-white text-xs truncate">{player.display_name || player.username}</p>
                      {player.prestige_level > 0 && <span className="text-yellow-400 text-[9px] font-bold">⭐{player.prestige_level}</span>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[9px] font-bold px-1.5 py-px rounded-full" style={{ background: `${glow}25`, color: glow }}>
                        Nv.{player.level} {CLASS_NAMES[player.class] ?? player.class}
                      </span>
                    </div>
                    {/* HP bar */}
                    <div className="mt-1.5">
                      <div className="flex justify-between text-[8px] text-gray-500 mb-0.5">
                        <span>❤️ HP</span><span>{player.hp}/{player.max_hp}</span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden bg-[#1a1a1a]">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${hpPct}%`, background: hpPct > 50 ? "#22c55e" : hpPct > 25 ? "#eab308" : "#ef4444" }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                {/* Cash row */}
                <div className="mt-2 grid grid-cols-2 gap-1.5 text-center">
                  <div className="rounded-lg py-1 px-2" style={{ background: "rgba(0,0,0,0.3)" }}>
                    <p className="text-[8px] text-gray-500">Limpo</p>
                    <p className="text-[10px] font-bold text-green-400">${player.cash.toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg py-1 px-2" style={{ background: "rgba(0,0,0,0.3)" }}>
                    <p className="text-[8px] text-gray-500">Sujo</p>
                    <p className="text-[10px] font-bold text-yellow-400">${player.dirty_cash.toLocaleString()}</p>
                  </div>
                </div>
              </Link>
            );
          })()}

          {/* Game Navigation */}
          <nav className="space-y-1">
            {GAME_SECTIONS.map((group, i) => (
              <React.Fragment key={i}>
              <div key={i}>
                {group.section && (
                  <></>
                )}
                <div className="">
                  {group.links.map((link) => {
                    const isActive = pathname === link.href;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => onClose()}
                        className={`block px-2.5 py-1.5 text-sm rounded-lg font-medium transition-all ${
                          isActive
                            ? "bg-[#ff6a00] text-white shadow-lg shadow-[#ff6a00]/20"
                            : "text-[#b0b0b0] hover:text-white hover:bg-[#1a1a1a]"
                        }`}
                      >
                        <span className="mr-2">{link.icon}</span>
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
              {i === 1 && (
                <div>
                  <button
                    onClick={() => setGamblingOpen((v) => !v)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 text-sm rounded-lg font-medium transition-all ${
                      isGamblingActive
                        ? "bg-[#ff6a00]/20 text-[#ff6a00]"
                        : "text-[#b0b0b0] hover:text-white hover:bg-[#1a1a1a]"
                    }`}
                  >
                    <span><span className="mr-2">🎰</span>Gambling</span>
                    <span className={`text-xs transition-transform ${gamblingOpen ? "rotate-180" : ""}`}>▼</span>
                  </button>
                  <AnimatePresence initial={false}>
                    {gamblingOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-1 space-y-1">
                          {GAMBLING_LINKS.map((link) => {
                            const isActive = pathname === link.href;
                            return (
                              <Link
                                key={link.href}
                                href={link.href}
                                onClick={() => onClose()}
                                className={`block pl-5 pr-3 py-1 text-xs rounded-lg font-medium transition-all ${
                                  isActive
                                    ? "bg-[#ff6a00] text-white shadow-lg shadow-[#ff6a00]/20"
                                    : "text-[#999] hover:text-[#ccc] hover:bg-[#1a1a1a]"
                                }`}
                              >
                                <span className="mr-2">{link.icon}</span>
                                {link.label}
                              </Link>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
              </React.Fragment>
            ))}
          </nav>

          {/* Coming Soon */}
          <div className="pt-1 border-t border-[#ff6a00]/20 space-y-1">
            {COMING_SOON_ITEMS.map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  setComingSoonToast(item.label);
                  setTimeout(() => setComingSoonToast(null), 2000);
                }}
                className="group relative w-full flex items-center justify-between px-2.5 py-1.5 text-sm rounded-lg font-medium overflow-hidden border border-yellow-500/25 hover:border-yellow-400/50 transition-colors duration-200"
                style={{
                  backgroundImage: "repeating-linear-gradient(135deg, #1a1400 0px, #1a1400 10px, #2a1f00 10px, #2a1f00 20px)",
                }}
              >
                <span
                  className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(234,179,8,0.08) 0px, rgba(234,179,8,0.08) 10px, transparent 10px, transparent 20px)" }}
                />
                <span className="relative flex items-center gap-2 text-yellow-500/75 group-hover:text-yellow-300 transition-colors duration-200">
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </span>
                <span
                  className="relative text-[8px] font-black tracking-[0.15em] uppercase px-1.5 py-px rounded"
                  style={{ background: "rgba(234,179,8,0.12)", color: "rgba(234,179,8,0.65)", border: "1px solid rgba(234,179,8,0.22)" }}
                >
                  EM BREVE
                </span>
              </button>
            ))}
            <AnimatePresence>
              {comingSoonToast && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-[10px] font-bold tracking-widest uppercase"
                  style={{ background: "rgba(26,20,0,0.97)", border: "1px solid rgba(234,179,8,0.35)", color: "#fbbf24" }}
                >
                  <span>🚧</span>
                  <span>{comingSoonToast} — Em Breve!</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Admin Link */}
          {isAdmin && (
            <div className="pt-1">
              <Link
                href="/jogos/crime-empire/admin"
                onClick={onClose}
                className={`block px-2.5 py-1.5 rounded-lg text-sm font-bold transition-all border ${
                  pathname.startsWith("/jogos/crime-empire/admin")
                    ? "bg-red-600/20 border-red-500/50 text-red-400"
                    : "border-red-900/40 text-red-500/70 hover:bg-red-900/20 hover:text-red-400"
                }`}
              >
                <span className="mr-2">🛡️</span>Admin Panel
              </Link>
            </div>
          )}

          {/* Return to Website */}
          <div className="pt-3 border-t border-[#ff6a00]/30">
            <Link
              href="/jogos"
              className="block px-2.5 py-1.5 rounded-lg text-sm font-medium text-[#ff6a00] hover:bg-[#ff6a00]/10 transition-all"
            >
              ← Voltar ao Site
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
