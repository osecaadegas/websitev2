"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { CrimeEmpireNav } from "@/components/CrimeEmpireNav";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { router.push("/"); return; }
    fetchAndMarkRead();
  }, [user]);

  const fetchAndMarkRead = async () => {
    try {
      const res = await fetch("/api/crime-empire/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        // Mark all as read
        if ((data.notifications || []).length > 0) {
          await fetch("/api/crime-empire/notifications", { method: "POST" });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const typeIcon: Record<string, string> = {
    jail_released: "🚔",
    pvp_attack: "⚔️",
    worker_event: "👷",
    level_up: "🎉",
    default: "🔔",
  };

  return (
    <div className="flex-1 text-white py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <CrimeEmpireNav />
        <h1 className="text-4xl font-black mb-6 bg-gradient-to-r from-[#ff6a00] to-[#ff8533] bg-clip-text text-transparent">
          🔔 Notificações
        </h1>

        {loading && (
          <div className="text-[#888] text-center py-12">A carregar...</div>
        )}

        {!loading && notifications.length === 0 && (
          <div className="text-center py-16 rounded-2xl bg-[#121212] border border-[#222]">
            <p className="text-5xl mb-4">🔕</p>
            <p className="text-[#666] text-lg">Sem notificações por ler.</p>
          </div>
        )}

        {!loading && notifications.length > 0 && (
          <div className="space-y-3">
            {notifications.map((n) => (
              <div
                key={n.id}
                className="flex gap-4 p-4 rounded-xl bg-[#121212] border border-[#222] hover:border-[#333] transition-colors"
              >
                <div className="text-2xl flex-shrink-0 mt-0.5">
                  {typeIcon[n.type] ?? typeIcon.default}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm">{n.title}</p>
                  <p className="text-[#888] text-xs mt-1">{n.message}</p>
                  <p className="text-[#555] text-[10px] mt-2">
                    {new Date(n.created_at).toLocaleString("pt-PT")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
