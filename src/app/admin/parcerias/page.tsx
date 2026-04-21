"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { CasinoOfferRow } from "@/lib/supabase";

/* ═══════════════════════════════════════════════════════════════════
   EMPTY OFFER TEMPLATE
   ═══════════════════════════════════════════════════════════════════ */

const EMPTY_OFFER: Omit<CasinoOfferRow, "id" | "created_at" | "updated_at"> = {
  slug: "",
  name: "",
  logo_url: null,
  logo_bg: "#666666",
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
  license: "Curaçao",
  established: "2023",
  notes: [],
  affiliate_url: "",
  rating: 4.5,
  is_exclusive: true,
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
   OFFER FORM
   ═══════════════════════════════════════════════════════════════════ */

interface OfferFormProps {
  initial: Omit<CasinoOfferRow, "id" | "created_at" | "updated_at"> | CasinoOfferRow;
  onSave: (data: Omit<CasinoOfferRow, "id" | "created_at" | "updated_at">) => void;
  saving: boolean;
  nextOrder: number;
}

function OfferForm({ initial, onSave, saving, nextOrder }: OfferFormProps) {
  const [form, setForm] = useState({
    slug: initial.slug,
    name: initial.name,
    logo_bg: initial.logo_bg,
    banner_url: initial.banner_url ?? "",
    badge: initial.badge ?? "",
    tags: initial.tags.join(", "),
    headline: initial.headline,
    bonus_value: initial.bonus_value,
    free_spins: initial.free_spins,
    min_deposit: initial.min_deposit,
    code: initial.code,
    cashback: initial.cashback ?? "",
    withdraw_time: initial.withdraw_time,
    license: initial.license,
    established: initial.established,
    notes: initial.notes.join("\n"),
    affiliate_url: initial.affiliate_url,
    rating: (initial as any).rating ?? 4.5,
    is_exclusive: initial.is_exclusive ?? true,
    visible: initial.visible,
    sort_order: initial.sort_order || nextOrder,
  });

  const set = (key: string, value: string | boolean | number) => setForm((p) => ({ ...p, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.slug || !form.name || !form.headline) {
      alert("Slug, Nome e Headline são obrigatórios.");
      return;
    }
    onSave({
      slug: form.slug.toLowerCase().replace(/[^a-z0-9-]/g, ""),
      name: form.name,
      logo_url: initial.logo_url ?? null,
      logo_bg: form.logo_bg,
      banner_url: form.banner_url || null,
      badge: (form.badge as "NEW" | "HOT" | "ELITE") || null,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      headline: form.headline,
      bonus_value: form.bonus_value,
      free_spins: form.free_spins,
      min_deposit: form.min_deposit,
      code: form.code,
      cashback: form.cashback || null,
      withdraw_time: form.withdraw_time,
      license: form.license,
      established: form.established,
      notes: form.notes.split("\n").filter(Boolean),
      affiliate_url: form.affiliate_url,
      rating: form.rating,
      is_exclusive: form.is_exclusive,
      visible: form.visible,
      sort_order: form.sort_order,
    });
  };

  const inputCls = "w-full bg-arena-charcoal border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-arena-ash/50 focus:outline-none focus:border-arena-gold/40 transition-colors";
  const labelCls = "block text-[11px] uppercase tracking-wider text-arena-ash mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Row: Name + Slug */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Nome *</label>
          <input className={inputCls} value={form.name} onChange={(e) => {
            set("name", e.target.value);
            if (!("id" in initial)) set("slug", e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
          }} placeholder="Casino Name" required />
        </div>
        <div>
          <label className={labelCls}>Slug *</label>
          <input className={inputCls} value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="casino-name" required />
        </div>
      </div>

      {/* Headline */}
      <div>
        <label className={labelCls}>Headline *</label>
        <input className={inputCls} value={form.headline} onChange={(e) => set("headline", e.target.value)} placeholder="400% Bonus up to €2200 & 350FS" required />
      </div>

      {/* Row: Bonus + Free Spins + Min Deposit + Code */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <label className={labelCls}>Bonus Value</label>
          <input className={inputCls} value={form.bonus_value} onChange={(e) => set("bonus_value", e.target.value)} placeholder="550%" />
        </div>
        <div>
          <label className={labelCls}>Free Spins</label>
          <input className={inputCls} value={form.free_spins} onChange={(e) => set("free_spins", e.target.value)} placeholder="Up to 75" />
        </div>
        <div>
          <label className={labelCls}>Min. Depósito</label>
          <input className={inputCls} value={form.min_deposit} onChange={(e) => set("min_deposit", e.target.value)} placeholder="20€" />
        </div>
        <div>
          <label className={labelCls}>Código</label>
          <input className={inputCls} value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="Seca" />
        </div>
      </div>

      {/* Row: Cashback + Withdraw + License + Established */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <label className={labelCls}>Cashback</label>
          <input className={inputCls} value={form.cashback} onChange={(e) => set("cashback", e.target.value)} placeholder="35%" />
        </div>
        <div>
          <label className={labelCls}>Tempo Levantamento</label>
          <input className={inputCls} value={form.withdraw_time} onChange={(e) => set("withdraw_time", e.target.value)} placeholder="Up to 48h" />
        </div>
        <div>
          <label className={labelCls}>Licença</label>
          <input className={inputCls} value={form.license} onChange={(e) => set("license", e.target.value)} placeholder="Curaçao" />
        </div>
        <div>
          <label className={labelCls}>Fundado</label>
          <input className={inputCls} value={form.established} onChange={(e) => set("established", e.target.value)} placeholder="2023" />
        </div>
      </div>

      {/* Row: Badge + Tags + Logo BG */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={labelCls}>Badge</label>
          <select className={inputCls} value={form.badge} onChange={(e) => set("badge", e.target.value)}>
            <option value="">Nenhum</option>
            <option value="NEW">NEW</option>
            <option value="HOT">HOT</option>
            <option value="ELITE">ELITE</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Rating (0-5)</label>
          <div className="flex items-center gap-3">
            <input type="range" min="0" max="5" step="0.5" value={form.rating} onChange={(e) => set("rating", parseFloat(e.target.value))} className="flex-1 accent-arena-gold" />
            <span className="text-white text-sm font-bold w-8">{form.rating}</span>
          </div>
        </div>
        <div>
          <label className={labelCls}>Cor do Logo</label>
          <div className="flex gap-2 items-center">
            <input type="color" value={form.logo_bg} onChange={(e) => set("logo_bg", e.target.value)} className="w-10 h-10 rounded border border-white/10 cursor-pointer bg-transparent" />
            <input className={inputCls} value={form.logo_bg} onChange={(e) => set("logo_bg", e.target.value)} placeholder="#c026d3" />
          </div>
        </div>
      </div>

      {/* URLs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={labelCls}>Tags (separadas por vírgula)</label>
          <input className={inputCls} value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="FREE SPINS, MB" />
        </div>
        <div>
          <label className={labelCls}>Banner URL</label>
          <input className={inputCls} value={form.banner_url} onChange={(e) => set("banner_url", e.target.value)} placeholder="/images/banner.jpg" />
        </div>
        <div>
          <label className={labelCls}>Link Afiliado</label>
          <input className={inputCls} value={form.affiliate_url} onChange={(e) => set("affiliate_url", e.target.value)} placeholder="" />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className={labelCls}>Notas (uma por linha)</label>
        <textarea className={`${inputCls} min-h-[80px]`} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder={"24/7 Live Support\nPromotion details..."} />
      </div>

      {/* Visibility + Exclusive + Order */}
      <div className="flex items-center gap-6 flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.visible} onChange={(e) => set("visible", e.target.checked)} className="w-4 h-4 accent-arena-gold" />
          <span className="text-sm text-arena-smoke">Visível no site</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.is_exclusive} onChange={(e) => set("is_exclusive", e.target.checked)} className="w-4 h-4 accent-arena-gold" />
          <span className="text-sm text-arena-smoke">Oferta Exclusiva</span>
        </label>
        <div className="flex items-center gap-2">
          <label className="text-[11px] uppercase tracking-wider text-arena-ash">Ordem:</label>
          <input type="number" className={`${inputCls} w-20`} value={form.sort_order} onChange={(e) => set("sort_order", parseInt(e.target.value) || 0)} />
        </div>
      </div>

      {/* Submit */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="px-8 py-3 rounded-xl bg-gradient-to-b from-arena-crimson to-arena-blood text-white text-sm font-bold uppercase tracking-wider border border-arena-red/40 hover:from-arena-red hover:to-arena-crimson transition-all disabled:opacity-50"
        >
          {saving ? "A guardar..." : "id" in initial ? "Guardar Alterações" : "Criar Oferta"}
        </button>
      </div>
    </form>
  );
}
