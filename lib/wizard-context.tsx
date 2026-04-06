"use client";

import { createContext, useContext, useState, ReactNode } from "react";

export type TemplateType = "personal" | "developer" | "business" | "custom";

type TouchedKey = "channels" | "security" | "skills" | "personality" | "useCase" | "guardClaw";

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

export interface WizardConfig {
  providers: {
    anthropic?: { apiKey?: string; sessionToken?: string };
    openai?: { apiKey: string };
    google?: { apiKey: string };
    ollama?: { baseUrl: string };
    axet?: AxetProviderConfig;
  };
  useCase: {
    type: UseCaseType;
    agents: AgentDefinition[];
  };
  guardClaw: {
    sensitivity: DataSensitivity;
  };
  channels: {
    telegram?: { token: string; allowlist?: string[] };
    whatsapp?: { enabled: boolean };
    discord?: { token: string; allowlist?: string[] };
    signal?: { enabled: boolean };
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
  });
  const [config, setConfig] = useState<WizardConfig>({
    providers: {},
    useCase: {
      type: "software-dev",
      agents: ALL_AGENTS["software-dev"],
    },
    guardClaw: {
      sensitivity: "S1",
    },
    channels: {},
    security: { dmPolicy: "allowlist", allowlist: [] },
    skills: [],
    personality: { name: "JARVIS", emoji: "🤖", vibe: "Professional yet approachable" },
  });

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
