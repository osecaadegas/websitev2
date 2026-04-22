import { readdir, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baseDir = path.join(__dirname, "..", "public", "images", "crime_empire", "items");

async function main() {
  const entries = await readdir(baseDir, { withFileTypes: true });
  const categories = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  const manifest = {};
  for (const cat of categories) {
    const files = await readdir(path.join(baseDir, cat));
    manifest[cat] = files
      .filter((f) => /\.(png|jpg|jpeg|webp|gif)$/i.test(f))
      .sort();
  }

  const outPath = path.join(baseDir, "manifest.json");
  await writeFile(outPath, JSON.stringify(manifest));

  const total = Object.values(manifest).reduce((s, v) => s + v.length, 0);
  console.log(
    `✅ Image manifest: ${categories.length} categories, ${total} images → ${outPath}`
  );
}

main().catch(console.error);
