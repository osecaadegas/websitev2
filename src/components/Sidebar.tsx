"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { hasRole } from "@/lib/roles";
import type { UserRole } from "@/lib/supabase";

/* ── Types ──────────────────────────────────────────────────────── */
interface NavChild {
  href: string;
  label: string;
  children?: NavChild[];
}

interface NavItem {
  href: string;
  label: string;
  children?: NavChild[];
  minRole?: UserRole;
}

/* ── Sidebar link definitions (custom order) ────────────────────── */
const MAIN_LINKS: NavItem[] = [
  { href: "/ofertas", label: "Ofertas" },
  {
    href: "/stream",
    label: "Stream",
    children: [
      { href: "/live", label: "Live" },
      { href: "/daily-session", label: "Sessão do Dia" },
      { href: "/destaques", label: "Destaques" },
      { href: "/bonus-hunt", label: "Bonus Hunt" },
      { href: "/calendario", label: "Calendário" },
    ],
  },
  {
    href: "/comunidade",
    label: "Comunidade",
    children: [
      { href: "/roda-diaria", label: "Roda Diária" },
      { href: "/giveaways", label: "Giveaways" },
      { href: "/liga-dos-secas", label: "Liga dos Secas" },
      { href: "/hall-of-victories", label: "Bruta do Mês" },
      { href: "/adivinha-o-resultado", label: "Adivinha o Resultado" },
    ],
  },
  { href: "/loja", label: "Loja" },
  { href: "/sobre", label: "Sobre" },
];

const SECONDARY_LINKS: NavItem[] = [
  {
    href: "/admin",
    label: "Admin Area",
    minRole: "configurador",
    children: [
      { href: "/admin/settings", label: "Definições" },
      { href: "/admin/outros/daily-session", label: "Sessão do Dia" },
      { href: "/admin/outros/bonus-hunt", label: "Bonus Hunt" },
      {
        href: "/admin/analitics",
        label: "Analitics",
        children: [
          { href: "/admin/analitics", label: "Visão Geral" },
          { href: "/admin/analitics/utilizadores", label: "Utilizadores" },
          { href: "/admin/analitics/ofertas", label: "Ofertas" },
          { href: "/admin/analitics/tempo-real", label: "Tempo Real" },
          { href: "/admin/analitics/trafego", label: "Tráfego" },
          { href: "/admin/analitics/geo", label: "Geo" },
          { href: "/admin/analitics/fraude", label: "Fraude" },
        ],
      },
      { href: "/admin/outros/calendario", label: "Calendário" },
      { href: "/admin/outros/bruta-do-mes", label: "Bruta do Mês" },
      {
        href: "/admin/outros",
        label: "Outros",
        children: [
          { href: "/admin/parcerias", label: "Parcerias" },
          {
            href: "/admin/loja",
            label: "Loja",
            children: [
              { href: "/admin/loja", label: "Criação" },
              { href: "/admin/loja/gestao", label: "Gestão" },
            ],
          },
          { href: "/admin/outros/giveaways", label: "Giveaways" },
          { href: "/admin/outros/daily-wheel", label: "Daily Wheel" },
          { href: "/admin/outros/liga", label: "Liga dos Secas" },
          { href: "/admin/utilizadores", label: "Utilizadores" },
        ],
      },
    ],
  },
  { href: "/moderador", label: "Moderador Area", minRole: "moderador" },
];

/* ── Icons per route ────────────────────────────────────────────── */
const ICONS: Record<string, React.ReactNode> = {
  "/sobre": (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
    </svg>
  ),
  "/ofertas": (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
    </svg>
  ),
  "/destaques": (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  ),
  "/stream": (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728M9.172 15.828a5 5 0 010-7.072m5.656 0a5 5 0 010 7.072M12 12h.01" />
    </svg>
  ),
  "/liga-dos-secas": (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
    </svg>
  ),
  "/comunidade": (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  "/loja": (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
  ),
  "/daily-session": (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  "/admin": (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  "/moderador": (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  "/calendario": (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  "/jogos/crime-empire/dashboard": (
    <Image
      src="/images/crime_empire/crime_empire_logo.png"
      alt="Crime Empire"
      width={20}
      height={20}
      className="w-5 h-5 object-contain"
    />
  ),
};

/* ── Sidebar Props ──────────────────────────────────────────────── */
interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Filter secondary links by user role
  const visibleSecondary = useMemo(
    () => SECONDARY_LINKS.filter((item) => !item.minRole || hasRole(user?.role, item.minRole)),
    [user?.role]
  );

  const toggleExpand = (href: string) => {
    setExpanded((prev) => ({ ...prev, [href]: !prev[href] }));
  };

  /* Check if a parent or any of its children (or grandchildren) is active */
  const isGroupActive = (item: NavItem | NavChild): boolean =>
    pathname === item.href ||
    item.children?.some((c) => pathname === c.href || c.children?.some((gc) => pathname === gc.href)) ||
    false;

  /* Render a single nav link */
  const renderLink = (link: { href: string; label: string }, indent = false) => {
    const isActive = pathname === link.href;
    return (
      <Link
        key={link.href}
        href={link.href}
        onClick={onClose}
        className={`
          group flex items-center gap-3 rounded-lg transition-all duration-200
          font-[family-name:var(--font-display)] tracking-wide uppercase
          ${indent ? "px-2 py-2 ml-0 text-[12px]" : "px-3 py-2.5 text-[15px]"}
          ${
            isActive
              ? "bg-arena-neon/10 text-arena-neon border border-arena-neon/20"
              : "text-white hover:text-arena-neon hover:bg-white/[0.04] border border-transparent"
          }
        `}
      >
        {!indent && (
          <span
            className={`shrink-0 transition-colors duration-200 ${
              isActive ? "text-arena-neon" : "text-white/60 group-hover:text-arena-neon/70"
            }`}
          >
            {ICONS[link.href] || (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            )}
          </span>
        )}
        {indent && (
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? "bg-arena-neon" : "bg-arena-steel"}`} />
        )}
        <span className="min-w-0 flex-1">{link.label}</span>
        {isActive && (
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-arena-neon shadow-[0_0_6px_rgba(255,85,0,0.6)]" />
        )}
      </Link>
    );
  };

  /* Render a nav item (with or without dropdown) */
  const renderNavItem = (item: NavItem) => {
    if (!item.children) return renderLink(item);

    const groupActive = isGroupActive(item);
    const isOpen = expanded[item.href] ?? groupActive;

    return (
      <div key={item.href}>
        {/* Parent row: link + chevron toggle */}
        <div className="flex items-center">
          <Link
            href={item.href}
            onClick={() => {
              setExpanded((prev) => ({ ...prev, [item.href]: true }));
              onClose();
            }}
            className={`
              group flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg text-[15px] transition-all duration-200
              font-[family-name:var(--font-display)] tracking-wide uppercase
              ${
                groupActive
                  ? "bg-arena-neon/10 text-arena-neon border border-arena-neon/20"
                  : "text-white hover:text-arena-neon hover:bg-white/[0.04] border border-transparent"
              }
            `}
          >
            <span
              className={`shrink-0 transition-colors duration-200 ${
                groupActive ? "text-arena-neon" : "text-white/60 group-hover:text-arena-neon/70"
              }`}
            >
              {ICONS[item.href] || (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              )}
            </span>
            <span className="min-w-0 flex-1">{item.label}</span>
          </Link>

          {/* Chevron toggle */}
          <button
            onClick={() => {
              toggleExpand(item.href);
              if (pathname !== item.href) {
                router.push(item.href);
              }
            }}
            className="p-2 -mr-1 text-arena-ash hover:text-arena-white transition-colors"
            aria-label={`${isOpen ? "Colapsar" : "Expandir"} ${item.label}`}
          >
            <motion.svg
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </motion.svg>
          </button>
        </div>

        {/* Dropdown children */}
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-1 space-y-0.5">
                {item.children!.map((child) =>
                  child.children ? renderSubDropdown(child) : renderLink(child, true)
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  /* Render a nested sub-dropdown (e.g. Outros → Giveaways, etc.) */
  const renderSubDropdown = (item: NavChild) => {
    const subActive = isGroupActive(item);
    const isSubOpen = expanded[item.href] ?? subActive;

    return (
      <div key={item.href}>
        <div className="flex items-center ml-1">
          <button
            onClick={() => toggleExpand(item.href)}
            className={`
              group flex-1 flex items-center gap-2 px-2 py-2 rounded-lg text-[12px] transition-all duration-200
              font-[family-name:var(--font-display)] tracking-wide uppercase
              ${subActive
                ? "text-arena-neon"
                : "text-white hover:text-arena-neon hover:bg-white/[0.04]"}
            `}
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${subActive ? "bg-arena-neon" : "bg-arena-steel"}`} />
            <span className="min-w-0 flex-1">{item.label}</span>
            <motion.svg
              animate={{ rotate: isSubOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="w-3 h-3 ml-auto text-arena-ash"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </motion.svg>
          </button>
        </div>
        <AnimatePresence initial={false}>
          {isSubOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-0.5 space-y-0.5 ml-5">
                {item.children!.map((gc) => gc.children ? renderSubDropdown(gc) : renderLink(gc, true))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  /* shared nav content */
  const navContent = (
    <>
      {/* Spacer */}
      <div className="h-3" />

      {/* Crime Empire logo button */}
      <div className="px-3 pt-2">
        <Link
          href="/jogos/crime-empire/dashboard"
          onClick={onClose}
          className="block w-full"
        >
          <Image
            src="/images/crime_empire/crime_empire_logo.png"
            alt="Crime Empire"
            width={200}
            height={56}
            className="w-full h-auto object-contain opacity-90 hover:opacity-100 transition-opacity duration-200"
            style={{ mixBlendMode: "screen" }}
          />
        </Link>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {/* Main links */}
        {MAIN_LINKS.map(renderNavItem)}

        {/* Secondary links (role-gated) */}
        {visibleSecondary.length > 0 && (
          <>
            <div className="!my-3 mx-1 h-px bg-gradient-to-r from-transparent via-arena-steel/30 to-transparent" />
            {visibleSecondary.map(renderNavItem)}
          </>
        )}
      </nav>

      {/* Social icons */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-center gap-4">
          <a
            href="https://www.instagram.com/SECAADEGAS"
            target="_blank"
            rel="noopener noreferrer"
            className="opacity-60 hover:opacity-100 transition-opacity duration-200"
            aria-label="Instagram"
          >
            <Image src="/images/icons/fa-instagram.png" alt="Instagram" width={32} height={32} className="w-8 h-8 object-contain" />
          </a>
          <a
            href="https://www.twitch.tv/secaadegas"
            target="_blank"
            rel="noopener noreferrer"
            className="opacity-60 hover:opacity-100 transition-opacity duration-200"
            aria-label="Twitch"
          >
            <Image src="/images/icons/fa-twitch.png" alt="Twitch" width={32} height={32} className="w-8 h-8 object-contain" />
          </a>
          <a
            href="mailto:info@SECAADEGAS.com"
            className="opacity-60 hover:opacity-100 transition-opacity duration-200"
            aria-label="Email"
          >
            <Image src="/images/icons/fa-gmail.png" alt="Email" width={24} height={24} className="w-6 h-6 object-contain" />
          </a>
        </div>
      </div>


    </>
  );

  return (
    <>
      {/* ── Desktop sidebar (always visible, lg+) ─────────────────── */}
      <aside className="hidden lg:flex flex-col fixed top-16 left-0 bottom-0 w-56 bg-black/95 backdrop-blur-sm border-r border-arena-neon/10 z-40">
        {navContent}
      </aside>

      {/* ── Mobile overlay + drawer ───────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
              onClick={onClose}
            />

            {/* Drawer */}
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 280 }}
              className="fixed top-0 left-0 bottom-0 w-72 bg-black border-r border-arena-neon/10 z-50 flex flex-col lg:hidden"
            >
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-3 p-1.5 rounded-md text-arena-ash hover:text-arena-white hover:bg-white/[0.06] transition-colors"
                aria-label="Fechar menu"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {navContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}