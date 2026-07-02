// check-catalog-drift.mjs — falla si la copia lib/clawcrew-catalog.json diverge
// del catálogo fuente de clawcrew. Evita que el wizard ofrezca un catálogo
// desactualizado (roles que faltan o versiones viejas) sin que nadie lo note.
//   npm run check:catalog
// Fuente (mismo orden que sync-catalog.mjs): AGENT_CATALOG_SOURCE >
// $CLAWCREW_PATH/catalog.json > ../clawcrew/catalog.json.
// Si la fuente no está presente (p.ej. build en Vercel, sin clawcrew al lado)
// se omite el check con aviso — no es un entorno donde se pueda comparar.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const src =
  process.env.AGENT_CATALOG_SOURCE ||
  (process.env.CLAWCREW_PATH ? join(process.env.CLAWCREW_PATH, 'catalog.json') : null) ||
  resolve(repoRoot, '..', 'clawcrew', 'catalog.json');

const dest = join(repoRoot, 'lib', 'clawcrew-catalog.json');

if (!existsSync(src)) {
  console.warn(`[check-catalog] fuente no disponible (${src}) — check omitido.`);
  process.exit(0);
}

const normalize = (raw) => JSON.stringify(JSON.parse(raw));
const source = normalize(readFileSync(src, 'utf8'));
const copy = normalize(readFileSync(dest, 'utf8'));

if (source !== copy) {
  const ids = (raw) => new Map(JSON.parse(raw).agents.map((a) => [a.id, a.version]));
  const s = ids(source);
  const c = ids(copy);
  for (const [id, v] of s) {
    if (!c.has(id)) console.error(`  falta en la copia: ${id}@${v}`);
    else if (c.get(id) !== v) console.error(`  versión vieja: ${id} copia=${c.get(id)} fuente=${v}`);
  }
  for (const id of c.keys()) {
    if (!s.has(id)) console.error(`  sobra en la copia (ya no existe en clawcrew): ${id}`);
  }
  console.error('[check-catalog] lib/clawcrew-catalog.json desactualizado — corre `npm run sync:catalog`.');
  process.exit(1);
}

console.log('[check-catalog] copia en sync con clawcrew.');
