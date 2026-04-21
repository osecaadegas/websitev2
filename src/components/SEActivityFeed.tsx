"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface Activity {
  _id: string;
  type: string;
  data: {
    username?: string;
    displayName?: string;
    amount?: number;
    message?: string;
    tier?: string;
  };
  createdAt: string;
}

const typeLabels: Record<string, { label: string; icon: string; color: string }> = {
  follow: { label: "Follow", icon: "👋", color: "text-blue-400" },
  subscriber: { label: "Sub", icon: "⭐", color: "text-purple-400" },
  cheer: { label: "Cheer", icon: "💎", color: "text-cyan-400" },
  tip: { label: "Tip", icon: "💰", color: "text-arena-gold" },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function SEActivityFeed() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    function fetchActivities() {
      fetch("/api/streamelements?endpoint=activities")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setActivities(data);
          else setError(true);
        })
        .catch(() => setError(true))
        .finally(() => setLoading(false));
    }

    fetchActivities();
    const interval = setInterval(fetchActivities, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-white/[0.04] animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || activities.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 text-center">
        <p className="text-white/50">
          {error ? "Não foi possível carregar atividades." : "Sem atividades recentes."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1 arena-scrollbar">
      {activities.map((activity, i) => {
        const meta = typeLabels[activity.type] || { label: activity.type, icon: "📌", color: "text-white/60" };
        const name = activity.data?.displayName || activity.data?.username || "Anónimo";

        return (
          <motion.div
            key={activity._id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: i * 0.02 }}
            className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 hover:bg-white/[0.04] transition-colors"
          >
            <span className="text-xl">{meta.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-semibold text-white">{name}</span>{" "}
                <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
              </p>
              {activity.data?.message && (
                <p className="text-xs text-white/40 truncate mt-0.5">{activity.data.message}</p>
              )}
            </div>
            {activity.data?.amount && (
              <span className="text-sm font-bold text-arena-gold">
                {activity.type === "tip" ? `€${activity.data.amount.toFixed(2)}` : `${activity.data.amount}`}
              </span>
            )}
            <span className="text-xs text-white/30 whitespace-nowrap">{timeAgo(activity.createdAt)}</span>
          </motion.div>
        );
      })}
    </div>
  );
}
