/** Estado de publicación de cada personaje. Falla (exit 1) si alguno no es publicable. */
import { getReport, listSlugs, statusOf } from "../characters";

let bad = 0;
for (const slug of listSlugs()) {
  const r = getReport(slug);
  const st = statusOf(slug);
  console.log(`${st === "published" ? "✓" : "✗"} ${slug}: ${st}  (evaluación automática: ${r?.automatic_pass ? "sí" : "no"} · firma humana: ${r?.manual_signoff ? "sí" : "no"} · última corrida: ${r?.at ?? "nunca"})`);
  if (st !== "published") bad++;
}
process.exit(bad ? 1 : 0);
