"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/jogos/crime-empire/dashboard", label: "Dashboard", icon: "🏠" },
  { href: "/jogos/crime-empire/crimes", label: "Crimes", icon: "💰" },
  { href: "/jogos/crime-empire/businesses", label: "Negócios", icon: "🏢" },
  { href: "/jogos/crime-empire/black-market", label: "Black Market", icon: "💎" },
  { href: "/jogos/crime-empire/inventory", label: "Inventário", icon: "🎒" },
  { href: "/jogos/crime-empire/pvp", label: "PvP", icon: "⚔️" },
  { href: "/jogos/crime-empire/stats", label: "Stats", icon: "📊" },
];

export function CrimeEmpireNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-8 border-b border-[#222222]">
      <div className="flex overflow-x-auto gap-2 pb-4 scrollbar-hide">
        {NAV_LINKS.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all
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
      </div>
    </nav>
  );
}
