"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";

const STORAGE_KEY = "arena_age_verified";

export function AgeGate() {
  const { user, loading } = useAuth();
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (loading) return;
    // Skip if logged in with Twitch
    if (user) return;
    // Skip if already verified this session
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === "true") return;
    } catch {
      // sessionStorage unavailable
    }
    setVisible(true);
  }, [user, loading]);

  const handleConfirm = () => {
    setExiting(true);
    try {
      sessionStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // ignore
    }
    setTimeout(() => setVisible(false), 500);
  };

  const handleDeny = () => {
    window.location.href = "https://www.google.com";
  };

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-500 ${
        exiting ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/95 backdrop-blur-md" />

      {/* Subtle blood-red ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-arena-crimson/8 blur-[120px]" />
      </div>

      {/* Card */}
      <div
        className={`relative z-10 max-w-sm w-full mx-4 transition-all duration-500 ${
          exiting ? "scale-95 opacity-0" : "scale-100 opacity-100"
        }`}
      >
        <div className="bg-arena-dark/90 border border-arena-gold/15 rounded-2xl p-8 text-center shadow-2xl shadow-black/50">
          {/* Logo */}
          <div className="flex justify-center mb-5">
            <Image
              src="/images/logo.svg"
              alt="Secahub"
              width={160}
              height={40}
              className="h-9 w-auto"
            />
          </div>

          {/* Divider */}
          <div className="w-12 h-px bg-arena-gold/30 mx-auto mb-5" />

          {/* Title */}
          <h2 className="gladiator-title text-xl mb-2">
            Verificação de Idade
          </h2>
          <p className="text-sm text-arena-ash leading-relaxed mb-6">
            Este site contém conteúdo relacionado com jogos de azar.
            Confirma que tens <span className="text-arena-gold font-bold">18 anos ou mais</span> para continuar.
          </p>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleConfirm}
              className="flex-1 py-3 rounded-xl bg-gradient-to-b from-arena-crimson to-[#5a0000] text-white text-sm font-bold uppercase tracking-wider border border-arena-red/30 hover:from-arena-red hover:to-arena-crimson transition-all duration-300 hover:shadow-lg hover:shadow-arena-crimson/20"
            >
              Tenho 18+
            </button>
            <button
              onClick={handleDeny}
              className="flex-1 py-3 rounded-xl bg-arena-iron/50 text-arena-ash text-sm font-medium uppercase tracking-wider border border-white/5 hover:text-white hover:border-white/10 transition-all duration-300"
            >
              Sair
            </button>
          </div>

          {/* Fine print */}
          <p className="text-[9px] text-arena-ash/50 mt-5 leading-relaxed">
            Ao continuar, confirmas que cumpres os requisitos legais de idade do teu país.
          </p>
        </div>
      </div>
    </div>
  );
}
