// sync-providers.mjs — compila el catálogo de PROVIDERS+MODELOS del onboarding de
// OpenClaw a un JSON que el wizard consume en build (el step de proveedor es
// "use client" y no puede leer ficheros en runtime). Mismo patrón que
// sync-catalog.mjs (clawcrew).
//
//   npm run sync:providers
//
// Fuente (en orden): OPENCLAW_EXTENSIONS > $OPENCLAW_PATH/extensions > ../openclaw/extensions
//
// De cada extensions/<x>/openclaw.plugin.json se extrae, POR provider:
//   - id, label, featured, métodos de credencial (authMethods) y envVars reales
//   - baseUrl + api (cómo conectar) y models (id, name, reasoning, contextWindow)
// El orden destacado replica el del onboard: openai, anthropic, xai, google, resto.
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
  console.error(`[sync-providers] no encuentro extensions/: ${extRoot}`);
  console.error("Define OPENCLAW_PATH u OPENCLAW_EXTENSIONS, o coloca openclaw/ junto a este repo.");
  process.exit(1);
}

const FEATURED_ORDER = { openai: 0, anthropic: 1, xai: 2, google: 3 };

function titleCase(id) {
  return id.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Mapa provider-id → entrada del catálogo (puede agregarse desde varios plugins).
const byProvider = new Map();

function ensure(id) {
  if (!byProvider.has(id)) {
    byProvider.set(id, {
      id,
      label: titleCase(id),
      featured: false,
      authMethods: [],
      envVars: [],
      baseUrl: null,
      api: null,
      models: [],
    });
  }
  return byProvider.get(id);
}

for (const dir of readdirSync(extRoot)) {
  const file = join(extRoot, dir, "openclaw.plugin.json");
  if (!existsSync(file)) continue;
  let j;
  try { j = JSON.parse(readFileSync(file, "utf8")); } catch { continue; }

  // Auth choices: label de grupo, featured y método.
  for (const ch of j.providerAuthChoices || []) {
    if (!ch.provider) continue;
    const e = ensure(ch.provider);
    if (ch.groupLabel) e.label = ch.groupLabel;
    if (ch.onboardingFeatured) e.featured = true;
    if (ch.method && !e.authMethods.includes(ch.method)) e.authMethods.push(ch.method);
  }

  // setup.providers: authMethods + envVars reales por provider.
  for (const sp of (j.setup && j.setup.providers) || []) {
    if (!sp.id) continue;
    const e = ensure(sp.id);
    for (const m of sp.authMethods || []) if (!e.authMethods.includes(m)) e.authMethods.push(m);
    for (const v of sp.envVars || []) if (!e.envVars.includes(v)) e.envVars.push(v);
  }

  // modelCatalog: conexión (baseUrl/api) + modelos.
  const mc = (j.modelCatalog && j.modelCatalog.providers) || {};
  for (const pid of Object.keys(mc)) {
    const e = ensure(pid);
    const entry = mc[pid];
    if (entry.baseUrl) e.baseUrl = entry.baseUrl;
    if (entry.api) e.api = entry.api;
    for (const m of entry.models || []) {
      if (e.models.some((x) => x.id === m.id)) continue;
      e.models.push({
        id: m.id,
        name: m.name || m.id,
        reasoning: !!m.reasoning,
        input: m.input || ["text"],
        contextWindow: m.contextWindow || null,
      });
    }
  }
}

// Solo providers que aportan algo (auth o modelos). Orden: featured primero
// (según FEATURED_ORDER), luego alfabético por label.
const providers = [...byProvider.values()]
  .filter((p) => p.authMethods.length || p.models.length)
  .sort((a, b) => {
    const fa = a.id in FEATURED_ORDER ? FEATURED_ORDER[a.id] : 999;
    const fb = b.id in FEATURED_ORDER ? FEATURED_ORDER[b.id] : 999;
    if (fa !== fb) return fa - fb;
    return a.label.localeCompare(b.label);
  });

const out = {
  generatedFrom: "openclaw/extensions/*/openclaw.plugin.json",
  providerCount: providers.length,
  modelCount: providers.reduce((a, p) => a + p.models.length, 0),
  featuredOrder: Object.keys(FEATURED_ORDER),
  providers,
};

const dest = join(repoRoot, "lib", "providers-catalog.json");
writeFileSync(dest, JSON.stringify(out, null, 2) + "\n", "utf8");
console.log(`[sync-providers] ${out.providerCount} providers, ${out.modelCount} modelos → ${dest}`);
