"use client";

import { createContext, useContext, useState, ReactNode } from "react";

export type TemplateType = "personal" | "developer" | "business" | "custom";

type TouchedKey = "channels" | "security" | "skills" | "personality";

export interface AxetProviderConfig {
  axetEnabled: boolean;
  axetGatewayUrl: string;
  axetGatewayToken: string;
  oktaIssuer: string;
  oktaClientId: string;
  oktaScope: string;
  axetApiBaseUrl: string;
}

export interface WizardConfig {
  providers: {
    anthropic?: { apiKey?: string; sessionToken?: string };
    openai?: { apiKey: string };
    google?: { apiKey: string };
    ollama?: { baseUrl: string };
    axet?: AxetProviderConfig;
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

export function WizardProvider({ children }: { children: ReactNode }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>("custom");
  const [touched, setTouched] = useState<Record<TouchedKey, boolean>>({
    channels: false,
    security: false,
    skills: false,
    personality: false,
  });
  const [config, setConfig] = useState<WizardConfig>({
    providers: {},
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
