// ──────────────────────────────────────────────────────────────────────────────
// Derivación de la lista de ENV requeridas (manifest.env).
//
// Es la ÚNICA fuente de verdad de qué secretos pedirá el instalador. Se deriva
// de los providers, channels e integrations elegidos en el wizard. CERO valores:
// solo declaraciones { key, scope, desc, example, required }.
// ──────────────────────────────────────────────────────────────────────────────

import type { WizardConfig } from "../wizard-context";
import type { ManifestEnvVar } from "./types";

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

// Integraciones del overlay. El wizard aún no las recoge en el entregable #1;
// se incluyen sus ENV solo si vienen habilitadas.
function integrationEnv(config: WizardConfig): ManifestEnvVar[] {
  const out: ManifestEnvVar[] = [];
  const integrations = (config as { integrations?: { n8n?: { enabled?: boolean } } }).integrations;
  if (integrations?.n8n?.enabled) {
    out.push(
      { key: "N8N_BASE_URL", scope: "overlay", desc: "URL base de la instancia n8n.", example: "https://n8n.example.com", required: true },
      { key: "N8N_AUTH_TOKEN", scope: "overlay", desc: "API key de n8n.", example: "<jwt>", required: true },
    );
  }
  // Slack NO se declara aquí: sus tokens los aporta el CANAL Slack (Fase 1, CHANNEL_ENV).
  return out;
}

// Deriva la lista completa de ENV requeridas, sin duplicados (por `key`).
export function deriveEnvSpec(config: WizardConfig): ManifestEnvVar[] {
  const collected: ManifestEnvVar[] = [];

  for (const id of Object.keys(config.providers || {})) {
    collected.push(...(PROVIDER_ENV[id] ?? []));
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
