"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { NAV_LINKS, SITE_NAME } from "@/lib/constants";
import { useAuth } from "@/lib/auth-context";
import { VipBadge, getVipLevel } from "@/components/VipBadge";
import { supabase } from "@/lib/supabase";

interface NavbarProps {
  onMenuToggle?: () => void;
}

export function Navbar({ onMenuToggle }: NavbarProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [points, setPoints] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { user, loading, login, logout } = useAuth();
  const pathname = usePathname();

  const vipLevel = getVipLevel(points);

  /* ── Page title map ─────────────────────────── */
  const PAGE_TITLES: Record<string, string> = {
    "/calendario": "Calendário",
    "/sobre": "Sobre Nós",
    "/contactos": "Contactos",
    "/comunidade": "Comunidade",
    "/giveaways": "Giveaways",
    "/ofertas": "Ofertas",
    "/destaques": "Destaques",
    "/loja": "Armaria",
    "/roda-diaria": "Arrebanha Daily",
    "/bonus-hunt": "Bonus Hunt",
    "/liga-dos-secas": "Liga dos Secas",
    "/live": "Em Direto",
    "/adivinha-o-resultado": "ADVINHA O RESULTADO",
    "/termos-e-condicoes": "Termos & Condições",
    "/politica-de-privacidade": "Política de Privacidade",
    "/politica-de-cookies": "Política de Cookies",
    "/moderador": "Moderador",
    "/admin": "Admin",
    "/admin/outros": "Outros",
    "/admin/outros/calendario": "Calendário",
    "/admin/outros/bonus-hunt": "Bonus Hunt",
    "/admin/outros/giveaways": "Giveaways",
    "/admin/outros/daily-wheel": "Daily Wheel",
    "/admin/outros/daily-session": "Daily Session",
    "/admin/loja": "Gestão de Recompensas",
    "/admin/loja/gestao": "Gestão de Resgates",
    "/admin/utilizadores": "Utilizadores",
    "/admin/parcerias": "Parcerias",
    "/admin/analitics": "Analytics",
    "/admin/outros/bruta-do-mes": "Bruta do Mês",
    "/hall-of-victories": "Bruta do Mês",
  };

  const pageTitle = PAGE_TITLES[pathname] ?? null;
  const isDailySession = pathname === "/daily-session";
  const isLive = pathname === "/live";

  /* ── Next stream (for /live marquee) ─────────── */
  const [nextStream, setNextStream] = useState<{ title: string; stream_date: string; start_time: string; categories: string[]; casino: string | null } | null>(null);

  useEffect(() => {
    if (!isLive) { setNextStream(null); return; }
    const today = new Date().toISOString().split("T")[0];
    fetch("/api/scheduled-streams")
      .then((r) => r.json())
      .then((d) => {
        const upcoming = (d.streams ?? []).filter(
          (s: { stream_date: string; is_cancelled: boolean }) => s.stream_date >= today && !s.is_cancelled
        );
        if (upcoming.length > 0) setNextStream(upcoming[0]);
      })
      .catch(() => {});
  }, [isLive]);

  /* ── Daily Session live info ──────────────────── */
  const [sessionInfo, setSessionInfo] = useState<{ title: string; date: string; is_active: boolean } | null>(null);

  useEffect(() => {
    if (!isDailySession) { setSessionInfo(null); return; }
    (async () => {
      const { data } = await supabase
        .from("daily_sessions")
        .select("title, session_date, is_active")
        .eq("is_active", true)
        .order("session_date", { ascending: false })
        .limit(1)
        .single();
      if (data) {
        const formatted = new Date(data.session_date + "T00:00:00").toLocaleDateString("pt-PT", {
          weekday: "long", year: "numeric", month: "long", day: "numeric",
        });
        setSessionInfo({ title: data.title, date: formatted, is_active: data.is_active });
      }
    })();
  }, [isDailySession]);

  // Fetch user points
  useEffect(() => {
    if (!user) return;
    fetch(`/api/streamelements?endpoint=user-points&username=${encodeURIComponent(user.login)}`)
      .then((r) => r.json())
      .then((d) => { if (typeof d.points === "number") setPoints(d.points); })
      .catch(() => {});
  }, [user]);

  // Fetch unread notification count
  useEffect(() => {
    if (!user) return;
    const fetchCount = () => {
      fetch("/api/notifications")
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d.notifications)) {
            setUnreadCount(d.notifications.filter((n: { read: boolean }) => !n.read).length);
          }
        })
        .catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Close user menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-arena-black border-b border-arena-gold/10">
      <div className="px-4 sm:px-6 lg:px-8">
          <div className="relative flex items-center justify-between h-16">
          {/* Left: hamburger + logo */}
          <div className="flex items-center gap-3">
            {/* Sidebar toggle (visible below lg) */}
            <button
              onClick={onMenuToggle}
              className="lg:hidden p-2 -ml-2 text-arena-smoke hover:text-arena-gold transition-colors"
              aria-label="Abrir menu"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <Link href="/" className="flex items-center gap-2 group">
              <Image
                src="/images/logo.svg"
                alt={SITE_NAME}
                width={160}
                height={40}
                className="h-8 w-auto brightness-100 group-hover:brightness-125 transition-all duration-300"
                priority
              />
            </Link>
          </div>

          {/* Center: page title, daily session info, or live marquee */}
          {isLive ? (
            <div className="hidden sm:flex flex-1 mx-6 overflow-hidden">
              <div className="relative w-full overflow-hidden rounded-md border border-arena-gold/20 bg-black/30 h-7 flex items-center">
                {/* Left fade */}
                <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-arena-black to-transparent z-10 pointer-events-none" />
                {/* Right fade */}
                <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-arena-black to-transparent z-10 pointer-events-none" />
                <div className="flex animate-marquee whitespace-nowrap">
                  {nextStream ? (
                    [0, 1].map((i) => (
                      <span key={i} className="inline-flex items-center gap-3 px-8 text-xs font-medium">
                        <span className="text-arena-gold/70 tracking-widest uppercase font-[family-name:var(--font-display)] text-[0.6rem]">Próxima Stream</span>
                        <span className="text-arena-gold">⚔</span>
                        <span className="text-arena-white font-semibold">{nextStream.title}</span>
                        <span className="text-arena-gold/40">·</span>
                        <span className="text-arena-smoke">
                          {new Date(nextStream.stream_date + "T00:00:00").toLocaleDateString("pt-PT", { weekday: "short", day: "numeric", month: "short" })}
                        </span>
                        <span className="text-arena-gold/40">·</span>
                        <span className="text-arena-smoke">{nextStream.start_time.slice(0, 5)}</span>
                        {nextStream.categories.length > 0 && (
                          <>
                            <span className="text-arena-gold/40">·</span>
                            <span className="text-arena-ash">{nextStream.categories.join(" & ")}</span>
                          </>
                        )}
                        {nextStream.casino && (
                          <>
                            <span className="text-arena-gold/40">·</span>
                            <span className="text-arena-ash">{nextStream.casino}</span>
                          </>
                        )}
                        <span className="text-arena-gold px-6">✦</span>
                      </span>
                    ))
                  ) : (
                    [0, 1].map((i) => (
                      <span key={i} className="inline-flex items-center gap-3 px-8 text-xs">
                        <span className="text-arena-gold/70 tracking-widest uppercase font-[family-name:var(--font-display)] text-[0.6rem]">Próxima Stream</span>
                        <span className="text-arena-gold">⚔</span>
                        <span className="text-arena-smoke">Em breve...</span>
                        <span className="text-arena-gold px-6">✦</span>
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : isDailySession && sessionInfo ? (
            <div className="hidden sm:flex items-center gap-3">
              <h1 className="text-2xl sm:text-4xl font-bold font-[family-name:var(--font-display)] bg-gradient-to-r from-arena-gold via-arena-gold-light to-arena-gold bg-clip-text text-transparent">
                {sessionInfo.title}
              </h1>
              {sessionInfo.is_active && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-900/60 border border-red-500/40 text-[10px] font-bold text-red-300 uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                  LIVE
                </span>
              )}
              <span className="text-arena-smoke/70 text-xs capitalize hidden md:inline">
                {sessionInfo.date}
              </span>
            </div>
          ) : pageTitle ? (
            <div className="hidden sm:flex items-center absolute left-1/2 lg:left-[calc(50%+7rem)] -translate-x-1/2 pointer-events-none">
              <h1 className="text-2xl sm:text-4xl font-bold font-[family-name:var(--font-display)] bg-gradient-to-r from-arena-gold via-arena-gold-light to-arena-gold bg-clip-text text-transparent uppercase tracking-wider pointer-events-auto">
                {pageTitle}
              </h1>
            </div>
          ) : (
            <div className="hidden md:flex lg:hidden items-center gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="relative px-3 py-2 text-sm font-medium text-arena-smoke hover:text-arena-gold transition-colors duration-300 arena-shine"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}

          {/* Right: auth controls */}
          {!loading && (
            <div className="relative" ref={userMenuRef}>
              {user ? (
                <>
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-arena-steel/30 hover:border-purple-500/50 transition-all duration-200"
                  >
                    <div className="relative">
                      <img
                        src={user.profile_image_url}
                        alt={user.display_name}
                        className="w-6 h-6 rounded-full"
                      />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-arena-black animate-pulse">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                    </div>
                    <span className="hidden sm:inline text-sm font-medium text-arena-white">
                      {user.display_name}
                    </span>
                    <span className="text-xs text-arena-gold font-semibold">
                      ⭐ {points.toLocaleString()}
                    </span>
                  </button>
                  <AnimatePresence>
                    {userMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2 w-48 rounded-lg bg-arena-charcoal border border-arena-steel/30 shadow-xl overflow-hidden z-50"
                      >
                        <div className="px-4 py-3 border-b border-arena-steel/20">
                          <p className="text-sm font-semibold text-arena-white">{user.display_name}</p>
                          <p className="text-xs text-arena-ash">@{user.login}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-arena-gold font-semibold">
                              ⭐ {points.toLocaleString()} pts
                            </span>
                            <VipBadge level={vipLevel} />
                          </div>
                        </div>
                        <Link
                          href="/perfil"
                          onClick={() => setUserMenuOpen(false)}
                          className="block px-4 py-2.5 text-sm text-arena-smoke hover:text-arena-white hover:bg-arena-steel/20 transition-colors"
                        >
                          Perfil
                        </Link>
                        <button
                          onClick={async () => {
                            await logout();
                            setUserMenuOpen(false);
                          }}
                          className="w-full text-left px-4 py-2.5 text-sm text-arena-smoke hover:text-arena-white hover:bg-arena-steel/20 transition-colors"
                        >
                          Sair
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              ) : (
                <button
                  onClick={login}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-[#9146FF] hover:bg-[#7c3aed] text-white text-sm font-bold tracking-wide transition-all duration-200 shadow-md shadow-purple-900/40 border border-purple-400/30 hover:shadow-purple-500/30"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
                  </svg>
                  <span className="hidden sm:inline">Login</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}