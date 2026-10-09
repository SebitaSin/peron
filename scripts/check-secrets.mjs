// Verifica que ninguna clave ni referencia a variables secretas llegue al bundle del navegador.
import fs from "node:fs";
import path from "node:path";

const roots = [".next/static", "public"];
const patterns = [
  { name: "clave Anthropic", re: /sk-ant-[A-Za-z0-9_-]{10,}/ },
  { name: "clave estilo OpenAI", re: /sk-(?:proj-)?[A-Za-z0-9_-]{32,}/ },
  { name: "nombre ANTHROPIC_API_KEY", re: /ANTHROPIC_API_KEY/ },
  { name: "nombre OPENAI_API_KEY", re: /OPENAI_API_KEY/ },
  { name: "endpoint de proveedor LLM en el cliente", re: /api\.(?:anthropic|openai)\.com/ },
  { name: "system prompt en el cliente", re: /FORMATO DE SALIDA \(obligatorio/ },
  { name: "dossier/línea de tiempo bloqueada en el cliente", re: /Revoluci[oó]n Libertadora: derrocamiento/ },
];

let files = 0;
const hits = [];
function walk(p) {
  if (!fs.existsSync(p)) return;
  for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    const f = path.join(p, e.name);
    if (e.isDirectory()) walk(f);
    else if (/\.(js|mjs|css|html|json|map|txt)$/.test(e.name)) {
      files++;
      const t = fs.readFileSync(f, "utf8");
      for (const { name, re } of patterns) if (re.test(t)) hits.push(`${name}: ${f}`);
    }
  }
}
roots.forEach(walk);

// Ninguna variable NEXT_PUBLIC_ puede parecer un secreto.
const srcHits = [];
for (const dir of ["app", "components", "lib", "characters"]) {
  (function scan(p) {
    if (!fs.existsSync(p)) return;
    for (const e of fs.readdirSync(p, { withFileTypes: true })) {
      const f = path.join(p, e.name);
      if (e.isDirectory()) scan(f);
      else if (/\.(ts|tsx|mjs|js)$/.test(e.name) && /NEXT_PUBLIC_\w*(KEY|SECRET|TOKEN|PASSWORD)/i.test(fs.readFileSync(f, "utf8"))) srcHits.push(f);
    }
  })(dir);
}

if (!fs.existsSync(".next/static")) {
  console.error("✗ No existe .next/static: ejecutá `npm run build` antes.");
  process.exit(2);
}
if (hits.length || srcHits.length) {
  console.error("✗ Fuga potencial hacia el cliente:");
  [...hits, ...srcHits.map((f) => `NEXT_PUBLIC_ sospechosa en ${f}`)].forEach((h) => console.error("  - " + h));
  process.exit(1);
}
console.log(`✓ ${files} archivos de cliente revisados: sin claves, sin endpoints de LLM, sin prompt ni línea de tiempo bloqueada.`);
