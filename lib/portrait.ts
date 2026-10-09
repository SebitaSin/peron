import fs from "node:fs";
import path from "node:path";

/** Retrato opcional en public/characters/<slug>/portrait.(jpg|png|webp). Debe ser una imagen con licencia verificada. */
export function portraitFor(slug: string): { url: string; file: string; mime: string } | null {
  for (const [ext, mime] of [["jpg", "image/jpeg"], ["png", "image/png"], ["webp", "image/webp"]] as const) {
    const file = path.join(process.cwd(), "public", "characters", slug, `portrait.${ext}`);
    if (fs.existsSync(file)) return { url: `/characters/${slug}/portrait.${ext}`, file, mime };
  }
  return null;
}
