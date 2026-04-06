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
  return `#!/bin/bash
# OpenClaw Enterprise Stack — Install Script v3
# Generated: ${new Date().toISOString()}
# Components: OpenClaw + autonomous-agents + GuardClaw

set -e

OS="$(uname -s)"
echo "🖥️  Detected OS: $OS"

if ! command -v npm >/dev/null 2>&1; then
  echo "❌ npm not found. Install Node.js first: https://nodejs.org"
  exit 1
fi

echo "🚀 Installing OpenClaw enterprise stack..."
npm install -g openclaw
npm install -g autonomous-agents
npm install -g guardclaw

mkdir -p ~/.openclaw

echo "📝 Copying config files..."
for f in openclaw.yaml agents-config.yaml bridge-config.yaml guardclaw-config.yaml .env; do
  [ -f "$f" ] && cp "$f" ~/.openclaw/"$f" && echo "  ✅ $f"
done

# Interactive prompts for missing env values
if grep -q "your-session-token-here\\|sk-\\.\\.\\.\\|AIza\\.\\.\\.\\|123456:ABC-DEF\\|change-me-in-production" ~/.openclaw/.env 2>/dev/null; then
  echo ""
  echo "⚠️  Se detectaron placeholders en ~/.openclaw/.env"
  read -p "¿Quieres editar .env ahora? (y/N): " EDIT_ENV
  if [[ "$EDIT_ENV" =~ ^[Yy]$ ]]; then
    \${EDITOR:-nano} ~/.openclaw/.env
  fi
fi

echo ""
echo "🛡️  Iniciando GuardClaw..."
guardclaw start --config ~/.openclaw/guardclaw-config.yaml || true

echo "🌉 Iniciando autonomous-agents bridge..."
autonomous-agents bridge start --config ~/.openclaw/bridge-config.yaml || true

echo "🚀 Iniciando OpenClaw..."
openclaw start --config ~/.openclaw/openclaw.yaml || true

DASH_URL="http://localhost:18789"
echo ""
echo "🌐 Abriendo panel de control: $DASH_URL"
if [[ "$OS" == "Darwin" ]]; then
  open "$DASH_URL" || true
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$DASH_URL" || true
fi

echo ""
echo "✅ Stack empresarial instalado."
echo "   Panel: $DASH_URL"
echo "   Agentes cargados desde: ~/.openclaw/agents-config.yaml"
`;
}
