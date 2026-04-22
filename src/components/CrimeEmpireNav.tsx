"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_LINKS = [
  { href: "/jogos/crime-empire/dashboard", label: "Dashboard", icon: "🏠" },
  { href: "/jogos/crime-empire/crimes", label: "Crimes", icon: "💰" },
  { href: "/jogos/crime-empire/contracts", label: "Contratos", icon: "🎯" },
  { href: "/jogos/crime-empire/streets", label: "Ruas", icon: "🌿" },
  { href: "/jogos/crime-empire/pvp", label: "PvP", icon: "⚔️" },
  { href: "/jogos/crime-empire/businesses", label: "Negócios", icon: "🏢" },
  { href: "/jogos/crime-empire/rua-das-luzes", label: "Bordel", icon: "💋" },
  { href: "/jogos/crime-empire/security", label: "Segurança", icon: "🛡️" },
  { href: "/jogos/crime-empire/gambling", label: "Casino", icon: "🎰" },
  { href: "/jogos/crime-empire/shop", label: "Loja", icon: "🛒" },
  { href: "/jogos/crime-empire/black-market", label: "Black Market", icon: "💎" },
  { href: "/jogos/crime-empire/inventory", label: "Inventário", icon: "🎒" },
  { href: "/jogos/crime-empire/hospital", label: "Hospital", icon: "🏥" },
  { href: "/jogos/crime-empire/jail", label: "Prisão", icon: "🚔" },
  { href: "/jogos/crime-empire/stats", label: "Stats", icon: "📊" },
];

export function CrimeEmpireNav() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await fetch("/api/crime-empire/notifications");
        if (res.ok) {
          const data = await res.json();
          setUnreadCount((data.notifications || []).length);
        }
      } catch {
        // silent fail
      }
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <nav className="mb-8 border-b border-[#222222]">
      <div className="flex overflow-x-auto gap-2 pb-4 scrollbar-hide items-center">
        {NAV_LINKS.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all flex-shrink-0
                ${
                  isActive
                    ? "bg-gradient-to-r from-[#ff6a00] to-[#ff8533] text-white font-bold"
                    : "bg-[#1a1a1a] text-[#888888] hover:text-white hover:bg-[#222222]"
                }
              `}
            >
              <span>{link.icon}</span>
              <span className="text-sm uppercase tracking-wide">{link.label}</span>
            </Link>
          );
        })}

        {/* Notifications bell */}
        <Link
          href="/jogos/crime-empire/notifications"
          className="relative flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all flex-shrink-0 bg-[#1a1a1a] text-[#888888] hover:text-white hover:bg-[#222222] ml-auto"
          onClick={() => setUnreadCount(0)}
        >
          <span>🔔</span>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>
      </div>
    </nav>
  );
}
