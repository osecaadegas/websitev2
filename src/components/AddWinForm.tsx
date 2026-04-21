"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SLOT_PROVIDERS = [
  "1x2 Gaming",
  "3 Oaks Gaming",
  "All41 Studios",
  "Bally Technologies",
  "BF Games",
  "Betsoft",
  "Big Time Gaming",
  "Blueprint Gaming",
  "Booming Games",
  "Booongo",
  "ELK Studios",
  "Endorphina",
  "Evoplay",
  "Evolution",
  "Fantasma Games",
  "Fugaso",
  "GameArt",
  "GreenTube",
  "Habanero",
  "Hacksaw Gaming",
  "High 5 Games",
  "IGT",
  "Iron Dog Studio",
  "Just For The Win",
  "Kalamba Games",
  "Lady Luck Games",
  "Leander Games",
  "Lightning Box",
  "Merkur Gaming",
  "Microgaming",
  "NetEnt",
  "NextGen Gaming",
  "NoLimit City",
  "OneTouch",
  "Oryx Gaming",
  "Pariplay",
  "Play'n GO",
  "Playson",
  "Playtech",
  "Pragmatic Play",
  "Print Studios",
  "Push Gaming",
  "Quickspin",
  "RAW iGaming",
  "Red Tiger",
  "Reel Kingdom",
  "Reflex Gaming",
  "Relax Gaming",
  "Ruby Play",
  "Slotmill",
  "Spinomenal",
  "Stakelogic",
  "Swintt",
  "Tom Horn Gaming",
  "Thunderkick",
  "True Lab",
  "Wazdan",
  "Wizard Games",
  "WMS",
  "Yggdrasil",
  "Outro",
] as const;

interface AddWinFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function AddWinForm({ onSuccess, onCancel }: AddWinFormProps) {
  const [url, setUrl]             = useState("");
  const [payout, setPayout]       = useState("");
  const [multiplier, setMultiplier] = useState("");
  const [provider, setProvider]   = useState("");
  const [providerSearch, setProviderSearch] = useState("");
  const [dropdownOpen, setDropdownOpen]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

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

  const handleProviderInputChange = (val: string) => {
    setProviderSearch(val);
    setProvider(val);
    setDropdownOpen(true);
  };

  /* Only allow numeric / decimal input */
  const handleNumericInput = (
    val: string,
    setter: (v: string) => void
  ) => {
    const cleaned = val.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
    setter(cleaned);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!url.trim()) { setError("Insere o URL do teu clip ou vídeo."); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/user-clips", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          url,
          title:       payout ? `${payout}€` : "",
          description: multiplier ? `${multiplier}x` : "",
          provider,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erro ao submeter"); return; }
      onSuccess();
    } catch {
      setError("Erro de rede. Tenta novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      className="add-win-form__overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <motion.div
        className="add-win-form"
        initial={{ opacity: 0, scale: 0.96, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -20 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-win-title"
      >
        {/* Header */}
        <div className="add-win-form__header">
          <h2 id="add-win-title" className="add-win-form__title">Registar Vitória</h2>
          <button className="add-win-form__close" onClick={onCancel} aria-label="Fechar">✕</button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {/* URL */}
          <div className="add-win-form__field">
            <label className="add-win-form__label" htmlFor="win-url">
              URL do Clip / Vídeo <span aria-hidden="true">*</span>
            </label>
            <input
              id="win-url"
              type="url"
              className="add-win-form__input"
              placeholder="https://youtube.com/watch?v=... ou link directo"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              autoFocus
              autoComplete="off"
            />
            <span className="add-win-form__hint">YouTube ou link directo (.mp4)</span>
          </div>

          {/* Payout + Multiplier side by side */}
          <div className="add-win-form__row">
            <div className="add-win-form__field">
              <label className="add-win-form__label" htmlFor="win-payout">Payout</label>
              <div className="add-win-form__number-wrap">
                <span className="add-win-form__number-prefix">€</span>
                <input
                  id="win-payout"
                  type="text"
                  inputMode="decimal"
                  className="add-win-form__input add-win-form__input--number"
                  placeholder="0.00"
                  value={payout}
                  onChange={(e) => handleNumericInput(e.target.value, setPayout)}
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="add-win-form__field">
              <label className="add-win-form__label" htmlFor="win-multiplier">Multiplier</label>
              <div className="add-win-form__number-wrap">
                <input
                  id="win-multiplier"
                  type="text"
                  inputMode="decimal"
                  className="add-win-form__input add-win-form__input--number"
                  placeholder="0"
                  value={multiplier}
                  onChange={(e) => handleNumericInput(e.target.value, setMultiplier)}
                  autoComplete="off"
                />
                <span className="add-win-form__number-suffix">x</span>
              </div>
            </div>
          </div>

          {/* Provider combobox */}
          <div className="add-win-form__field" ref={comboboxRef}>
            <label className="add-win-form__label" htmlFor="win-provider">Provider</label>
            <div className="add-win-form__combobox">
              <input
                id="win-provider"
                type="text"
                className="add-win-form__input add-win-form__input--combobox"
                placeholder="Pesquisar provider..."
                value={providerSearch}
                onChange={(e) => handleProviderInputChange(e.target.value)}
                onFocus={() => setDropdownOpen(true)}
                autoComplete="off"
                role="combobox"
                aria-expanded={dropdownOpen}
                aria-haspopup="listbox"
                aria-controls="provider-listbox"
              />
              <svg className="add-win-form__combobox-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                <circle cx="6.5" cy="6.5" r="4" />
                <path d="M10 10l3 3" />
              </svg>
              <AnimatePresence>
                {dropdownOpen && filteredProviders.length > 0 && (
                  <motion.ul
                    id="provider-listbox"
                    role="listbox"
                    className="add-win-form__provider-list"
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
                        className={`add-win-form__provider-item${provider === p ? " add-win-form__provider-item--selected" : ""}`}
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

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.p
                className="add-win-form__error"
                role="alert"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Actions */}
          <div className="add-win-form__actions">
            <button type="button" className="add-win-form__cancel-btn" onClick={onCancel} disabled={submitting}>
              Cancelar
            </button>
            <button type="submit" className="add-win-form__submit-btn" disabled={submitting}>
              {submitting ? <span className="add-win-form__spinner" aria-hidden="true" /> : "Gravar na Pedra"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
