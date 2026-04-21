"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { UserRole } from "./supabase";

export interface TwitchUser {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
  role: UserRole;
}

interface AuthContextType {
  user: TwitchUser | null;
  loading: boolean;
  login: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<TwitchUser | null>(null);
  const [loading, setLoading] = useState(true);

  /* Read session on mount */
  useEffect(() => {
    // First try the client-readable cookie for instant hydration
    try {
      const cookieStr = document.cookie
        .split("; ")
        .find((c) => c.startsWith("twitch_user="));
      if (cookieStr) {
        const decoded = decodeURIComponent(cookieStr.split("=").slice(1).join("="));
        const parsed = JSON.parse(decoded);
        setUser(parsed);
        setLoading(false);
        return;
      }
    } catch {
      // Fall through to API check
    }

    // Fallback: fetch from server
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(() => {
    window.location.href = "/api/auth/twitch";
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    // Clear client cookie
    document.cookie = "twitch_user=; path=/; max-age=0";
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
