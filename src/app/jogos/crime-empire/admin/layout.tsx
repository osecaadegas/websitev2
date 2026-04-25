"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const BASE = "/jogos/crime-empire/admin";

const GROUPS = [
  {
    label: null,
    items: [
      { href: BASE, label: "Dashboard", icon: "📊", exact: true },
    ],
  },
  {
    label: "Conteúdo",
    items: [
      { href: `${BASE}/items`,      label: "Items",     icon: "⚔️" },
      { href: `${BASE}/crimes`,     label: "Crimes",    icon: "💰" },
      { href: `${BASE}/businesses`, label: "Negócios",  icon: "🏢" },
      { href: `${BASE}/shop`,       label: "Loja",        icon: "🛒" },
      { href: `${BASE}/gun-shop`,   label: "SGT Machado", icon: "🔫" },
      { href: `${BASE}/contracts`,  label: "Contratos",   icon: "📄" },
    ],
  },
  {
    label: "Mundo",
    items: [
      { href: `${BASE}/events`,   label: "Eventos", icon: "🎯" },
      { href: `${BASE}/streets`,  label: "Ruas",    icon: "🛣️" },
      { href: `${BASE}/brothels`, label: "Bordéis", icon: "💋" },
    ],
  },
  {
    label: "Jogadores",
    items: [
      { href: `${BASE}/players`, label: "Jogadores", icon: "👥" },
      { href: `${BASE}/pvp`,     label: "PvP",       icon: "🥊" },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: `${BASE}/system`, label: "Controlo", icon: "🎛️" },
      { href: `${BASE}/logs`,   label: "Logs",     icon: "📋" },
    ],
  },
];

function NavItems({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="py-2 flex-1 overflow-y-auto">
      {GROUPS.map((group, gi) => (
        <div key={gi} className={gi > 0 ? "mt-1" : ""}>
          {group.label && (
            <p className="px-4 pt-4 pb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#2a2a2a]">
              {group.label}
            </p>
          )}
          {group.items.map((item) => {
            const active =
              "exact" in item && item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={`flex items-center gap-2.5 mx-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  active
                    ? "bg-red-600/20 text-red-400"
                    : "text-[#444] hover:text-white hover:bg-[#111]"
                }`}
              >
                <span className="text-sm leading-none flex-shrink-0">
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
                {active && (
                  <span className="ml-auto w-1 h-3.5 rounded-full bg-red-500 flex-shrink-0" />
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export default function CEAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (user === null) {
      router.replace("/jogos/crime-empire/dashboard");
      return;
    }
    if (user && user.role !== "admin" && user.role !== "configurador") {
      router.replace("/jogos/crime-empire/dashboard");
    }
  }, [user, router]);

  // Close mobile nav on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (!user || (user.role !== "admin" && user.role !== "configurador")) {
    return (
      <div className="flex items-center justify-center py-24 text-[#444]">
        A verificar permissões…
      </div>
    );
  }

  const SidebarHeader = () => (
    <div className="flex items-center gap-2.5 px-4 py-4 border-b border-[#111] flex-shrink-0">
      <span className="text-base">🛡️</span>
      <div>
        <p className="text-white font-black text-sm leading-none">Admin</p>
        <p className="text-[#2a2a2a] text-[9px] mt-0.5 uppercase tracking-widest">
          Crime Empire
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex">
      {/* ── Desktop sidebar ───────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-44 shrink-0 sticky top-16 self-start h-[calc(100vh-4rem)] bg-[#050505] border-r border-[#111] overflow-y-auto">
        <SidebarHeader />
        <NavItems pathname={pathname} />
      </aside>

      {/* ── Mobile overlay ────────────────────────────── */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40"
          onClick={() => setMobileOpen(false)}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <aside
            className="absolute left-0 top-16 bottom-0 w-52 bg-[#050505] border-r border-[#111] flex flex-col overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarHeader />
            <NavItems
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* ── Content area ──────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile topbar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-[#111] bg-[#050505] sticky top-16 z-30">
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="text-[#444] hover:text-white p-1.5 rounded-lg hover:bg-[#111] transition-colors"
            aria-label="Toggle menu"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="text-white text-sm font-bold">🛡️ Admin Panel</span>
        </div>

        <div className="p-4 sm:p-6 flex-1">{children}</div>
      </div>
    </div>
  );
}
