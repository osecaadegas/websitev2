"use client";

import { useAuth } from "@/lib/auth-context";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

interface Redemption {
  id: string;
  reward_id: string;
  user_twitch_id: string;
  cost: number;
  status: "pending" | "approved" | "denied";
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  rewards: {
    title: string;
    type: string;
    tier: string;
    image: string | null;
    cost: number;
  } | null;
  users: {
    display_name: string;
    login: string;
    profile_image_url: string | null;
  } | null;
}

type FilterStatus = "pending" | "approved" | "denied" | "all";

export default function AdminGestaoPage() {
  const { user } = useAuth();
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("pending");
  const [processing, setProcessing] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const fetchRedemptions = useCallback(async () => {
    try {
      const url = filter === "all"
        ? "/api/rewards/redemptions"
        : `/api/rewards/redemptions?status=${filter}`;
      const res = await fetch(url);
      const data = await res.json();
      if (Array.isArray(data.redemptions)) setRedemptions(data.redemptions);
    } catch { /* ignore */ }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    fetchRedemptions();
  }, [fetchRedemptions]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleAction(id: string, status: "approved" | "denied") {
    setProcessing(id);
    try {
      const res = await fetch("/api/rewards/redemptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });

      if (!res.ok) {
        const d = await res.json();
        showToast(d.details || d.error || "Erro");
      } else {
        showToast(status === "approved" ? "Resgate aprovado" : "Resgate recusado — pontos devolvidos");
        fetchRedemptions();
      }
    } catch {
      showToast("Erro de rede");
    }
    setProcessing(null);
  }

  const tierColors: Record<string, string> = {
    common: "text-arena-smoke",
    elite: "text-arena-gold",
    legendary: "text-arena-red",
  };

  const statusLabels: Record<string, { label: string; color: string }> = {
    pending: { label: "Pendente", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
    approved: { label: "Aprovado", color: "text-green-400 bg-green-400/10 border-green-400/20" },
    denied: { label: "Recusado", color: "text-red-400 bg-red-400/10 border-red-400/20" },
  };

  const filterButtons: { value: FilterStatus; label: string }[] = [
    { value: "pending", label: "Pendentes" },
    { value: "approved", label: "Aprovados" },
    { value: "denied", label: "Recusados" },
    { value: "all", label: "Todos" },
  ];

  const pendingCount = redemptions.filter((r) => r.status === "pending").length;

  return (
    <div className="pt-24 pb-16 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Filter tabs */}
        <div className="flex gap-2 mb-6">
          {filterButtons.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-2 rounded-lg text-xs gladiator-label uppercase transition-all cursor-pointer border
                ${filter === f.value
                  ? "bg-arena-gold/15 border-arena-gold/30 text-arena-gold"
                  : "bg-transparent border-white/10 text-arena-ash hover:border-white/20"
                }`}
            >
              {f.label}
              {f.value === "pending" && filter !== "pending" && pendingCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 rounded-full bg-arena-crimson text-white text-[10px]">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Redemptions list */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 bg-white/[0.03] animate-pulse rounded-lg" />
            ))}
          </div>
        ) : redemptions.length === 0 ? (
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-10 text-center">
            <p className="text-arena-ash">
              {filter === "pending" ? "Sem resgates pendentes" : "Nenhum resgate encontrado"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {redemptions.map((r) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 flex items-center gap-4"
              >
                {/* User avatar */}
                <div className="shrink-0">
                  {r.users?.profile_image_url ? (
                    <Image
                      src={r.users.profile_image_url}
                      alt={r.users.display_name}
                      width={40}
                      height={40}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-arena-steel/30 flex items-center justify-center text-arena-ash text-sm">
                      ?
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-arena-white text-sm font-medium truncate">
                      {r.users?.display_name || r.user_twitch_id}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] gladiator-label uppercase border ${statusLabels[r.status].color}`}>
                      {statusLabels[r.status].label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-arena-ash">
                    <span className={`gladiator-label uppercase ${tierColors[r.rewards?.tier || "common"]}`}>
                      {r.rewards?.title || "Desconhecido"}
                    </span>
                    <span className="text-arena-gold">{r.cost.toLocaleString()} pts</span>
                    <span>{new Date(r.created_at).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  {r.reviewed_by && (
                    <div className="text-[10px] text-arena-ash mt-0.5">
                      Revisto por <span className="text-arena-smoke">{r.reviewed_by}</span>
                      {r.reviewed_at && ` em ${new Date(r.reviewed_at).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`}
                    </div>
                  )}
                </div>

                {/* Actions */}
                {r.status === "pending" && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleAction(r.id, "approved")}
                      disabled={processing === r.id}
                      className="px-3 py-1.5 rounded-lg bg-green-600/20 hover:bg-green-600/40 text-green-400 text-xs gladiator-label transition-all cursor-pointer border border-green-600/20 disabled:opacity-40"
                    >
                      {processing === r.id ? "..." : "✓ Aprovar"}
                    </button>
                    <button
                      onClick={() => handleAction(r.id, "denied")}
                      disabled={processing === r.id}
                      className="px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-400 text-xs gladiator-label transition-all cursor-pointer border border-red-600/20 disabled:opacity-40"
                    >
                      {processing === r.id ? "..." : "✕ Recusar"}
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-xl border border-arena-gold/20 bg-arena-dark/90 backdrop-blur-lg gladiator-label text-sm text-arena-gold"
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
