import { WizardConfig } from "./wizard-context";

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

  lines.push(`# autonomous-agents / Work Console — Environment Variables`);
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push(`# Place this file at: ~/autonomous-agents/work-console/.env`);
  lines.push(``);

  // OpenClaw Gateway (autonomous-agents connects to it)
  const gatewayUrl = config.openclaw?.gatewayUrl || "http://localhost:18789";
  const gatewayToken = config.openclaw?.gatewayToken || "";
  lines.push(`# --- OpenClaw Gateway ---`);
  lines.push(`GATEWAY_URL=${gatewayUrl}`);
  lines.push(`GATEWAY_WS_URL=${gatewayUrl.replace(/^http/, "ws")}`);
  lines.push(`GATEWAY_TOKEN=${gatewayToken || "# Pega aquí el token de ~/.openclaw/openclaw.json > gateway.auth.token"}`);
  lines.push(`DISABLE_GATEWAY=false`);
  lines.push(``);

  // Bridge
  lines.push(`# --- Bridge ---`);
  lines.push(`BRIDGE_PORT=3700`);
  lines.push(``);

  // GuardClaw
  lines.push(`# --- GuardClaw ---`);
  lines.push(`GUARDCLAW_ENABLED=true`);
  lines.push(`GUARDCLAW_LOCAL_AGENT=corp-compliance-v1`);
  lines.push(``);

  // Providers (for OpenClaw itself, not the bridge — kept for reference)
  if (config.providers.anthropic?.sessionToken) {
    lines.push(`# Anthropic Claude (Session Token) — usado por OpenClaw`);
    lines.push(`ANTHROPIC_SESSION_TOKEN=your-session-token-here`);
    lines.push(``);
  } else if (config.providers.anthropic?.apiKey) {
    lines.push(`# Anthropic Claude (API Key) — usado por OpenClaw`);
    lines.push(`ANTHROPIC_API_KEY=sk-ant-api-...`);
    lines.push(``);
  }

  if (config.providers.openai) {
    lines.push(`# OpenAI GPT — usado por OpenClaw`);
    lines.push(`OPENAI_API_KEY=sk-...`);
    lines.push(``);
  }

  if (config.providers.google) {
    lines.push(`# Google Gemini — usado por OpenClaw`);
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

  // Connectors (MCP)
  lines.push(`# --- Connectors (MCP servers) ---`);
  if (config.skills.includes("github")) {
    lines.push(`GITHUB_PAT=ghp_xxxx  # GitHub Personal Access Token`);
    lines.push(`GITHUB_WRITE_ENABLED=false`);
  } else {
    lines.push(`# GITHUB_PAT=ghp_xxxx`);
    lines.push(`# GITHUB_WRITE_ENABLED=false`);
  }
  lines.push(`# SLACK_BOT_TOKEN=`);
  lines.push(`# SLACK_NOTIFY_CHANNEL=`);
  lines.push(`# SLACK_WRITE_ENABLED=false`);
  lines.push(`# JIRA_API_TOKEN=`);
  lines.push(`# JIRA_WRITE_ENABLED=false`);
  lines.push(``);

  // Channels
  if (config.channels.telegram) {
    lines.push(`# Telegram Bot — usado por OpenClaw`);
    lines.push(`TELEGRAM_BOT_TOKEN=123456:ABC-DEF...`);
    lines.push(``);
  }

  if (config.channels.discord) {
    lines.push(`# Discord Bot — usado por OpenClaw`);
    lines.push(`DISCORD_BOT_TOKEN=...`);
    lines.push(``);
  }

  // GuardClaw S3
  if (config.guardClaw.sensitivity === "S3") {
    lines.push(`# GuardClaw S3 — local LLM required`);
    lines.push(`OLLAMA_BASE_URL=http://localhost:11434`);
    lines.push(``);
  }

  return lines.join("\n");
}

export function generateInstallScript(config: WizardConfig): string {
  const REPO_URL = "https://github.com/jotajota1302/autonomous-agents.git";
  return `#!/bin/bash
# autonomous-agents — Install Script
# Generated: ${new Date().toISOString()}
# Prerequisito: OpenClaw ya instalado y ejecutándose en localhost:18789

set -euo pipefail

OS="$(uname -s)"
echo "🖥️  Detected OS: $OS"

# ── 1. Verificar dependencias ───────────────────────────────────────────────
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js no encontrado. Instálalo primero: https://nodejs.org"
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "❌ git no encontrado. Instálalo primero."
  exit 1
fi

echo "✅ Node $(node --version) | git $(git --version | awk '{print $3}')"

# ── 2. Verificar que OpenClaw está instalado ────────────────────────────────
OPENCLAW_JSON="$HOME/.openclaw/openclaw.json"
if [ ! -f "$OPENCLAW_JSON" ]; then
  echo ""
  echo "⚠️  No se encontró ~/.openclaw/openclaw.json"
  echo "   Asegúrate de que OpenClaw está instalado y has ejecutado al menos una vez."
  read -p "¿Continuar de todas formas? (y/N): " CONTINUE
  if [[ ! "$CONTINUE" =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# ── 3. Clonar o actualizar autonomous-agents ────────────────────────────────
INSTALL_DIR="$HOME/autonomous-agents"
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "📦 autonomous-agents ya existe — actualizando..."
  git -C "$INSTALL_DIR" pull --ff-only 2>/dev/null || echo "   (sin cambios o conflictos — continuando)"
else
  echo "📦 Clonando autonomous-agents..."
  git clone "${REPO_URL}" "$INSTALL_DIR"
fi

# ── 4. Instalar dependencias del work-console ───────────────────────────────
WORK_CONSOLE="$INSTALL_DIR/work-console"
echo "📦 Instalando dependencias de work-console..."
cd "$WORK_CONSOLE"
npm ci

# ── 5. Leer GATEWAY_TOKEN desde openclaw.json ───────────────────────────────
GATEWAY_TOKEN_VALUE=""
if [ -f "$OPENCLAW_JSON" ]; then
  GATEWAY_TOKEN_VALUE="$(python3 -c "import json; print(json.load(open('$OPENCLAW_JSON')).get('gateway',{}).get('auth',{}).get('token',''))" 2>/dev/null || true)"
fi

# ── 6. Crear work-console/.env ──────────────────────────────────────────────
echo "📝 Generando work-console/.env..."
ENV_FILE="$WORK_CONSOLE/.env"

cat > "$ENV_FILE" << 'ENVEOF'
# autonomous-agents Work Console — generado por install.sh
BRIDGE_PORT=3700
DISABLE_GATEWAY=false
GUARDCLAW_ENABLED=true
GUARDCLAW_LOCAL_AGENT=corp-compliance-v1
ENVEOF

# Append dynamic values
echo "GATEWAY_URL=http://localhost:18789" >> "$ENV_FILE"
echo "GATEWAY_WS_URL=ws://localhost:18789" >> "$ENV_FILE"
echo "GATEWAY_TOKEN=$GATEWAY_TOKEN_VALUE" >> "$ENV_FILE"

echo "  ✅ .env creado con GATEWAY_TOKEN=$([ -n "$GATEWAY_TOKEN_VALUE" ] && echo "detectado" || echo "vacío — edita manualmente")"

if [ -z "$GATEWAY_TOKEN_VALUE" ]; then
  echo ""
  echo "⚠️  GATEWAY_TOKEN está vacío. Edita manualmente $ENV_FILE"
  echo "   Valor en: ~/.openclaw/openclaw.json > gateway.auth.token"
  read -p "¿Quieres editar el .env ahora? (y/N): " EDIT_ENV
  if [[ "$EDIT_ENV" =~ ^[Yy]$ ]]; then
    "\${EDITOR:-nano}" "$ENV_FILE"
  fi
fi

# ── 7. Copiar configs YAML a ~/.openclaw/ ────────────────────────────────────
echo "📝 Copiando configs a ~/.openclaw/..."
mkdir -p "$HOME/.openclaw"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

for f in agents-config.yaml bridge-config.yaml guardclaw-config.yaml openclaw.yaml; do
  if [ -f "$SCRIPT_DIR/$f" ]; then
    cp "$SCRIPT_DIR/$f" "$HOME/.openclaw/$f"
    echo "  ✅ $f → ~/.openclaw/$f"
  fi
done

# ── 8. Arrancar los servicios ───────────────────────────────────────────────
echo ""
echo "🚀 Arrancando autonomous-agents..."
cd "$INSTALL_DIR/work-console"
bash bin/start-all.sh

echo ""
echo "✅ autonomous-agents en marcha."
echo "   Bridge API: http://localhost:3700/api/health"
echo "   Work Console UI: http://localhost:8080"
echo ""

UI_URL="http://localhost:8080"
if [[ "$OS" == "Darwin" ]]; then
  open "$UI_URL" || true
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$UI_URL" || true
fi
`;
}
