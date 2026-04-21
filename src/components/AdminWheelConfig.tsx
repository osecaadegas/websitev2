"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

interface Segment {
  id: string;
  label: string;
  icon: string;
  color: string;
  glow_color: string;
  tier: "legendary" | "epic" | "rare" | "common" | "loss";
  reward_type: "SE_POINTS" | "FREE_SPIN" | "CUSTOM";
  reward_value: number;
  weight: number;
  is_active: boolean;
  sort_order: number;
}

interface WheelConfig {
  free_spin_enabled: boolean;
  max_free_spins_per_day: number;
  chain_limit: number;
}

const EMPTY_SEGMENT: Omit<Segment, "id"> = {
  label: "",
  icon: "🎁",
  color: "#d4a843",
  glow_color: "rgba(212,168,67,0.5)",
  tier: "common",
  reward_type: "SE_POINTS",
  reward_value: 0,
  weight: 10,
  is_active: true,
  sort_order: 0,
};

const TIER_OPTIONS: { value: Segment["tier"]; label: string; color: string }[] = [
  { value: "legendary", label: "Lendário", color: "#d4a843" },
  { value: "epic", label: "Épico", color: "#9c27b0" },
  { value: "rare", label: "Raro", color: "#cd7f32" },
  { value: "common", label: "Comum", color: "#f0d78c" },
  { value: "loss", label: "Derrota", color: "#8b0000" },
];

const REWARD_TYPES: { value: Segment["reward_type"]; label: string }[] = [
  { value: "SE_POINTS", label: "SE Points" },
  { value: "FREE_SPIN", label: "Free Spin" },
  { value: "CUSTOM", label: "Custom" },
];

/* ═══════════════════════════════════════════════════════════════
   WHEEL PREVIEW SVG
   ═══════════════════════════════════════════════════════════════ */

function WheelPreview({ segments }: { segments: Segment[] }) {
  const active = segments.filter((s) => s.is_active);
  const count = active.length;
  if (count === 0) {
    return (
      <div className="flex items-center justify-center h-full text-arena-ash/50 text-sm italic">
        Nenhum segmento ativo
      </div>
    );
  }

  const segAngle = 360 / count;
  const size = 400;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 10;

  function segmentPath(index: number) {
    const startAngle = (index * segAngle - 90) * (Math.PI / 180);
    const endAngle = ((index + 1) * segAngle - 90) * (Math.PI / 180);
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = segAngle > 180 ? 1 : 0;
    return `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2} Z`;
  }

  return (
    <div className="relative aspect-square w-full max-w-[320px] mx-auto">
      {/* Pointer */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20" style={{ marginTop: "-16px" }}>
        <svg width="24" height="40" viewBox="0 0 36 64" fill="none">
          <polygon points="18,19 12,21 18,62 24,21" fill="#c0c0c0" stroke="#888" strokeWidth="0.5" />
          <line x1="18" y1="21" x2="18" y2="58" stroke="#e8e8e8" strokeWidth="1" opacity="0.5" />
          <circle cx="18" cy="3" r="3" fill="#b8860b" stroke="#8b6914" strokeWidth="0.6" />
          <rect x="14" y="2" width="8" height="14" rx="2" fill="#3a2a1a" stroke="#5a4a2a" strokeWidth="0.6" />
          <rect x="6" y="14" width="24" height="5" rx="1.5" fill="#b8860b" stroke="#8b6914" strokeWidth="0.8" />
        </svg>
      </div>

      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full">
        <defs>
          <radialGradient id="prevRim" cx="50%" cy="50%" r="50%">
            <stop offset="82%" stopColor="#1a1a1a" />
            <stop offset="90%" stopColor="#2a2a2a" />
            <stop offset="95%" stopColor="#444" />
            <stop offset="100%" stopColor="#1a1a1a" />
          </radialGradient>
        </defs>

        <circle cx={cx} cy={cy} r={r + 8} fill="url(#prevRim)" stroke="#555" strokeWidth="1" />
        <circle cx={cx} cy={cy} r={r + 5} fill="none" stroke="#d4a843" strokeWidth="0.5" opacity="0.3" />

        {active.map((seg, i) => {
          const midAngleDeg = (i + 0.5) * segAngle;
          const midAngle = (midAngleDeg - 90) * (Math.PI / 180);
          const segColors = ["rgba(18,18,18,0.97)", "rgba(28,26,22,0.97)"];
          const letters = seg.label.toUpperCase().split("");
          const iconR = r * 0.85;
          const letterStartR = r * 0.73;
          const letterStep = Math.min((r * 0.40) / Math.max(letters.length, 1), 13);

          return (
            <g key={seg.id}>
              <path d={segmentPath(i)} fill={segColors[i % 2]} stroke="rgba(80,70,50,0.35)" strokeWidth="1" />
              <text
                x={cx + iconR * Math.cos(midAngle)} y={cy + iconR * Math.sin(midAngle)}
                textAnchor="middle" dominantBaseline="central" fontSize="17"
                transform={`rotate(${midAngleDeg}, ${cx + iconR * Math.cos(midAngle)}, ${cy + iconR * Math.sin(midAngle)})`}
              >{seg.icon}</text>
              {letters.map((letter, li) => {
                const lr = letterStartR - li * letterStep;
                const lx = cx + lr * Math.cos(midAngle);
                const ly = cy + lr * Math.sin(midAngle);
                return (
                  <text key={li} x={lx} y={ly} textAnchor="middle" dominantBaseline="central"
                    fontSize="8" fontWeight="800" fill={seg.color} fontFamily="'Cinzel', serif" opacity="0.85"
                    transform={`rotate(${midAngleDeg}, ${lx}, ${ly})`}
                  >{letter}</text>
                );
              })}
            </g>
          );
        })}

        <circle cx={cx} cy={cy} r={r * 0.24} fill="#141414" stroke="#555" strokeWidth="1.5" />
        <circle cx={cx} cy={cy} r={r * 0.23} fill="none" stroke="#d4a843" strokeWidth="0.5" opacity="0.25" />
      </svg>

      {/* Center mascot */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[22%] h-[22%] rounded-full overflow-hidden border-2 border-arena-gold/30 bg-arena-dark">
          <Image src="/images/superbruta.png" alt="Superbruta" width={80} height={80} className="w-full h-full object-cover" />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN ADMIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function AdminWheelConfig() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [config, setConfig] = useState<WheelConfig>({
    free_spin_enabled: true,
    max_free_spins_per_day: 1,
    chain_limit: 3,
  });
  const [editing, setEditing] = useState<Segment | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const showToast = useCallback((type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  }, []);

  /* ── Fetch data ──────────────────────────────────────────── */
  useEffect(() => {
    fetch("/api/wheel-segments")
      .then((r) => r.json())
      .then((d) => {
        if (d.segments) setSegments(d.segments);
        if (d.config) {
          const cfg: Record<string, string> = {};
          for (const row of d.config) cfg[row.key] = row.value;
          setConfig({
            free_spin_enabled: cfg.free_spin_enabled !== "false",
            max_free_spins_per_day: parseInt(cfg.max_free_spins_per_day ?? "1", 10),
            chain_limit: parseInt(cfg.chain_limit ?? "3", 10),
          });
        }
      })
      .catch(() => showToast("error", "Erro ao carregar dados"))
      .finally(() => setLoading(false));
  }, [showToast]);

  /* ── CRUD ────────────────────────────────────────────────── */
  const saveSegment = async () => {
    if (!editing) return;
    if (!editing.label.trim()) { showToast("error", "Label obrigatório"); return; }
    if (editing.weight < 1) { showToast("error", "Weight mínimo é 1"); return; }

    setSaving(true);
    try {
      if (isNew) {
        const res = await fetch("/api/wheel-segments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editing),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        setSegments((prev) => [...prev, d.segment]);
        setEditing(d.segment);
        setIsNew(false);
        showToast("success", "Segmento criado!");
      } else {
        const res = await fetch("/api/wheel-segments", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editing),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        setSegments((prev) => prev.map((s) => (s.id === d.segment.id ? d.segment : s)));
        setEditing(d.segment);
        showToast("success", "Segmento atualizado!");
      }
    } catch (err: unknown) {
      showToast("error", err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const deleteSegment = async () => {
    if (!editing || isNew) return;
    if (!confirm("Eliminar este segmento?")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/wheel-segments?id=${editing.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao eliminar");
      setSegments((prev) => prev.filter((s) => s.id !== editing.id));
      setEditing(null);
      showToast("success", "Segmento eliminado!");
    } catch {
      showToast("error", "Erro ao eliminar");
    } finally {
      setSaving(false);
    }
  };

  const duplicateSegment = () => {
    if (!editing) return;
    const dup = { ...editing, id: crypto.randomUUID(), label: `${editing.label} (cópia)`, sort_order: segments.length };
    setEditing(dup);
    setIsNew(true);
  };

  const toggleActive = async (seg: Segment) => {
    const updated = { ...seg, is_active: !seg.is_active };
    try {
      const res = await fetch("/api/wheel-segments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setSegments((prev) => prev.map((s) => (s.id === d.segment.id ? d.segment : s)));
      if (editing?.id === seg.id) setEditing(d.segment);
    } catch {
      showToast("error", "Erro ao atualizar");
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/wheel-segments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: [
            { key: "free_spin_enabled", value: String(config.free_spin_enabled) },
            { key: "max_free_spins_per_day", value: String(config.max_free_spins_per_day) },
            { key: "chain_limit", value: String(config.chain_limit) },
          ],
        }),
      });
      if (!res.ok) throw new Error("Erro ao salvar config");
      showToast("success", "Config atualizada!");
    } catch {
      showToast("error", "Erro ao salvar config");
    } finally {
      setSaving(false);
    }
  };

  const normalizeWeights = () => {
    const active = segments.filter((s) => s.is_active);
    if (active.length === 0) return;
    const equalWeight = Math.round(100 / active.length);
    setSegments((prev) =>
      prev.map((s) => (s.is_active ? { ...s, weight: equalWeight } : s))
    );
    if (editing?.is_active) setEditing({ ...editing, weight: equalWeight });
    showToast("success", "Pesos normalizados! Salva cada segmento para aplicar.");
  };

  /* ── Drag & Drop ─────────────────────────────────────────── */
  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setSegments((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(idx, 0, moved);
      return next.map((s, i) => ({ ...s, sort_order: i }));
    });
    setDragIdx(idx);
  };
  const handleDragEnd = () => setDragIdx(null);

  /* ── Derived ─────────────────────────────────────────────── */
  const totalWeight = segments.filter((s) => s.is_active).reduce((sum, s) => sum + s.weight, 0);
  const activeCount = segments.filter((s) => s.is_active).length;
  const freeSpinCount = segments.filter((s) => s.is_active && s.reward_type === "FREE_SPIN").length;

  /* ── Validation warnings ─────────────────────────────────── */
  const warnings: string[] = [];
  if (activeCount === 0) warnings.push("A roda precisa de pelo menos 1 segmento ativo.");
  if (totalWeight === 0) warnings.push("O peso total é 0.");
  if (freeSpinCount > 1) warnings.push(`${freeSpinCount} segmentos FREE_SPIN ativos — recomendado: máximo 1.`);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-2 border-arena-gold/30 border-t-arena-gold rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Toast ──────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className={`fixed top-20 right-6 z-50 px-4 py-2 rounded-lg text-sm font-semibold shadow-lg ${
              toast.type === "success" ? "bg-green-600/90 text-white" : "bg-red-600/90 text-white"
            }`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Warnings ──────────────────────────────────────── */}
      {warnings.length > 0 && (
        <div className="rounded-lg border border-yellow-600/40 bg-yellow-900/20 p-3">
          {warnings.map((w, i) => (
            <p key={i} className="text-xs text-yellow-400">⚠ {w}</p>
          ))}
        </div>
      )}

      {/* ── Free Spin Config ──────────────────────────────── */}
      <div className="rounded-xl border border-arena-gold/10 bg-arena-charcoal/50 p-4">
        <h3 className="gladiator-label text-xs text-arena-gold mb-3">⚙ Configuração Free Spin</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={config.free_spin_enabled}
              onChange={(e) => setConfig((c) => ({ ...c, free_spin_enabled: e.target.checked }))}
              className="accent-arena-gold w-4 h-4"
            />
            <span className="text-sm text-arena-smoke">Free Spin Ativo</span>
          </label>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-arena-ash block mb-1">Max Free Spins / Dia</label>
            <input type="number" min={1} max={10} value={config.max_free_spins_per_day}
              onChange={(e) => setConfig((c) => ({ ...c, max_free_spins_per_day: parseInt(e.target.value, 10) || 1 }))}
              className="w-full bg-arena-dark border border-arena-steel/30 rounded px-2 py-1 text-sm text-arena-white"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-arena-ash block mb-1">Chain Limit</label>
            <input type="number" min={1} max={20} value={config.chain_limit}
              onChange={(e) => setConfig((c) => ({ ...c, chain_limit: parseInt(e.target.value, 10) || 3 }))}
              className="w-full bg-arena-dark border border-arena-steel/30 rounded px-2 py-1 text-sm text-arena-white"
            />
          </div>
        </div>
        <button onClick={saveConfig} disabled={saving}
          className="mt-3 px-4 py-1.5 rounded-lg bg-arena-gold/20 text-arena-gold text-xs font-bold hover:bg-arena-gold/30 transition-colors disabled:opacity-50"
        >
          Guardar Config
        </button>
      </div>

      {/* ── Main 3-column layout ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* LEFT — Segments List */}
        <div className="lg:col-span-4 rounded-xl border border-arena-gold/10 bg-arena-charcoal/50 p-4 max-h-[70vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="gladiator-label text-xs text-arena-gold">⚔ Segmentos ({segments.length})</h3>
            <div className="flex gap-2">
              <button onClick={normalizeWeights} title="Normalizar pesos"
                className="p-1.5 rounded bg-arena-steel/20 hover:bg-arena-steel/30 text-arena-ash hover:text-arena-white transition-colors text-xs"
              >
                ⚖
              </button>
              <button onClick={() => { setEditing({ ...EMPTY_SEGMENT, id: crypto.randomUUID(), sort_order: segments.length } as Segment); setIsNew(true); }}
                className="px-3 py-1 rounded bg-arena-gold/20 text-arena-gold text-xs font-bold hover:bg-arena-gold/30 transition-colors"
              >
                + Novo
              </button>
            </div>
          </div>

          <div className="space-y-1">
            {segments.map((seg, idx) => {
              const pct = totalWeight > 0 ? ((seg.weight / totalWeight) * 100).toFixed(1) : "0";
              return (
                <div
                  key={seg.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  onClick={() => { setEditing({ ...seg }); setIsNew(false); }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all duration-150 border ${
                    editing?.id === seg.id
                      ? "border-arena-gold/50 bg-arena-gold/10"
                      : "border-transparent hover:border-arena-steel/30 hover:bg-white/[0.02]"
                  } ${!seg.is_active ? "opacity-40" : ""}`}
                >
                  <span className="text-xs text-arena-ash/40 cursor-grab select-none">⣿</span>
                  <span className="text-base shrink-0">{seg.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-arena-white truncate">{seg.label}</p>
                    <p className="text-[10px] text-arena-ash">
                      {seg.reward_type} • w:{seg.weight} ({pct}%)
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleActive(seg); }}
                      className={`w-8 h-4 rounded-full transition-colors relative ${seg.is_active ? "bg-green-600" : "bg-arena-steel/30"}`}
                    >
                      <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${seg.is_active ? "left-4" : "left-0.5"}`} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CENTER — Edit/Create Form */}
        <div className="lg:col-span-4 rounded-xl border border-arena-gold/10 bg-arena-charcoal/50 p-4">
          <h3 className="gladiator-label text-xs text-arena-gold mb-3">
            {editing ? (isNew ? "✚ Novo Segmento" : "✎ Editar Segmento") : "Seleciona um segmento"}
          </h3>

          {editing ? (
            <div className="space-y-3">
              {/* Label */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-arena-ash block mb-1">Label</label>
                <input type="text" value={editing.label} maxLength={30}
                  onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                  className="w-full bg-arena-dark border border-arena-steel/30 rounded px-3 py-1.5 text-sm text-arena-white focus:border-arena-gold/50 focus:outline-none transition-colors"
                  placeholder="Ex: 100 Points"
                />
              </div>

              {/* Icon */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-arena-ash block mb-1">Ícone (emoji)</label>
                <input type="text" value={editing.icon} maxLength={4}
                  onChange={(e) => setEditing({ ...editing, icon: e.target.value })}
                  className="w-20 bg-arena-dark border border-arena-steel/30 rounded px-3 py-1.5 text-lg text-center focus:border-arena-gold/50 focus:outline-none transition-colors"
                />
              </div>

              {/* Reward Type */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-arena-ash block mb-1">Tipo de Recompensa</label>
                <select value={editing.reward_type}
                  onChange={(e) => setEditing({ ...editing, reward_type: e.target.value as Segment["reward_type"], reward_value: e.target.value === "FREE_SPIN" ? 0 : editing.reward_value })}
                  className="w-full bg-arena-dark border border-arena-steel/30 rounded px-3 py-1.5 text-sm text-arena-white focus:border-arena-gold/50 focus:outline-none transition-colors"
                >
                  {REWARD_TYPES.map((rt) => (
                    <option key={rt.value} value={rt.value}>{rt.label}</option>
                  ))}
                </select>
              </div>

              {/* Reward Value */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-arena-ash block mb-1">Valor da Recompensa</label>
                {editing.reward_type === "FREE_SPIN" ? (
                  <input type="text" value="Auto (Free Spin)" disabled
                    className="w-full bg-arena-dark/50 border border-arena-steel/20 rounded px-3 py-1.5 text-sm text-arena-ash cursor-not-allowed"
                  />
                ) : editing.reward_type === "SE_POINTS" ? (
                  <input type="number" min={0} value={editing.reward_value}
                    onChange={(e) => setEditing({ ...editing, reward_value: parseInt(e.target.value, 10) || 0 })}
                    className="w-full bg-arena-dark border border-arena-steel/30 rounded px-3 py-1.5 text-sm text-arena-white focus:border-arena-gold/50 focus:outline-none transition-colors"
                    placeholder="Ex: 100"
                  />
                ) : (
                  <input type="text" value={editing.reward_value}
                    onChange={(e) => setEditing({ ...editing, reward_value: e.target.value as unknown as number })}
                    className="w-full bg-arena-dark border border-arena-steel/30 rounded px-3 py-1.5 text-sm text-arena-white focus:border-arena-gold/50 focus:outline-none transition-colors"
                    placeholder="Descrição custom"
                  />
                )}
              </div>

              {/* Tier */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-arena-ash block mb-1">Tier</label>
                <div className="flex gap-1.5 flex-wrap">
                  {TIER_OPTIONS.map((t) => (
                    <button key={t.value} onClick={() => setEditing({ ...editing, tier: t.value })}
                      className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase border transition-all ${
                        editing.tier === t.value
                          ? "border-current bg-current/10"
                          : "border-arena-steel/20 text-arena-ash hover:text-arena-smoke"
                      }`}
                      style={editing.tier === t.value ? { color: t.color, borderColor: t.color } : undefined}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-arena-ash block mb-1">Cor</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={editing.color}
                      onChange={(e) => setEditing({ ...editing, color: e.target.value })}
                      className="w-8 h-8 rounded border border-arena-steel/30 cursor-pointer bg-transparent"
                    />
                    <input type="text" value={editing.color}
                      onChange={(e) => setEditing({ ...editing, color: e.target.value })}
                      className="flex-1 bg-arena-dark border border-arena-steel/30 rounded px-2 py-1 text-xs text-arena-white font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-arena-ash block mb-1">Glow</label>
                  <input type="text" value={editing.glow_color}
                    onChange={(e) => setEditing({ ...editing, glow_color: e.target.value })}
                    className="w-full bg-arena-dark border border-arena-steel/30 rounded px-2 py-1 text-xs text-arena-white font-mono"
                    placeholder="rgba(…)"
                  />
                </div>
              </div>

              {/* Weight */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-arena-ash block mb-1">
                  Peso (Probabilidade) — {totalWeight > 0 ? ((editing.weight / totalWeight) * 100).toFixed(1) : "0"}%
                </label>
                <input type="range" min={1} max={100} value={editing.weight}
                  onChange={(e) => setEditing({ ...editing, weight: parseInt(e.target.value, 10) })}
                  className="w-full accent-arena-gold"
                />
                <div className="flex justify-between text-[10px] text-arena-ash mt-0.5">
                  <span>1</span>
                  <input type="number" min={1} max={999} value={editing.weight}
                    onChange={(e) => setEditing({ ...editing, weight: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                    className="w-14 bg-arena-dark border border-arena-steel/30 rounded px-1 py-0.5 text-center text-arena-white text-xs"
                  />
                  <span>100</span>
                </div>
              </div>

              {/* Active toggle */}
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={editing.is_active}
                  onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                  className="accent-arena-gold w-4 h-4"
                />
                <span className="text-sm text-arena-smoke">Ativo</span>
              </label>

              {/* Action buttons */}
              <div className="flex gap-2 pt-2 border-t border-arena-steel/10">
                <button onClick={saveSegment} disabled={saving}
                  className="flex-1 px-3 py-2 rounded-lg bg-arena-gold/20 text-arena-gold text-xs font-bold hover:bg-arena-gold/30 transition-colors disabled:opacity-50"
                >
                  {saving ? "A guardar..." : isNew ? "Criar" : "Guardar"}
                </button>
                {!isNew && (
                  <>
                    <button onClick={duplicateSegment}
                      className="px-3 py-2 rounded-lg bg-arena-steel/20 text-arena-smoke text-xs font-bold hover:bg-arena-steel/30 transition-colors"
                      title="Duplicar"
                    >
                      📋
                    </button>
                    <button onClick={deleteSegment} disabled={saving}
                      className="px-3 py-2 rounded-lg bg-red-900/30 text-red-400 text-xs font-bold hover:bg-red-900/50 transition-colors disabled:opacity-50"
                    >
                      Eliminar
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-arena-ash/50 text-sm italic">
              <p>Clica num segmento para editar</p>
              <p className="text-[10px] mt-1">ou cria um novo com o botão + Novo</p>
            </div>
          )}
        </div>

        {/* RIGHT — Live Preview */}
        <div className="lg:col-span-4 rounded-xl border border-arena-gold/10 bg-arena-charcoal/50 p-4">
          <h3 className="gladiator-label text-xs text-arena-gold mb-3">👁 Preview</h3>

          <WheelPreview segments={editing && !isNew
            ? segments.map((s) => (s.id === editing.id ? editing : s))
            : isNew && editing
            ? [...segments, editing]
            : segments
          } />

          {/* Stats */}
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-arena-dark/50 p-2">
              <p className="text-lg font-bold text-arena-gold">{activeCount}</p>
              <p className="text-[9px] uppercase text-arena-ash">Ativos</p>
            </div>
            <div className="rounded-lg bg-arena-dark/50 p-2">
              <p className="text-lg font-bold text-arena-white">{segments.length}</p>
              <p className="text-[9px] uppercase text-arena-ash">Total</p>
            </div>
            <div className="rounded-lg bg-arena-dark/50 p-2">
              <p className="text-lg font-bold text-arena-smoke">{totalWeight}</p>
              <p className="text-[9px] uppercase text-arena-ash">Peso Total</p>
            </div>
          </div>

          {/* Probability breakdown */}
          {activeCount > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-arena-ash">Probabilidades</p>
              {segments.filter((s) => s.is_active).map((s) => {
                const pct = totalWeight > 0 ? (s.weight / totalWeight) * 100 : 0;
                return (
                  <div key={s.id} className="flex items-center gap-2">
                    <span className="text-xs shrink-0 w-4">{s.icon}</span>
                    <div className="flex-1 h-2 rounded-full bg-arena-dark/50 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: s.color }} />
                    </div>
                    <span className="text-[10px] text-arena-ash w-10 text-right">{pct.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
