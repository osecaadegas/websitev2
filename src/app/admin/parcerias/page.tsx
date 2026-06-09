"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { CasinoOfferRow, WelcomeBonusStage } from "@/lib/supabase";

/* ═══════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════ */

const PAYMENT_OPTIONS = [
  "Visa", "Mastercard", "MB WAY", "MBnet",
  "Bitcoin", "Ethereum", "USDT",
  "Skrill", "Neteller", "Paysafecard",
  "Apple Pay", "Google Pay", "Bank", "Crypto",
];

const DEFAULT_STAGES: WelcomeBonusStage[] = [
  { label: "1ST", pct: "", fs: "", min: "" },
  { label: "2ND", pct: "", fs: "", min: "" },
  { label: "3RD", pct: "", fs: "", min: "" },
  { label: "4TH", pct: "", fs: "", min: "" },
];

const EMPTY_OFFER: Omit<CasinoOfferRow, "id" | "created_at" | "updated_at"> = {
  slug: "",
  name: "",
  logo_url: null,
  logo_bg: "#1a1a2e",
  banner_url: null,
  badge: null,
  tags: [],
  headline: "",
  bonus_value: "",
  free_spins: "",
  min_deposit: "",
  code: "",
  cashback: null,
  withdraw_time: "Up to 48h",
  max_withdrawal: null,
  license: "Curaçao",
  established: "2023",
  live_support: null,
  total_games: null,
  languages: null,
  game_providers: [],
  notes: [],
  welcome_bonus_stages: null,
  vip_program: null,
  details: null,
  affiliate_url: "",
  rating: 4.5,
  is_exclusive: true,
  payment_methods: [],
  kyc_required: true,
  vpn_friendly: false,
  visible: true,
  sort_order: 0,
};

/* ═══════════════════════════════════════════════════════════════════
   MAIN DASHBOARD
   ═══════════════════════════════════════════════════════════════════ */

export default function ParceriasPage() {
  const [offers, setOffers] = useState<CasinoOfferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CasinoOfferRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchOffers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("casino_offers")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) {
      console.error("Fetch error:", error);
      showToast("Erro ao carregar ofertas");
    }
    setOffers((data as CasinoOfferRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchOffers(); }, [fetchOffers]);

  /* ── TOGGLE VISIBILITY ── */
  const toggleVisibility = async (offer: CasinoOfferRow) => {
    const { error } = await supabase
      .from("casino_offers")
      .update({ visible: !offer.visible, updated_at: new Date().toISOString() })
      .eq("id", offer.id);
    if (error) { showToast("Erro ao atualizar"); return; }
    showToast(offer.visible ? "Oferta ocultada" : "Oferta visível");
    fetchOffers();
  };

  /* ── DELETE ── */
  const deleteOffer = async (id: string, name: string) => {
    if (!confirm(`Apagar a oferta "${name}"? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from("casino_offers").delete().eq("id", id);
    if (error) { showToast("Erro ao apagar"); return; }
    showToast("Oferta apagada");
    fetchOffers();
  };

  /* ── SAVE (create or update) ── */
  const handleSave = async (formData: Omit<CasinoOfferRow, "id" | "created_at" | "updated_at">) => {
    setSaving(true);
    if (editing) {
      const { error } = await supabase
        .from("casino_offers")
        .update({ ...formData, updated_at: new Date().toISOString() })
        .eq("id", editing.id);
      if (error) { showToast("Erro ao guardar"); setSaving(false); return; }
      showToast("Oferta atualizada");
    } else {
      const { error } = await supabase.from("casino_offers").insert(formData);
      if (error) { showToast("Erro ao criar: " + error.message); setSaving(false); return; }
      showToast("Oferta criada");
    }
    setSaving(false);
    setEditing(null);
    setCreating(false);
    fetchOffers();
  };

  /* ── MOVE ORDER ── */
  const moveOrder = async (offer: CasinoOfferRow, direction: "up" | "down") => {
    const idx = offers.findIndex((o) => o.id === offer.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= offers.length) return;
    const other = offers[swapIdx];
    await Promise.all([
      supabase.from("casino_offers").update({ sort_order: other.sort_order }).eq("id", offer.id),
      supabase.from("casino_offers").update({ sort_order: offer.sort_order }).eq("id", other.id),
    ]);
    fetchOffers();
  };

  /* ── FORM OPEN ── */
  if (editing || creating) {
    return (
      <div className="pt-24 pb-16 min-h-screen">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <button onClick={() => { setEditing(null); setCreating(false); }} className="text-arena-gold text-sm mb-4 hover:underline">
            ← Voltar à lista
          </button>
          <h1 className="text-arena-smoke text-lg font-semibold mb-6">
            {editing ? `Editar: ${editing.name}` : "Nova Parceria"}
          </h1>
          <OfferForm
            initial={editing ?? EMPTY_OFFER}
            onSave={handleSave}
            saving={saving}
            nextOrder={offers.length}
          />
        </div>
      </div>
    );
  }

  /* ── LIST ── */
  return (
    <div className="pt-24 pb-16 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-sm text-arena-ash mt-1">{offers.length} ofertas registadas</p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-b from-arena-crimson to-arena-blood text-white text-xs font-bold uppercase tracking-wider border border-arena-red/40 hover:from-arena-red hover:to-arena-crimson transition-all"
          >
            + Nova Oferta
          </button>
        </div>

        {/* Toast */}
        {toast && (
          <div className="fixed top-20 right-4 z-50 bg-arena-charcoal border border-arena-gold/30 text-arena-gold px-4 py-2.5 rounded-xl text-sm shadow-xl">
            {toast}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="text-center py-20 text-arena-ash">A carregar...</div>
        ) : offers.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-arena-ash text-lg mb-4">Nenhuma oferta ainda</p>
            <button onClick={() => setCreating(true)} className="text-arena-gold hover:underline">
              Criar a primeira oferta →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {offers.map((offer, idx) => (
              <div
                key={offer.id}
                className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                  offer.visible
                    ? "bg-arena-dark border-white/10"
                    : "bg-arena-dark/50 border-white/5 opacity-60"
                }`}
              >
                {/* Order arrows */}
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    onClick={() => moveOrder(offer, "up")}
                    disabled={idx === 0}
                    className="text-arena-ash hover:text-arena-gold disabled:opacity-20 text-xs"
                  >▲</button>
                  <button
                    onClick={() => moveOrder(offer, "down")}
                    disabled={idx === offers.length - 1}
                    className="text-arena-ash hover:text-arena-gold disabled:opacity-20 text-xs"
                  >▼</button>
                </div>

                {/* Color swatch */}
                <div className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: offer.logo_bg }}>
                  {offer.name.charAt(0)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white truncate">{offer.name}</h3>
                    {offer.badge && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded text-white ${offer.badge === "NEW" ? "bg-green-600" : offer.badge === "ELITE" ? "bg-yellow-600" : "bg-orange-600"}`}>
                        {offer.badge}
                      </span>
                    )}
                    {!offer.visible && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-arena-steel/50 text-arena-ash">
                        OCULTA
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-arena-ash truncate">{offer.headline}</p>
                  <p className="text-[10px] text-arena-ash/60 mt-0.5">
                    {offer.bonus_value} · {offer.min_deposit} min · Code: {offer.code}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleVisibility(offer)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${
                      offer.visible
                        ? "border-arena-gold/30 text-arena-gold hover:bg-arena-gold/10"
                        : "border-green-500/30 text-green-400 hover:bg-green-500/10"
                    }`}
                  >
                    {offer.visible ? "Ocultar" : "Mostrar"}
                  </button>
                  <button
                    onClick={() => setEditing(offer)}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-all"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => deleteOffer(offer.id, offer.name)}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    Apagar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   WELCOME BONUS STAGE EDITOR
   ═══════════════════════════════════════════════════════════════════ */

interface StageEditorProps {
  stages: WelcomeBonusStage[];
  onChange: (stages: WelcomeBonusStage[]) => void;
}

function WelcomeBonusStageEditor({ stages, onChange }: StageEditorProps) {
  const ic = "bg-arena-charcoal border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-arena-ash/40 focus:outline-none focus:border-arena-gold/40 transition-colors w-full";
  const setStage = (i: number, key: keyof WelcomeBonusStage, val: string) => {
    const next = stages.map((s, idx) => idx === i ? { ...s, [key]: val } : s);
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {stages.map((s, i) => (
        <div key={s.label} className="grid grid-cols-4 gap-2 items-center p-2.5 rounded-lg bg-white/[0.02] border border-white/8">
          <div className="text-[10px] font-black text-arena-gold uppercase tracking-wider text-center">{s.label}</div>
          <div>
            <div className="text-[9px] text-arena-ash mb-1 uppercase tracking-wider">% Bónus</div>
            <input className={ic} value={s.pct} onChange={e => setStage(i, "pct", e.target.value)} placeholder="120%" />
          </div>
          <div>
            <div className="text-[9px] text-arena-ash mb-1 uppercase tracking-wider">Free Spins</div>
            <input className={ic} value={s.fs ?? ""} onChange={e => setStage(i, "fs", e.target.value)} placeholder="100 FS" />
          </div>
          <div>
            <div className="text-[9px] text-arena-ash mb-1 uppercase tracking-wider">Min. Dep.</div>
            <input className={ic} value={s.min} onChange={e => setStage(i, "min", e.target.value)} placeholder="5€" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   OFFER FORM
   ═══════════════════════════════════════════════════════════════════ */

interface OfferFormProps {
  initial: Omit<CasinoOfferRow, "id" | "created_at" | "updated_at"> | CasinoOfferRow;
  onSave: (data: Omit<CasinoOfferRow, "id" | "created_at" | "updated_at">) => void;
  saving: boolean;
  nextOrder: number;
}

function OfferForm({ initial, onSave, saving, nextOrder }: OfferFormProps) {
  const isNew = !("id" in initial);

  const [form, setForm] = useState({
    /* identity */
    slug:           initial.slug,
    name:           initial.name,
    logo_url:       initial.logo_url ?? "",
    logo_bg:        initial.logo_bg,
    banner_url:     initial.banner_url ?? "",
    affiliate_url:  initial.affiliate_url,
    /* display */
    badge:          initial.badge ?? "",
    tags:           initial.tags.join(", "),
    rating:         (initial as any).rating ?? 4.5,
    /* bonus stats */
    headline:       initial.headline,
    bonus_value:    initial.bonus_value,
    free_spins:     initial.free_spins,
    min_deposit:    initial.min_deposit,
    code:           initial.code,
    cashback:       initial.cashback ?? "",
    /* casino details */
    withdraw_time:  initial.withdraw_time,
    max_withdrawal: (initial as any).max_withdrawal ?? "",
    license:        initial.license,
    established:    initial.established,
    live_support:   (initial as any).live_support ?? "",
    total_games:    (initial as any).total_games ?? "",
    languages:      (initial as any).languages ?? "",
    game_providers: ((initial as any).game_providers ?? []).join("\n"),
    /* rich content */
    welcome_bonus_stages: (() => {
      const wbs = (initial as any).welcome_bonus_stages;
      if (Array.isArray(wbs) && wbs.length > 0) {
        const filled = [...wbs];
        while (filled.length < 4) filled.push({ label: `${filled.length + 1}${["ST","ND","RD","TH"][filled.length] ?? "TH"}`, pct: "", fs: "", min: "" });
        return filled as WelcomeBonusStage[];
      }
      return DEFAULT_STAGES.map(s => ({ ...s }));
    })(),
    notes:          initial.notes.join("\n"),
    vip_program:    (initial as any).vip_program ?? "",
    details:        (initial as any).details ?? "",
    /* payment */
    payment_methods: initial.payment_methods ?? [] as string[],
    /* flags */
    kyc_required:   initial.kyc_required ?? true,
    vpn_friendly:   initial.vpn_friendly ?? false,
    is_exclusive:   initial.is_exclusive ?? true,
    visible:        initial.visible,
    /* order — kept as string so user can freely edit the field */
    sort_order_str: String(isNew ? nextOrder : initial.sort_order),
  });

  const set = (key: string, value: unknown) => setForm(p => ({ ...p, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.slug || !form.name || !form.headline) {
      alert("Slug, Nome e Headline são obrigatórios.");
      return;
    }
    const filledStages = form.welcome_bonus_stages.filter(s => s.pct.trim() !== "");
    onSave({
      slug:           form.slug.toLowerCase().replace(/[^a-z0-9-]/g, ""),
      name:           form.name,
      logo_url:       form.logo_url || null,
      logo_bg:        form.logo_bg,
      banner_url:     form.banner_url || null,
      affiliate_url:  form.affiliate_url,
      badge:          (form.badge as "NEW" | "HOT" | "ELITE") || null,
      tags:           form.tags.split(",").map(t => t.trim()).filter(Boolean),
      rating:         form.rating as number,
      headline:       form.headline,
      bonus_value:    form.bonus_value,
      free_spins:     form.free_spins,
      min_deposit:    form.min_deposit,
      code:           form.code,
      cashback:       form.cashback || null,
      withdraw_time:  form.withdraw_time,
      max_withdrawal: form.max_withdrawal || null,
      license:        form.license,
      established:    form.established,
      live_support:   form.live_support || null,
      total_games:    form.total_games || null,
      languages:      form.languages || null,
      game_providers: (form.game_providers as string).split("\n").map(p => p.trim()).filter(Boolean),
      notes:          (form.notes as string).split("\n").filter(Boolean),
      welcome_bonus_stages: filledStages.length > 0 ? filledStages : null,
      vip_program:    form.vip_program || null,
      details:        form.details || null,
      payment_methods: form.payment_methods as string[],
      kyc_required:   form.kyc_required as boolean,
      vpn_friendly:   form.vpn_friendly as boolean,
      is_exclusive:   form.is_exclusive as boolean,
      visible:        form.visible as boolean,
      sort_order:     parseInt(form.sort_order_str as string) || 0,
    });
  };

  const ic = "w-full bg-arena-charcoal border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-arena-ash/50 focus:outline-none focus:border-arena-gold/40 transition-colors";
  const lc = "block text-[11px] uppercase tracking-wider text-arena-ash mb-1";
  const sc = "text-[11px] uppercase tracking-wider text-arena-ash font-bold pb-2 mb-4 border-b border-white/8";

  return (
    <form onSubmit={handleSubmit} className="space-y-8">

      {/* ── SECTION: Identidade ──────────────────────────────────── */}
      <div>
        <p className={sc}>▸ Identidade</p>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className={lc}>Nome *</label>
            <input className={ic} value={form.name} onChange={e => {
              set("name", e.target.value);
              if (isNew) set("slug", e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
            }} placeholder="Casino Name" required />
          </div>
          <div>
            <label className={lc}>Slug *</label>
            <input className={ic} value={form.slug} onChange={e => set("slug", e.target.value)} placeholder="casino-name" required />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className={lc}>Logo URL</label>
            <input className={ic} value={form.logo_url} onChange={e => set("logo_url", e.target.value)} placeholder="/images/logos/casino.png" />
          </div>
          <div>
            <label className={lc}>Banner URL</label>
            <input className={ic} value={form.banner_url} onChange={e => set("banner_url", e.target.value)} placeholder="/images/banners/casino.jpg" />
          </div>
          <div>
            <label className={lc}>Link Afiliado</label>
            <input className={ic} value={form.affiliate_url} onChange={e => set("affiliate_url", e.target.value)} placeholder="https://..." />
          </div>
        </div>
        <div>
          <label className={lc}>Headline *</label>
          <input className={ic} value={form.headline} onChange={e => set("headline", e.target.value)} placeholder="400% Bonus up to €2200 & 350FS" required />
        </div>
      </div>

      {/* ── SECTION: Apresentação ────────────────────────────────── */}
      <div>
        <p className={sc}>▸ Apresentação</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={lc}>Badge</label>
            <select className={ic} value={form.badge} onChange={e => set("badge", e.target.value)}>
              <option value="">Nenhum</option>
              <option value="NEW">🟢 NEW</option>
              <option value="HOT">🔴 HOT</option>
              <option value="ELITE">⭐ ELITE</option>
            </select>
          </div>
          <div>
            <label className={lc}>Tags (vírgula)</label>
            <input className={ic} value={form.tags} onChange={e => set("tags", e.target.value)} placeholder="FREE SPINS, MB WAY" />
          </div>
          <div>
            <label className={lc}>Cor do Logo BG</label>
            <div className="flex gap-2 items-center">
              <input type="color" value={form.logo_bg} onChange={e => set("logo_bg", e.target.value)} className="w-10 h-10 rounded border border-white/10 cursor-pointer bg-transparent shrink-0" />
              <input className={ic} value={form.logo_bg} onChange={e => set("logo_bg", e.target.value)} placeholder="#1a1a2e" />
            </div>
          </div>
        </div>
        <div className="mt-4">
          <label className={lc}>Rating (0–5) — {form.rating}</label>
          <input type="range" min="0" max="5" step="0.5" value={form.rating as number} onChange={e => set("rating", parseFloat(e.target.value))} className="w-full accent-arena-gold" />
          <div className="flex justify-between text-[10px] text-arena-ash/50 mt-0.5"><span>0</span><span>5</span></div>
        </div>
      </div>

      {/* ── SECTION: Estatísticas do Bónus ───────────────────────── */}
      <div>
        <p className={sc}>▸ Estatísticas do Bónus</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <div><label className={lc}>Bónus</label><input className={ic} value={form.bonus_value} onChange={e => set("bonus_value", e.target.value)} placeholder="550%" /></div>
          <div><label className={lc}>Free Spins</label><input className={ic} value={form.free_spins} onChange={e => set("free_spins", e.target.value)} placeholder="Up to 75" /></div>
          <div><label className={lc}>Min. Depósito</label><input className={ic} value={form.min_deposit} onChange={e => set("min_deposit", e.target.value)} placeholder="20€" /></div>
          <div><label className={lc}>Código Promo</label><input className={ic} value={form.code} onChange={e => set("code", e.target.value)} placeholder="SECA" /></div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div><label className={lc}>Cashback</label><input className={ic} value={form.cashback} onChange={e => set("cashback", e.target.value)} placeholder="35%" /></div>
          <div><label className={lc}>Tempo Levant.</label><input className={ic} value={form.withdraw_time} onChange={e => set("withdraw_time", e.target.value)} placeholder="Up to 48h" /></div>
          <div><label className={lc}>Max Levant.</label><input className={ic} value={form.max_withdrawal} onChange={e => set("max_withdrawal", e.target.value)} placeholder="€5,000/week" /></div>
          <div><label className={lc}>Cashback %</label><input className={ic} value={form.cashback} onChange={e => set("cashback", e.target.value)} placeholder="30%" /></div>
        </div>
      </div>

      {/* ── SECTION: Detalhes do Casino ──────────────────────────── */}
      <div>
        <p className={sc}>▸ Detalhes do Casino</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <div><label className={lc}>Licença</label><input className={ic} value={form.license} onChange={e => set("license", e.target.value)} placeholder="Curaçao" /></div>
          <div><label className={lc}>Fundado</label><input className={ic} value={form.established} onChange={e => set("established", e.target.value)} placeholder="2023" /></div>
          <div><label className={lc}>Suporte Live</label><input className={ic} value={form.live_support} onChange={e => set("live_support", e.target.value)} placeholder="24/7" /></div>
          <div><label className={lc}>Total de Jogos</label><input className={ic} value={form.total_games} onChange={e => set("total_games", e.target.value)} placeholder="5000+" /></div>
        </div>
        <div className="mb-4">
          <label className={lc}>Idiomas Disponíveis</label>
          <input className={ic} value={form.languages} onChange={e => set("languages", e.target.value)} placeholder="PT, EN, ES, FR" />
        </div>
        <div>
          <label className={lc}>Game Providers (um por linha)</label>
          <textarea className={`${ic} min-h-[80px]`} value={form.game_providers} onChange={e => set("game_providers", e.target.value)} placeholder={"Pragmatic Play\nNoLimit City\nEvolution\nPlay'n GO"} />
        </div>
      </div>

      {/* ── SECTION: Welcome Bonus Stages ────────────────────────── */}
      <div>
        <p className={sc}>▸ Welcome Bonus — Breakdown por Depósito</p>
        <p className="text-[11px] text-arena-ash mb-3">Preenche os depósitos com conteúdo. Deixa vazio para não mostrar no cartão.</p>
        <WelcomeBonusStageEditor
          stages={form.welcome_bonus_stages as WelcomeBonusStage[]}
          onChange={stages => set("welcome_bonus_stages", stages)}
        />
      </div>

      {/* ── SECTION: Conteúdo Rico ───────────────────────────────── */}
      <div>
        <p className={sc}>▸ Conteúdo Rico</p>
        <div className="mb-4">
          <label className={lc}>Notas / Destaques (uma por linha)</label>
          <textarea className={`${ic} min-h-[80px]`} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder={"Suporte 24/7\nMegaways slots disponíveis"} />
        </div>
        <div className="mb-4">
          <label className={lc}>Programa VIP (uma bullet por linha)</label>
          <textarea className={`${ic} min-h-[80px]`} value={form.vip_program} onChange={e => set("vip_program", e.target.value)} placeholder={"5 níveis VIP\nCashback dedicado\nManager pessoal"} />
        </div>
        <div>
          <label className={lc}>Detalhes & Termos</label>
          <textarea className={`${ic} min-h-[100px]`} value={form.details} onChange={e => set("details", e.target.value)} placeholder="Wagering 35x. Válido para novos jogadores. Depósito mínimo €20..." />
        </div>
      </div>

      {/* ── SECTION: Métodos de Pagamento ────────────────────────── */}
      <div>
        <p className={sc}>▸ Métodos de Pagamento</p>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {PAYMENT_OPTIONS.map(opt => {
            const selected = (form.payment_methods as string[]).includes(opt);
            return (
              <label key={opt} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all text-xs font-medium select-none ${selected ? "border-arena-gold/60 bg-arena-gold/10 text-arena-gold" : "border-white/10 bg-white/[0.02] text-arena-ash hover:border-white/20 hover:text-arena-smoke"}`}>
                <input type="checkbox" className="sr-only" checked={selected} onChange={e => {
                  const arr = [...(form.payment_methods as string[])];
                  if (e.target.checked) arr.push(opt);
                  else { const i = arr.indexOf(opt); if (i > -1) arr.splice(i, 1); }
                  set("payment_methods", arr);
                }} />
                <span className={`w-3.5 h-3.5 rounded flex-shrink-0 border flex items-center justify-center transition-colors ${selected ? "bg-arena-gold border-arena-gold" : "border-white/20"}`}>
                  {selected && <svg className="w-2.5 h-2.5 text-black" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>}
                </span>
                {opt}
              </label>
            );
          })}
        </div>
      </div>

      {/* ── SECTION: Opções & Configuração ───────────────────────── */}
      <div>
        <p className={sc}>▸ Opções & Configuração</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          {([
            { key: "visible",     label: "Visível no site",   color: "accent-arena-gold" },
            { key: "is_exclusive",label: "Oferta Exclusiva",  color: "accent-arena-gold" },
            { key: "kyc_required",label: "Requer KYC",        color: "accent-red-500"   },
            { key: "vpn_friendly",label: "VPN Friendly",      color: "accent-green-500" },
          ] as const).map(({ key, label, color }) => (
            <label key={key} className="flex items-center gap-2.5 p-3 rounded-lg bg-white/[0.02] border border-white/8 cursor-pointer hover:border-white/15 transition-colors">
              <input type="checkbox" checked={form[key] as boolean} onChange={e => set(key, e.target.checked)} className={`w-4 h-4 ${color} shrink-0`} />
              <span className="text-sm text-arena-smoke">{label}</span>
            </label>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <label className={`${lc} mb-0 shrink-0`}>Ordem / Ranking</label>
          <input
            type="text"
            inputMode="numeric"
            className={`${ic} w-28`}
            value={form.sort_order_str}
            onChange={e => set("sort_order_str", e.target.value.replace(/[^0-9]/g, ""))}
            placeholder={String(nextOrder)}
          />
          <p className="text-[10px] text-arena-ash">Número mais baixo = aparece primeiro na lista</p>
        </div>
      </div>

      {/* ── Submit ───────────────────────────────────────────────── */}
      <div className="flex gap-3 pt-2 border-t border-white/8">
        <button type="submit" disabled={saving} className="px-8 py-3 rounded-xl bg-gradient-to-b from-arena-crimson to-arena-blood text-white text-sm font-bold uppercase tracking-wider border border-arena-red/40 hover:from-arena-red hover:to-arena-crimson transition-all disabled:opacity-50">
          {saving ? "A guardar..." : isNew ? "Criar Oferta" : "Guardar Alterações"}
        </button>
      </div>
    </form>
  );
}
