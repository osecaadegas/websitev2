import { NextResponse } from "next/server";
import { readdir } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const ALLOWED = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);

export async function GET() {
  try {
    const dir = path.join(process.cwd(), "public", "images", "pages");
    const entries = await readdir(dir, { withFileTypes: true });

    const images = entries
      .filter((e) => e.isFile() && ALLOWED.has(path.extname(e.name).toLowerCase()))
      .map((e) => {
        const base = path.basename(e.name, path.extname(e.name));
        const isNumeric = /^\d+$/.test(base);
        return {
          file: `/images/pages/${e.name}`,
          name: isNumeric ? `Imagem ${base}` : base,
          sortKey: isNumeric ? parseInt(base, 10) : Number.MAX_SAFE_INTEGER,
          rawName: e.name.toLowerCase(),
        };
      })
      .sort((a, b) => {
        if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
        return a.rawName.localeCompare(b.rawName);
      })
      .map(({ file, name }) => ({ file, name }));

    return NextResponse.json({ images }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list" },
      { status: 500 },
    );
  }
}
