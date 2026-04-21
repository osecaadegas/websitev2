"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import type { UserRow, UserRole } from "@/lib/supabase";

/* ═══════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════ */

interface SEPointsData {
  channel: string;
  username: string;
  points: number;
  pointsAlltime: number;
  rank: number;
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN DASHBOARD
   ═══════════════════════════════════════════════════════════════════ */

export default function UtilizadoresPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Fetch error:", error);
      showToast("Erro ao carregar utilizadores");
    }
    setUsers((data as UserRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filtered = users.filter((u) =>
    u.login.toLowerCase().includes(search.toLowerCase()) ||
    u.display_name.toLowerCase().includes(search.toLowerCase()) ||
    (u.se_username && u.se_username.toLowerCase().includes(search.toLowerCase())) ||
    (u.discord_username && u.discord_username.toLowerCase().includes(search.toLowerCase())) ||
    (u.email && u.email.toLowerCase().includes(search.toLowerCase()))
  );

  const roleBadge = (role: UserRole) => {
    const colors: Record<UserRole, string> = {
      admin: "bg-red-600",
      configurador: "bg-purple-600",
      moderador: "bg-blue-600",
      viewer: "bg-arena-steel/50",
    };
    return (
      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded text-white uppercase ${colors[role]}`}>
        {role}
      </span>
    );
  };

  /* ── USER DETAIL VIEW ── */
  if (selected) {
    return (
      <div className="pt-24 pb-16 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <button onClick={() => setSelected(null)} className="text-arena-gold text-sm mb-4 hover:underline">
            ← Voltar à lista
          </button>
          <UserDetail user={selected} onUpdate={fetchUsers} onToast={showToast} />
        </div>
        {toast && (
          <div className="fixed top-20 right-4 z-50 bg-arena-charcoal border border-arena-gold/30 text-arena-gold px-4 py-2.5 rounded-xl text-sm shadow-xl">
            {toast}
          </div>
        )}
      </div>
    );
  }

  /* ── LIST VIEW ── */
  return (
    <div className="pt-24 pb-16 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm text-arena-ash mt-1">{users.length} registados</p>
          </div>
        </div>

        {/* Search */}
        <input
          className="w-full max-w-md bg-arena-charcoal border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-arena-ash/50 focus:outline-none focus:border-arena-gold/40 transition-colors mb-6"
          placeholder="Pesquisar por username, email, SE, Discord..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* Toast */}
        {toast && (
          <div className="fixed top-20 right-4 z-50 bg-arena-charcoal border border-arena-gold/30 text-arena-gold px-4 py-2.5 rounded-xl text-sm shadow-xl">
            {toast}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="text-center py-20 text-arena-ash">A carregar...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-arena-ash">
            {search ? "Nenhum utilizador encontrado." : "Nenhum utilizador registado."}
          </div>
        ) : (
          /* Users table */
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-arena-charcoal text-arena-ash text-[10px] uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Utilizador</th>
                  <th className="text-left px-4 py-3">SE Username</th>
                  <th className="text-left px-4 py-3">Discord</th>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">IP</th>
                  <th className="text-left px-4 py-3">Role</th>
                  <th className="text-left px-4 py-3">Registado</th>
                  <th className="text-left px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr
                    key={user.id}
                    className="border-t border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer"
                    onClick={() => setSelected(user)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {user.profile_image_url ? (
                          <Image
                            src={user.profile_image_url}
                            alt={user.display_name}
                            width={28}
                            height={28}
                            className="rounded-full"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-arena-steel flex items-center justify-center text-white text-xs font-bold">
                            {user.display_name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-white">{user.display_name}</p>
                          <p className="text-[10px] text-arena-ash">{user.login}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-arena-smoke">{user.se_username || "—"}</td>
                    <td className="px-4 py-3 text-arena-smoke">{user.discord_username || "—"}</td>
                    <td className="px-4 py-3 text-arena-smoke text-xs">{user.email || "—"}</td>
                    <td className="px-4 py-3 text-arena-smoke text-xs font-mono">{user.ip_address || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {roleBadge(user.role)}
                        {user.role_expires_at && (
                          <span className="text-[8px] text-arena-ash">
                            até {new Date(user.role_expires_at).toLocaleDateString("pt-PT")}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-arena-ash text-xs">
                      {new Date(user.created_at).toLocaleDateString("pt-PT")}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-arena-gold text-xs hover:underline">Ver →</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   USER DETAIL PANEL
   ═══════════════════════════════════════════════════════════════════ */

function UserDetail({
  user,
  onUpdate,
  onToast,
}: {
  user: UserRow;
  onUpdate: () => void;
  onToast: (msg: string) => void;
}) {
  const [sePoints, setSePoints] = useState<SEPointsData | null>(null);
  const [seLoading, setSeLoading] = useState(false);
  const [seError, setSeError] = useState<string | null>(null);

  // Role editing
  const [editRole, setEditRole] = useState(false);
  const [newRole, setNewRole] = useState<UserRole>(user.role);
  const [duration, setDuration] = useState<"permanent" | "1d" | "7d" | "30d" | "custom">("permanent");
  const [customDays, setCustomDays] = useState(1);
  const [saving, setSaving] = useState(false);

  // SE edit
  const [editPoints, setEditPoints] = useState(false);
  const [pointsAmount, setPointsAmount] = useState(0);
  const [pointsSaving, setPointsSaving] = useState(false);

  // SE username edit
  const [editSE, setEditSE] = useState(false);
  const [seUsername, setSeUsername] = useState(user.se_username || "");

  const inputCls = "bg-arena-charcoal border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-arena-ash/50 focus:outline-none focus:border-arena-gold/40 transition-colors";

  /* Fetch SE points */
  const fetchSEPoints = useCallback(async (username: string) => {
    setSeLoading(true);
    setSeError(null);
    try {
      const res = await fetch(`/api/streamelements?endpoint=user-points&username=${encodeURIComponent(username)}`);
      if (!res.ok) throw new Error("Não encontrado");
      const data = await res.json();
      setSePoints(data);
    } catch {
      setSeError("Não foi possível encontrar o utilizador no StreamElements");
    }
    setSeLoading(false);
  }, []);

  useEffect(() => {
    const username = user.se_username || user.login;
    fetchSEPoints(username);
  }, [user.se_username, user.login, fetchSEPoints]);

  /* Save SE username */
  const saveSEUsername = async () => {
    const { error } = await supabase
      .from("users")
      .update({ se_username: seUsername || null, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    if (error) { onToast("Erro ao guardar SE username"); return; }
    onToast("SE username atualizado");
    setEditSE(false);
    onUpdate();
    if (seUsername) fetchSEPoints(seUsername);
  };

  /* Save role */
  const saveRole = async () => {
    setSaving(true);
    let expiresAt: string | null = null;
    if (duration !== "permanent" && newRole !== "viewer") {
      const days = duration === "custom" ? customDays : parseInt(duration);
      const d = new Date();
      d.setDate(d.getDate() + days);
      expiresAt = d.toISOString();
    }

    const { error } = await supabase
      .from("users")
      .update({
        role: newRole,
        role_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) { onToast("Erro ao atualizar role"); setSaving(false); return; }
    onToast(`Role atualizado para ${newRole}${expiresAt ? ` (expira ${new Date(expiresAt).toLocaleDateString("pt-PT")})` : ""}`);
    setSaving(false);
    setEditRole(false);
    onUpdate();
  };

  /* Edit SE points */
  const updatePoints = async () => {
    if (pointsAmount === 0) return;
    setPointsSaving(true);
    const username = user.se_username || user.login;
    try {
      const res = await fetch("/api/streamelements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, amount: pointsAmount }),
      });
      if (!res.ok) throw new Error("Failed");
      onToast(`Pontos ${pointsAmount > 0 ? "adicionados" : "removidos"} com sucesso`);
      setEditPoints(false);
      setPointsAmount(0);
      fetchSEPoints(username);
    } catch {
      onToast("Erro ao atualizar pontos");
    }
    setPointsSaving(false);
  };

  return (
    <div className="space-y-6">
      {/* User header */}
      <div className="flex items-center gap-4 p-5 rounded-xl bg-arena-dark border border-white/10">
        {user.profile_image_url ? (
          <Image src={user.profile_image_url} alt={user.display_name} width={56} height={56} className="rounded-full" />
        ) : (
          <div className="w-14 h-14 rounded-full bg-arena-steel flex items-center justify-center text-white text-xl font-bold">
            {user.display_name.charAt(0)}
          </div>
        )}
        <div className="flex-1">
          <h2 className="text-xl font-bold text-white">{user.display_name}</h2>
          <p className="text-sm text-arena-ash">@{user.login} · Twitch ID: {user.twitch_id}</p>
          <div className="flex items-center gap-2 mt-1">
            {(() => {
              const colors: Record<UserRole, string> = {
                admin: "bg-red-600", configurador: "bg-purple-600",
                moderador: "bg-blue-600", viewer: "bg-arena-steel/50",
              };
              return (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded text-white uppercase ${colors[user.role]}`}>
                  {user.role}
                </span>
              );
            })()}
            {user.role_expires_at && (
              <span className="text-[10px] text-arena-ash">
                expira {new Date(user.role_expires_at).toLocaleDateString("pt-PT")}
              </span>
            )}
          </div>
        </div>
        <div className="text-right text-xs text-arena-ash space-y-0.5">
          <p>Email: {user.email || "—"}</p>
          <p>Discord: {user.discord_username || "—"}</p>
          <p className="font-mono">IP: {user.ip_address || "—"}</p>
          <p>Registado: {new Date(user.created_at).toLocaleDateString("pt-PT")}</p>
        </div>
      </div>

      {/* SE Info Card */}
      <div className="p-5 rounded-xl bg-arena-dark border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-arena-gold uppercase text-sm tracking-wider">StreamElements</h3>
          <div className="flex items-center gap-2">
            {!editSE ? (
              <>
                <span className="text-xs text-arena-ash">
                  SE user: <span className="text-white font-medium">{user.se_username || user.login}</span>
                </span>
                <button onClick={() => { setEditSE(true); setSeUsername(user.se_username || user.login); }}
                  className="text-[10px] text-blue-400 hover:underline">Alterar</button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <input className={`${inputCls} w-40 text-xs`} value={seUsername} onChange={(e) => setSeUsername(e.target.value)} placeholder="SE username" />
                <button onClick={saveSEUsername} className="text-[10px] text-green-400 hover:underline">Guardar</button>
                <button onClick={() => setEditSE(false)} className="text-[10px] text-arena-ash hover:underline">Cancelar</button>
              </div>
            )}
          </div>
        </div>

        {seLoading ? (
          <p className="text-arena-ash text-sm">A carregar pontos...</p>
        ) : seError ? (
          <p className="text-red-400 text-sm">{seError}</p>
        ) : sePoints ? (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-arena-charcoal rounded-lg p-3 text-center">
              <p className="text-[10px] text-arena-ash uppercase">Pontos Atuais</p>
              <p className="text-2xl font-bold text-white">{sePoints.points.toLocaleString("pt-PT")}</p>
            </div>
            <div className="bg-arena-charcoal rounded-lg p-3 text-center">
              <p className="text-[10px] text-arena-ash uppercase">Pontos All-Time</p>
              <p className="text-2xl font-bold text-white">{sePoints.pointsAlltime.toLocaleString("pt-PT")}</p>
            </div>
            <div className="bg-arena-charcoal rounded-lg p-3 text-center">
              <p className="text-[10px] text-arena-ash uppercase">Rank</p>
              <p className="text-2xl font-bold text-arena-gold">#{sePoints.rank}</p>
            </div>
          </div>
        ) : null}

        {/* Edit points */}
        <div className="mt-4">
          {!editPoints ? (
            <button onClick={() => setEditPoints(true)}
              className="px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-all">
              Editar Pontos
            </button>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-arena-charcoal rounded-lg">
              <div className="flex-1">
                <label className="block text-[10px] uppercase text-arena-ash mb-1">Valor (positivo = adicionar, negativo = remover)</label>
                <input type="number" className={`${inputCls} w-full`} value={pointsAmount} onChange={(e) => setPointsAmount(parseInt(e.target.value) || 0)} />
              </div>
              <div className="flex gap-2 pt-4">
                <button onClick={updatePoints} disabled={pointsSaving || pointsAmount === 0}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-gradient-to-b from-arena-crimson to-arena-blood text-white border border-arena-red/40 hover:from-arena-red hover:to-arena-crimson transition-all disabled:opacity-50">
                  {pointsSaving ? "..." : "Aplicar"}
                </button>
                <button onClick={() => { setEditPoints(false); setPointsAmount(0); }}
                  className="px-4 py-2 rounded-lg text-xs text-arena-ash hover:text-white transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Role Management Card */}
      <div className="p-5 rounded-xl bg-arena-dark border border-white/10">
        <h3 className="font-bold text-arena-gold uppercase text-sm tracking-wider mb-4">Gestão de Role</h3>

        {!editRole ? (
          <div className="flex items-center gap-4">
            <p className="text-sm text-arena-smoke">
              Role atual: <span className="font-bold text-white capitalize">{user.role}</span>
              {user.role_expires_at && (
                <span className="text-arena-ash ml-2">
                  (expira {new Date(user.role_expires_at).toLocaleDateString("pt-PT")})
                </span>
              )}
            </p>
            <button onClick={() => { setEditRole(true); setNewRole(user.role); }}
              className="px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-all">
              Alterar Role
            </button>
          </div>
        ) : (
          <div className="space-y-4 p-4 bg-arena-charcoal rounded-lg">
            {/* Role selector */}
            <div>
              <label className="block text-[10px] uppercase text-arena-ash mb-2">Nova Role</label>
              <div className="flex gap-2">
                {(["viewer", "moderador", "configurador", "admin"] as UserRole[]).map((r) => (
                  <button key={r} onClick={() => setNewRole(r)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all ${
                      newRole === r
                        ? "border-arena-gold text-arena-gold bg-arena-gold/10"
                        : "border-white/10 text-arena-ash hover:text-white hover:border-white/20"
                    }`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            {newRole !== "viewer" && (
              <div>
                <label className="block text-[10px] uppercase text-arena-ash mb-2">Duração</label>
                <div className="flex flex-wrap gap-2">
                  {([
                    { value: "permanent", label: "Permanente" },
                    { value: "1d", label: "1 Dia" },
                    { value: "7d", label: "7 Dias" },
                    { value: "30d", label: "30 Dias" },
                    { value: "custom", label: "Personalizado" },
                  ] as const).map((opt) => (
                    <button key={opt.value} onClick={() => setDuration(opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        duration === opt.value
                          ? "border-arena-gold text-arena-gold bg-arena-gold/10"
                          : "border-white/10 text-arena-ash hover:text-white"
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {duration === "custom" && (
                  <div className="flex items-center gap-2 mt-2">
                    <input type="number" min={1} className={`${inputCls} w-24`}
                      value={customDays} onChange={(e) => setCustomDays(Math.max(1, parseInt(e.target.value) || 1))} />
                    <span className="text-sm text-arena-ash">dias</span>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button onClick={saveRole} disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-b from-arena-crimson to-arena-blood text-white text-xs font-bold uppercase tracking-wider border border-arena-red/40 hover:from-arena-red hover:to-arena-crimson transition-all disabled:opacity-50">
                {saving ? "A guardar..." : "Aplicar Role"}
              </button>
              <button onClick={() => setEditRole(false)}
                className="px-4 py-2 text-xs text-arena-ash hover:text-white transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
