// sync-catalog.mjs — copia el catálogo de roles de clawcrew a este repo para que
// el wizard lo consuma en build (wizard-context.tsx es "use client" y no puede
// leer ficheros en runtime). Ejecutar cuando clawcrew añada/cambie roles:
//   npm run sync:catalog
// Fuente (en orden): AGENT_CATALOG_SOURCE > $CLAWCREW_PATH/catalog.json > ../clawcrew/catalog.json
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
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
  console.error(`[sync-catalog] catálogo no encontrado: ${src}`);
  console.error('Define CLAWCREW_PATH o AGENT_CATALOG_SOURCE, o coloca clawcrew/ junto a este repo.');
  process.exit(1);
}

const catalog = JSON.parse(readFileSync(src, 'utf8'));
writeFileSync(dest, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
console.log(`[sync-catalog] ${catalog.agentCount ?? (catalog.agents || []).length} roles → ${dest}`);
