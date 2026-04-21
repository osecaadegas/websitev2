"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

interface Profile {
  twitch_id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
  email: string | null;
  se_username: string | null;
  discord_username: string | null;
  role: string;
  created_at: string;
}

export default function PerfilPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [seUsername, setSeUsername] = useState("");
  const [discordUsername, setDiscordUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [points, setPoints] = useState<number | null>(null);

  /* Redirect if not logged in */
  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [loading, user, router]);

  /* Fetch profile */
  useEffect(() => {
    if (!user) return;
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          setProfile(d.user);
          setSeUsername(d.user.se_username || "");
          setDiscordUsername(d.user.discord_username || "");
        }
      })
      .catch(() => {});
  }, [user]);

  /* Fetch SE points */
  useEffect(() => {
    if (!user) return;
    fetch(`/api/streamelements?endpoint=user-points&username=${encodeURIComponent(user.login)}`)
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.points === "number") setPoints(d.points);
      })
      .catch(() => {});
  }, [user]);

  /* Fetch notifications */
  useEffect(() => {
    if (!user) return;
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.notifications)) setNotifications(d.notifications);
      })
      .catch(() => {});
  }, [user]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ se_username: seUsername, discord_username: discordUsername }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  async function markRead(id: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-arena-smoke">A carregar...</p>
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  const typeIcon: Record<string, string> = {
    giveaway_win: "🎁",
    guess_result_win: "🎯",
    general: "📢",
  };

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Profile Card */}
        <div className="bg-black/40 backdrop-blur-md border border-arena-gold/20 rounded-2xl p-6 sm:p-8">
          <div className="flex items-center gap-5 mb-6">
            <Image
              src={user.profile_image_url}
              alt={user.display_name}
              width={80}
              height={80}
              className="rounded-full border-2 border-arena-gold/50"
            />
            <div>
              <h1 className="gladiator-title text-2xl">{user.display_name}</h1>
              <p className="text-arena-smoke text-sm mt-1">@{user.login}</p>
              {points !== null && (
                <p className="text-arena-gold text-sm mt-1 gladiator-label">
                  {points.toLocaleString()} pontos SE
                </p>
              )}
            </div>
          </div>

          {/* Editable fields */}
          <div className="space-y-4">
            <div>
              <label className="gladiator-label text-xs text-arena-smoke block mb-1">
                Username StreamElements
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={seUsername}
                  onChange={(e) => setSeUsername(e.target.value)}
                  placeholder="O teu username no StreamElements"
                  maxLength={50}
                  className="flex-1 bg-black/50 border border-arena-gold/20 rounded-lg px-4 py-2 text-arena-smoke
                             placeholder:text-arena-ash/40 focus:outline-none focus:border-arena-gold/60 transition-colors"
                />
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="gladiator-label px-4 py-2 bg-arena-gold/20 border border-arena-gold/30 rounded-lg
                             text-arena-gold hover:bg-arena-gold/30 transition-colors disabled:opacity-50"
                >
                  {saving ? "..." : saved ? "✓" : "Guardar"}
                </button>
              </div>
            </div>

            <div>
              <label className="gladiator-label text-xs text-arena-smoke block mb-1">
                Username Discord
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={discordUsername}
                  onChange={(e) => setDiscordUsername(e.target.value)}
                  placeholder="O teu username no Discord"
                  maxLength={50}
                  className="flex-1 bg-black/50 border border-arena-gold/20 rounded-lg px-4 py-2 text-arena-smoke
                             placeholder:text-arena-ash/40 focus:outline-none focus:border-arena-gold/60 transition-colors"
                />
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="gladiator-label px-4 py-2 bg-arena-gold/20 border border-arena-gold/30 rounded-lg
                             text-arena-gold hover:bg-arena-gold/30 transition-colors disabled:opacity-50"
                >
                  {saving ? "..." : saved ? "✓" : "Guardar"}
                </button>
              </div>
            </div>

            {/* Read-only info */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-arena-gold/10">
              <div>
                <span className="gladiator-label text-[10px] text-arena-ash block">Cargo</span>
                <span className="text-arena-smoke text-sm capitalize">{profile?.role || user.role}</span>
              </div>
              <div>
                <span className="gladiator-label text-[10px] text-arena-ash block">Membro desde</span>
                <span className="text-arena-smoke text-sm">
                  {profile?.created_at
                    ? new Date(profile.created_at).toLocaleDateString("pt-PT")
                    : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-black/40 backdrop-blur-md border border-arena-gold/20 rounded-2xl p-6 sm:p-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="gladiator-title text-xl">
              Notificações
              {unreadCount > 0 && (
                <span className="ml-2 bg-arena-crimson text-white text-xs rounded-full px-2 py-0.5 align-middle">
                  {unreadCount}
                </span>
              )}
            </h2>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="gladiator-label text-xs text-arena-gold/60 hover:text-arena-gold transition-colors"
              >
                Marcar tudo como lido
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="text-arena-ash text-sm text-center py-8">
              Sem notificações de momento.
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => !n.read && markRead(n.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    n.read
                      ? "border-arena-gold/5 bg-black/20"
                      : "border-arena-gold/20 bg-arena-gold/5 hover:bg-arena-gold/10"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg shrink-0">{typeIcon[n.type] || "📢"}</span>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${n.read ? "text-arena-ash" : "text-arena-gold"}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-arena-smoke mt-0.5">{n.message}</p>
                      <p className="text-[10px] text-arena-ash/60 mt-1">
                        {new Date(n.created_at).toLocaleDateString("pt-PT", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-arena-crimson shrink-0 mt-1.5 ml-auto" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
