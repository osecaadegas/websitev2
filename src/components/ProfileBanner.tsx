"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import Image from "next/image";

export function ProfileBanner() {
  const { user, loading } = useAuth();
  const [points, setPoints] = useState<number | null>(null);
  const [unread, setUnread] = useState(0);

  /* Fetch SE points when user is logged in */
  useEffect(() => {
    if (!user) return;
    const username = user.login;
    fetch(`/api/streamelements?endpoint=user-points&username=${encodeURIComponent(username)}`)
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.points === "number") setPoints(d.points);
      })
      .catch(() => {});
  }, [user]);

  /* Fetch unread notification count */
  useEffect(() => {
    if (!user) return;
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.notifications)) {
          setUnread(d.notifications.filter((n: { read: boolean }) => !n.read).length);
        }
      })
      .catch(() => {});
  }, [user]);

  if (loading || !user) return null;

  return (
    <div
      className="group flex items-center gap-4 bg-black/40 backdrop-blur-md border border-arena-gold/20
                 rounded-xl px-5 py-3 mb-8 transition-all
                 max-w-md mx-auto"
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <Image
          src={user.profile_image_url}
          alt={user.display_name}
          width={48}
          height={48}
          className="rounded-full border-2 border-arena-gold/40 group-hover:border-arena-gold transition-colors"
        />
        {/* Unread badge */}
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-arena-crimson text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col min-w-0">
        <span className="gladiator-label text-sm text-arena-gold truncate">
          {user.display_name}
        </span>
        <span className="text-xs text-arena-smoke">
          {points !== null ? `${points.toLocaleString()} pontos` : "A carregar pontos..."}
        </span>
      </div>

      {/* Arrow */}
      <svg className="w-4 h-4 text-arena-gold/40 group-hover:text-arena-gold ml-auto transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </div>
  );
}
