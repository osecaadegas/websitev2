import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

/** GET /api/rewards/redemptions — list redemptions (admin only) */
export async function GET(request: Request) {
  const cookieStore = await cookies();
  const raw = cookieStore.get("twitch_session")?.value;
  if (!raw) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let session: { id: string; role: string };
  try { session = JSON.parse(raw); } catch { return NextResponse.json({ error: "Sessão inválida" }, { status: 401 }); }

  if (session.role !== "admin" && session.role !== "configurador") {
    return NextResponse.json({ error: "Sem permissões" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status"); // pending | approved | denied | null (all)

  let query = supabase
    .from("reward_redemptions")
    .select("*, rewards(title, type, tier, image, cost), users!reward_redemptions_user_twitch_id_fkey(display_name, login, profile_image_url)")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Falha ao buscar resgates", details: error.message }, { status: 500 });
  }

  return NextResponse.json({ redemptions: data ?? [] });
}

/** PATCH /api/rewards/redemptions — approve or deny a redemption (admin only) */
export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  const raw = cookieStore.get("twitch_session")?.value;
  if (!raw) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let session: { id: string; login: string; role: string };
  try { session = JSON.parse(raw); } catch { return NextResponse.json({ error: "Sessão inválida" }, { status: 401 }); }

  if (session.role !== "admin" && session.role !== "configurador") {
    return NextResponse.json({ error: "Sem permissões" }, { status: 403 });
  }

  const body = await request.json();
  const { id, status } = body;

  if (!id) return NextResponse.json({ error: "ID do resgate em falta" }, { status: 400 });
  if (!status || !["approved", "denied"].includes(status)) {
    return NextResponse.json({ error: "Estado inválido (approved/denied)" }, { status: 400 });
  }

  // If denying, refund the points
  if (status === "denied") {
    const { data: redemption } = await supabase
      .from("reward_redemptions")
      .select("*, rewards(cost)")
      .eq("id", id)
      .single();

    if (redemption && redemption.status === "pending") {
      // Refund points via SE API
      const token = process.env.STREAMELEMENTS_JWT_TOKEN;
      const channelId = process.env.STREAMELEMENTS_CHANNEL_ID;

      if (token && channelId) {
        // Get user login from users table
        const { data: userData } = await supabase
          .from("users")
          .select("login")
          .eq("twitch_id", redemption.user_twitch_id)
          .single();

        if (userData) {
          await fetch(
            `https://api.streamelements.com/kappa/v2/points/${channelId}/${encodeURIComponent(userData.login)}/${redemption.cost}`,
            {
              method: "PUT",
              headers: {
                Accept: "application/json",
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ amount: redemption.cost }),
            }
          );
        }
      }

      // Restore stock if applicable
      if (redemption.rewards?.cost !== undefined) {
        const { data: reward } = await supabase
          .from("rewards")
          .select("stock")
          .eq("id", redemption.reward_id)
          .single();

        if (reward && reward.stock !== null) {
          await supabase
            .from("rewards")
            .update({ stock: reward.stock + 1, updated_at: new Date().toISOString() })
            .eq("id", redemption.reward_id);
        }
      }
    }
  }

  const { error } = await supabase
    .from("reward_redemptions")
    .update({
      status,
      reviewed_by: session.login,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Falha ao atualizar resgate", details: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
