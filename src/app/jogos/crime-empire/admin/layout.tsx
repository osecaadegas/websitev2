"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const BASE = "/jogos/crime-empire/admin";

const NAV = [
  { href: BASE,                 label: "Visão Geral", icon: "🏠", exact: true },
  { href: `${BASE}/items`,      label: "Items",       icon: "⚔️" },
  { href: `${BASE}/crimes`,     label: "Crimes",      icon: "💰" },
  { href: `${BASE}/businesses`, label: "Negócios",    icon: "🏢" },
  { href: `${BASE}/shop`,       label: "Loja",        icon: "🛒" },
  { href: `${BASE}/players`,    label: "Jogadores",   icon: "👥" },
  { href: `${BASE}/system`,     label: "Controlo",    icon: "🎛️" },
  { href: `${BASE}/logs`,       label: "Logs",        icon: "📋" },
  { href: `${BASE}/pvp`,        label: "PvP",         icon: "⚔️" },
];

export default function CEAdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (user === null) {
      router.replace("/jogos/crime-empire/dashboard");
      return;
    }
    if (user && user.role !== "admin" && user.role !== "configurador") {
      router.replace("/jogos/crime-empire/dashboard");
    }
  }, [user, router]);

  if (!user || (user.role !== "admin" && user.role !== "configurador")) {
    return (
      <div className="flex items-center justify-center py-24 text-[#444]">
        A verificar permissões…
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Admin header */}
      <div className="flex items-center gap-3 mb-5">
        <span className="text-2xl">🛡️</span>
        <div>
          <h2 className="text-lg font-black text-white">Admin Panel</h2>
          <p className="text-xs text-[#555]">Crime Empire · Gestão do Jogo</p>
        </div>
      </div>

      {/* Horizontal tab nav */}
      <nav className="flex gap-1 flex-wrap mb-6 pb-5 border-b border-[#1e1e1e]">
        {NAV.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                active
                  ? "bg-red-600/20 text-red-400 border-red-600/30"
                  : "text-[#555] hover:text-white hover:bg-[#1a1a1a] border-transparent"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
