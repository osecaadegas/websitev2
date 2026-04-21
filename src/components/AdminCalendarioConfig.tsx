"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */
interface Stream {
  id: string;
  title: string;
  description: string;
  stream_date: string;
  start_time: string;
  end_time: string | null;
  categories: string[];
  casino: string | null;
  is_special: boolean;
  is_cancelled: boolean;
}

const CATEGORIES = ["Slots", "Bonus Hunt", "Torneio", "Slot Request", "Liga dos Secas", "Torneio Liga dos Secas", "Giveaway", "Outro"] as const;

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Slots":                  { bg: "bg-amber-500/10",   text: "text-amber-400",   border: "border-amber-500/30" },
  "Bonus Hunt":             { bg: "bg-purple-500/10",  text: "text-purple-400",  border: "border-purple-500/30" },
  "Torneio":                { bg: "bg-blue-500/10",    text: "text-blue-400",    border: "border-blue-500/30" },
  "Slot Request":           { bg: "bg-pink-500/10",    text: "text-pink-400",    border: "border-pink-500/30" },
  "Liga dos Secas":        { bg: "bg-arena-gold/10",  text: "text-arena-gold",  border: "border-arena-gold/30" },
  "Torneio Liga dos Secas":{ bg: "bg-cyan-500/10",    text: "text-cyan-400",    border: "border-cyan-500/30" },
  "Giveaway":               { bg: "bg-green-500/10",   text: "text-green-400",   border: "border-green-500/30" },
  "Outro":                  { bg: "bg-gray-500/10",    text: "text-gray-400",    border: "border-gray-500/30" },
};

const CATEGORY_ICONS: Record<string, string> = {
  "Slots":                   "🎰",
  "Bonus Hunt":              "🎯",
  "Torneio":                 "⚔️",
  "Slot Request":            "📥",
  "Liga dos Secas":         "🛡️",
  "Torneio Liga dos Secas": "🏆",
  "Giveaway":                "🎁",
  "Outro":                   "📺",
};

const EMPTY_STREAM: Omit<Stream, "id"> = {
  title: "",
  description: "",
  stream_date: "",
  start_time: "18:00",
  end_time: null,
  categories: ["Slots"],
  casino: null,
  is_special: false,
  is_cancelled: false,
};

/* ═══════════════════════════════════════════════════════════════
   TOAST
   ═══════════════════════════════════════════════════════════════ */
function Toast({ message, type, onDone }: { message: string; type: "success" | "error"; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
      className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl border backdrop-blur-md text-sm font-medium ${
        type === "success"
          ? "bg-green-900/80 border-green-500/40 text-green-200"
          : "bg-red-900/80 border-red-500/40 text-red-200"
      }`}
    >{message}</motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function AdminCalendarioConfig() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Stream | null>(null);
  const [draft, setDraft] = useState<Omit<Stream, "id">>(EMPTY_STREAM);
  const [isNew, setIsNew] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const fetchStreams = useCallback(async () => {
    try {
      const r = await fetch("/api/scheduled-streams");
      const d = await r.json();
      if (d.streams) setStreams(d.streams);
    } catch { /* noop */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchStreams(); }, [fetchStreams]);

  const showToast = useCallback((message: string, type: "success" | "error") => setToast({ message, type }), []);

  const save = async () => {
    if (!draft.title || !draft.stream_date || !draft.start_time) {
      showToast("Preenche o título, data e hora de início", "error");
      return;
    }

    const method = isNew ? "POST" : "PUT";
    const payload = isNew ? draft : { id: editing!.id, ...draft };

    const r = await fetch("/api/scheduled-streams", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (r.ok) {
      showToast(isNew ? "Stream agendada!" : "Stream atualizada!", "success");
      setEditing(null);
      setIsNew(false);
      fetchStreams();
    } else {
      const d = await r.json();
      showToast(d.error || "Erro ao guardar", "error");
    }
  };

  const deleteStream = async (id: string) => {
    const r = await fetch(`/api/scheduled-streams?id=${id}`, { method: "DELETE" });
    if (r.ok) {
      showToast("Stream eliminada", "success");
      if (editing?.id === id) { setEditing(null); setIsNew(false); }
      fetchStreams();
    } else {
      showToast("Erro ao eliminar", "error");
    }
  };

  const toggleCancel = async (stream: Stream) => {
    const r = await fetch("/api/scheduled-streams", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: stream.id, is_cancelled: !stream.is_cancelled }),
    });
    if (r.ok) {
      showToast(stream.is_cancelled ? "Stream reativada" : "Stream cancelada", "success");
      fetchStreams();
    }
  };

  const startNew = () => {
    setIsNew(true);
    setDraft({ ...EMPTY_STREAM, stream_date: new Date().toISOString().split("T")[0] });
    setEditing(null);
  };

  const startEdit = (stream: Stream) => {
    setIsNew(false);
    setEditing(stream);
    setDraft({
      title: stream.title,
      description: stream.description,
      stream_date: stream.stream_date,
      start_time: stream.start_time.slice(0, 5),
      end_time: stream.end_time?.slice(0, 5) || null,
      categories: stream.categories || ["Slots"],
      casino: stream.casino,
      is_special: stream.is_special,
      is_cancelled: stream.is_cancelled,
    });
  };

  /* ── Calendar helpers ─────────────────────────────────────── */
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfWeek = (year: number, month: number) => (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0

  const streamsForDate = (date: string) => streams.filter((s) => s.stream_date === date);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("pt-PT", { weekday: "short", day: "numeric", month: "short" });
  };

  const isToday = (dateStr: string) => dateStr === new Date().toISOString().split("T")[0];
  const isPast = (dateStr: string) => dateStr < new Date().toISOString().split("T")[0];

  const monthLabel = new Date(calendarMonth.year, calendarMonth.month).toLocaleDateString("pt-PT", { month: "long", year: "numeric" });

  /* ── Upcoming streams (next 7 days) ───────────────────────── */
  const today = new Date().toISOString().split("T")[0];
  const upcomingStreams = streams.filter((s) => s.stream_date >= today && !s.is_cancelled).slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-arena-gold/30 border-t-arena-gold rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Top Bar ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode("list")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              viewMode === "list"
                ? "bg-arena-gold/20 text-arena-gold border border-arena-gold/30"
                : "bg-white/[0.04] text-arena-smoke border border-white/10 hover:bg-white/[0.08]"
            }`}
          >📋 Lista</button>
          <button
            onClick={() => setViewMode("calendar")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              viewMode === "calendar"
                ? "bg-arena-gold/20 text-arena-gold border border-arena-gold/30"
                : "bg-white/[0.04] text-arena-smoke border border-white/10 hover:bg-white/[0.08]"
            }`}
          >📅 Calendário</button>
        </div>

        <button
          onClick={startNew}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-arena-gold to-yellow-600 text-black font-bold text-sm
                     hover:shadow-lg hover:shadow-arena-gold/20 transition-all active:scale-95"
        >+ Nova Stream</button>
      </div>

      {/* ── Stats ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: streams.length, color: "text-arena-gold" },
          { label: "Próximas", value: streams.filter((s) => s.stream_date >= today && !s.is_cancelled).length, color: "text-green-400" },
          { label: "Canceladas", value: streams.filter((s) => s.is_cancelled).length, color: "text-red-400" },
          { label: "Especiais", value: streams.filter((s) => s.is_special && !s.is_cancelled).length, color: "text-purple-400" },
        ].map((s) => (
          <div key={s.label} className="bg-white/[0.03] border border-white/10 rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-arena-ash mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: Stream List / Calendar ─────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          {viewMode === "calendar" ? (
            /* Calendar View */
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setCalendarMonth((p) => p.month === 0 ? { year: p.year - 1, month: 11 } : { year: p.year, month: p.month - 1 })}
                  className="p-2 rounded-lg bg-white/[0.04] border border-white/10 text-arena-smoke hover:text-arena-gold transition"
                >◀</button>
                <h3 className="font-display text-lg uppercase tracking-wider text-arena-gold">{monthLabel}</h3>
                <button
                  onClick={() => setCalendarMonth((p) => p.month === 11 ? { year: p.year + 1, month: 0 } : { year: p.year, month: p.month + 1 })}
                  className="p-2 rounded-lg bg-white/[0.04] border border-white/10 text-arena-smoke hover:text-arena-gold transition"
                >▶</button>
              </div>

              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
                  <div key={d} className="text-center text-xs text-arena-ash font-medium py-1">{d}</div>
                ))}
              </div>

              {/* Days */}
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: getFirstDayOfWeek(calendarMonth.year, calendarMonth.month) }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square" />
                ))}
                {Array.from({ length: getDaysInMonth(calendarMonth.year, calendarMonth.month) }).map((_, i) => {
                  const day = i + 1;
                  const dateStr = `${calendarMonth.year}-${String(calendarMonth.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const dayStreams = streamsForDate(dateStr);
                  const todayClass = isToday(dateStr);

                  return (
                    <div
                      key={day}
                      className={`aspect-square rounded-lg p-1 text-xs transition-all cursor-pointer hover:bg-white/[0.06] ${
                        todayClass
                          ? "bg-arena-gold/10 border border-arena-gold/30"
                          : "bg-white/[0.02] border border-transparent"
                      }`}
                      onClick={() => {
                        if (dayStreams.length === 1) startEdit(dayStreams[0]);
                        else if (dayStreams.length === 0) {
                          setIsNew(true);
                          setDraft({ ...EMPTY_STREAM, stream_date: dateStr });
                          setEditing(null);
                        }
                      }}
                    >
                      <div className={`font-medium ${todayClass ? "text-arena-gold" : isPast(dateStr) ? "text-arena-ash/50" : "text-arena-smoke"}`}>
                        {day}
                      </div>
                      {dayStreams.length > 0 && (
                        <div className="mt-0.5 space-y-0.5">
                          {dayStreams.slice(0, 2).map((s) => {
                            const firstCat = (s.categories || [])[0] || "Outro";
                            return (
                              <div
                                key={s.id}
                                className={`truncate rounded px-0.5 text-[10px] leading-tight ${
                                  s.is_cancelled
                                    ? "text-red-400/60 line-through"
                                    : CATEGORY_COLORS[firstCat]?.text || "text-arena-smoke"
                                }`}
                              >
                                {(s.categories || []).map((c) => CATEGORY_ICONS[c]).join("")} {s.start_time.slice(0, 5)}
                              </div>
                            );
                          })}
                          {dayStreams.length > 2 && (
                            <div className="text-[10px] text-arena-ash">+{dayStreams.length - 2}</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* List View */
            <div className="space-y-3">
              {streams.length === 0 ? (
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-12 text-center">
                  <div className="text-4xl mb-3">📅</div>
                  <p className="text-arena-smoke">Nenhuma stream agendada</p>
                  <p className="text-sm text-arena-ash mt-1">Clica em &quot;Nova Stream&quot; para começar</p>
                </div>
              ) : (
                streams.map((stream) => {
                  const cats = stream.categories || ["Outro"];
                  const firstCat = CATEGORY_COLORS[cats[0]] || CATEGORY_COLORS["Outro"];
                  return (
                    <motion.div
                      key={stream.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`bg-white/[0.03] border rounded-xl p-4 transition-all hover:bg-white/[0.05] ${
                        editing?.id === stream.id ? "border-arena-gold/40 ring-1 ring-arena-gold/20" : "border-white/10"
                      } ${stream.is_cancelled ? "opacity-50" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            {cats.map((catName) => {
                              const c = CATEGORY_COLORS[catName] || CATEGORY_COLORS["Outro"];
                              return (
                                <span key={catName} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${c.bg} ${c.text} ${c.border}`}>
                                  {CATEGORY_ICONS[catName]} {catName}
                                </span>
                              );
                            })}
                            {stream.is_cancelled && (
                              <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/30">
                                Cancelada
                              </span>
                            )}
                          </div>

                          <h4 className={`font-bold text-arena-white ${stream.is_cancelled ? "line-through" : ""}`}>
                            {stream.title}
                          </h4>

                          <div className="flex items-center gap-3 mt-1 text-sm text-arena-ash">
                            <span>📅 {formatDate(stream.stream_date)}</span>
                            <span>🕐 {stream.start_time.slice(0, 5)}{stream.end_time ? ` – ${stream.end_time.slice(0, 5)}` : ""}</span>
                            {stream.casino && <span>🎰 {stream.casino}</span>}
                          </div>

                          {stream.description && (
                            <p className="text-sm text-arena-smoke/70 mt-1 line-clamp-2">{stream.description}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => startEdit(stream)}
                            className="p-2 rounded-lg text-arena-smoke hover:text-arena-gold hover:bg-arena-gold/10 transition"
                            title="Editar"
                          >✏️</button>
                          <button
                            onClick={() => toggleCancel(stream)}
                            className="p-2 rounded-lg text-arena-smoke hover:text-yellow-400 hover:bg-yellow-500/10 transition"
                            title={stream.is_cancelled ? "Reativar" : "Cancelar"}
                          >{stream.is_cancelled ? "✅" : "🚫"}</button>
                          <button
                            onClick={() => deleteStream(stream.id)}
                            className="p-2 rounded-lg text-arena-smoke hover:text-red-400 hover:bg-red-500/10 transition"
                            title="Eliminar"
                          >🗑️</button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* ── Right: Edit Form + Upcoming ─────────────────── */}
        <div className="space-y-6">
          {/* Edit / Create Panel */}
          {(isNew || editing) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white/[0.03] border border-white/10 rounded-2xl p-5"
            >
              <h3 className="font-display text-sm uppercase tracking-wider text-arena-gold mb-4">
                {isNew ? "Nova Stream" : "Editar Stream"}
              </h3>

              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="text-xs text-arena-ash uppercase tracking-wider">Título *</label>
                  <input
                    value={draft.title}
                    onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
                    className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-arena-white placeholder:text-arena-ash/50 focus:border-arena-gold/50 focus:ring-1 focus:ring-arena-gold/20 outline-none"
                    placeholder="Ex: Slots com os Secas"
                  />
                </div>

                {/* Date + Times */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-arena-ash uppercase tracking-wider">Data *</label>
                    <input
                      type="date"
                      value={draft.stream_date}
                      onChange={(e) => setDraft((p) => ({ ...p, stream_date: e.target.value }))}
                      className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-arena-white focus:border-arena-gold/50 focus:ring-1 focus:ring-arena-gold/20 outline-none [color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-arena-ash uppercase tracking-wider">Início *</label>
                    <input
                      type="time"
                      value={draft.start_time}
                      onChange={(e) => setDraft((p) => ({ ...p, start_time: e.target.value }))}
                      className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-arena-white focus:border-arena-gold/50 focus:ring-1 focus:ring-arena-gold/20 outline-none [color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-arena-ash uppercase tracking-wider">Fim</label>
                    <input
                      type="time"
                      value={draft.end_time || ""}
                      onChange={(e) => setDraft((p) => ({ ...p, end_time: e.target.value || null }))}
                      className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-arena-white focus:border-arena-gold/50 focus:ring-1 focus:ring-arena-gold/20 outline-none [color-scheme:dark]"
                    />
                  </div>
                </div>

                {/* Category (multi-select) */}
                <div>
                  <label className="text-xs text-arena-ash uppercase tracking-wider">Categoria</label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    {CATEGORIES.map((cat) => {
                      const c = CATEGORY_COLORS[cat];
                      const isSelected = draft.categories.includes(cat);
                      return (
                        <button
                          key={cat}
                          onClick={() => setDraft((p) => {
                            const cats = p.categories.includes(cat)
                              ? p.categories.filter((c) => c !== cat)
                              : [...p.categories, cat];
                            return { ...p, categories: cats.length > 0 ? cats : [cat] };
                          })}
                          className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            isSelected
                              ? `${c.bg} ${c.text} ${c.border}`
                              : "bg-white/[0.02] text-arena-ash border-white/10 hover:bg-white/[0.05]"
                          }`}
                        >
                          {CATEGORY_ICONS[cat]} {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Casino */}
                <div>
                  <label className="text-xs text-arena-ash uppercase tracking-wider">Casino</label>
                  <input
                    value={draft.casino || ""}
                    onChange={(e) => setDraft((p) => ({ ...p, casino: e.target.value || null }))}
                    className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-arena-white placeholder:text-arena-ash/50 focus:border-arena-gold/50 focus:ring-1 focus:ring-arena-gold/20 outline-none"
                    placeholder="Ex: Stake, Roobet..."
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="text-xs text-arena-ash uppercase tracking-wider">Descrição</label>
                  <textarea
                    value={draft.description}
                    onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
                    rows={3}
                    className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-arena-white placeholder:text-arena-ash/50 focus:border-arena-gold/50 focus:ring-1 focus:ring-arena-gold/20 outline-none resize-none"
                    placeholder="Notas sobre a stream..."
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={save}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-arena-gold to-yellow-600 text-black font-bold text-sm
                               hover:shadow-lg hover:shadow-arena-gold/20 transition-all active:scale-95"
                  >
                    {isNew ? "Agendar Stream" : "Guardar Alterações"}
                  </button>
                  <button
                    onClick={() => { setEditing(null); setIsNew(false); }}
                    className="px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-arena-smoke text-sm hover:bg-white/[0.08] transition"
                  >Cancelar</button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Upcoming Streams Summary */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
            <h3 className="font-display text-sm uppercase tracking-wider text-arena-gold mb-3">Próximas Streams</h3>
            {upcomingStreams.length === 0 ? (
              <p className="text-sm text-arena-ash">Nenhuma stream futura agendada</p>
            ) : (
              <div className="space-y-2">
                {upcomingStreams.map((s) => {
                  const firstCat = CATEGORY_COLORS[(s.categories || [])[0] || "Outro"];
                  return (
                    <div key={s.id} className="flex items-center gap-3 text-sm">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${firstCat?.text?.replace("text-", "bg-") || "bg-arena-ash"}`} />
                      <div className="flex-1 min-w-0">
                        <span className="text-arena-white truncate block">{s.title}</span>
                        <span className="text-xs text-arena-ash">
                          {formatDate(s.stream_date)} às {s.start_time.slice(0, 5)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
      </AnimatePresence>
    </div>
  );
}
