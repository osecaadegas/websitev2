"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface Tip {
  _id: string;
  donation: {
    user: { username: string };
    amount: number;
    currency: string;
    message?: string;
  };
  createdAt: string;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function SETipsFeed() {
  const [tips, setTips] = useState<Tip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/streamelements?endpoint=tips")
      .then((r) => r.json())
      .then((data) => {
        if (data.docs) setTips(data.docs);
        else if (Array.isArray(data)) setTips(data);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-white/[0.04] animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || tips.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 text-center">
        <p className="text-white/50">
          {error ? "Não foi possível carregar as doações." : "Sem doações recentes."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tips.map((tip, i) => (
        <motion.div
          key={tip._id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25, delay: i * 0.04 }}
          className="rounded-xl border border-arena-gold/20 bg-gradient-to-r from-arena-gold/[0.06] to-transparent p-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">💰</span>
              <div>
                <p className="font-semibold text-white">{tip.donation.user.username}</p>
                <p className="text-xs text-white/40">{timeAgo(tip.createdAt)}</p>
              </div>
            </div>
            <span className="text-lg font-bold text-arena-gold">
              €{tip.donation.amount.toFixed(2)}
            </span>
          </div>
          {tip.donation.message && (
            <p className="mt-2 text-sm text-white/60 italic">&ldquo;{tip.donation.message}&rdquo;</p>
          )}
        </motion.div>
      ))}
    </div>
  );
}
