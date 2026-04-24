import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { generateEscapeToken } from "@/lib/crime-empire/arrest-helpers";

export const dynamic = "force-dynamic";

/* ── Auth helper ───────────────────────────────────────────── */
async function getAuthUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("twitch_session")?.value;
  if (!raw) return null;
  try {
    const session = JSON.parse(raw);
    return { id: session.id, username: session.login, display_name: session.display_name, avatar: session.profile_image_url };
  } catch {
    return null;
  }
}

// GET: Fetch active listings and player's own listings
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // Get player
    const { data: player } = await supabase
      .from("crime_players")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!player) {
      return NextResponse.json({ error: "Jogador não encontrado" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    // Get player's own listings
    if (action === "my-listings") {
      const { data: myListings, error } = await supabase
        .from("black_market_listings")
        .select(`
          *,
          items (name, description, category, power_bonus, intelligence_bonus, charisma_bonus, hp_bonus, base_price)
        `)
        .eq("seller_id", player.id)
        .eq("active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return NextResponse.json({ listings: myListings || [] });
    }

    // D3: Trade history for this player
    if (action === "history") {
      const { data: boughtTrades } = await supabase
        .from("black_market_trades")
        .select("id, item_id, quantity, crypto_price_per_unit, total_crypto, buyer_caught, seller_caught, jail_time_minutes, created_at, items(name)")
        .eq("buyer_id", player.id)
        .order("created_at", { ascending: false })
        .limit(50);

      const { data: soldTrades } = await supabase
        .from("black_market_trades")
        .select("id, item_id, quantity, crypto_price_per_unit, total_crypto, buyer_caught, seller_caught, jail_time_minutes, created_at, items(name)")
        .eq("seller_id", player.id)
        .order("created_at", { ascending: false })
        .limit(50);

      const trades = [
        ...(boughtTrades || []).map((t: any) => ({ ...t, item_name: t.items?.name, role: "buyer" })),
        ...(soldTrades || []).map((t: any) => ({ ...t, item_name: t.items?.name, role: "seller" })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 50);

      return NextResponse.json({ trades });
    }

    // Get all active listings (exclude own listings)
    const { data: listings, error } = await supabase
      .from("black_market_listings")
      .select(`
        *,
        items (name, description, category, power_bonus, intelligence_bonus, charisma_bonus, hp_bonus, base_price),
        crime_players!seller_id (username, display_name, level, prestige_level)
      `)
      .eq("active", true)
      .neq("seller_id", player.id)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ 
      listings: listings || [],
      playerCrypto: player.crypto || 0
    });
  } catch (error) {
    console.error("Error fetching black market:", error);
    return NextResponse.json({ error: "Erro ao carregar mercado negro" }, { status: 500 });
  }
}

// POST: Create listing, buy listing, or cancel listing
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = await req.json();
    const { action, listingId, itemId, quantity, cryptoPricePerUnit } = body;

    // Get player
    const { data: player } = await supabase
      .from("crime_players")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!player) {
      return NextResponse.json({ error: "Jogador não encontrado" }, { status: 404 });
    }

    if (player.in_jail && player.jail_release_at && new Date(player.jail_release_at) > new Date()) {
      return NextResponse.json({ error: "Estás na prisão. Não podes aceder ao mercado negro." }, { status: 403 });
    }
    if (player.hp <= 0) {
      return NextResponse.json({ error: "Estás no hospital. Vai ao Hospital para te curar." }, { status: 403 });
    }

    // Create new listing
    if (action === "create") {
      if (!itemId || !quantity || !cryptoPricePerUnit) {
        return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
      }

      // Check if player has the item
      const { data: inventory } = await supabase
        .from("player_inventory")
        .select("*")
        .eq("player_id", player.id)
        .eq("item_id", itemId)
        .single();

      if (!inventory || inventory.quantity < quantity) {
        return NextResponse.json({ error: "Não tens este item em quantidade suficiente" }, { status: 400 });
      }

      // Get item details
      const { data: item } = await supabase
        .from("items")
        .select("*")
        .eq("id", itemId)
        .single();

      if (!item || !item.tradeable) {
        return NextResponse.json({ error: "Este item não pode ser vendido" }, { status: 400 });
      }

      // Remove items from player's inventory
      const newQuantity = inventory.quantity - quantity;
      if (newQuantity === 0) {
        await supabase
          .from("player_inventory")
          .delete()
          .eq("player_id", player.id)
          .eq("item_id", itemId);
      } else {
        await supabase
          .from("player_inventory")
          .update({ quantity: newQuantity })
          .eq("player_id", player.id)
          .eq("item_id", itemId);
      }

      // Create listing
      const totalCrypto = Number(cryptoPricePerUnit) * quantity;
      const { data: listing, error } = await supabase
        .from("black_market_listings")
        .insert({
          seller_id: player.id,
          item_id: itemId,
          quantity,
          crypto_price_per_unit: cryptoPricePerUnit,
          total_crypto: totalCrypto,
          active: true,
        })
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: `${item.name} listado no mercado negro por ${totalCrypto} crypto!`,
        listing,
      });
    }

    // Buy listing
    if (action === "buy") {
      if (!listingId) {
        return NextResponse.json({ error: "ID de listagem inválido" }, { status: 400 });
      }

      // Get listing
      const { data: listing } = await supabase
        .from("black_market_listings")
        .select("*, items (*)")
        .eq("id", listingId)
        .eq("active", true)
        .single();

      if (!listing) {
        return NextResponse.json({ error: "Listagem não encontrada ou expirada" }, { status: 404 });
      }

      if (listing.seller_id === player.id) {
        return NextResponse.json({ error: "Não podes comprar a tua própria listagem" }, { status: 400 });
      }

      // Check if player has enough crypto
      const playerCrypto = player.crypto || 0;
      if (playerCrypto < listing.total_crypto) {
        return NextResponse.json({ 
          error: `Não tens crypto suficiente! Precisas de ${listing.total_crypto} crypto (tens ${playerCrypto})` 
        }, { status: 400 });
      }

      // Risk of getting caught (5% base chance)
      const caughtChance = 0.05;
      const buyerCaught = Math.random() < caughtChance;
      const sellerCaught = Math.random() < caughtChance;

      // Deactivate listing
      await supabase
        .from("black_market_listings")
        .update({ active: false })
        .eq("id", listingId);

      // Transfer crypto
      await supabase
        .from("crime_players")
        .update({ crypto: playerCrypto - listing.total_crypto })
        .eq("id", player.id);

      // Get seller's current crypto
      const { data: seller } = await supabase
        .from("crime_players")
        .select("crypto")
        .eq("id", listing.seller_id)
        .single();

      if (seller) {
        const sellerCrypto = seller.crypto || 0;
        await supabase
          .from("crime_players")
          .update({ crypto: sellerCrypto + listing.total_crypto })
          .eq("id", listing.seller_id);
      }

      // Add item to buyer's inventory
      const { data: buyerInventory } = await supabase
        .from("player_inventory")
        .select("*")
        .eq("player_id", player.id)
        .eq("item_id", listing.item_id)
        .single();

      if (buyerInventory) {
        await supabase
          .from("player_inventory")
          .update({ quantity: buyerInventory.quantity + listing.quantity })
          .eq("player_id", player.id)
          .eq("item_id", listing.item_id);
      } else {
        await supabase
          .from("player_inventory")
          .insert({
            player_id: player.id,
            item_id: listing.item_id,
            quantity: listing.quantity,
          });
      }

      // Record trade
      let jailTime = 0;
      if (buyerCaught || sellerCaught) {
        jailTime = Math.floor(Math.random() * 30) + 15; // 15-45 minutes
      }

      await supabase
        .from("black_market_trades")
        .insert({
          listing_id: listingId,
          seller_id: listing.seller_id,
          buyer_id: player.id,
          item_id: listing.item_id,
          quantity: listing.quantity,
          crypto_price_per_unit: listing.crypto_price_per_unit,
          total_crypto: listing.total_crypto,
          buyer_caught: buyerCaught,
          seller_caught: sellerCaught,
          jail_time_minutes: jailTime,
        });

      // Send to jail if caught
      let buyerEscapeToken: string | null = null;
      if (buyerCaught) {
        const releaseAt = new Date(Date.now() + jailTime * 60 * 1000);
        const et = generateEscapeToken();
        buyerEscapeToken = et.escape_token;
        await supabase
          .from("crime_players")
          .update({
            in_jail: true,
            jail_release_at: releaseAt.toISOString(),
            escape_token: et.escape_token,
            escape_token_expires_at: et.escape_token_expires_at,
          })
          .eq("id", player.id);

        await supabase.from("jail_records").insert({
          player_id: player.id,
          jail_time_minutes: jailTime,
          release_at: releaseAt.toISOString(),
        });
      }

      // Jail the seller if caught
      if (sellerCaught) {
        const sellerReleaseAt = new Date(Date.now() + jailTime * 60 * 1000);
        await supabase
          .from("crime_players")
          .update({
            in_jail: true,
            jail_release_at: sellerReleaseAt.toISOString(),
          })
          .eq("id", listing.seller_id);

        await supabase.from("jail_records").insert({
          player_id: listing.seller_id,
          jail_time_minutes: jailTime,
          release_at: sellerReleaseAt.toISOString(),
        });

        await supabase.from("player_notifications").insert({
          player_id: listing.seller_id,
          type: "jail_released",
          title: "🚔 Apanhado no Mercado Negro!",
          message: `Um dos teus itens foi rastreado pela polícia. Estás preso por ${jailTime} minutos.`,
        });
      }

      return NextResponse.json({
        success: true,
        message: buyerCaught 
          ? `⚠️ Compraste ${listing.items.name} mas foste apanhado! ${jailTime} minutos na prisão.`
          : `✅ Compraste ${listing.items.name} x${listing.quantity} por ${listing.total_crypto} crypto!`,
        caught: buyerCaught,
        escape_token: buyerEscapeToken,
        jailTime: buyerCaught ? jailTime : 0,
      });
    }

    // Cancel listing
    if (action === "cancel") {
      if (!listingId) {
        return NextResponse.json({ error: "ID de listagem inválido" }, { status: 400 });
      }

      // Get listing
      const { data: listing } = await supabase
        .from("black_market_listings")
        .select("*")
        .eq("id", listingId)
        .eq("seller_id", player.id)
        .eq("active", true)
        .single();

      if (!listing) {
        return NextResponse.json({ error: "Listagem não encontrada" }, { status: 404 });
      }

      // Deactivate listing
      await supabase
        .from("black_market_listings")
        .update({ active: false })
        .eq("id", listingId);

      // Return items to player
      const { data: inventory } = await supabase
        .from("player_inventory")
        .select("*")
        .eq("player_id", player.id)
        .eq("item_id", listing.item_id)
        .single();

      if (inventory) {
        await supabase
          .from("player_inventory")
          .update({ quantity: inventory.quantity + listing.quantity })
          .eq("player_id", player.id)
          .eq("item_id", listing.item_id);
      } else {
        await supabase
          .from("player_inventory")
          .insert({
            player_id: player.id,
            item_id: listing.item_id,
            quantity: listing.quantity,
          });
      }

      return NextResponse.json({
        success: true,
        message: "Listagem cancelada e itens devolvidos!",
      });
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (error) {
    console.error("Error in black market:", error);
    return NextResponse.json({ error: "Erro no mercado negro" }, { status: 500 });
  }
}
