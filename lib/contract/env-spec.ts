// ──────────────────────────────────────────────────────────────────────────────
// Derivación de la lista de ENV requeridas (manifest.env).
//
// Es la ÚNICA fuente de verdad de qué secretos pedirá el instalador. Se deriva
// de los providers, channels e integrations elegidos en el wizard. CERO valores:
// solo declaraciones { key, scope, desc, example, required }.
// ──────────────────────────────────────────────────────────────────────────────

import type { WizardConfig } from "../wizard-context";
import type { ManifestEnvVar } from "./types";
import providersCatalog from "../providers-catalog.json";

const PROVIDER_CATALOG: Record<string, { label?: string; envVars?: string[] }> =
  Object.fromEntries(providersCatalog.providers.map((p) => [p.id, p]));

function providerEnvKey(id: string, envVars?: string[]): string | undefined {
  if (!envVars || !envVars.length) return undefined;
  const std = `${id.toUpperCase()}_API_KEY`;
  if (envVars.includes(std)) return std;
  return envVars.find((v) => /_API_KEY$/.test(v)) || envVars[0];
}

// Tablas de declaración. `example` muestra la FORMA del valor (no un secreto).
const PROVIDER_ENV: Record<string, ManifestEnvVar[]> = {
  anthropic: [
    { key: "ANTHROPIC_API_KEY", scope: "base", desc: "API key de Anthropic (Console).", example: "sk-ant-api03-...", required: true },
  ],
  openai: [
    { key: "OPENAI_API_KEY", scope: "base", desc: "API key de OpenAI.", example: "sk-...", required: true },
  ],
  google: [
    { key: "GOOGLE_API_KEY", scope: "base", desc: "API key de Google AI Studio (Gemini).", example: "AIza...", required: true },
  ],
  axet: [
    { key: "AXET_GATEWAY_TOKEN", scope: "base", desc: "Token del gateway corporativo Axet.", example: "<token>", required: true },
    { key: "OKTA_CLIENT_ID", scope: "base", desc: "Client ID de Okta para el Device Flow.", example: "0oa...", required: true },
  ],
  // ollama es keyless: no aporta ENV.
  ollama: [],
};

const CHANNEL_ENV: Record<string, ManifestEnvVar[]> = {
  telegram: [
    { key: "TELEGRAM_BOT_TOKEN", scope: "base", desc: "Token del bot de Telegram (@BotFather).", example: "123456:ABC-DEF...", required: true },
  ],
  slack: [
    { key: "SLACK_BOT_TOKEN", scope: "base", desc: "Bot token de Slack (xoxb-...).", example: "xoxb-...", required: true },
    { key: "SLACK_APP_TOKEN", scope: "base", desc: "App-level token de Slack (Socket Mode).", example: "xapp-1-...", required: true },
  ],
  discord: [
    { key: "DISCORD_BOT_TOKEN", scope: "base", desc: "Token del bot de Discord.", example: "<token>", required: true },
  ],
  // whatsapp se empareja por QR en runtime: no aporta ENV.
  whatsapp: [],
  signal: [],
};

// ENV por integración. Google Workspace = OAuth en la instalación (no aporta ENV).
// Slack NO está: es un CANAL (Fase 1, CHANNEL_ENV).
const INTEGRATION_ENV: Record<string, ManifestEnvVar[]> = {
  n8n: [
    { key: "N8N_BASE_URL", scope: "overlay", desc: "URL base de la instancia n8n.", example: "https://n8n.example.com", required: true },
    { key: "N8N_AUTH_TOKEN", scope: "overlay", desc: "API key de n8n.", example: "<jwt>", required: true },
  ],
  brave: [
    { key: "BRAVE_API_KEY", scope: "base", desc: "API key de Brave Search (búsqueda web de calidad).", example: "BSA...", required: true },
  ],
  elevenlabs: [
    { key: "ELEVENLABS_API_KEY", scope: "base", desc: "API key de ElevenLabs (voz/TTS).", example: "sk_...", required: false },
  ],
  // googleworkspace: OAuth en destino, sin ENV.
  googleworkspace: [],
};

// Incluye las ENV de las integraciones habilitadas (mapa por id, presencia+enabled).
function integrationEnv(config: WizardConfig): ManifestEnvVar[] {
  const out: ManifestEnvVar[] = [];
  const integrations = config.integrations || {};
  for (const id of Object.keys(integrations)) {
    if (integrations[id]?.enabled) out.push(...(INTEGRATION_ENV[id] ?? []));
  }
  return out;
}

// Deriva la lista completa de ENV requeridas, sin duplicados (por `key`).
export function deriveEnvSpec(config: WizardConfig): ManifestEnvVar[] {
  const collected: ManifestEnvVar[] = [];

  for (const id of Object.keys(config.providers || {})) {
    if (PROVIDER_ENV[id]) {
      collected.push(...PROVIDER_ENV[id]);
      continue;
    }
    if (id === "__custom__") {
      const c = (config.providers as { __custom__?: { envKey?: string } }).__custom__;
      if (c?.envKey) collected.push({ key: c.envKey, scope: "base", desc: "API key del provider OpenAI-compatible (custom).", example: "<api-key>", required: true });
      continue;
    }
    // Provider del catálogo no tabulado (minimax, deepseek, groq…): declara su key.
    const entry = PROVIDER_CATALOG[id];
    const key = entry && providerEnvKey(id, entry.envVars);
    if (key) {
      collected.push({ key, scope: "base", desc: `API key de ${entry.label || id}.`, example: "<api-key>", required: true });
    }
  }
  for (const id of Object.keys(config.channels || {})) {
    // channels[id] puede ser un objeto de config o un flag; basta su presencia.
    if (config.channels[id as keyof typeof config.channels]) {
      collected.push(...(CHANNEL_ENV[id] ?? []));
    }
  }
  collected.push(...integrationEnv(config));

  const seen = new Set<string>();
  return collected.filter((e) => (seen.has(e.key) ? false : (seen.add(e.key), true)));
}
