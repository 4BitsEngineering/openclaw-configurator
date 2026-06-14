import type { WizardConfig } from "./wizard-context";
import openclawTemplate from "./templates/openclaw.template.json";
import { randomBytes } from "crypto";

// ──────────────────────────────────────────────────────────────────────────────
// Overlay config (consumed by autonomous-agents/work-console/scripts/configure-overlay.js)
//
// Shape definido en el header del wrapper. Los paths se emiten RELATIVOS al
// dir donde el install.sh deja el archivo (~/openclaw-stack/overlay-config.json
// por defecto). El install.sh los resuelve a absolutos antes de invocar al
// wrapper.
//
// Nota: el bloque planMode todavía no se pregunta en el step-2 actual; si en
// el futuro extendemos el wizard con un sub-paso de plan-mode (Planificador
// activado? plannerAgentId? autoSuggest?) lo añadimos aquí sin tocar
// configure-overlay (que ya lo soporta).
// ──────────────────────────────────────────────────────────────────────────────

// Modelo default hardcodeado para todas las instalaciones generadas por el
// configurator. Garantiza que el cliente abre el chat y los agentes pueden
// responder de inmediato sin pasos manuales en el .env. Cuando el wizard
// step-1 capture provider+modelo del operador, eliminar este literal y leer
// del config.providers.
//
// !! REMOVE BEFORE PUBLIC RELEASE (junto con la key xiaomi en
// generateInstallScript). Solo para demos managed-asistidas 24-may.
const DEFAULT_MODEL_HARDCODED = "xiaomi/mimo-v2-pro";

// !! REMOVE BEFORE PUBLIC RELEASE / cuando wizard step-1 capture la key real
// del operador. Por ahora hardcoded para demos: el .env del cliente queda con
// esta key directamente, sin que el operador tenga que editar a mano. Esta
// key se subirá a GitHub cuando se commitee — riesgo asumido conscientemente
// hasta que se cierre el flujo Capa 2 (wizard captura key + .env la inyecta
// como `${XIAOMI_API_KEY}` substituido al generar).
const DEMO_XIAOMI_API_KEY_HARDCODED = "sk-esbnditqmy4kcyyk1i12i2wi2nlxt3mkynwa2pp69gzg7zpr";

// Genera un openclaw.json COMPLETO partiendo de la plantilla (derivada de la
// config probada de ai-office) y parametrizando lo por-instancia. agents.list
// queda [] — configure-overlay.js los inyecta tras instalar los agentes.
export function generateOpenclawJson(config: WizardConfig): string {
  const tpl = JSON.parse(JSON.stringify(openclawTemplate));
  const token = randomBytes(24).toString("base64url");
  if (tpl.gateway?.auth) tpl.gateway.auth.token = token;
  if (tpl.gateway?.remote) tpl.gateway.remote.token = token;
  const chosen = pickProviderModel(config);
  if (chosen) {
    tpl.models = tpl.models || { mode: "replace", providers: {} };
    tpl.models.providers = tpl.models.providers || {};
    const existing = tpl.models.providers[chosen.providerId];
    if (existing && typeof existing === "object") {
      // El provider ya vive en la plantilla (p.ej. ollama con varios modelos):
      // NO reemplazar en bloque (perderíamos el resto de modelos). Preservamos
      // la entry y solo aseguramos que el modelo elegido esté presente.
      const chosenModels = (chosen.providerEntry as { models?: Array<{ id?: string }> }).models || [];
      const existingModels: Array<{ id?: string }> = Array.isArray(existing.models) ? existing.models : [];
      for (const m of chosenModels) {
        const present = existingModels.some((em) => em.id === m.id);
        if (!present) existingModels.unshift(m);
      }
      existing.models = existingModels;
    } else {
      // El provider no existe en la plantilla (anthropic/openai/google): aditivo.
      tpl.models.providers[chosen.providerId] = chosen.providerEntry;
    }
  }
  return JSON.stringify(tpl, null, 2) + "\n";
}

function pickProviderModel(config: WizardConfig): { providerId: string; providerEntry: unknown } | null {
  const p = config.providers || {};
  if (p.ollama) {
    return { providerId: "ollama", providerEntry: {
      baseUrl: p.ollama.baseUrl || "http://127.0.0.1:11434/v1",
      apiKey: "ollama-local", api: "openai-completions",
      models: [{ id: p.ollama.model || "gemma4-gpu", name: p.ollama.model || "gemma4-gpu", reasoning: false, input: ["text"] }],
    } };
  }
  if (p.anthropic) {
    return { providerId: "anthropic", providerEntry: {
      apiKey: "${ANTHROPIC_API_KEY}", api: "anthropic-messages",
      models: [{ id: p.anthropic.model || "claude-sonnet-4-6", name: p.anthropic.model || "claude-sonnet-4-6" }],
    } };
  }
  if (p.openai) {
    return { providerId: "openai", providerEntry: {
      apiKey: "${OPENAI_API_KEY}", api: "openai-completions",
      models: [{ id: p.openai.model || "gpt-5.2-chat-latest", name: p.openai.model || "gpt-5.2-chat-latest" }],
    } };
  }
  if (p.google) {
    return { providerId: "google", providerEntry: {
      apiKey: "${GOOGLE_API_KEY}", api: "openai-completions",
      models: [{ id: p.google.model || "gemini-2.5-pro", name: p.google.model || "gemini-2.5-pro" }],
    } };
  }
  return null;
}

export function generateOverlayConfig(config: WizardConfig): string {
  const team = config.clawcrewTeam;
  // Defensivo: si el step-2 no se completó (operator saltó pasos), emitimos
  // un esqueleto vacío con instrucciones — install.sh detecta agents=[] y
  // salta el invoke a configure-overlay.
  if (!team || team.agents.length === 0) {
    return JSON.stringify({
      "$comment": "overlay-config.json — vacío (no se eligió equipo en step-2)",
      "overlay": { path: "./overlays/empty", prefix: "empty", name: "Empty" },
      "library": { path: "./clawcrew" },
      "openclawConfig": "./openclaw.json",
      "agents": [],
    }, null, 2);
  }

  const enabledAgents = team.agents.filter((a) => a.enabled);

  // El bloque agents[*] queda 1:1 con el shape esperado por configure-overlay.js
  // (ver scripts/configure-overlay.js header).
  const agentsBlock = enabledAgents.map((a) => {
    const out: Record<string, unknown> = {
      agent: a.agent,
      slug: a.slug,
      displayName: a.displayName,
      shortName: a.shortName || a.displayName,
      icon: a.icon,
    };
    if (a.color)        out.color = a.color;
    if (a.workingVerb)  out.workingVerb = a.workingVerb;
    if (a.voice && (a.voice.kind || a.voice.elevenlabsId)) {
      const voice: Record<string, unknown> = {};
      if (a.voice.kind)         voice.kind = a.voice.kind;
      if (a.voice.elevenlabsId) voice.elevenlabsId = a.voice.elevenlabsId;
      out.voice = voice;
    }
    return out;
  });

  const overlayConfig: Record<string, unknown> = {
    "$comment": `overlay-config.json — generado por openclaw-configurator @ ${new Date().toISOString()}`,
    overlay: {
      path: `./overlays/${team.overlayName.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}`,
      prefix: team.prefix,
      name: team.overlayName,
    },
    library: { path: "./clawcrew" },
    openclawConfig: "./openclaw.json",
    // configure-overlay.js lee este campo top-level y lo propaga a cada
    // agent-cli install como --default-model. Hardcoded por ahora (demos
    // managed); cuando el wizard step-1 capture provider+modelo del operador
    // (Capa 2), esto leerá de cfg.providers.<provider>.model.
    defaultModel: DEFAULT_MODEL_HARDCODED,
    agents: agentsBlock,
  };

  if (team.planMode) {
    overlayConfig.planMode = team.planMode;
  }

  return JSON.stringify(overlayConfig, null, 2);
}

export function generateConfigYAML(config: WizardConfig): string {
  const yaml: string[] = [];

  // Meta
  yaml.push(`meta:`);
  yaml.push(`  generated: "${new Date().toISOString()}"`);
  yaml.push(`  version: "2026.3"`);
  yaml.push(``);

  // Providers
  if (Object.keys(config.providers).length > 0) {
    yaml.push(`providers:`);

    if (config.providers.anthropic) {
      yaml.push(`  - provider: anthropic`);
      if (config.providers.anthropic.sessionToken) {
        yaml.push(`    sessionToken: \${ANTHROPIC_SESSION_TOKEN}`);
      } else if (config.providers.anthropic.apiKey) {
        yaml.push(`    apiKey: \${ANTHROPIC_API_KEY}`);
      }
    }

    if (config.providers.openai) {
      yaml.push(`  - provider: openai`);
      yaml.push(`    apiKey: \${OPENAI_API_KEY}`);
    }

    if (config.providers.google) {
      yaml.push(`  - provider: google`);
      yaml.push(`    apiKey: \${GOOGLE_API_KEY}`);
    }

    if (config.providers.ollama) {
      yaml.push(`  - provider: ollama`);
      yaml.push(`    baseUrl: http://localhost:11434`);
    }

    if (config.providers.axet) {
      yaml.push(`  - provider: axet`);
      yaml.push(`    gatewayUrl: \${AXET_GATEWAY_URL}`);
      yaml.push(`    gatewayToken: \${AXET_GATEWAY_TOKEN}`);
      yaml.push(`    oktaIssuer: \${OKTA_ISSUER}`);
      yaml.push(`    oktaClientId: \${OKTA_CLIENT_ID}`);
      yaml.push(`    oktaScope: "${config.providers.axet.oktaScope}"`);
      yaml.push(`    apiBaseUrl: \${AXET_API_BASE_URL}`);
      yaml.push(`    # Auth: Device Flow / Okta — initiated at gateway runtime`);
    }

    yaml.push(``);
  }

  // Channels
  if (Object.keys(config.channels).length > 0) {
    yaml.push(`channels:`);

    if (config.channels.telegram) {
      yaml.push(`  - channel: telegram`);
      yaml.push(`    token: \${TELEGRAM_BOT_TOKEN}`);
      yaml.push(`    dmPolicy: ${config.security.dmPolicy}`);
      if (config.security.allowlist.length > 0) {
        yaml.push(`    allowlist:`);
        config.security.allowlist.forEach((user) => {
          yaml.push(`      - "${user}"`);
        });
      }
    }

    if (config.channels.discord) {
      yaml.push(`  - channel: discord`);
      yaml.push(`    token: \${DISCORD_BOT_TOKEN}`);
    }

    if (config.channels.whatsapp?.enabled) {
      yaml.push(`  - channel: whatsapp`);
      yaml.push(`    # Will configure via QR code on first run`);
    }

    if (config.channels.signal?.enabled) {
      yaml.push(`  - channel: signal`);
      yaml.push(`    # Will configure via linking on first run`);
    }

    yaml.push(``);
  }

  // Agent personality
  yaml.push(`agent:`);
  yaml.push(`  name: "${config.personality.name}"`);
  yaml.push(`  emoji: "${config.personality.emoji}"`);
  yaml.push(`  vibe: "${config.personality.vibe}"`);
  yaml.push(``);

  // Skills
  if (config.skills.length > 0) {
    yaml.push(`skills:`);
    config.skills.forEach((skill) => {
      yaml.push(`  - ${skill}`);
    });
  }

  return yaml.join("\n");
}

export function generateAgentsConfig(config: WizardConfig): string {
  const yaml: string[] = [];
  const activeAgents = config.useCase.agents.filter((a) => a.enabled);

  yaml.push(`# autonomous-agents configuration`);
  yaml.push(`# Generated: ${new Date().toISOString()}`);
  yaml.push(`# Use case: ${config.useCase.type}`);
  yaml.push(``);
  yaml.push(`use_case: ${config.useCase.type}`);
  yaml.push(``);

  yaml.push(`agents:`);
  if (activeAgents.length === 0) {
    yaml.push(`  [] # No agents selected`);
  } else {
    activeAgents.forEach((agent) => {
      yaml.push(`  - id: ${agent.id}`);
      yaml.push(`    name: "${agent.name}"`);
      yaml.push(`    role: "${agent.role}"`);
      yaml.push(`    enabled: true`);
      yaml.push(`    prompt_base: |`);
      yaml.push(`      You are ${agent.name}, an AI agent specialized in: ${agent.role}.`);
      yaml.push(`      Act as part of a team of agents for the ${config.useCase.type} use case.`);
      yaml.push(`      Coordinate with other agents when needed and escalate to the Reviewer for QA.`);
      yaml.push(``);
    });
  }

  yaml.push(`# Bridge settings (see bridge-config.yaml)`);
  yaml.push(`bridge_ref: ./bridge-config.yaml`);

  return yaml.join("\n");
}

export function generateBridgeConfig(config: WizardConfig): string {
  const yaml: string[] = [];

  yaml.push(`# autonomous-agents bridge configuration`);
  yaml.push(`# Generated: ${new Date().toISOString()}`);
  yaml.push(``);
  yaml.push(`bridge:`);
  yaml.push(`  mode: ${config.guardClaw.sensitivity === "S3" ? "local" : "cloud"}`);
  yaml.push(`  max_concurrent_agents: ${config.useCase.agents.filter((a) => a.enabled).length}`);
  yaml.push(`  timeout_seconds: 120`);
  yaml.push(`  retry_on_failure: true`);
  yaml.push(`  max_retries: 3`);
  yaml.push(``);
  yaml.push(`routing:`);

  if (config.guardClaw.sensitivity === "S3") {
    yaml.push(`  # S3: local-only routing`);
    yaml.push(`  provider: ollama`);
    yaml.push(`  endpoint: http://localhost:11434`);
    yaml.push(`  allow_external: false`);
  } else if (config.guardClaw.sensitivity === "S2") {
    yaml.push(`  # S2: cloud with PII redaction`);
    yaml.push(`  provider: ${Object.keys(config.providers)[0] || "anthropic"}`);
    yaml.push(`  pii_redaction: true`);
    yaml.push(`  allow_external: true`);
  } else {
    yaml.push(`  # S1: standard cloud routing`);
    yaml.push(`  provider: ${Object.keys(config.providers)[0] || "anthropic"}`);
    yaml.push(`  pii_redaction: false`);
    yaml.push(`  allow_external: true`);
  }

  yaml.push(``);
  yaml.push(`coordination:`);
  yaml.push(`  handoff_strategy: sequential`);
  yaml.push(`  shared_context: true`);
  yaml.push(`  audit_log: ${config.guardClaw.sensitivity !== "S1"}`);

  return yaml.join("\n");
}

export function generateGuardClawConfig(config: WizardConfig): string {
  const yaml: string[] = [];
  const { sensitivity } = config.guardClaw;

  yaml.push(`# GuardClaw configuration`);
  yaml.push(`# Generated: ${new Date().toISOString()}`);
  yaml.push(`# Sensitivity level: ${sensitivity}`);
  yaml.push(``);
  yaml.push(`guardclaw:`);
  yaml.push(`  sensitivity: ${sensitivity}`);
  yaml.push(``);

  if (sensitivity === "S1") {
    yaml.push(`  # S1 — Público: sin restricciones`);
    yaml.push(`  pii_redaction: false`);
    yaml.push(`  local_only: false`);
    yaml.push(`  logging:`);
    yaml.push(`    level: full`);
    yaml.push(`    retain_days: 30`);
    yaml.push(`  data_routing:`);
    yaml.push(`    allow_cloud: true`);
    yaml.push(`    allow_external_apis: true`);
  } else if (sensitivity === "S2") {
    yaml.push(`  # S2 — Privado: redacción de PII antes de enviar al cloud`);
    yaml.push(`  pii_redaction: true`);
    yaml.push(`  local_only: false`);
    yaml.push(`  pii_patterns:`);
    yaml.push(`    - type: email`);
    yaml.push(`      action: redact`);
    yaml.push(`    - type: phone`);
    yaml.push(`      action: redact`);
    yaml.push(`    - type: full_name`);
    yaml.push(`      action: tokenize`);
    yaml.push(`    - type: id_number`);
    yaml.push(`      action: redact`);
    yaml.push(`    - type: address`);
    yaml.push(`      action: redact`);
    yaml.push(`  logging:`);
    yaml.push(`    level: anonymized`);
    yaml.push(`    retain_days: 90`);
    yaml.push(`  data_routing:`);
    yaml.push(`    allow_cloud: true`);
    yaml.push(`    allow_external_apis: false`);
    yaml.push(`    require_tls: true`);
  } else {
    yaml.push(`  # S3 — Sensible/Regulado: ejecución local únicamente`);
    yaml.push(`  pii_redaction: true`);
    yaml.push(`  local_only: true`);
    yaml.push(`  logging:`);
    yaml.push(`    level: minimal`);
    yaml.push(`    retain_days: 365`);
    yaml.push(`    storage: local`);
    yaml.push(`  data_routing:`);
    yaml.push(`    allow_cloud: false`);
    yaml.push(`    allow_external_apis: false`);
    yaml.push(`    require_local_llm: true`);
    yaml.push(`    local_llm_endpoint: http://localhost:11434`);
    yaml.push(`  compliance:`);
    yaml.push(`    hipaa: true`);
    yaml.push(`    pci_dss: true`);
    yaml.push(`    audit_trail: true`);
  }

  return yaml.join("\n");
}

export function generateEnvFile(config: WizardConfig): string {
  const lines: string[] = [];

  lines.push(`# OpenClaw Enterprise Stack — Environment Variables`);
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push(`# Version: 2026.3`);
  lines.push(``);

  // Providers
  if (config.providers.anthropic?.sessionToken) {
    lines.push(`# Anthropic Claude (Session Token)`);
    lines.push(`ANTHROPIC_SESSION_TOKEN=your-session-token-here`);
    lines.push(``);
  } else if (config.providers.anthropic?.apiKey) {
    lines.push(`# Anthropic Claude (API Key)`);
    lines.push(`ANTHROPIC_API_KEY=sk-ant-api-...`);
    lines.push(``);
  }

  if (config.providers.openai) {
    lines.push(`# OpenAI GPT`);
    lines.push(`OPENAI_API_KEY=sk-...`);
    lines.push(``);
  }

  if (config.providers.google) {
    lines.push(`# Google Gemini`);
    lines.push(`GOOGLE_API_KEY=AIza...`);
    lines.push(``);
  }

  if (config.providers.axet) {
    lines.push(`# Axet Corporate Provider (Okta)`);
    lines.push(`AXET_GATEWAY_URL=${config.providers.axet.axetGatewayUrl}`);
    lines.push(`AXET_GATEWAY_TOKEN=your-gateway-token-here`);
    lines.push(`OKTA_ISSUER=${config.providers.axet.oktaIssuer}`);
    lines.push(`OKTA_CLIENT_ID=${config.providers.axet.oktaClientId}`);
    lines.push(`OKTA_SCOPE=${config.providers.axet.oktaScope}`);
    lines.push(`AXET_API_BASE_URL=${config.providers.axet.axetApiBaseUrl}`);
    lines.push(``);
  }

  // Channels
  if (config.channels.telegram) {
    lines.push(`# Telegram Bot`);
    lines.push(`TELEGRAM_BOT_TOKEN=123456:ABC-DEF...`);
    lines.push(``);
  }

  if (config.channels.discord) {
    lines.push(`# Discord Bot`);
    lines.push(`DISCORD_BOT_TOKEN=...`);
    lines.push(``);
  }

  // GuardClaw specific
  if (config.guardClaw.sensitivity === "S3") {
    lines.push(`# GuardClaw S3 — local LLM required`);
    lines.push(`OLLAMA_BASE_URL=http://localhost:11434`);
    lines.push(``);
  }

  return lines.join("\n");
}

export function generateInstallScript(): string {
  return `#!/usr/bin/env bash
# OpenClaw stack installer — modo "bundle por operador".
#
# Si este script está dentro de un bundle (junto a autonomous-agents/, clawcrew/
# y ai-office/), COPIA los repos desde ahí (BUNDLE_MODE). Si no, intenta
# git clone (LEGACY_MODE) — requiere repos públicos, hoy NO disponible.
#
# Pasos:
#   1. Prerequisites (Node 18+, npm, git)
#   2. Acquire repos (bundle copy o git clone)
#   3. OpenClaw gateway (npm i -g openclaw si falta + bootstrap config)
#   4. npm ci (bridge + overlay UI)
#   5. Generate .env files (bridge + overlay coherentes)
#   6. Configure overlay agents (configure-overlay.js apply)
#   7. Start services (gateway + bridge + overlay UI) + abrir browser
#
# Usage:
#   ./install.sh            # full install
#   ./install.sh --dry-run  # preview what would happen
#   ./install.sh --no-browser  # skip opening browser at the end
set -euo pipefail

GREEN='\\033[0;32m'; RED='\\033[0;31m'; YELLOW='\\033[1;33m'
CYAN='\\033[0;36m'; BOLD='\\033[1m'; RESET='\\033[0m'
ok()   { echo -e "\${GREEN}  ✓\${RESET} $*"; }
err()  { echo -e "\${RED}  ✗\${RESET} $*" >&2; }
warn() { echo -e "\${YELLOW}  !\${RESET} $*"; }
info() { echo -e "\${CYAN}  →\${RESET} $*"; }
hdr()  { echo -e "\\n\${BOLD}$*\${RESET}"; }

DRY_RUN=false
OPEN_BROWSER=true
for arg in "$@"; do
  [[ "\$arg" == "--dry-run" ]] && DRY_RUN=true
  [[ "\$arg" == "--no-browser" ]] && OPEN_BROWSER=false
done
run() { \$DRY_RUN && echo -e "\${YELLOW}  [dry-run]\${RESET} \$*" || "\$@"; }

echo -e "\${BOLD}"
echo "╔══════════════════════════════════════════════════╗"
echo "║   autonomous-agents — Work Console Installer     ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "\${RESET}"
$DRY_RUN && warn "DRY-RUN mode — no changes will be made\\n"

# Repos (LEGACY mode — requiere public repos, hoy no se usa)
REPO_URL="https://github.com/4BitsEngineering/autonomous-agents.git"
CLAWCREW_REPO="https://github.com/4BitsEngineering/clawcrew.git"
AI_OFFICE_REPO="https://github.com/4BitsEngineering/ai-office.git"

SCRIPT_DIR="\$(cd "\$(dirname "\$0")" && pwd)"
# Todas las rutas y puertos respetan env override para permitir instalaciones
# paralelas (operator probando en su laptop con bridge real corriendo, dos
# overlays en el mismo PC, etc.). Si no están en env, defaults sensatos.
STACK_ROOT="\${STACK_ROOT:-\$HOME/openclaw-stack}"
INSTALL_DIR="\$STACK_ROOT/autonomous-agents"
CLAWCREW_DIR="\$STACK_ROOT/clawcrew"
AI_OFFICE_DIR="\$STACK_ROOT/ai-office"
OVERLAYS_DIR="\$STACK_ROOT/overlays"
WORK_CONSOLE="\$INSTALL_DIR/work-console"
OVERLAY_WEB_DIR="\$AI_OFFICE_DIR/web"
LOG_DIR="\$STACK_ROOT/logs"
PID_DIR="\$STACK_ROOT/pids"
OPENCLAW_HOME="\${OPENCLAW_HOME:-\$HOME/.openclaw}"
OPENCLAW_OVERLAY_DIR="\${OPENCLAW_OVERLAY_DIR:-\$OPENCLAW_HOME/ai-office}"
OPENCLAW_CONFIG="\$OPENCLAW_OVERLAY_DIR/openclaw.json"
ENV_FILE="\$WORK_CONSOLE/.env"
ENV_EXAMPLE_AI_OFFICE="\$INSTALL_DIR/env.example.ai-office"
OVERLAY_CONFIG="\${OVERLAY_CONFIG:-\$SCRIPT_DIR/overlay-config.json}"
BRIDGE_PORT="\${BRIDGE_PORT:-3700}"
UI_PORT="\${UI_PORT:-8080}"
GATEWAY_PORT="\${GATEWAY_PORT:-18789}"
OVERLAY_UI_PORT="\${OVERLAY_UI_PORT:-3001}"

mkdir -p "\$STACK_ROOT" "\$OVERLAYS_DIR" "\$LOG_DIR" "\$PID_DIR"

# !! Hardcoded demo key (REMOVER cuando wizard step-1 capture providers).
# Se inyecta tanto en el .env (bridge) como inline al arrancar el gateway
# para que las instalaciones managed-asistidas arranquen vivas con un modelo
# Xiaomi MiMo funcional sin intervención manual del cliente.
XIAOMI_API_KEY_DEMO="${DEMO_XIAOMI_API_KEY_HARDCODED}"

# ── Detect BUNDLE_MODE ──────────────────────────────────────────────────────
# Si junto al script viven los 3 repos, asumimos que estamos dentro de un
# bundle pre-empaquetado por el operador (prepare-client-bundle.js). En ese
# caso COPIAMOS desde ahí en vez de hacer git clone (que necesitaría repos
# públicos y credenciales).
BUNDLE_MODE=false
if [ -d "\$SCRIPT_DIR/autonomous-agents/work-console" ] \\
   && [ -d "\$SCRIPT_DIR/clawcrew/agents" ] \\
   && [ -d "\$SCRIPT_DIR/ai-office/web" ]; then
  BUNDLE_MODE=true
fi

# ── Step 1: Prerequisites ──────────────────────────────────────────────────────
hdr "1/7  Checking prerequisites"
\$BUNDLE_MODE && ok "BUNDLE_MODE detected (sources at \$SCRIPT_DIR)" \\
              || info "LEGACY_MODE — will try git clone from public repos"

if ! command -v node &>/dev/null; then
  err "Node.js not found. Install Node.js 18+ from https://nodejs.org"; exit 1
fi
NODE_VERSION=\$(node -e "process.stdout.write(process.version.slice(1).split('.')[0])")
[[ "\$NODE_VERSION" -lt 18 ]] && { err "Node.js \$NODE_VERSION found, need >= 18"; exit 1; }
ok "Node.js \$(node --version)"

command -v npm &>/dev/null || { err "npm not found"; exit 1; }
ok "npm \$(npm --version)"

command -v git &>/dev/null || { err "git not found — https://git-scm.com"; exit 1; }
ok "git \$(git --version | awk '{print \$3}')"

JQ_AVAILABLE=false; command -v jq &>/dev/null && JQ_AVAILABLE=true

# JSON helpers — node -e como fallback (Node ya es prereq, evitamos depender
# de jq o python3 que en Windows típicos NO están).
#
# Truco crítico: en MSYS/Git-Bash los paths POSIX (/c/Users/X) Node los
# interpreta como C:\c\Users\X (busca un dir literal "c" en el cwd). Hay que
# normalizar a Windows mixed-mode (C:/Users/X) con cygpath -m. Y pasar los
# args via argv (no interpolados en el string JS) para no romper con
# backslashes que Node lee como escapes.
_norm_path() {
  local p="\$1"
  if command -v cygpath &>/dev/null; then
    cygpath -m "\$p" 2>/dev/null || echo "\$p"
  else
    echo "\$p"
  fi
}
json_read() {
  local file
  file=\$(_norm_path "\$1")
  local pathexpr="\$2"   # notación dot: gateway.auth.token
  node -e 'try{const d=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const parts=process.argv[2].split(".");let v=d;for(const p of parts)v=v?v[p]:undefined;process.stdout.write(v==null?"":String(v));}catch(e){process.exit(1);}' "\$file" "\$pathexpr" 2>/dev/null || echo ""
}
json_array_length() {
  local file
  file=\$(_norm_path "\$1")
  local pathexpr="\$2"
  node -e 'try{const d=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const parts=process.argv[2].split(".");let v=d;for(const p of parts)v=v?v[p]:undefined;process.stdout.write(String(Array.isArray(v)?v.length:0));}catch(e){process.stdout.write("0");}' "\$file" "\$pathexpr" 2>/dev/null || echo "0"
}

# Dry-run-aware directory check. En dry-run, si el dir no existe asumimos
# que un paso previo lo crearía y warneamos sin abortar. En run real, error
# fatal con código 1.
require_dir() {
  local d="\$1"; local hint="\$2"
  if [ -d "\$d" ]; then return 0; fi
  if \$DRY_RUN; then
    warn "\$hint not present yet (would be created by an earlier step in real run) — skipping deeper checks"
    return 1
  fi
  err "\$hint not found: \$d"
  exit 1
}

# ── Step 2: Acquire repos (BUNDLE copy or LEGACY clone) ───────────────────────
hdr "2/7  Repositories"

acquire_repo() {
  local name="\$1"
  local src="\$2"
  local dst="\$3"
  local repo_url="\$4"
  if [ -d "\$dst" ]; then
    if \$BUNDLE_MODE; then
      ok "\$name already at \$dst (skipping copy)"
    elif [ -d "\$dst/.git" ]; then
      info "Updating \$name from remote..."
      run bash -c "cd '\$dst' && git pull --ff-only"
    else
      ok "\$name already at \$dst"
    fi
    return
  fi
  if \$BUNDLE_MODE; then
    info "Copying \$name from bundle..."
    run cp -R "\$src" "\$dst"
    ok "\$name copied to \$dst"
  else
    info "Cloning \$name from \$repo_url..."
    run git clone "\$repo_url" "\$dst" || {
      err "Failed to clone \$name — repo may be private. Use BUNDLE_MODE."
      exit 1
    }
    ok "\$name cloned to \$dst"
  fi
}

acquire_repo "autonomous-agents" "\$SCRIPT_DIR/autonomous-agents" "\$INSTALL_DIR" "\$REPO_URL"
acquire_repo "clawcrew"          "\$SCRIPT_DIR/clawcrew"          "\$CLAWCREW_DIR" "\$CLAWCREW_REPO"
acquire_repo "ai-office"         "\$SCRIPT_DIR/ai-office"         "\$AI_OFFICE_DIR" "\$AI_OFFICE_REPO"

# ── Step 3: OpenClaw gateway (install if missing + bootstrap config) ──────────
hdr "3/7  OpenClaw gateway"

GATEWAY_TOKEN=""
GATEWAY_URL="http://localhost:\$GATEWAY_PORT"

# 3.a — install openclaw global if missing
if ! command -v openclaw &>/dev/null; then
  info "openclaw CLI not in PATH — installing globally via npm..."
  if \$DRY_RUN; then
    info "[dry-run] would run: npm install -g openclaw"
  else
    npm install -g openclaw || {
      err "npm install -g openclaw failed. Check npm prefix permissions."
      err "Workaround: install Node via nvm so global packages don't need sudo."
      exit 1
    }
    ok "openclaw installed: \$(openclaw --version 2>/dev/null || echo "(installed)")"
  fi
else
  ok "openclaw already in PATH (\$(openclaw --version 2>/dev/null || echo "version unknown"))"
fi

# 3.b — bootstrap overlay-specific openclaw.json (separate from HOME default)
\$DRY_RUN || mkdir -p "\$OPENCLAW_OVERLAY_DIR"
if [ -f "\$OPENCLAW_CONFIG" ]; then
  ok "Found existing \$OPENCLAW_CONFIG"
  # Usamos node -e (Node es prereq); evitamos depender de jq/python3 que
  # en Windows estándar no están instalados.
  GATEWAY_TOKEN=\$(json_read "\$OPENCLAW_CONFIG" "gateway.auth.token")
  DETECTED_PORT=\$(json_read "\$OPENCLAW_CONFIG" "gateway.port")
  [ -n "\$DETECTED_PORT" ] && GATEWAY_PORT="\$DETECTED_PORT"
else
  info "Bootstrapping new \$OPENCLAW_CONFIG with fresh token..."
  GATEWAY_TOKEN=\$(node -e "console.log(require('crypto').randomBytes(24).toString('hex'))")
  if ! \$DRY_RUN; then
    cat > "\$OPENCLAW_CONFIG" <<JSON
{
  "\$schema": "https://docs.openclaw.ai/schema/openclaw.json",
  "gateway": {
    "mode": "local",
    "port": \$GATEWAY_PORT,
    "auth": {
      "mode": "token",
      "token": "\$GATEWAY_TOKEN"
    },
    "controlUi": {
      "allowInsecureAuth": true,
      "dangerouslyDisableDeviceAuth": true
    },
    "reload": { "mode": "hybrid" },
    "remote": { "token": "\$GATEWAY_TOKEN" }
  },
  "discovery": {
    "mdns": { "mode": "off" }
  },
  "agents": { "list": [] },
  "tools": {
    "profile": "messaging"
  },
  "channels": {
    "slack": { "enabled": false }
  }
}
JSON
    ok "Created \$OPENCLAW_CONFIG"
  else
    info "[dry-run] would create \$OPENCLAW_CONFIG with fresh token"
  fi
fi
GATEWAY_URL="http://localhost:\$GATEWAY_PORT"
[ -n "\$GATEWAY_TOKEN" ] && ok "Gateway token ready (\${GATEWAY_TOKEN:0:8}...)" \\
                        || warn "Gateway token still empty — bridge auth will fail"

# ── Step 4: Dependencies (bridge + overlay UI) ────────────────────────────────
hdr "4/7  Dependencies"

# 4.a — bridge dependencies
if require_dir "\$WORK_CONSOLE" "work-console/"; then
  if [ ! -d "\$WORK_CONSOLE/node_modules" ]; then
    info "Running npm ci in work-console/ (bridge)..."
    run bash -c "cd '\$WORK_CONSOLE' && npm ci"
    \$DRY_RUN || ok "Bridge dependencies installed"
  else
    ok "work-console/node_modules present (skipping npm ci)"
  fi
fi

# 4.b — overlay UI dependencies
if require_dir "\$OVERLAY_WEB_DIR" "ai-office/web/"; then
  if [ ! -d "\$OVERLAY_WEB_DIR/node_modules" ]; then
    info "Running npm ci in ai-office/web/ (overlay UI)... (this can take a few minutes)"
    run bash -c "cd '\$OVERLAY_WEB_DIR' && npm ci"
    \$DRY_RUN || ok "Overlay UI dependencies installed"
  else
    ok "ai-office/web/node_modules present (skipping npm ci)"
  fi
fi

# ── Step 5: Generate .env files (bridge + overlay coherent paths) ─────────────
hdr "5/7  Environment files"

if [ -f "\$ENV_FILE" ]; then
  warn ".env already exists — skipping (delete \$ENV_FILE to regenerate)"
else
  if [ ! -f "\$ENV_EXAMPLE_AI_OFFICE" ]; then
    if \$DRY_RUN; then
      warn "[dry-run] env.example.ai-office no presente aún (would be in INSTALL_DIR after step 2)"
    else
      err "\$ENV_EXAMPLE_AI_OFFICE not found — bundle missing env.example.ai-office"
      exit 1
    fi
  fi
  if \$DRY_RUN; then
    info "[dry-run] Would generate \$ENV_FILE from env.example.ai-office with resolved paths"
  else
    cp "\$ENV_EXAMPLE_AI_OFFICE" "\$ENV_FILE"
    # Cross-platform sed (BSD on macOS needs '' after -i; GNU doesn't).
    SED_INPLACE=(-i)
    if [[ "\$OSTYPE" == "darwin"* ]]; then SED_INPLACE=(-i ''); fi
    # Substitute paths absolutos del overlay
    sed "\${SED_INPLACE[@]}" "s|/absolute/path/to/ai-office|\$AI_OFFICE_DIR|g" "\$ENV_FILE"
    # Storage isolation paths
    sed "\${SED_INPLACE[@]}" "s|~/.openclaw/ai-office|\$OPENCLAW_OVERLAY_DIR|g" "\$ENV_FILE"
    # Gateway token + URL + ports
    [ -n "\$GATEWAY_TOKEN" ] && sed "\${SED_INPLACE[@]}" "s|^GATEWAY_TOKEN=.*|GATEWAY_TOKEN=\$GATEWAY_TOKEN|" "\$ENV_FILE"
    sed "\${SED_INPLACE[@]}" "s|^GATEWAY_URL=.*|GATEWAY_URL=\$GATEWAY_URL|" "\$ENV_FILE"
    sed "\${SED_INPLACE[@]}" "s|^GATEWAY_WS_URL=.*|GATEWAY_WS_URL=ws://localhost:\$GATEWAY_PORT|" "\$ENV_FILE"
    sed "\${SED_INPLACE[@]}" "s|^BRIDGE_PORT=.*|BRIDGE_PORT=\$BRIDGE_PORT|" "\$ENV_FILE"
    # CORS / iframe ancestors al overlay UI port
    if ! grep -q "^OVERLAY_HOSTS=" "\$ENV_FILE"; then
      echo "" >> "\$ENV_FILE"
      echo "# Auto-añadidos por install.sh (overlay UI en :\$OVERLAY_UI_PORT)" >> "\$ENV_FILE"
      echo "OVERLAY_HOSTS=http://localhost:\$OVERLAY_UI_PORT,http://127.0.0.1:\$OVERLAY_UI_PORT" >> "\$ENV_FILE"
      echo "CORS_ORIGINS=http://localhost:\$OVERLAY_UI_PORT,http://127.0.0.1:\$OVERLAY_UI_PORT" >> "\$ENV_FILE"
      # XIAOMI_API_KEY hardcoded (variable XIAOMI_API_KEY_DEMO al inicio del
      # script; ver constante DEMO_XIAOMI_API_KEY_HARDCODED en lib/generators.ts
      # del configurator — REMOVER cuando wizard step-1 capture providers).
      echo "XIAOMI_API_KEY=\$XIAOMI_API_KEY_DEMO" >> "\$ENV_FILE"
      echo "ELEVENLABS_API_KEY=dummy" >> "\$ENV_FILE"
    fi
    ok "Generated \$ENV_FILE (paths resueltos: AI_OFFICE_DIR, OPENCLAW_CONFIG, etc.)"
  fi
fi

# .env.local del overlay UI (para que Next.js apunte al bridge)
OVERLAY_ENV_LOCAL="\$OVERLAY_WEB_DIR/.env.local"
if [ -f "\$OVERLAY_ENV_LOCAL" ]; then
  warn "\$OVERLAY_ENV_LOCAL exists — skipping"
else
  if ! \$DRY_RUN; then
    cat > "\$OVERLAY_ENV_LOCAL" <<ENVEOF
# Generated by install.sh
NEXT_PUBLIC_BRIDGE_URL=http://localhost:\$BRIDGE_PORT
NEXT_PUBLIC_BRIDGE_WS_URL=ws://localhost:\$BRIDGE_PORT
PORT=\$OVERLAY_UI_PORT
ENVEOF
    ok "Generated \$OVERLAY_ENV_LOCAL"
  fi
fi

# ── Step 6: Install agents (overlay-config.json → configure-overlay.js) ───────
hdr "6/7  Configure overlay agents"

if [ ! -f "\$OVERLAY_CONFIG" ]; then
  warn "overlay-config.json not found at \$OVERLAY_CONFIG — skipping agent install"
  warn "(if you generated one, drop it next to install.sh or set OVERLAY_CONFIG env)"
else
  AGENT_COUNT=\$(json_array_length "\$OVERLAY_CONFIG" "agents")
  if [ "\$AGENT_COUNT" -eq 0 ]; then
    warn "overlay-config.json has 0 agents — skipping configure-overlay invocation"
  else
    info "Installing \$AGENT_COUNT agents into the LIVE overlay (\$AI_OFFICE_DIR)"
    # Nota: instalamos AGENTES en el overlay vivo (ai-office), NO en una copia
    # bajo overlays/. Eso asegura que agent-registry.json + workspaces nuevos
    # se sumen al overlay que el UI sirve. El bridge .env apunta a ese dir.
    run bash -c "cd '\$WORK_CONSOLE' && node scripts/configure-overlay.js apply \\
      --config '\$OVERLAY_CONFIG' \\
      --library '\$CLAWCREW_DIR' \\
      --overlay '\$AI_OFFICE_DIR' \\
      --openclaw-config '\$OPENCLAW_CONFIG' \\
      --force"
    ok "Agents installed into \$AI_OFFICE_DIR"
  fi
fi

# ── Step 7: Start services + open browser ─────────────────────────────────────
hdr "7/7  Start services"

wait_for_url() {
  local url="\$1"; local label="\$2"; local tries="\${3:-20}"
  info "Waiting for \$label..."
  for i in \$(seq 1 "\$tries"); do
    if curl -sf --max-time 2 "\$url" &>/dev/null; then
      ok "\$label is up (\$url)"; return 0
    fi
    sleep 1
  done
  warn "\$label timed out — check \$LOG_DIR/\$(basename "\$url" | tr -d ':/.').log"
  return 1
}

start_bg() {
  local label="\$1"; shift
  local log="\$LOG_DIR/\${label}.log"; local pid="\$PID_DIR/\${label}.pid"
  if \$DRY_RUN; then
    info "[dry-run] Would start \$label: \$*"
    return
  fi
  nohup "\$@" >"\$log" 2>&1 &
  echo \$! > "\$pid"
  ok "Started \$label (pid \$(cat "\$pid"), log \$log)"
}

if \$DRY_RUN; then
  info "[dry-run] Would start gateway + bridge + overlay UI and open browser"
else
  # 7.a — Gateway
  if ! curl -sf --max-time 1 "http://localhost:\$GATEWAY_PORT/" &>/dev/null; then
    start_bg gateway bash -c "OPENCLAW_CONFIG_PATH='\$OPENCLAW_CONFIG' XIAOMI_API_KEY='\$XIAOMI_API_KEY_DEMO' openclaw gateway --port \$GATEWAY_PORT"
    sleep 3
  else
    ok "Gateway already running on :\$GATEWAY_PORT"
  fi

  # 7.b — Bridge (source .env del overlay para que use AI_OFFICE_DIR)
  if ! curl -sf --max-time 1 "http://localhost:\$BRIDGE_PORT/api/health" &>/dev/null; then
    start_bg bridge bash -c "cd '\$WORK_CONSOLE' && set -a && source '\$ENV_FILE' && set +a && node bridge/server.js"
    wait_for_url "http://localhost:\$BRIDGE_PORT/api/health" "Bridge API"
  else
    ok "Bridge already running on :\$BRIDGE_PORT"
  fi

  # 7.c — Overlay UI Next.js
  if ! curl -sf --max-time 1 "http://localhost:\$OVERLAY_UI_PORT" &>/dev/null; then
    # Build only if .next missing (build is slow, cliente lo agradece la 2ª vez)
    if [ ! -d "\$OVERLAY_WEB_DIR/.next" ]; then
      info "Building overlay UI (first time, takes 1-3 min)..."
      run bash -c "cd '\$OVERLAY_WEB_DIR' && npm run build"
    fi
    start_bg overlay-ui bash -c "cd '\$OVERLAY_WEB_DIR' && PORT=\$OVERLAY_UI_PORT npm run start"
    wait_for_url "http://localhost:\$OVERLAY_UI_PORT" "Overlay UI"
  else
    ok "Overlay UI already running on :\$OVERLAY_UI_PORT"
  fi

  # 7.d — Open browser
  if \$OPEN_BROWSER; then
    OVERLAY_URL="http://localhost:\$OVERLAY_UI_PORT"
    info "Opening \$OVERLAY_URL in your browser..."
    case "\$OSTYPE" in
      linux*)        command -v xdg-open >/dev/null && xdg-open "\$OVERLAY_URL" &>/dev/null & ;;
      darwin*)       open "\$OVERLAY_URL" ;;
      msys*|cygwin*) start "" "\$OVERLAY_URL" ;;
      *)             info "(could not detect OS for auto-open — visit \$OVERLAY_URL manually)" ;;
    esac
  fi
fi

echo ""
echo -e "\${BOLD}╔══════════════════════════════════════════════════╗\${RESET}"
echo -e "\${BOLD}║   Installation complete                          ║\${RESET}"
echo -e "\${BOLD}╚══════════════════════════════════════════════════╝\${RESET}"
echo ""
echo -e "  \${CYAN}Overlay UI:\${RESET}     http://localhost:\$OVERLAY_UI_PORT  ← Open this"
echo -e "  \${CYAN}Bridge API:\${RESET}     http://localhost:\$BRIDGE_PORT/api/health"
echo -e "  \${CYAN}Work Console:\${RESET}   http://localhost:\$UI_PORT  (técnico, dev)"
echo -e "  \${CYAN}Gateway:\${RESET}        \$GATEWAY_URL"
echo ""
echo -e "  \${CYAN}Logs:\${RESET}    \$LOG_DIR/"
echo -e "  \${CYAN}PIDs:\${RESET}    \$PID_DIR/"
echo -e "  \${CYAN}Stop:\${RESET}    kill \\\$(cat \$PID_DIR/*.pid)"
echo -e "  \${CYAN}Restart:\${RESET} bash install.sh  (re-runs idempotently)"
echo ""
`;
}
