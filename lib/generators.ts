import type { WizardConfig } from "./wizard-context";
import openclawTemplate from "./templates/openclaw.template.json";
import { randomBytes } from "crypto";
import { deriveEnvSpec } from "./contract/env-spec";
import { SUPPORTED_INTEGRATIONS } from "./integrations-meta";
import providersCatalog from "./providers-catalog.json";
import clawcrewCatalog from "./clawcrew-catalog.json";

// Catálogo clawcrew indexado por id de rol (planner, executive, …) — para
// derivar las role cards del concierge (label/blurb) en generateDispatchConfig.
type ClawcrewCatalogEntry = { id: string; description?: string; defaults?: { displayName?: string; shortName?: string } };
const CLAWCREW_BY_ID: Record<string, ClawcrewCatalogEntry> = Object.fromEntries(
  ((clawcrewCatalog as { agents?: ClawcrewCatalogEntry[] }).agents || []).map((a) => [a.id, a]),
);

// Catálogo de providers indexado por id (minimax, deepseek, groq, …).
const PROVIDER_CATALOG: Record<string, { label?: string; envVars?: string[]; baseUrl?: string | null; api?: string | null; models?: Array<{ id: string; name?: string }> }> =
  Object.fromEntries(providersCatalog.providers.map((p) => [p.id, p]));

// Elige la ENV key "canónica" de un provider: prefiere {ID}_API_KEY, luego la
// primera acabada en _API_KEY, luego la primera declarada.
function providerEnvKey(id: string, envVars?: string[]): string | undefined {
  if (!envVars || !envVars.length) return undefined;
  const std = `${id.toUpperCase()}_API_KEY`;
  if (envVars.includes(std)) return std;
  return envVars.find((v) => /_API_KEY$/.test(v)) || envVars[0];
}
import {
  CONFIG_SCHEMA_VERSION,
  PACKAGE_PATHS,
  type BridgeSettingsSeed,
  type IntegrationsBlock,
  type KnowledgeBlock,
  type InstanceManifest,
  type InstancePackage,
  type ManifestProvider,
  type ManifestChannel,
} from "./contract/types";

// Versión del configurator que estampa el manifiesto (compat.generatedBy).
// Mantener alineada con package.json:version.
const CONFIGURATOR_VERSION = "0.1.0";

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

// Xiaomi: ya NO se hardcodea ninguna key (14-jun, decisión JJ). La instancia
// usa por defecto el modelo elegido en el wizard (o ollama/gemma4-gpu, keyless),
// así que el plugin xiaomi solo necesita un placeholder NO-VACÍO para no abortar
// el arranque del gateway (mismo patrón que ELEVENLABS_API_KEY=dummy). Cuando el
// cliente quiera usar Xiaomi de verdad, pone su key en XIAOMI_API_KEY del .env.

// Modelo keyless por defecto (Ollama local). Es el fallback universal y el
// modelo de la instancia cuando el operador no eligió provider en step-1.
const DEFAULT_KEYLESS_MODEL = "ollama/gemma4-gpu";

// Resuelve el modelo de la instancia desde el wizard. Es la ÚNICA fuente de
// verdad compartida por los tres generadores (openclaw.json primary,
// overlay defaultModel, .env key) para que no se descuadren. Default keyless:
// ollama/gemma4-gpu.
function resolveInstanceModel(config: WizardConfig): { providerId: string; modelId: string; ref: string; envKey?: string } {
  const p = config.providers || {};
  const KEY: Record<string, string> = { anthropic: "ANTHROPIC_API_KEY", openai: "OPENAI_API_KEY", google: "GOOGLE_API_KEY" };
  for (const id of ["anthropic", "openai", "google"] as const) {
    if (p[id]) {
      const def = id === "anthropic" ? "claude-sonnet-4-6" : id === "openai" ? "gpt-5.2-chat-latest" : "gemini-2.5-pro";
      const modelId = p[id]!.model || def;
      return { providerId: id, modelId, ref: `${id}/${modelId}`, envKey: KEY[id] };
    }
  }
  if (p.ollama) {
    const modelId = p.ollama.model || "gemma4-gpu";
    return { providerId: "ollama", modelId, ref: `ollama/${modelId}` };
  }
  if (p.__custom__) {
    const c = p.__custom__;
    const modelId = c.model || "custom-model";
    return { providerId: "custom", modelId, ref: `custom/${modelId}`, envKey: c.envKey || undefined };
  }
  // Cualquier otro provider del catálogo (minimax, deepseek, groq, …). Antes
  // caía silenciosamente al keyless ollama; ahora respeta la elección del step-1.
  const otherId = Object.keys(p).find((id) => id !== "axet" && !!PROVIDER_CATALOG[id]);
  if (otherId) {
    const entry = PROVIDER_CATALOG[otherId];
    const modelId = (p[otherId] as { model?: string } | undefined)?.model || entry.models?.[0]?.id || otherId;
    return { providerId: otherId, modelId, ref: `${otherId}/${modelId}`, envKey: providerEnvKey(otherId, entry.envVars) };
  }
  return { providerId: "ollama", modelId: "gemma4-gpu", ref: DEFAULT_KEYLESS_MODEL };
}

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

  // El modelo elegido en step-1 dirige el PRIMARY de la instancia. Sin elección,
  // resolveInstanceModel devuelve el keyless por defecto (ollama/gemma4-gpu).
  const instance = resolveInstanceModel(config);
  tpl.agents = tpl.agents || {};
  tpl.agents.defaults = tpl.agents.defaults || {};
  const modelBlock = (tpl.agents.defaults.model && typeof tpl.agents.defaults.model === "object")
    ? tpl.agents.defaults.model
    : { fallbacks: [] as string[] };
  modelBlock.primary = instance.ref;
  const fallbacks: string[] = Array.isArray(modelBlock.fallbacks) ? modelBlock.fallbacks : [];
  // Red de seguridad keyless: asegurar ollama/gemma4-gpu como fallback (sin
  // duplicar, y nunca como fallback de sí mismo si ya es el primary).
  if (instance.ref !== DEFAULT_KEYLESS_MODEL && !fallbacks.includes(DEFAULT_KEYLESS_MODEL)) {
    fallbacks.push(DEFAULT_KEYLESS_MODEL);
  }
  modelBlock.fallbacks = fallbacks;
  tpl.agents.defaults.model = modelBlock;

  // Canales: la presencia de un canal en config.channels = activado. Reflejamos
  // ese estado en el bloque channels del openclaw.json (enabled:true). Los que
  // no se eligieron quedan como vengan en la plantilla (enabled:false). Map
  // vacío = sin canales (interacción solo por la web de ai-office).
  const selectedChannels = Object.keys(config.channels || {}).filter(
    (id) => config.channels[id as keyof typeof config.channels],
  );
  if (selectedChannels.length) {
    tpl.channels = tpl.channels || {};
    for (const id of selectedChannels) {
      tpl.channels[id] = { ...(tpl.channels[id] || {}), enabled: true };
    }
  }

  // Integraciones: la plantilla (copia de la instancia viva) trae n8n/brave/
  // elevenlabs ACTIVAS con SecretRef `service:*` (exec via bridge_tokens). En una
  // instancia nueva esos secretos no existen y el secret-reloader del gateway los
  // resuelve SIEMPRE (aunque el plugin esté disabled) → aborta el arranque
  // (SECRETS_RELOADER_DEGRADED). Reflejamos la SELECCIÓN del wizard: lo no elegido
  // se desactiva Y se le quita el SecretRef para que no haya nada que resolver.
  const selectedIntegrations = config.integrations || {};
  // Integración elegida = PENDIENTE hasta que la key se guarde en /integrations.
  // Se genera con enabled:false aunque se seleccione: el secret-reloader solo
  // resuelve providers HABILITADOS, así que un plugin disabled con su SecretRef
  // NO aborta el boot. La tarjeta de /integrations lo activa (enabled:true) al
  // guardar la key (bridge: service-keys → openclaw-config-sync, Capa B). No
  // seleccionado → además quitamos su SecretRef/config (sin refs huérfanos).
  if (tpl.plugins?.entries?.n8n) {
    const selected = !!selectedIntegrations.n8n?.enabled;
    tpl.plugins.entries.n8n.enabled = false;
    if (!selected && tpl.plugins.entries.n8n.config) delete tpl.plugins.entries.n8n.config.apiKey;
  }
  if (tpl.plugins?.entries?.brave) {
    const selected = !!selectedIntegrations.brave?.enabled;
    tpl.plugins.entries.brave.enabled = false;
    if (!selected) delete tpl.plugins.entries.brave.config;
  }
  // TTS elevenlabs: el bloque `providers` no tiene gate `enabled`, así que su mera
  // presencia hace que el reloader intente resolver service:elevenlabs y aborte si
  // falta la key. Se deja SIEMPRE fuera del config generado (elegido o no); la
  // tarjeta de /integrations lo re-inyecta al guardar la key (Capa B). El provider
  // TTS activo por defecto sigue siendo minimax.
  if (tpl.messages?.tts?.providers?.elevenlabs) {
    delete tpl.messages.tts.providers.elevenlabs;
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
  // Provider genérico del catálogo. Solo construimos la entry si el catálogo trae
  // baseUrl+api; si no (p.ej. minimax, que YA vive en la plantilla con su config
  // probada), devolvemos null y dejamos que la plantilla mande — resolveInstanceModel
  // ya fija el primary correcto.
  const otherId = Object.keys(p).find(
    (id) => !["anthropic", "openai", "google", "ollama", "axet", "__custom__"].includes(id) && !!PROVIDER_CATALOG[id],
  );
  if (otherId) {
    const entry = PROVIDER_CATALOG[otherId];
    if (entry.baseUrl && entry.api) {
      const envKey = providerEnvKey(otherId, entry.envVars);
      const modelId = (p[otherId] as { model?: string } | undefined)?.model || entry.models?.[0]?.id || otherId;
      return { providerId: otherId, providerEntry: {
        baseUrl: entry.baseUrl,
        apiKey: envKey ? `\${${envKey}}` : undefined,
        api: entry.api,
        models: [{ id: modelId, name: modelId }],
      } };
    }
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
    // agent-cli install como --default-model. Coherente con el primary del
    // openclaw.json: lo dirige el modelo elegido en step-1 (resolveInstanceModel),
    // con default keyless ollama/gemma4-gpu si no se eligió provider.
    defaultModel: resolveInstanceModel(config).ref,
    agents: agentsBlock,
  };

  if (team.planMode) {
    overlayConfig.planMode = team.planMode;
  }

  // Perfil de arranque: subconjunto de los settings del bridge que el
  // configurator pre-configura. El instalador los siembra en el bridge en
  // destino. Los SECRETOS asociados (keys/tokens) NO viven aquí: van en
  // manifest.env.
  overlayConfig.settingsSeed = deriveSettingsSeed(config);
  overlayConfig.integrations = deriveIntegrations(config);
  overlayConfig.knowledge = deriveKnowledge(config);

  return JSON.stringify(overlayConfig, null, 2);
}

// ── Perfil de arranque de autonomous-agents (Salida B) ──────────────────────────

// Defaults seguros (humano-en-bucle, GuardClaw ON con redacción). El wizard de
// la Fase 2 puebla `config.bridgeSettings`; sin él rigen estos defaults.
function deriveSettingsSeed(config: WizardConfig): BridgeSettingsSeed {
  const s = config.bridgeSettings;
  return {
    AUTONOMY_LEVEL: s?.autonomyLevel ?? "n0",
    GUARDCLAW_ENABLED: s?.guardClawEnabled ?? true,
    GUARDCLAW_OUTPUT_REDACT: s?.outputRedact ?? true,
    WEB_EGRESS_ENABLED: s?.webEgress ?? true,
    AGENTS_DEFAULT_LANGUAGE: s?.language ?? "es-ES",
    AGENT_TIMEOUT: s?.agentTimeout ?? 1800,
    CONVERSATIONS_IDLE_DAYS: s?.conversationIdleDays ?? 30,
  };
}

function deriveIntegrations(config: WizardConfig): IntegrationsBlock {
  const src = config.integrations || {};
  const out: IntegrationsBlock = {};
  for (const id of SUPPORTED_INTEGRATIONS) out[id] = { enabled: !!src[id]?.enabled };
  return out;
}

function deriveKnowledge(config: WizardConfig): KnowledgeBlock {
  const k = (config as { knowledge?: Partial<KnowledgeBlock> }).knowledge;
  return {
    ragEnabled: k?.ragEnabled ?? false,
    embeddingsProvider: k?.embeddingsProvider ?? null,
  };
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

  // Modelo de la instancia (step-1): garantiza que la API key del provider
  // elegido tiene su línea en el .env, vacía para que el cliente la rellene.
  // El openclaw.json referencia ${envKey} en el provider primary; sin esta
  // línea los agentes no responderían. Para ollama (keyless) no se emite nada.
  // No duplicamos si alguno de los bloques anteriores ya emitió la línea.
  const instance = resolveInstanceModel(config);
  if (instance.envKey && !lines.some((l) => l.startsWith(`${instance.envKey}=`))) {
    lines.push(`# Required for the selected model (${instance.ref}) — fill in your key`);
    lines.push(`${instance.envKey}=`);
    lines.push(``);
  }

  return lines.join("\n");
}

// ── Manifiesto de instancia (Salida C) ──────────────────────────────────────────

function slugify(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "instance";
}

const PROVIDER_DEFAULT_MODEL: Record<string, string> = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-5.2-chat-latest",
  google: "gemini-2.5-pro",
  ollama: "gemma4-gpu",
};

function manifestProviders(config: WizardConfig): ManifestProvider[] {
  const p = config.providers || {};
  return Object.keys(p).map((id) => {
    const entry = p[id as keyof typeof p] as { model?: string } | undefined;
    return { id, model: entry?.model || PROVIDER_DEFAULT_MODEL[id] || "(default)" };
  });
}

function manifestChannels(config: WizardConfig): ManifestChannel[] {
  const c = config.channels || {};
  return Object.keys(c)
    .filter((id) => Boolean(c[id as keyof typeof c]))
    .map((id) => ({ id }));
}

// Genera el manifiesto de instancia: identidad, compat/versionado, declaración
// de ENV requeridas (sin valores), resumen de providers/channels y metadata de
// registro (install-time). Es el handoff que el instalador consume.
export function generateInstanceManifest(config: WizardConfig): string {
  const team = config.clawcrewTeam;
  const name = team?.overlayName || "Instancia";
  const prefix = team?.prefix || "office";
  const manifest: InstanceManifest = {
    instance: { slug: slugify(name), name, prefix },
    compat: {
      configSchemaVersion: CONFIG_SCHEMA_VERSION,
      generatedBy: `openclaw-configurator@${CONFIGURATOR_VERSION}`,
      targetStack: {
        openclaw: ">=2026.5",
        aiOffice: null,
        autonomousAgents: null,
        clawcrewCatalogCommit: null,
      },
    },
    artifacts: { base: PACKAGE_PATHS.base, overlay: PACKAGE_PATHS.overlay },
    env: deriveEnvSpec(config),
    providers: manifestProviders(config),
    channels: manifestChannels(config),
    registration: {
      target: "clawhub",
      plan: config.registration?.plan ?? null,
      features: config.registration?.features ?? [],
      mode: "install-time",
    },
  };
  return JSON.stringify(manifest, null, 2) + "\n";
}

// .env.example EXACTO de la instancia: una línea KEY= por cada ENV declarada en el
// manifiesto (con su descripción y ejemplo de forma). Es la plantilla de secretos que
// el operador rellena y renombra a .env/.env.local para arrancar. Las integraciones
// "service key" (Brave/n8n/ElevenLabs) NO salen aquí: se configuran en la consola
// (key cifrada → service:X). Cero valores reales.
export function generateEnvExample(config: WizardConfig): string {
  const env = deriveEnvSpec(config);
  const lines = [
    "# .env — secretos de esta instancia. Rellena los valores y renombra a .env",
    "# (o .env.local). Generado por openclaw-configurator. NO lo subas a git.",
    "#",
    "# Brave, n8n y ElevenLabs NO van aquí: se configuran en la consola tras arrancar",
    "# (se guardan cifrados en el bridge). Google Workspace se conecta por OAuth.",
    "",
  ];
  if (!env.length) {
    lines.push("# (esta instancia no requiere secretos vía .env)");
  } else {
    for (const e of env) {
      lines.push(`# ${e.desc}${e.required ? "" : " (opcional)"}  ej: ${e.example}`);
      lines.push(`${e.key}=`);
      lines.push("");
    }
  }
  return lines.join("\n");
}

// Orquesta los artefactos del contrato + el arrancable en un árbol path→contenido.
// install.sh es el instalador "bundle" que copia el openclaw.json base, configura el
// overlay con overlay-config.json, pide las ENV del manifiesto en destino y arranca
// gateway + bridge + UI. Es lo que consume/ejecuta ai-office-install.
// dispatch.config.json — concierge del overlay: roles mapeados a los agentes
// ELEGIDOS. Lo consume el bridge: routes/dispatch.js (GET /api/dispatch/config →
// UI del concierge) y long-task.js#buildRoleAgentMap (dispatch por rol/nombre).
// Antes el bundle traía el de la instancia viva (roles con agentIds inexistentes);
// ahora se genera por-cliente. El runtime agentId = `${prefix}-${slug}-v1`
// (idPattern uniforme en clawcrew, verificado).
export function generateDispatchConfig(config: WizardConfig): string {
  const team = config.clawcrewTeam;
  const prefix = team?.prefix || "office";
  const enabled = (team?.agents || []).filter((a) => a.enabled !== false);
  const roles = enabled.map((a) => {
    const cat = CLAWCREW_BY_ID[a.agent];
    return {
      id: a.agent,
      label: a.displayName || cat?.defaults?.displayName || a.agent,
      blurb: cat?.description || "",
      agentId: `${prefix}-${a.slug}-v1`,
    };
  });
  const namePool: Record<string, string[]> = {};
  for (const a of enabled) namePool[a.agent] = [a.displayName || a.shortName || a.agent];
  const dispatch = {
    brand: "AI Office",
    firmName: team?.overlayName || "AI Office",
    roles,
    infrastructure: [] as unknown[],
    namePool,
    composer: { suggestions: [] as unknown[] },
    sampleTasks: {} as Record<string, unknown[]>,
    sampleSteps: {} as Record<string, unknown[]>,
    recurring: [] as string[],
  };
  return JSON.stringify(dispatch, null, 2) + "\n";
}

export function generateInstancePackage(config: WizardConfig): InstancePackage {
  return {
    [PACKAGE_PATHS.base]: generateOpenclawJson(config),
    [PACKAGE_PATHS.overlay]: generateOverlayConfig(config),
    [PACKAGE_PATHS.manifest]: generateInstanceManifest(config),
    [PACKAGE_PATHS.install]: generateInstallScript(),
    [PACKAGE_PATHS.env]: generateEnvExample(config),
    [PACKAGE_PATHS.dispatch]: generateDispatchConfig(config),
  };
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

# Xiaomi ya no lleva key hardcodeada. Placeholder dummy no-vacío para que el
# gateway no aborte si el config referencia \${XIAOMI_API_KEY}; el modelo por
# defecto es el elegido en el wizard (o ollama/gemma4-gpu, keyless).
XIAOMI_API_KEY_DEMO="dummy"

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
#
# Preferimos el openclaw.json COMPLETO que el configurator empaqueta junto a
# este script (generateOpenclawJson → plantilla probada de ai-office). Lleva
# placeholders de install-time (__STACK_ROOT__, __NODE_BIN__, __NODE_DIR__)
# que sustituimos abajo con las rutas reales de ESTA máquina. Si no viaja en
# el bundle, caemos a un esqueleto mínimo y warneamos.
\$DRY_RUN || mkdir -p "\$OPENCLAW_OVERLAY_DIR"

# Rutas reales de node en esta máquina para resolver los placeholders.
NODE_BIN="\$(command -v node)"
NODE_DIR="\$(dirname "\$NODE_BIN")"

if [ -f "\$OPENCLAW_CONFIG" ]; then
  ok "Found existing \$OPENCLAW_CONFIG"
  # Usamos node -e (Node es prereq); evitamos depender de jq/python3 que
  # en Windows estándar no están instalados.
  GATEWAY_TOKEN=\$(json_read "\$OPENCLAW_CONFIG" "gateway.auth.token")
  DETECTED_PORT=\$(json_read "\$OPENCLAW_CONFIG" "gateway.port")
  [ -n "\$DETECTED_PORT" ] && GATEWAY_PORT="\$DETECTED_PORT"
else
  if [ -f "\$SCRIPT_DIR/openclaw.json" ]; then
    info "Copying bundled openclaw.json → \$OPENCLAW_CONFIG"
    if ! \$DRY_RUN; then
      cp "\$SCRIPT_DIR/openclaw.json" "\$OPENCLAW_CONFIG"
      # Sustituir placeholders de install-time. Delimitador '#' (no '/') para
      # no chocar con las barras de las rutas. -i.bak + rm para portabilidad
      # GNU/BSD sed.
      sed -i.bak \\
        -e "s#__STACK_ROOT__#\${STACK_ROOT}#g" \\
        -e "s#__NODE_BIN__#\${NODE_BIN}#g" \\
        -e "s#__NODE_DIR__#\${NODE_DIR}#g" \\
        "\$OPENCLAW_CONFIG" && rm -f "\$OPENCLAW_CONFIG.bak"
      info "Substituted install paths: STACK_ROOT=\$STACK_ROOT, NODE_BIN=\$NODE_BIN, NODE_DIR=\$NODE_DIR"
      if grep -q "__STACK_ROOT__" "\$OPENCLAW_CONFIG" 2>/dev/null; then
        warn "__STACK_ROOT__ still present in \$OPENCLAW_CONFIG — placeholder substitution may have failed"
      fi
      GATEWAY_TOKEN=\$(json_read "\$OPENCLAW_CONFIG" "gateway.auth.token")
      DETECTED_PORT=\$(json_read "\$OPENCLAW_CONFIG" "gateway.port")
      [ -n "\$DETECTED_PORT" ] && GATEWAY_PORT="\$DETECTED_PORT"
      ok "Created \$OPENCLAW_CONFIG from bundle"
    else
      info "[dry-run] would copy \$SCRIPT_DIR/openclaw.json → \$OPENCLAW_CONFIG and substitute __STACK_ROOT__/__NODE_BIN__/__NODE_DIR__"
    fi
  else
    warn "No openclaw.json next to install.sh — falling back to minimal skeleton"
    info "Bootstrapping minimal \$OPENCLAW_CONFIG with fresh token..."
    GATEWAY_TOKEN=\$(node -e "console.log(require('crypto').randomBytes(24).toString('hex'))")
    if ! \$DRY_RUN; then
      cat > "\$OPENCLAW_CONFIG" <<JSON
{ "gateway": { "mode": "local", "auth": { "mode": "token", "token": "CHANGE_ME" } }, "agents": { "list": [] } }
JSON
      ok "Created minimal \$OPENCLAW_CONFIG"
    else
      info "[dry-run] would create minimal \$OPENCLAW_CONFIG with fresh token"
    fi
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
      # XIAOMI_API_KEY: placeholder dummy no-vacío (XIAOMI_API_KEY_DEMO arriba).
      # Evita abortar el gateway si el config referencia \${XIAOMI_API_KEY}; el
      # modelo por defecto es el del wizard u ollama. El cliente pone su key aquí.
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
