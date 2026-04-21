"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import EmbedRenderer from "./EmbedRenderer";
import type { EmbedType } from "./EmbedRenderer";

interface BrutaDoMes {
  id: string;
  month_label: string;
  title: string;
  description: string | null;
  url: string;
  provider: string | null;
  embed_type: EmbedType;
  embed_url: string;
  is_active: boolean;
  created_at: string;
}

const SLOT_PROVIDERS = [
  "1x2 Gaming", "3 Oaks Gaming", "All41 Studios", "Bally Technologies",
  "BF Games", "Betsoft", "Big Time Gaming", "Blueprint Gaming",
  "Booming Games", "Booongo", "ELK Studios", "Endorphina",
  "Evoplay", "Evolution", "Fantasma Games", "Fugaso",
  "GameArt", "GreenTube", "Habanero", "Hacksaw Gaming",
  "High 5 Games", "IGT", "Iron Dog Studio", "Just For The Win",
  "Kalamba Games", "Lady Luck Games", "Leander Games", "Lightning Box",
  "Merkur Gaming", "Microgaming", "NetEnt", "NextGen Gaming",
  "NoLimit City", "OneTouch", "Oryx Gaming", "Pariplay",
  "Play'n GO", "Playson", "Playtech", "Pragmatic Play",
  "Print Studios", "Push Gaming", "Quickspin", "RAW iGaming",
  "Red Tiger", "Reel Kingdom", "Reflex Gaming", "Relax Gaming",
  "Ruby Play", "Slotmill", "Spinomenal", "Stakelogic",
  "Swintt", "Tom Horn Gaming", "Thunderkick", "True Lab",
  "Wazdan", "Wizard Games", "WMS", "Yggdrasil", "Outro",
] as const;

/* ── Arena-themed toast ──────────────────────────────────────── */
function Toast({ message, type, onClose }: {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <motion.div
      className={`bdm-toast ${type === "success" ? "bdm-toast--success" : "bdm-toast--error"}`}
      initial={{ opacity: 0, y: -16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.97 }}
      transition={{ duration: 0.2 }}
    >
      <svg className="bdm-toast__icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8}>
        {type === "success"
          ? <path d="M3 8l3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
          : <><path d="M8 5v4" strokeLinecap="round" /><circle cx="8" cy="11.5" r="0.5" fill="currentColor" /></>
        }
      </svg>
      {message}
    </motion.div>
  );
}

export default function AdminBrutaDoMesConfig() {
  const [current, setCurrent]   = useState<BrutaDoMes | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [removing, setRemoving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  /* ── Form state ─────────────────────────────────────────── */
  const [url, setUrl]           = useState("");
  const [gameTitle, setGameTitle] = useState("");
  const [description, setDescription] = useState("");
  const [provider, setProvider] = useState("");
  const [providerSearch, setProviderSearch] = useState("");
  const [dropdownOpen, setDropdownOpen]     = useState(false);
  const [monthLabel, setMonthLabel] = useState(() =>
    new Date().toLocaleDateString("pt-PT", { month: "long", year: "numeric" })
  );
  const [error, setError] = useState<string | null>(null);

  const comboboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredProviders = SLOT_PROVIDERS.filter((p) =>
    p.toLowerCase().includes(providerSearch.toLowerCase())
  );

  const handleProviderSelect = (p: string) => {
    setProvider(p);
    setProviderSearch(p);
    setDropdownOpen(false);
  };

  const handleProviderInput = (val: string) => {
    setProviderSearch(val);
    setProvider(val);
    setDropdownOpen(true);
  };

  /* ── Load current ───────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch("/api/bruta-do-mes");
        const data = await res.json();
        setCurrent(data.win ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ── Submit ─────────────────────────────────────────────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!url.trim())       { setError("Insere o URL do vídeo.");          return; }
    if (!gameTitle.trim()) { setError("Insere o nome do jogo / slot.");   return; }
    if (!monthLabel.trim()){ setError("Insere o mês.");                   return; }

    setSaving(true);
    try {
      const res = await fetch("/api/bruta-do-mes", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          url,
          title:       gameTitle,
          description: description || null,
          provider:    provider || null,
          month_label: monthLabel,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erro ao guardar"); return; }
      setCurrent(data.win);
      setUrl(""); setGameTitle(""); setDescription(""); setProvider(""); setProviderSearch("");
      setToast({ message: "Bruta do Mês definida com sucesso!", type: "success" });
    } catch {
      setError("Erro de rede. Tenta novamente.");
    } finally {
      setSaving(false);
    }
  };

  /* ── Remove ─────────────────────────────────────────────── */
  const handleRemove = async () => {
    if (!confirm("Remover a Bruta do Mês atual?")) return;
    setRemoving(true);
    try {
      const res = await fetch("/api/bruta-do-mes", { method: "DELETE" });
      if (res.ok) {
        setCurrent(null);
        setToast({ message: "Bruta do Mês removida.", type: "success" });
      }
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="bdm-admin-page">
      <AnimatePresence>
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
      </AnimatePresence>

      <div className="bdm-admin-page__inner">
        {/* Page header */}
        <div className="bdm-admin-page__header">
          <div className="bdm-admin-page__header-ornament" aria-hidden="true">
            <svg viewBox="0 0 80 12" fill="none" stroke="currentColor" strokeWidth={0.8}>
              <line x1="0" y1="6" x2="28" y2="6" />
              <path d="M30 6 C34 2, 46 2, 50 6 C46 10, 34 10, 30 6Z" />
              <line x1="52" y1="6" x2="80" y2="6" />
            </svg>
          </div>
          <h1 className="bdm-admin-page__title">Bruta do Mês</h1>
          <p className="bdm-admin-page__desc">
            Define a melhor vitória do mês — será mostrada em destaque antes das vitórias da comunidade.
          </p>
        </div>

        {/* Current win preview */}
        {loading ? (
          <div className="bdm-admin-skeleton" aria-hidden="true" />
        ) : current ? (
          <div className="bdm-admin-current">
            <div className="bdm-admin-current__header">
              <div>
                <span className="bdm-admin-current__month">{current.month_label}</span>
                <h2 className="bdm-admin-current__title">{current.title}</h2>
                {current.provider && (
                  <span className="bdm-admin-current__provider-badge">{current.provider}</span>
                )}
              </div>
              <button
                className="bdm-admin-current__remove-btn"
                onClick={handleRemove}
                disabled={removing}
              >
                {removing ? "A remover…" : "Remover"}
              </button>
            </div>
            <div className="bdm-admin-current__embed">
              <EmbedRenderer type={current.embed_type} embedUrl={current.embed_url} title={current.title} />
            </div>
            {current.description && (
              <p className="bdm-admin-current__desc">{current.description}</p>
            )}
          </div>
        ) : (
          <div className="bdm-admin-empty">
            <svg viewBox="0 0 20 14" fill="currentColor" width="20" height="14" style={{ opacity: 0.3 }}>
              <path d="M0 14 L3 4 L7 9 L10 0 L13 9 L17 4 L20 14 Z" />
            </svg>
            <span>Nenhuma Bruta do Mês definida.</span>
          </div>
        )}

        {/* Set new win form */}
        <div className="bdm-admin-form-wrap">
          <h3 className="bdm-admin-form-wrap__heading">
            {current ? "Substituir Bruta do Mês" : "Definir Bruta do Mês"}
          </h3>

          <form onSubmit={handleSubmit} className="bdm-admin-form" noValidate>
            {/* Month */}
            <div className="bdm-admin-form__field">
              <label className="bdm-admin-form__label">Mês</label>
              <input
                className="bdm-admin-form__input"
                type="text"
                value={monthLabel}
                onChange={(e) => setMonthLabel(e.target.value)}
                placeholder="ex: Abril 2026"
                maxLength={60}
              />
            </div>

            {/* URL */}
            <div className="bdm-admin-form__field">
              <label className="bdm-admin-form__label">URL do vídeo / clip <span aria-hidden="true">*</span></label>
              <input
                className="bdm-admin-form__input"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=... ou clip.twitch.tv/..."
              />
              <span className="bdm-admin-form__hint">YouTube, Twitch clip, ou link direto para vídeo.</span>
            </div>

            {/* Game title */}
            <div className="bdm-admin-form__field">
              <label className="bdm-admin-form__label">Nome do Jogo / Slot <span aria-hidden="true">*</span></label>
              <input
                className="bdm-admin-form__input"
                type="text"
                value={gameTitle}
                onChange={(e) => setGameTitle(e.target.value)}
                placeholder="ex: Gates of Olympus"
                maxLength={120}
              />
            </div>

            {/* Provider combobox */}
            <div className="bdm-admin-form__field" ref={comboboxRef}>
              <label className="bdm-admin-form__label">Provider</label>
              <div className="bdm-admin-form__combobox">
                <input
                  type="text"
                  className="bdm-admin-form__input bdm-admin-form__input--combobox"
                  placeholder="Pesquisar provider..."
                  value={providerSearch}
                  onChange={(e) => handleProviderInput(e.target.value)}
                  onFocus={() => setDropdownOpen(true)}
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={dropdownOpen}
                  aria-haspopup="listbox"
                  aria-controls="bdm-provider-listbox"
                />
                <svg className="bdm-admin-form__combobox-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                  <circle cx="6.5" cy="6.5" r="4" />
                  <path d="M10 10l3 3" />
                </svg>
                <AnimatePresence>
                  {dropdownOpen && filteredProviders.length > 0 && (
                    <motion.ul
                      id="bdm-provider-listbox"
                      role="listbox"
                      className="bdm-admin-form__provider-list"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.14 }}
                    >
                      {filteredProviders.map((p) => (
                        <li
                          key={p}
                          role="option"
                          aria-selected={provider === p}
                          className={`bdm-admin-form__provider-item${provider === p ? " bdm-admin-form__provider-item--selected" : ""}`}
                          onMouseDown={(e) => { e.preventDefault(); handleProviderSelect(p); }}
                        >
                          {p}
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Description */}
            <div className="bdm-admin-form__field">
              <label className="bdm-admin-form__label">Contexto / Descrição (opcional)</label>
              <textarea
                className="bdm-admin-form__textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="ex: Ganhou durante uma stream ao vivo com 2x de base bet…"
                maxLength={500}
                rows={3}
              />
            </div>

            <AnimatePresence>
              {error && (
                <motion.p
                  className="bdm-admin-form__error"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <div className="bdm-admin-form__actions">
              <button type="submit" className="bdm-admin-form__submit-btn" disabled={saving}>
                {saving
                  ? <span className="bdm-admin-form__spinner" aria-hidden="true" />
                  : (current ? "Substituir" : "Definir como Bruta do Mês")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
