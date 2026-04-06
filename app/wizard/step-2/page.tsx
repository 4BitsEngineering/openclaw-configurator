"use client";

import { WizardLayout } from "@/components/wizard-layout";
import { useWizard, UseCaseType, AgentDefinition, ALL_AGENTS } from "@/lib/wizard-context";
import { useState } from "react";

const USE_CASES: {
  id: UseCaseType;
  label: string;
  emoji: string;
  desc: string;
  agentNames: string[];
}[] = [
  {
    id: "software-dev",
    label: "Desarrollo Software",
    emoji: "💻",
    desc: "Planificación, codificación, revisión y despliegue de software",
    agentNames: ["Planner", "Executor", "Reviewer", "Architect", "DevOps"],
  },
  {
    id: "compliance",
    label: "Compliance / Legal",
    emoji: "⚖️",
    desc: "Auditoría normativa, investigación legal y revisión de documentos",
    agentNames: ["Compliance", "Researcher", "Reviewer", "Planner"],
  },
  {
    id: "content",
    label: "Contenido / Marketing",
    emoji: "✍️",
    desc: "Estrategia de contenido, generación de copies y optimización",
    agentNames: ["Planner", "Executor", "Researcher", "Reviewer"],
  },
  {
    id: "support",
    label: "Soporte Técnico",
    emoji: "🎧",
    desc: "Gestión de tickets, base de conocimiento y monitorización",
    agentNames: ["Executor", "Researcher", "Patrol", "Reviewer"],
  },
  {
    id: "custom",
    label: "Custom",
    emoji: "🔧",
    desc: "Elige manualmente los agentes que necesitas",
    agentNames: [],
  },
];

const ALL_POSSIBLE_AGENTS: AgentDefinition[] = [
  { id: "planner", name: "Planner", role: "Descompone tareas y crea planes de ejecución", enabled: true },
  { id: "executor", name: "Executor", role: "Ejecuta subtareas y produce resultados", enabled: true },
  { id: "reviewer", name: "Reviewer", role: "Revisa calidad y detecta errores", enabled: true },
  { id: "architect", name: "Architect", role: "Define arquitectura y decisiones técnicas", enabled: true },
  { id: "devops", name: "DevOps", role: "CI/CD, infraestructura y despliegue", enabled: true },
  { id: "compliance", name: "Compliance", role: "Verifica normativa y regulación", enabled: true },
  { id: "researcher", name: "Researcher", role: "Investiga fuentes y recopila información", enabled: true },
  { id: "patrol", name: "Patrol", role: "Monitoriza incidencias y alertas", enabled: true },
];

export default function Step2() {
  const { config, updateConfig, markTouched } = useWizard();

  const [selectedUseCase, setSelectedUseCase] = useState<UseCaseType>(config.useCase.type);
  const [customAgents, setCustomAgents] = useState<string[]>(
    config.useCase.agents.map((a) => a.id)
  );

  const selectUseCase = (id: UseCaseType) => {
    setSelectedUseCase(id);
    markTouched("useCase");
  };

  const toggleCustomAgent = (agentId: string) => {
    setCustomAgents((prev) =>
      prev.includes(agentId) ? prev.filter((a) => a !== agentId) : [...prev, agentId]
    );
  };

  const handleNext = () => {
    let agents: AgentDefinition[];
    if (selectedUseCase === "custom") {
      agents = ALL_POSSIBLE_AGENTS.filter((a) => customAgents.includes(a.id));
    } else {
      agents = ALL_AGENTS[selectedUseCase];
    }
    updateConfig({ useCase: { type: selectedUseCase, agents } });
    return true;
  };

  const selectedMeta = USE_CASES.find((u) => u.id === selectedUseCase)!;

  return (
    <WizardLayout
      step={2}
      title="Caso de Uso"
      description="Elige el ámbito principal de tu stack empresarial"
      onNext={handleNext}
    >
      <div className="space-y-3">
        {USE_CASES.map((uc) => {
          const isSelected = selectedUseCase === uc.id;
          return (
            <button
              key={uc.id}
              onClick={() => selectUseCase(uc.id)}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                isSelected
                  ? "border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/10"
                  : "border-slate-600/60 hover:border-slate-500 bg-slate-800/40"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0">{uc.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{uc.label}</span>
                    {isSelected && (
                      <span className="px-1.5 py-0.5 text-xs rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                        Seleccionado
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400 mb-2">{uc.desc}</p>
                  {uc.agentNames.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {uc.agentNames.map((name) => (
                        <span
                          key={name}
                          className={`px-2 py-0.5 text-xs rounded-full border ${
                            isSelected
                              ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
                              : "bg-slate-700/60 text-slate-400 border-slate-600/50"
                          }`}
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}

        {/* Custom agent picker */}
        {selectedUseCase === "custom" && (
          <div className="mt-4 p-4 rounded-xl border border-slate-600/60 bg-slate-800/40 space-y-3 animate-fadeInUp">
            <p className="text-sm font-medium text-slate-300">Selecciona los agentes que quieres activar:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ALL_POSSIBLE_AGENTS.map((agent) => {
                const checked = customAgents.includes(agent.id);
                return (
                  <button
                    key={agent.id}
                    onClick={() => toggleCustomAgent(agent.id)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      checked
                        ? "border-cyan-500 bg-cyan-500/10"
                        : "border-slate-600/60 hover:border-slate-500 bg-slate-700/30"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                          checked ? "border-cyan-500 bg-cyan-500" : "border-slate-500"
                        }`}
                      >
                        {checked && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{agent.name}</div>
                        <div className="text-xs text-slate-400">{agent.role}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {customAgents.length === 0 && (
              <p className="text-xs text-amber-400">Selecciona al menos un agente para continuar.</p>
            )}
          </div>
        )}

        {/* Preview of active agents for non-custom */}
        {selectedUseCase !== "custom" && (
          <div className="mt-2 p-3 rounded-lg bg-slate-800/50 border border-slate-700/60">
            <p className="text-xs text-slate-500 mb-2">Agentes que se activarán:</p>
            <div className="space-y-1">
              {selectedMeta.agentNames.map((name) => {
                const agent = ALL_POSSIBLE_AGENTS.find(
                  (a) => a.name.toLowerCase() === name.toLowerCase()
                );
                return (
                  <div key={name} className="flex items-center gap-2 text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0" />
                    <span className="font-medium text-slate-200">{name}</span>
                    {agent && <span className="text-slate-500 text-xs">— {agent.role}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </WizardLayout>
  );
}
