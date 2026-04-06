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
  return `#!/usr/bin/env bash
# autonomous-agents — Work Console Installer
# Usage:
#   ./install.sh            # full install
#   ./install.sh --dry-run  # preview what would happen
set -euo pipefail

GREEN='\\033[0;32m'; RED='\\033[0;31m'; YELLOW='\\033[1;33m'
CYAN='\\033[0;36m'; BOLD='\\033[1m'; RESET='\\033[0m'
ok()   { echo -e "\${GREEN}  ✓\${RESET} $*"; }
err()  { echo -e "\${RED}  ✗\${RESET} $*" >&2; }
warn() { echo -e "\${YELLOW}  !\${RESET} $*"; }
info() { echo -e "\${CYAN}  →\${RESET} $*"; }
hdr()  { echo -e "\\n\${BOLD}$*\${RESET}"; }

DRY_RUN=false
for arg in "$@"; do [[ "$arg" == "--dry-run" ]] && DRY_RUN=true; done
run() { $DRY_RUN && echo -e "\${YELLOW}  [dry-run]\${RESET} $*" || "$@"; }

echo -e "\${BOLD}"
echo "╔══════════════════════════════════════════════════╗"
echo "║   autonomous-agents — Work Console Installer     ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "\${RESET}"
$DRY_RUN && warn "DRY-RUN mode — no changes will be made\\n"

REPO_URL="https://github.com/jotajota1302/autonomous-agents.git"
INSTALL_DIR="\$HOME/autonomous-agents"
WORK_CONSOLE="\$INSTALL_DIR/work-console"
OPENCLAW_CONFIG="\$HOME/.openclaw/openclaw.json"
ENV_FILE="\$WORK_CONSOLE/.env"
ENV_EXAMPLE="\$INSTALL_DIR/env.example"
BRIDGE_PORT=3700; UI_PORT=8080; GATEWAY_PORT=18789

# ── Step 1: Prerequisites ──────────────────────────────────────────────────────
hdr "1/5  Checking prerequisites"

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

# ── Step 2: Clone or update repo ───────────────────────────────────────────────
hdr "2/5  Repository"

if [ -d "\$INSTALL_DIR/.git" ]; then
  ok "Repo already cloned at \$INSTALL_DIR"
  info "Pulling latest changes..."
  run bash -c "cd '\$INSTALL_DIR' && git pull --ff-only"
else
  info "Cloning \$REPO_URL → \$INSTALL_DIR"
  run git clone "\$REPO_URL" "\$INSTALL_DIR"
  ok "Cloned successfully"
fi

# ── Step 3: Detect OpenClaw token ─────────────────────────────────────────────
hdr "3/5  Detecting OpenClaw configuration"

GATEWAY_TOKEN=""
GATEWAY_URL="http://localhost:\$GATEWAY_PORT"

if [ -f "\$OPENCLAW_CONFIG" ]; then
  ok "Found \$OPENCLAW_CONFIG"
  if \$JQ_AVAILABLE; then
    GATEWAY_TOKEN=\$(jq -r '.gateway.auth.token // ""' "\$OPENCLAW_CONFIG" 2>/dev/null || true)
    DETECTED_PORT=\$(jq -r '.gateway.port // 18789' "\$OPENCLAW_CONFIG" 2>/dev/null || echo "\$GATEWAY_PORT")
  else
    GATEWAY_TOKEN=\$(python3 -c \\
      "import json; d=json.load(open('\$OPENCLAW_CONFIG')); print(d.get('gateway',{}).get('auth',{}).get('token',''))" \\
      2>/dev/null || true)
    DETECTED_PORT=\$(python3 -c \\
      "import json; d=json.load(open('\$OPENCLAW_CONFIG')); print(d.get('gateway',{}).get('port',18789))" \\
      2>/dev/null || echo "\$GATEWAY_PORT")
  fi
  GATEWAY_PORT="\$DETECTED_PORT"
  GATEWAY_URL="http://localhost:\$GATEWAY_PORT"
  [ -n "\$GATEWAY_TOKEN" ] \\
    && ok "Gateway token detected (\${GATEWAY_TOKEN:0:8}...)" \\
    || warn "Token not found in openclaw.json — fill GATEWAY_TOKEN manually in \$ENV_FILE"
else
  warn "~/.openclaw/openclaw.json not found — fill GATEWAY_TOKEN manually in \$ENV_FILE"
fi

# ── Step 4: npm ci + .env ──────────────────────────────────────────────────────
hdr "4/5  Dependencies & environment"

[ -d "\$WORK_CONSOLE" ] || { err "work-console/ not found at \$WORK_CONSOLE"; exit 1; }

if [ ! -d "\$WORK_CONSOLE/node_modules" ]; then
  info "Running npm ci in work-console/"
  run bash -c "cd '\$WORK_CONSOLE' && npm ci"
  ok "Dependencies installed"
else
  ok "node_modules already present (skipping npm ci)"
fi

if [ -f "\$ENV_FILE" ]; then
  warn ".env already exists — skipping (delete it to regenerate)"
else
  if [ -f "\$ENV_EXAMPLE" ]; then
    if \$DRY_RUN; then
      info "[dry-run] Would create \$ENV_FILE from env.example"
    else
      cp "\$ENV_EXAMPLE" "\$ENV_FILE"
      if [ -n "\$GATEWAY_TOKEN" ]; then
        sed -i '' "s|^GATEWAY_TOKEN=.*|GATEWAY_TOKEN=\$GATEWAY_TOKEN|" "\$ENV_FILE" 2>/dev/null || \\
        sed -i    "s|^GATEWAY_TOKEN=.*|GATEWAY_TOKEN=\$GATEWAY_TOKEN|" "\$ENV_FILE"
      fi
      sed -i '' "s|^GATEWAY_URL=.*|GATEWAY_URL=\$GATEWAY_URL|" "\$ENV_FILE" 2>/dev/null || \\
      sed -i    "s|^GATEWAY_URL=.*|GATEWAY_URL=\$GATEWAY_URL|" "\$ENV_FILE"
      ok "Created \$ENV_FILE"
    fi
  else
    if ! \$DRY_RUN; then
      printf 'GATEWAY_TOKEN=%s\\nGATEWAY_URL=%s\\nBRIDGE_PORT=%s\\n' \\
        "\$GATEWAY_TOKEN" "\$GATEWAY_URL" "\$BRIDGE_PORT" > "\$ENV_FILE"
      ok "Created minimal \$ENV_FILE"
    fi
  fi
fi

# ── Step 5: Start services ─────────────────────────────────────────────────────
hdr "5/5  Start services"

if \$DRY_RUN; then
  info "[dry-run] Would prompt to start services"
else
  echo -ne "\${CYAN}  →\${RESET} Start Work Console now? [Y/n] "
  read -r REPLY; REPLY="\${REPLY:-Y}"
  if [[ "\$REPLY" =~ ^[Yy]\$ ]]; then
    START_SCRIPT="\$WORK_CONSOLE/bin/start-all.sh"
    if [ -f "\$START_SCRIPT" ]; then
      bash "\$START_SCRIPT"
      info "Waiting for API health check (http://localhost:\$BRIDGE_PORT/api/health)..."
      for i in \$(seq 1 8); do
        if curl -sf --max-time 2 "http://localhost:\$BRIDGE_PORT/api/health" &>/dev/null; then
          ok "API is healthy at http://localhost:\$BRIDGE_PORT/api/health"; break
        fi
        sleep 1
        [ "\$i" -eq 8 ] && warn "Health check timed out — check logs in work-console/.pids/"
      done
    else
      warn "start-all.sh not found — try: cd \$WORK_CONSOLE && npm start"
    fi
  else
    info "Skipped. Start later: cd \$WORK_CONSOLE && ./bin/start-all.sh"
  fi
fi

echo ""
echo -e "\${BOLD}╔══════════════════════════════════════════════════╗\${RESET}"
echo -e "\${BOLD}║   Installation complete                          ║\${RESET}"
echo -e "\${BOLD}╚══════════════════════════════════════════════════╝\${RESET}"
echo ""
echo -e "  \${CYAN}UI:\${RESET}      http://localhost:\$UI_PORT"
echo -e "  \${CYAN}API:\${RESET}     http://localhost:\$BRIDGE_PORT/api/health"
echo -e "  \${CYAN}Gateway:\${RESET} \$GATEWAY_URL"
echo ""
echo -e "  \${CYAN}Start:\${RESET}   cd \$WORK_CONSOLE && ./bin/start-all.sh"
echo -e "  \${CYAN}Stop:\${RESET}    cd \$WORK_CONSOLE && ./bin/stop-all.sh"
echo ""
`;
}
