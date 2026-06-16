// sync-channels.mjs — compila el catálogo de CANALES de OpenClaw a un JSON que el
// wizard consume en build (el step de canales es "use client" y no puede leer
// ficheros en runtime). Mismo patrón que sync-providers.mjs.
//
//   npm run sync:channels
//
// Fuente (en orden): OPENCLAW_EXTENSIONS > $OPENCLAW_PATH/extensions > ../openclaw/extensions
//
// De cada extensions/<x>/openclaw.plugin.json que declara `channels` se extrae:
//   - id del canal y las ENV vars reales que necesita (channelEnvVars[canal])
// La capa de presentación (label, logo, soportado, estilo de auth) la añade
// lib/channels-meta.ts — aquí solo va la verdad técnica de OpenClaw.
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const extRoot =
  process.env.OPENCLAW_EXTENSIONS ||
  (process.env.OPENCLAW_PATH ? join(process.env.OPENCLAW_PATH, "extensions") : null) ||
  resolve(repoRoot, "..", "openclaw", "extensions");

if (!existsSync(extRoot)) {
  console.error(`[sync-channels] no encuentro extensions/: ${extRoot}`);
  console.error("Define OPENCLAW_PATH u OPENCLAW_EXTENSIONS, o coloca openclaw/ junto a este repo.");
  process.exit(1);
}

// Canales internos / de test que NO ofrecemos en el wizard.
const SKIP = new Set(["qa-channel", "qa-matrix", "clickclack"]);

const byChannel = new Map();

for (const dir of readdirSync(extRoot)) {
  const file = join(extRoot, dir, "openclaw.plugin.json");
  if (!existsSync(file)) continue;
  let j;
  try { j = JSON.parse(readFileSync(file, "utf8")); } catch { continue; }
  if (!Array.isArray(j.channels) || !j.channels.length) continue;

  for (const ch of j.channels) {
    if (SKIP.has(ch)) continue;
    const envVars = (j.channelEnvVars && j.channelEnvVars[ch]) || [];
    const prev = byChannel.get(ch) || { id: ch, plugin: j.id || dir, envVars: [] };
    for (const v of envVars) if (!prev.envVars.includes(v)) prev.envVars.push(v);
    byChannel.set(ch, prev);
  }
}

const channels = [...byChannel.values()].sort((a, b) => a.id.localeCompare(b.id));

const out = {
  generatedFrom: "openclaw/extensions/*/openclaw.plugin.json (channels)",
  channelCount: channels.length,
  channels,
};

const dest = join(repoRoot, "lib", "channels-catalog.json");
writeFileSync(dest, JSON.stringify(out, null, 2) + "\n", "utf8");
console.log(`[sync-channels] ${out.channelCount} canales → ${dest}`);
