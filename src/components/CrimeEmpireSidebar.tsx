"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Player {
  username: string;
  level: number;
  hp: number;
  max_hp: number;
  dirty_cash: number;
  cash: number;
  stamina: number;
  max_stamina: number;
  class: string;
}

const GAME_LINKS = [
  { href: "/jogos/crime-empire/dashboard", label: "Dashboard", icon: "🏠" },
  { href: "/jogos/crime-empire/crimes", label: "Crimes", icon: "💰" },
  { href: "/jogos/crime-empire/businesses", label: "Negócios", icon: "🏢" },
  { href: "/jogos/crime-empire/inventory", label: "Inventário", icon: "🎒" },
  { href: "/jogos/crime-empire/jail", label: "Prisão", icon: "🚔" },
  { href: "/jogos/crime-empire/hospital", label: "Hospital", icon: "🏥" },
  { href: "/jogos/crime-empire/pvp", label: "PvP", icon: "⚔️" },
  { href: "/jogos/crime-empire/stats", label: "Estatísticas", icon: "📊" },
];

export function CrimeEmpireSidebar({ open, onClose }: Props) {
  const pathname = usePathname();
  const [player, setPlayer] = useState<Player | null>(null);

  useEffect(() => {
    fetchPlayer();
  }, []);

  const fetchPlayer = async () => {
    try {
      const res = await fetch("/api/crime-empire/player");
      const data = await res.json();
      if (data.player) {
        setPlayer(data.player);
      }
    } catch (error) {
      console.error("Error fetching player:", error);
    }
  };

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
        <div className="p-4 space-y-6">
          {/* Game Title */}
          <div className="pb-4 border-b border-[#ff6a00]/30">
            <h2 className="text-xl font-black bg-gradient-to-r from-[#ff6a00] to-[#ff8533] bg-clip-text text-transparent">
              CRIME EMPIRE
            </h2>
          </div>

          {/* Player Info */}
          {player && (
            <div className="p-3 rounded-lg bg-[#1a1a1a] border border-[#ff6a00]/30 space-y-2">
              <p className="text-sm font-bold text-white">{player.username}</p>
              <p className="text-xs text-[#888888]">
                {player.class.toUpperCase()} • Nível {player.level}
              </p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#888888]">Dinheiro Sujo:</span>
                  <span className="text-green-400">${player.dirty_cash.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#888888]">Dinheiro Limpo:</span>
                  <span className="text-yellow-400">${player.cash.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#888888]">HP:</span>
                  <span className={`${
                    player.hp / player.max_hp > 0.75 ? 'text-green-400' :
                    player.hp / player.max_hp > 0.5 ? 'text-yellow-400' :
                    player.hp / player.max_hp > 0.25 ? 'text-orange-400' :
                    'text-red-400'
                  }`}>
                    {player.hp}/{player.max_hp}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#888888]">Stamina:</span>
                  <span className="text-blue-400">{player.stamina}/{player.max_stamina}</span>
                </div>
              </div>
            </div>
          )}

          {/* Game Navigation */}
          <nav className="space-y-1">
            {GAME_LINKS.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => onClose()}
                  className={`block px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-[#ff6a00] text-white shadow-lg shadow-[#ff6a00]/20"
                      : "text-[#888888] hover:text-white hover:bg-[#1a1a1a]"
                  }`}
                >
                  <span className="mr-2">{link.icon}</span>
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Return to Website */}
          <div className="pt-4 border-t border-[#ff6a00]/30">
            <Link
              href="/jogos"
              className="block px-3 py-2 rounded-lg text-sm font-medium text-[#ff6a00] hover:bg-[#ff6a00]/10 transition-all"
            >
              ← Voltar ao Site
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
