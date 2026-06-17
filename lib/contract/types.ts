// ──────────────────────────────────────────────────────────────────────────────
// Contrato de salidas del configurator (entregable #1)
//
// Ver docs/superpowers/specs/2026-06-16-configurator-output-contract-design.md.
//
// El configurator emite un "paquete de instancia" con tres artefactos y CERO
// secretos: base/openclaw.json, overlay/overlay-config.json e
// instance-manifest.json. Estos tipos definen la forma del manifiesto y de los
// bloques nuevos del overlay (autonomy/integrations/knowledge).
// ──────────────────────────────────────────────────────────────────────────────

export const CONFIG_SCHEMA_VERSION = "1.0";

// ── Manifiesto ────────────────────────────────────────────────────────────────

export type EnvScope = "base" | "overlay";

// Una variable de entorno que el instalador pedirá al usuario en destino.
// NUNCA lleva valor: solo su declaración. `example` es ilustrativo (forma del
// valor), no un secreto real.
export interface ManifestEnvVar {
  key: string;
  scope: EnvScope;
  desc: string;
  example: string;
  required: boolean;
}

export interface ManifestProvider {
  id: string;
  model: string;
}

export interface ManifestChannel {
  id: string;
}

export interface InstanceManifestCompat {
  configSchemaVersion: string;
  generatedBy: string;
  targetStack: {
    openclaw: string;
    aiOffice: string | null;
    autonomousAgents: string | null;
    clawcrewCatalogCommit: string | null;
  };
}

export interface InstanceManifestRegistration {
  target: "clawhub";
  plan: string | null;
  features: string[];
  // El registro ocurre en la máquina destino (install-time), no en config-time.
  mode: "install-time";
}

export interface InstanceManifest {
  instance: { slug: string; name: string; prefix: string };
  compat: InstanceManifestCompat;
  artifacts: { base: string; overlay: string };
  env: ManifestEnvVar[];
  providers: ManifestProvider[];
  channels: ManifestChannel[];
  registration: InstanceManifestRegistration;
}

// ── Bloques nuevos del overlay-config.json ──────────────────────────────────────

// Nivel de autonomía REAL del bridge (AUTONOMY_LEVEL): n0=humano-en-bucle,
// n1=autónomo con reglas, n2=full.
export type AutonomyLevel = "n0" | "n1" | "n2";

// "Perfil de arranque": el subconjunto de los settings del bridge que el
// configurator pre-configura al provisionar. Las CLAVES son las reales del
// settings registry del bridge (SQLite); el instalador las siembra en destino.
// El resto de los 40+ settings quedan en sus defaults, editables en la consola.
export interface BridgeSettingsSeed {
  AUTONOMY_LEVEL: AutonomyLevel;
  GUARDCLAW_ENABLED: boolean;
  GUARDCLAW_OUTPUT_REDACT: boolean;
  WEB_EGRESS_ENABLED: boolean;
  AGENTS_DEFAULT_LANGUAGE: string;
  AGENT_TIMEOUT: number;
  CONVERSATIONS_IDLE_DAYS: number;
}

// Integraciones del overlay (herramientas que usan los agentes), mapa por id:
// { googleworkspace, n8n, brave, elevenlabs } → { enabled }. Slack NO va aquí: es
// un CANAL (Fase 1). Las credenciales se declaran en manifest.env (INTEGRATION_ENV).
export type IntegrationsBlock = Record<string, { enabled: boolean }>;

export interface KnowledgeBlock {
  ragEnabled: boolean;
  embeddingsProvider: string | null;
}

// ── Paquete de instancia ────────────────────────────────────────────────────────

// path relativo dentro del paquete → contenido del archivo (texto).
export type InstancePackage = Record<string, string>;

export const PACKAGE_PATHS = {
  base: "base/openclaw.json",
  overlay: "overlay/overlay-config.json",
  manifest: "instance-manifest.json",
} as const;
