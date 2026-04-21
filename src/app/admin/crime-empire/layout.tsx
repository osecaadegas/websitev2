"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/admin/crime-empire",             label: "Visão Geral",  icon: "🏠" },
  { href: "/admin/crime-empire/items",       label: "Items",        icon: "⚔️" },
  { href: "/admin/crime-empire/crimes",      label: "Crimes",       icon: "💰" },
  { href: "/admin/crime-empire/businesses",  label: "Negócios",     icon: "🏢" },
  { href: "/admin/crime-empire/shop",        label: "Loja do Chinês", icon: "🏪" },
  { href: "/admin/crime-empire/players",     label: "Jogadores",    icon: "👥" },
  { href: "/admin/crime-empire/system",      label: "Controlo",     icon: "🎛️" },
  { href: "/admin/crime-empire/logs",        label: "Logs",         icon: "📋" },
];

export default function CrimeEmpireAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="pt-24 pb-16 min-h-screen">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-[#555] mb-6">
          <Link href="/admin" className="hover:text-[#ff6a00] transition-colors">Admin</Link>
          <span>/</span>
          <span className="text-[#888]">Crime Empire</span>
        </div>

        <div className="flex gap-6">
          {/* Sidebar nav */}
          <aside className="w-52 flex-shrink-0">
            <div className="bg-[#0e0e0e] border border-[#1e1e1e] rounded-xl p-3 sticky top-24">
              <p className="text-[10px] font-bold text-[#444] uppercase tracking-widest px-2 mb-3">Crime Empire</p>
              <nav className="space-y-1">
                {NAV.map((item) => {
                  const exact = item.href === "/admin/crime-empire";
                  const active = exact ? pathname === item.href : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        active
                          ? "bg-[#ff6a00]/15 text-[#ff6a00] border border-[#ff6a00]/30"
                          : "text-[#666] hover:text-white hover:bg-[#1a1a1a]"
                      }`}
                    >
                      <span>{item.icon}</span>
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
