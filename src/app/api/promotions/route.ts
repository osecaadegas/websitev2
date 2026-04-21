import { NextResponse } from "next/server";
import { getPromotions } from "@/lib/promotions";
import type { CasinoPromotion } from "@/lib/promotions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const type = searchParams.get("type") as CasinoPromotion["type"] | null;
  const casino = searchParams.get("casino");
  const featuredOnly = searchParams.get("featured") === "true";

  const data = getPromotions({
    type: type || undefined,
    casino: casino || undefined,
    featuredOnly: featuredOnly || undefined,
  });

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
