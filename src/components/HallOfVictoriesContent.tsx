"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import WinCard from "./WinCard";
import AddWinForm from "./AddWinForm";
import EmbedRenderer from "./EmbedRenderer";
import type { WinClip } from "./WinCard";
import type { EmbedType } from "./EmbedRenderer";

type SortMode = "created_at" | "honors";
type TabMode  = "featured" | "community";

interface BrutaDoMes {
  id: string;
  month_label: string;
  title: string;
  description: string | null;
  url: string;
  provider: string | null;
  embed_type: EmbedType;
  embed_url: string;
  created_at: string;
}

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "created_at", label: "Mais Recentes" },
  { value: "honors",     label: "Mais Honradas"  },
];

const PAGE_SIZE_DISPLAY = 20;

/* ── Featured win section ───────────────────────────────────── */
function FeaturedWin({ win, loading }: { win: BrutaDoMes | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="animate-pulse rounded-2xl bg-gradient-to-br from-arena-gold/10 to-arena-gold/5 border border-arena-gold/20 p-8 h-[600px]" />
    );
  }
  if (!win) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-arena-charcoal/80 via-arena-charcoal/60 to-arena-charcoal/40 border border-arena-steel/20 p-12 text-center"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(212,168,67,0.05),transparent_70%)]" />
        <div className="relative">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-arena-gold/10 flex items-center justify-center">
            <svg className="w-10 h-10 text-arena-gold/40" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
            </svg>
          </div>
          <h3 className="font-[family-name:var(--font-display)] text-2xl text-arena-gold mb-3 tracking-wide">
            Aguardando Julgamento
          </h3>
          <p className="text-arena-smoke/60 text-sm max-w-md mx-auto">
            O admin ainda não escolheu a vitória mais épica deste mês. Em breve, a glória será revelada.
          </p>
        </div>
      </motion.div>
    );
  }
  
  return (
    <motion.article
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="relative group"
    >
      {/* Glow effect */}
      <div className="absolute -inset-1 bg-gradient-to-r from-arena-gold via-yellow-500 to-arena-gold opacity-20 blur-xl group-hover:opacity-30 transition-opacity duration-500 rounded-2xl" />
      
      {/* Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-arena-charcoal/90 via-arena-charcoal/80 to-arena-charcoal/70 border border-arena-gold/30 backdrop-blur-sm">
        {/* Header with month badge */}
        <div className="relative px-8 pt-8 pb-6 bg-gradient-to-br from-arena-gold/15 via-arena-gold/5 to-transparent border-b border-arena-gold/10">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-arena-gold/20 blur-md rounded-full" />
                <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-arena-gold to-yellow-600 flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-arena-dark" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-arena-gold/60 uppercase tracking-wider mb-0.5">
                  Vitória Oficial
                </div>
                <h2 className="font-[family-name:var(--font-display)] text-xl text-arena-gold tracking-wide">
                  {win.month_label}
                </h2>
              </div>
            </div>
            {win.provider && (
              <div className="px-4 py-1.5 rounded-full bg-arena-steel/10 border border-arena-steel/20">
                <span className="text-sm text-arena-smoke/70 font-medium">{win.provider}</span>
              </div>
            )}
          </div>
        </div>

        {/* Video embed */}
        <div className="relative aspect-video bg-black/40">
          <EmbedRenderer type={win.embed_type} embedUrl={win.embed_url} title={win.title} />
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="flex items-start gap-3 mb-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-arena-gold/20 to-arena-gold/10 border border-arena-gold/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-arena-gold" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-[family-name:var(--font-display)] text-2xl text-arena-smoke tracking-wide mb-2">
                {win.title}
              </h3>
              {win.description && (
                <p className="text-arena-smoke/70 leading-relaxed">
                  {win.description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Bottom accent */}
        <div className="h-1 bg-gradient-to-r from-transparent via-arena-gold to-transparent" />
      </div>
    </motion.article>
  );
}

export default function HallOfVictoriesContent() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabMode>("featured");

  /* ── Featured state ─────────────────────────────────────── */
  const [featured, setFeatured]               = useState<BrutaDoMes | null>(null);
  const [loadingFeatured, setLoadingFeatured] = useState(true);

  useEffect(() => {
    fetch("/api/bruta-do-mes")
      .then((r) => r.json())
      .then((d) => setFeatured(d.win ?? null))
      .catch(() => {})
      .finally(() => setLoadingFeatured(false));
  }, []);

  /* ── Community wins state ───────────────────────────────── */
  const [clips,   setClips]   = useState<WinClip[]>([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [sort,    setSort]    = useState<SortMode>("created_at");
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [honoredIds, setHonoredIds] = useState<Set<string>>(new Set());
  const [communityLoaded, setCommunityLoaded] = useState(false);

  const fetchClips = useCallback(async (p: number, s: SortMode) => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/user-clips?page=${p}&sort=${s}`);
      const data = await res.json();
      if (p === 1) {
        setClips(data.clips ?? []);
      } else {
        setClips((prev) => [...prev, ...(data.clips ?? [])]);
      }
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleTabChange = (t: TabMode) => {
    setTab(t);
    if (t === "community" && !communityLoaded) {
      setCommunityLoaded(true);
      fetchClips(1, sort);
      setPage(1);
    }
  };

  const handleSortChange = (s: SortMode) => {
    setSort(s);
    fetchClips(1, s);
    setPage(1);
  };

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchClips(next, sort);
  };

  const handleHonor = (id: string) => {
    setHonoredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setSort("created_at");
    fetchClips(1, "created_at");
    setPage(1);
  };

  const hasMore = clips.length < total && clips.length >= PAGE_SIZE_DISPLAY;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4 pb-8 border-b border-arena-steel/10"
      >
        <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-gradient-to-r from-arena-gold/10 via-arena-gold/5 to-arena-gold/10 border border-arena-gold/20">
          <svg className="w-5 h-5 text-arena-gold" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
          <span className="text-sm font-medium text-arena-gold uppercase tracking-wider">Hall da Glória</span>
        </div>
        <h1 className="font-[family-name:var(--font-display)] text-4xl sm:text-5xl text-arena-smoke tracking-wide">
          Salão das Vitórias
        </h1>
        <p className="text-arena-smoke/60 max-w-2xl mx-auto leading-relaxed">
          Celebre as conquistas mais épicas da comunidade SecaAdegas. Das vitórias oficiais do mês às glórias individuais dos guerreiros.
        </p>
      </motion.div>

      {/* Tab Navigation */}
      <div className="flex items-center justify-center gap-3" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "featured"}
          onClick={() => handleTabChange("featured")}
          className={`
            group relative px-6 py-3 rounded-xl font-medium transition-all duration-300
            ${tab === "featured" 
              ? "text-arena-dark" 
              : "text-arena-smoke/70 hover:text-arena-smoke"
            }
          `}
        >
          {tab === "featured" && (
            <motion.div
              layoutId="activeTab"
              className="absolute inset-0 bg-gradient-to-r from-arena-gold to-yellow-500 rounded-xl shadow-lg"
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
          <span className="relative flex items-center gap-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            Bruta do Mês
          </span>
        </button>

        <button
          role="tab"
          aria-selected={tab === "community"}
          onClick={() => handleTabChange("community")}
          className={`
            group relative px-6 py-3 rounded-xl font-medium transition-all duration-300
            ${tab === "community" 
              ? "text-arena-dark" 
              : "text-arena-smoke/70 hover:text-arena-smoke"
            }
          `}
        >
          {tab === "community" && (
            <motion.div
              layoutId="activeTab"
              className="absolute inset-0 bg-gradient-to-r from-arena-gold to-yellow-500 rounded-xl shadow-lg"
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
          <span className="relative flex items-center gap-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Vitórias da Comunidade
          </span>
        </button>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {tab === "featured" ? (
          <motion.div
            key="featured"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <FeaturedWin win={featured} loading={loadingFeatured} />
          </motion.div>
        ) : (
          <motion.div
            key="community"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-8"
          >
            {/* Community Controls */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2" role="group">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleSortChange(opt.value)}
                    className={`
                      px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200
                      ${sort === opt.value
                        ? "bg-arena-steel/20 text-arena-smoke border border-arena-steel/30 shadow-sm"
                        : "text-arena-smoke/60 hover:text-arena-smoke hover:bg-arena-steel/10"
                      }
                    `}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {user ? (
                <button
                  onClick={() => setShowForm(true)}
                  className="group px-5 py-2.5 rounded-lg bg-gradient-to-r from-arena-gold/90 to-yellow-600/90 hover:from-arena-gold hover:to-yellow-600 text-arena-dark font-medium transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Registar Vitória
                </button>
              ) : (
                <p className="text-sm text-arena-smoke/50 italic">
                  Faz login para partilhar as tuas vitórias
                </p>
              )}
            </div>

            {/* Community Grid */}
            {loading && clips.length === 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="animate-pulse rounded-xl bg-arena-charcoal/40 border border-arena-steel/10 h-80"
                  />
                ))}
              </div>
            ) : clips.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-20 rounded-2xl bg-gradient-to-br from-arena-charcoal/40 to-arena-charcoal/20 border border-arena-steel/10"
              >
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-arena-steel/10 flex items-center justify-center">
                  <svg className="w-10 h-10 text-arena-smoke/30" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                </div>
                <h3 className="font-[family-name:var(--font-display)] text-xl text-arena-smoke/70 mb-2">
                  Nenhuma vitória registada
                </h3>
                <p className="text-arena-smoke/50 text-sm">
                  Sê o primeiro guerreiro a reclamar glória!
                </p>
              </motion.div>
            ) : (
              <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence>
                  {clips.map((clip) => (
                    <WinCard
                      key={clip.id}
                      clip={clip}
                      currentUserId={user?.id ?? null}
                      onHonor={handleHonor}
                      honored={honoredIds.has(clip.id)}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}

            {/* Load More */}
            {hasMore && !loading && (
              <div className="text-center pt-4">
                <button
                  onClick={handleLoadMore}
                  className="px-8 py-3 rounded-xl bg-arena-charcoal/60 hover:bg-arena-charcoal/80 border border-arena-steel/20 hover:border-arena-steel/30 text-arena-smoke font-medium transition-all duration-200 hover:scale-105"
                >
                  Carregar Mais Vitórias
                </button>
              </div>
            )}

            {loading && clips.length > 0 && (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-2 border-arena-gold/30 border-t-arena-gold rounded-full animate-spin" />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Win Modal */}
      <AnimatePresence>
        {showForm && (
          <AddWinForm onSuccess={handleFormSuccess} onCancel={() => setShowForm(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
