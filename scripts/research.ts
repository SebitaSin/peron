/** Uso: npm run research -- "Eva Perón"   → crea characters/eva-peron/ (esqueleto) y research/eva-peron/CHECKLIST.md */
import fs from "node:fs";
import path from "node:path";
import { checklistMarkdown, packSkeleton } from "../lib/research/pipeline";

const name = process.argv.slice(2).join(" ").trim();
if (!name) {
  console.error('Uso: npm run research -- "Nombre de la persona"');
  process.exit(1);
}
const slug = name
  .normalize("NFD")
  .replace(/[̀-ͯ]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

const dir = path.join(process.cwd(), "characters", slug);
if (fs.existsSync(dir)) {
  console.error(`Ya existe characters/${slug}. No se sobrescribe.`);
  process.exit(1);
}
fs.mkdirSync(dir, { recursive: true });
for (const [file, content] of Object.entries(packSkeleton(name, slug))) fs.writeFileSync(path.join(dir, file), content);
const rdir = path.join(process.cwd(), "research", slug);
fs.mkdirSync(rdir, { recursive: true });
fs.writeFileSync(path.join(rdir, "CHECKLIST.md"), checklistMarkdown(name, slug));
console.log(`✓ Esqueleto en characters/${slug}/ y checklist en research/${slug}/CHECKLIST.md (estado: draft, no publicable).`);
