"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "arena_cookie_consent";

type ConsentState = {
  essential: true; // always on
  analytics: boolean;
  marketing: boolean;
};

const DEFAULTS: ConsentState = { essential: true, analytics: false, marketing: false };

export function useCookieConsent(): ConsentState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return DEFAULTS;
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [configuring, setConfiguring] = useState(false);
  const [consent, setConsent] = useState<ConsentState>(DEFAULTS);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch {
      // ignore
    }
    // Small delay so it doesn't clash with age gate
    const t = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(t);
  }, []);

  const save = (state: ConsentState) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
    setExiting(true);
    setTimeout(() => setVisible(false), 400);
  };

  const acceptAll = () => save({ essential: true, analytics: true, marketing: true });
  const rejectAll = () => save(DEFAULTS);
  const saveCustom = () => save(consent);

  if (!visible) return null;

  return (
    <div
      className={`fixed bottom-4 left-4 right-4 lg:left-auto lg:right-6 lg:bottom-6 lg:max-w-md z-[9990] transition-all duration-400 ${
        exiting ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"
      }`}
    >
      <div className="bg-arena-dark/95 backdrop-blur-sm border border-white/10 rounded-2xl p-5 shadow-2xl shadow-black/60">
        {!configuring ? (
          /* ── Default view ── */
          <>
            <div className="flex items-start gap-3 mb-4">
              <span className="text-lg shrink-0 mt-0.5">🍪</span>
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Cookies</h3>
                <p className="text-xs text-arena-ash leading-relaxed">
                  Usamos cookies essenciais e opcionais para melhorar a tua experiência.
                  Podes aceitar, rejeitar ou configurar as tuas preferências.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={acceptAll}
                className="flex-1 py-2 rounded-lg bg-gradient-to-b from-arena-crimson to-[#5a0000] text-white text-xs font-bold uppercase tracking-wider border border-arena-red/30 hover:from-arena-red hover:to-arena-crimson transition-all"
              >
                Aceitar
              </button>
              <button
                onClick={() => setConfiguring(true)}
                className="flex-1 py-2 rounded-lg bg-arena-iron/50 text-arena-smoke text-xs font-medium uppercase tracking-wider border border-white/5 hover:text-white hover:border-white/10 transition-all"
              >
                Configurar
              </button>
              <button
                onClick={rejectAll}
                className="flex-1 py-2 rounded-lg bg-arena-iron/30 text-arena-ash text-xs font-medium uppercase tracking-wider border border-white/5 hover:text-white hover:border-white/10 transition-all"
              >
                Rejeitar
              </button>
            </div>
          </>
        ) : (
          /* ── Config view ── */
          <>
            <h3 className="text-sm font-bold text-white mb-3">Configurar Cookies</h3>
            <div className="space-y-3 mb-4">
              {/* Essential — always on */}
              <label className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-white">Essenciais</p>
                  <p className="text-[10px] text-arena-ash">Necessários para o site funcionar.</p>
                </div>
                <div className="w-9 h-5 rounded-full bg-arena-gold/80 relative cursor-not-allowed">
                  <div className="absolute right-0.5 top-0.5 w-4 h-4 rounded-full bg-white" />
                </div>
              </label>

              {/* Analytics */}
              <label className="flex items-center justify-between cursor-pointer group">
                <div>
                  <p className="text-xs font-medium text-white">Analíticos</p>
                  <p className="text-[10px] text-arena-ash">Ajudam a entender o uso do site.</p>
                </div>
                <button
                  onClick={() => setConsent((c) => ({ ...c, analytics: !c.analytics }))}
                  className={`w-9 h-5 rounded-full relative transition-colors duration-200 ${
                    consent.analytics ? "bg-arena-gold/80" : "bg-arena-steel/60"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200 ${
                      consent.analytics ? "right-0.5" : "left-0.5"
                    }`}
                  />
                </button>
              </label>

              {/* Marketing */}
              <label className="flex items-center justify-between cursor-pointer group">
                <div>
                  <p className="text-xs font-medium text-white">Marketing</p>
                  <p className="text-[10px] text-arena-ash">Personalização e anúncios.</p>
                </div>
                <button
                  onClick={() => setConsent((c) => ({ ...c, marketing: !c.marketing }))}
                  className={`w-9 h-5 rounded-full relative transition-colors duration-200 ${
                    consent.marketing ? "bg-arena-gold/80" : "bg-arena-steel/60"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200 ${
                      consent.marketing ? "right-0.5" : "left-0.5"
                    }`}
                  />
                </button>
              </label>
            </div>

            <div className="flex gap-2">
              <button
                onClick={saveCustom}
                className="flex-1 py-2 rounded-lg bg-gradient-to-b from-arena-crimson to-[#5a0000] text-white text-xs font-bold uppercase tracking-wider border border-arena-red/30 hover:from-arena-red hover:to-arena-crimson transition-all"
              >
                Guardar
              </button>
              <button
                onClick={() => setConfiguring(false)}
                className="py-2 px-4 rounded-lg text-xs text-arena-ash hover:text-white transition-colors"
              >
                Voltar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
