"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import clawcrewCatalog from "./clawcrew-catalog.json";

// Persist the wizard state across remounts (hard reload / new tab / deep-link to
// a later step). Without this the state lived in plain useState and a remount
// reset it to defaults (notably providers:{}), silently dropping the chosen LLM
// provider → a baseline registered WITHOUT a provider → new installs boot with a
// dead LLM (fall back to keyless ollama/gemma4-gpu). Bump the version suffix to
// invalidate older saved shapes.
const WIZARD_STORAGE_KEY = "openclaw-wizard-state-v1";

export type TemplateType = "personal" | "developer" | "business" | "custom";

type TouchedKey =
  | "channels"
  | "security"
  | "skills"
  | "personality"
  | "useCase"
  | "guardClaw"
  | "clawcrewTeam";

export interface AxetProviderConfig {
  axetEnabled: boolean;
  axetGatewayUrl: string;
  axetGatewayToken: string;
  oktaIssuer: string;
  oktaClientId: string;
  oktaScope: string;
  axetApiBaseUrl: string;
}

export type UseCaseType =
  | "software-dev"
  | "compliance"
  | "content"
  | "support"
  | "custom";

export interface AgentDefinition {
  id: string;
  name: string;
  role: string;
  enabled: boolean;
}

export type DataSensitivity = "S1" | "S2" | "S3";

// ──────────────────────────────────────────────────────────────────────────────
// Clawcrew team — el wizard "sector → equipo → identidades" que reemplaza el
// useCase legacy en el step-2. Los 15 roles atómicos viven en la library
// clawcrew (../clawcrew/agents/<role>/). El install.sh del Step-9 invoca
// configure-overlay.js (autonomous-agents/scripts) con un overlay-config.json
// derivado de este bloque para instalar los roles seleccionados en un overlay
// fresco.
// ──────────────────────────────────────────────────────────────────────────────

export type ClawcrewSector =
  | "asesoria"
  | "ecommerce"
  | "agencia"
  | "clinica"
  | "inmobiliaria"
  | "general"
  | "custom";

export type ClawcrewVoiceKind = "male" | "female" | "neutral" | null;

export interface ClawcrewVoice {
  kind: ClawcrewVoiceKind;
  elevenlabsId?: string | null;
}

// 1:1 con el shape del bloque agents[*] del overlay-config.json que consume
// scripts/configure-overlay.js (ver header del wrapper). Mantener alineado.
export interface ClawcrewAgentSelection {
  agent: string;          // id del rol en la library (executive, outbound-sdr, …)
  enabled: boolean;       // si false, NO se incluirá en el overlay-config generado
  slug: string;           // {prefix}-<slug>-v1 — runtime agentId final
  displayName: string;    // "Elena", "Diego", …
  shortName?: string;     // default = displayName
  icon: string;           // emoji avatar
  color?: string | null;  // hex
  voice?: ClawcrewVoice;
  workingVerb?: string;   // "ordenando tu día"
}

export interface ClawcrewPlanMode {
  enabled: boolean;
  uiVisible: boolean;
  autoSuggest: boolean;
  plannerAgentId: string | null;
  fallbackPlanFirst: boolean;
}

export interface ClawcrewTeamConfig {
  sector: ClawcrewSector;
  prefix: string;                       // prefijo del overlay: {prefix}-<slug>-v1
  overlayName: string;                  // human label ("Mi Despacho Acme")
  agents: ClawcrewAgentSelection[];
  planMode?: ClawcrewPlanMode;
}

// Metadata de los 15 roles atómicos de clawcrew. Los `defaults` se usan como
// punto de partida cuando el operator añade un rol al equipo (puede sobre-
// escribir desde el step-2 UI). Mantener `agent` (id) alineado 1:1 con
// clawcrew/agents/<dir>/manifest.json:id.
export interface ClawcrewRoleSpec {
  agent: string;          // = directory name in clawcrew/agents/
  category: "ai-office" | "marketing" | "content" | "ops";
  description: string;    // 1 frase, qué hace
  defaultSlug: string;    // slug por defecto si no hay override
  defaultDisplayName: string;
  defaultIcon: string;
  defaultColor: string | null;
  defaultVoiceKind: ClawcrewVoiceKind;
  defaultWorkingVerb: string;
}

// CLAWCREW_ROLES se DERIVA del catálogo versionado de clawcrew
// (clawcrew/catalog.json → ./clawcrew-catalog.json vía `npm run sync:catalog`).
// Antes era una lista hardcodeada que se desincronizaba al añadir roles a la library.
const CATALOG_CATEGORY_MAP: Record<string, ClawcrewRoleSpec["category"]> = {
  office: "ai-office",
  "ai-office": "ai-office",
  marketing: "marketing",
  content: "content",
  ops: "ops",
  general: "ops",
};

type CatalogAgent = (typeof clawcrewCatalog)["agents"][number];

function roleSpecFromCatalog(a: CatalogAgent): ClawcrewRoleSpec {
  const d = a.defaults ?? ({} as CatalogAgent["defaults"]);
  return {
    agent: a.id,
    category: CATALOG_CATEGORY_MAP[a.category] ?? "ops",
    description: a.description ?? "",
    defaultSlug: d.slug,
    defaultDisplayName: d.displayName,
    defaultIcon: d.icon ?? "🤖",
    defaultColor: (d.color ?? null) as string | null,
    defaultVoiceKind: (d.voice?.kind ?? "neutral") as ClawcrewVoiceKind,
    defaultWorkingVerb: d.workingVerb ?? "working",
  };
}

export const CLAWCREW_ROLES: Record<string, ClawcrewRoleSpec> = Object.fromEntries(
  clawcrewCatalog.agents.map((a) => [a.id, roleSpecFromCatalog(a)]),
);

// Templates por vertical — alineados con clawhub office-templates para que el
// wizard local proponga el mismo equipo "razonable" que el operador managed
// vería en clawhub. El operator puede tocar todo en el step-2 UI.
export interface ClawcrewSectorTemplate {
  label: string;
  emoji: string;
  description: string;
  agentIds: string[];     // ids del CLAWCREW_ROLES
  suggestedPrefix: string;
  suggestedOverlayName: string;
}

export const SECTOR_TEMPLATES: Record<ClawcrewSector, ClawcrewSectorTemplate> = {
  // NOTA: los sectores/plantillas están DESHABILITADOS en el wizard (decisión de
  // producto 17-jun: el equipo se elige a mano del catálogo). Se mantienen como
  // datos por si se reactivan; sus agentIds usan el catálogo Lean PyME (11 roles).
  asesoria: {
    label: "Asesoría / Despacho",
    emoji: "📁",
    description: "Asesoría fiscal, laboral, contable o despacho jurídico.",
    // Los TRES asesores del roster (12-ago-2026): fiscal, jurídica y laboral.
    // Antes esta plantilla no llevaba ninguno de los dos primeros porque no
    // existían cuando se escribió — y es justo el sector al que apunta.
    agentIds: ["executive", "tax", "legal", "employment"],
    suggestedPrefix: "asesoria",
    suggestedOverlayName: "Mi Despacho",
  },
  ecommerce: {
    label: "E-commerce",
    emoji: "🛒",
    description: "Tienda online — atención, contenido y SEO de producto.",
    agentIds: ["executive", "community", "marketing", "copywriter"],
    suggestedPrefix: "shop",
    suggestedOverlayName: "Mi Tienda",
  },
  agencia: {
    label: "Agencia",
    emoji: "🏢",
    description: "Agencia digital — operaciones, estrategia y contenido.",
    agentIds: ["executive", "marketing", "community", "copywriter"],
    suggestedPrefix: "agency",
    suggestedOverlayName: "Mi Agencia",
  },
  clinica: {
    label: "Clínica / Consulta",
    emoji: "🏥",
    description: "Clínica privada, consulta — agenda, contenido, captación.",
    agentIds: ["executive", "community", "copywriter"],
    suggestedPrefix: "clinic",
    suggestedOverlayName: "Mi Clínica",
  },
  inmobiliaria: {
    label: "Inmobiliaria",
    emoji: "🏘️",
    description: "Inmobiliaria — redes, contenido y legal de contratos.",
    agentIds: ["executive", "community", "legal"],
    suggestedPrefix: "estate",
    suggestedOverlayName: "Mi Inmobiliaria",
  },
  general: {
    label: "General (PYME)",
    emoji: "🤖",
    description: "Pack genérico — oficina, comunidad y contenido.",
    agentIds: ["executive", "community", "copywriter", "legal"],
    suggestedPrefix: "office",
    suggestedOverlayName: "Mi Oficina",
  },
  custom: {
    label: "Custom",
    emoji: "🔧",
    description: "Empiezo de cero — elijo los roles disponibles a mano.",
    agentIds: [],
    suggestedPrefix: "custom",
    suggestedOverlayName: "Mi Overlay",
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// Núcleo de AI Office — roles del catálogo clawcrew que TODA instancia incluye
// siempre: el Planificador (gestiona los proyectos por fases), el Asistente
// Personal (generalista, responde en los canales) y el Founder (mantiene vivo el
// contexto del negocio —misión, voz, audiencia— en los docs enterprise/ que el
// resto del equipo lee al arrancar; sin él los agentes suenan genéricos). Son
// roles REUTILIZABLES de clawcrew (no hardcodeados): planner → {prefix}-planner-v1,
// assistant → {prefix}-assistant-v1, founder → {prefix}-founder-v1,
// igual que el overlay real office-*. Los tres son infraestructura: van ocultos
// del roster visible en la web (isHiddenAgent) pero SIEMPRE presentes.
// ──────────────────────────────────────────────────────────────────────────────
export const NUCLEO_ROLE_IDS = ["planner", "assistant", "founder"] as const;
export const isNucleoAgent = (roleId: string) =>
  (NUCLEO_ROLE_IDS as readonly string[]).includes(roleId);

// Construye un ClawcrewAgentSelection a partir de un id de role + el prefix
// del overlay. Genera identidades default coherentes que el operator puede
// modificar después desde el step-2 UI.
export function buildAgentSelectionFromRole(
  roleId: string,
  enabled = true,
): ClawcrewAgentSelection {
  const spec = CLAWCREW_ROLES[roleId];
  if (!spec) {
    // Fallback defensivo — no debería pasar (UI valida contra CLAWCREW_ROLES).
    return {
      agent: roleId, enabled, slug: roleId, displayName: roleId, icon: "🤖",
      color: null, voice: { kind: null }, workingVerb: "",
    };
  }
  return {
    agent: spec.agent,
    enabled,
    slug: spec.defaultSlug,
    displayName: spec.defaultDisplayName,
    shortName: spec.defaultDisplayName,
    icon: spec.defaultIcon,
    color: spec.defaultColor,
    voice: { kind: spec.defaultVoiceKind, elevenlabsId: null },
    workingVerb: spec.defaultWorkingVerb,
  };
}

export interface WizardConfig {
  providers: {
    anthropic?: { apiKey?: string; sessionToken?: string; model?: string; fallbacks?: string[] };
    openai?: { apiKey: string; model?: string; fallbacks?: string[] };
    google?: { apiKey: string; model?: string; fallbacks?: string[] };
    ollama?: { baseUrl: string; model?: string; fallbacks?: string[] };
    axet?: AxetProviderConfig;
    // Provider custom OpenAI-compatible (cualquier endpoint local o remoto).
    __custom__?: { baseUrl: string; model: string; envKey?: string };
    // Permite cualquier provider id del catálogo (groq, minimax, deepseek…).
    [key: string]: unknown;
  };
  useCase: {
    type: UseCaseType;
    agents: AgentDefinition[];
  };
  // Nuevo bloque del wizard sector→equipo→identidades. Drives the
  // overlay-config.json generation in Step-9. Opcional para no romper la
  // hidratación inicial del config en componentes que no lo conocen.
  clawcrewTeam?: ClawcrewTeamConfig;
  guardClaw: {
    sensitivity: DataSensitivity;
  };
  // Perfil de arranque (Fase 2): subconjunto de settings del bridge que se
  // pre-configuran. Se mapea 1:1 a BridgeSettingsSeed en generators.ts.
  // Opcional: sin él rigen los defaults seguros del generador.
  bridgeSettings?: {
    autonomyLevel: "n0" | "n1" | "n2";
    guardClawEnabled: boolean;
    outputRedact: boolean;
    webEgress: boolean;
    language: string;
    agentTimeout: number;
    conversationIdleDays: number;
  };
  // Integraciones del overlay (Fase 2): solo flags; los secretos se declaran
  // como ENV en el manifiesto.
  // Integraciones (tools que usan los agentes). Mapa por id (presencia+enabled =
  // activada), igual que channels. Ids soportados: googleworkspace, n8n, brave,
  // elevenlabs. Las credenciales se declaran como ENV en el manifiesto.
  integrations?: {
    [key: string]: { enabled: boolean } | undefined;
  };
  // Registro (Fase 3): metadata declarativa para clawhub. El alta/pairing real
  // ocurre en install-time; aquí solo se recoge plan + features pretendidos.
  registration?: {
    plan: string | null;
    features: string[];
  };
  // Canales seleccionados. CERO secretos: solo se marca qué canales quiere la
  // instancia (presencia = activado); los tokens los pide el instalador en
  // destino vía manifest.env. Un map vacío es válido → la interacción irá solo
  // por la web de ai-office. Cualquier id de canal de OpenClaw es admisible.
  channels: {
    telegram?: { enabled: boolean };
    whatsapp?: { enabled: boolean };
    slack?: { enabled: boolean };
    discord?: { enabled: boolean };
    signal?: { enabled: boolean };
    [key: string]: { enabled: boolean } | undefined;
  };
  security: {
    dmPolicy: "allow" | "deny" | "allowlist";
    allowlist: string[];
  };
  skills: string[];
  personality: {
    name: string;
    emoji: string;
    vibe: string;
  };
}

interface WizardContextType {
  config: WizardConfig;
  updateConfig: (updates: Partial<WizardConfig>) => void;
  currentStep: number;
  setCurrentStep: (step: number) => void;
  selectedTemplate: TemplateType;
  setSelectedTemplate: (template: TemplateType) => void;
  touched: Record<TouchedKey, boolean>;
  markTouched: (key: TouchedKey) => void;
  resetWizard: () => void;
}

const WizardContext = createContext<WizardContextType | undefined>(undefined);

export const ALL_AGENTS: Record<UseCaseType, AgentDefinition[]> = {
  "software-dev": [
    { id: "planner", name: "Planner", role: "Descompone tareas y crea planes de ejecución", enabled: true },
    { id: "executor", name: "Executor", role: "Ejecuta subtareas y produce código", enabled: true },
    { id: "reviewer", name: "Reviewer", role: "Revisa código y detecta errores", enabled: true },
    { id: "architect", name: "Architect", role: "Define arquitectura y decisiones técnicas", enabled: true },
    { id: "devops", name: "DevOps", role: "CI/CD, infraestructura y despliegue", enabled: true },
  ],
  compliance: [
    { id: "compliance", name: "Compliance", role: "Verifica normativa y regulación", enabled: true },
    { id: "researcher", name: "Researcher", role: "Investiga fuentes legales y precedentes", enabled: true },
    { id: "reviewer", name: "Reviewer", role: "Revisa documentos y contratos", enabled: true },
    { id: "planner", name: "Planner", role: "Organiza flujos de auditoría", enabled: true },
  ],
  content: [
    { id: "planner", name: "Planner", role: "Planifica calendarios y estrategia de contenido", enabled: true },
    { id: "executor", name: "Executor", role: "Genera textos, posts y copies", enabled: true },
    { id: "researcher", name: "Researcher", role: "Investiga tendencias y referencias", enabled: true },
    { id: "reviewer", name: "Reviewer", role: "Revisa y optimiza contenido", enabled: true },
  ],
  support: [
    { id: "executor", name: "Executor", role: "Responde tickets y consultas", enabled: true },
    { id: "researcher", name: "Researcher", role: "Busca soluciones en base de conocimiento", enabled: true },
    { id: "patrol", name: "Patrol", role: "Monitoriza incidencias y alertas", enabled: true },
    { id: "reviewer", name: "Reviewer", role: "Calidad de respuestas y escalado", enabled: true },
  ],
  custom: [],
};

export function WizardProvider({ children }: { children: ReactNode }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>("custom");
  const [touched, setTouched] = useState<Record<TouchedKey, boolean>>({
    channels: false,
    security: false,
    skills: false,
    personality: false,
    useCase: false,
    guardClaw: false,
    clawcrewTeam: false,
  });
  // Pre-poblamos clawcrewTeam con el template "general" (5 roles core ai-office)
  // para que un usuario que aterriza en step-2 ya vea un equipo sugerido en
  // lugar de un selector vacío. El step-2 UI le deja cambiar de sector, añadir
  // o quitar roles y editar identidades. Si el sector pasa a "custom" el
  // operator empieza de cero (agents = []).
  // Núcleo agnóstico de AI Office (decisión 17-jun): toda instancia incluye SIEMPRE
  // el Planificador (gestiona los proyectos por fases) y el Asistente Personal (el
  // generalista que responde en los canales). El resto se elige a mano del catálogo
  // clawcrew en el step de equipo. (Antes arrancaba con la plantilla "general" de 5
  // roles.) plan-mode queda cableado al planner (mismo shape que el overlay real
  // office-*); enabled:false porque los proyectos usan el agente planner aunque el
  // auto-plan de chat esté apagado.
  const defaultClawcrewTeam: ClawcrewTeamConfig = {
    sector: "custom",
    prefix: "office",
    overlayName: "Mi equipo",
    agents: NUCLEO_ROLE_IDS.map((id) => buildAgentSelectionFromRole(id, true)),
    planMode: {
      enabled: false,
      uiVisible: false,
      autoSuggest: false,
      plannerAgentId: "office-planner-v1",
      fallbackPlanFirst: true,
    },
  };
  const [config, setConfig] = useState<WizardConfig>({
    providers: {},
    useCase: {
      type: "software-dev",
      agents: ALL_AGENTS["software-dev"],
    },
    clawcrewTeam: defaultClawcrewTeam,
    guardClaw: {
      sensitivity: "S1",
    },
    channels: {},
    security: { dmPolicy: "allowlist", allowlist: [] },
    skills: [],
    personality: { name: "JARVIS", emoji: "🤖", vibe: "Professional yet approachable" },
  });

  // Hydrate once from localStorage on mount. We gate persistence on `hydrated`
  // (state, not a ref) so the persist effect's first run — which still sees the
  // pre-hydration default state — skips writing, and only the post-hydration run
  // persists the restored values. This avoids clobbering the saved state with
  // defaults on a remount.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(WIZARD_STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved.config) setConfig(saved.config);
          if (typeof saved.currentStep === "number") setCurrentStep(saved.currentStep);
          if (saved.selectedTemplate) setSelectedTemplate(saved.selectedTemplate);
          if (saved.touched) setTouched(saved.touched);
        }
      } catch {
        /* corrupt/unavailable storage — start fresh */
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        WIZARD_STORAGE_KEY,
        JSON.stringify({ config, currentStep, selectedTemplate, touched }),
      );
    } catch {
      /* quota / private mode — persistence is best-effort */
    }
  }, [hydrated, config, currentStep, selectedTemplate, touched]);

  // Clear persisted state — call after a successful registration so the next
  // firm setup starts clean instead of inheriting the previous firm's choices.
  const resetWizard = () => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(WIZARD_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
  };

  const updateConfig = (updates: Partial<WizardConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  const markTouched = (key: TouchedKey) => {
    setTouched((prev) => ({ ...prev, [key]: true }));
  };

  return (
    <WizardContext.Provider
      value={{
        config,
        updateConfig,
        currentStep,
        setCurrentStep,
        selectedTemplate,
        setSelectedTemplate,
        touched,
        markTouched,
        resetWizard,
      }}
    >
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard() {
  const context = useContext(WizardContext);
  if (!context) throw new Error("useWizard must be used within WizardProvider");
  return context;
}
