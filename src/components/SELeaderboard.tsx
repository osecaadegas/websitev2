"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface TopUser {
  username: string;
  points: number;
}

export function SELeaderboard() {
  const [users, setUsers] = useState<TopUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/streamelements?endpoint=leaderboard")
      .then((r) => r.json())
      .then((data) => {
        if (data.users) setUsers(data.users);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-white/[0.04] animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || users.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 text-center">
        <p className="text-white/50">
          {error ? "Não foi possível carregar o leaderboard. Configura as variáveis StreamElements." : "Sem dados de leaderboard."}
        </p>
      </div>
    );
  }

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="space-y-2">
      {users.map((user, i) => (
        <motion.div
          key={user.username}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: i * 0.03 }}
          className={`flex items-center gap-4 rounded-xl border px-5 py-3.5 transition-colors ${
            i < 3
              ? "border-arena-gold/25 bg-gradient-to-r from-arena-gold/[0.08] to-transparent"
              : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
          }`}
        >
          <span className="w-8 text-center text-lg font-bold text-white/40">
            {i < 3 ? medals[i] : i + 1}
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white truncate">{user.username}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-arena-gold">
              {user.points.toLocaleString("en-US")} pts
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
