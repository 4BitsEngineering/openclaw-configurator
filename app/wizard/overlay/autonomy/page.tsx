"use client";

import { PhaseLayout } from "@/components/wizard/phase-layout";
import { useWizard } from "@/lib/wizard-context";
import { useState } from "react";

type AutonomyLevel = "n0" | "n1" | "n2";

const LEVELS: Array<{ id: AutonomyLevel; label: string; desc: string }> = [
  { id: "n0", label: "Humano en el bucle", desc: "El agente propone; tú apruebas cada acción sensible (escritura, correo, ejecución)." },
  { id: "n1", label: "Autónomo con reglas", desc: "Ejecuta solo lo permitido por las reglas; pide aprobación para lo demás (correo, calendario, webhooks)." },
  { id: "n2", label: "Autónomo total", desc: "Ejecuta sin aprobaciones (salvo el suelo de seguridad S3). Para entornos de confianza." },
];

const LANGUAGES = ["es-ES", "en-US", "ca-ES", "eu-ES", "gl-ES", "pt-BR", "fr-FR", "de-DE", "it-IT"];

export default function AutonomyStep() {
  const { config, updateConfig } = useWizard();
  const s = config.bridgeSettings;
  const i = config.integrations;

  const [autonomyLevel, setAutonomyLevel] = useState<AutonomyLevel>(s?.autonomyLevel ?? "n0");
  const [guardClawEnabled, setGuardClawEnabled] = useState(s?.guardClawEnabled ?? true);
  const [outputRedact, setOutputRedact] = useState(s?.outputRedact ?? true);
  const [webEgress, setWebEgress] = useState(s?.webEgress ?? true);
  const [language, setLanguage] = useState(s?.language ?? "es-ES");
  const [agentTimeout, setAgentTimeout] = useState(s?.agentTimeout ?? 1800);
  const [conversationIdleDays, setConversationIdleDays] = useState(s?.conversationIdleDays ?? 90);
  const [n8nEnabled, setN8nEnabled] = useState(i?.n8n?.enabled ?? false);
  const [slackEnabled, setSlackEnabled] = useState(i?.slack?.enabled ?? false);

  const handleNext = () => {
    updateConfig({
      bridgeSettings: {
        autonomyLevel,
        guardClawEnabled,
        outputRedact,
        webEgress,
        language,
        agentTimeout: Math.max(60, Math.min(3600, Number(agentTimeout) || 1800)),
        conversationIdleDays: Math.max(1, Math.min(365, Number(conversationIdleDays) || 90)),
      },
      integrations: { n8n: { enabled: n8nEnabled }, slack: { enabled: slackEnabled } },
    });
    return true;
  };

  const Toggle = ({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) => (
    <label className="flex items-start justify-between gap-4 p-4 bg-slate-700/50 rounded-lg border border-slate-600 cursor-pointer">
      <span>
        <span className="font-medium block">{label}</span>
        <span className="text-xs text-slate-400">{hint}</span>
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 shrink-0" />
    </label>
  );

  return (
    <PhaseLayout stepId="autonomy" title="Autonomía y seguridad" description="Perfil de arranque de la instancia. Lo demás se ajusta luego en la consola." onNext={handleNext} nextLabel="Continuar a Registro">
      <div className="space-y-6">
        {/* Nivel de autonomía */}
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Nivel de autonomía</h3>
          <div className="space-y-2">
            {LEVELS.map((lv) => (
              <button
                key={lv.id}
                type="button"
                onClick={() => setAutonomyLevel(lv.id)}
                className={`w-full text-left p-4 rounded-lg border transition-colors ${
                  autonomyLevel === lv.id ? "border-cyan-500 bg-cyan-500/10" : "border-slate-600 bg-slate-700/50 hover:border-slate-500"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-slate-800 text-cyan-400">{lv.id}</span>
                  <span className="font-medium">{lv.label}</span>
                </span>
                <span className="text-xs text-slate-400 block mt-1">{lv.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* GuardClaw */}
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-3">GuardClaw (seguridad de datos)</h3>
          <div className="space-y-2">
            <Toggle checked={guardClawEnabled} onChange={setGuardClawEnabled} label="GuardClaw activado" hint="Clasifica la sensibilidad de los datos (S1/S2/S3) en cada acción." />
            <Toggle checked={outputRedact} onChange={setOutputRedact} label="Enmascarar PII en las respuestas" hint="Redacta datos personales en los outputs de los agentes." />
            <Toggle checked={webEgress} onChange={setWebEgress} label="Filtrar salida a la web" hint="Revisa búsquedas y URLs antes de enviarlas a terceros." />
          </div>
        </div>

        {/* Idioma + límites */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium block mb-1">Idioma por defecto</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full px-3 py-2 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none">
              {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Timeout de agente (s)</label>
            <input type="number" min={60} max={3600} value={agentTimeout} onChange={(e) => setAgentTimeout(Number(e.target.value))} className="w-full px-3 py-2 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Retención conversaciones (días)</label>
            <input type="number" min={1} max={365} value={conversationIdleDays} onChange={(e) => setConversationIdleDays(Number(e.target.value))} className="w-full px-3 py-2 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none" />
          </div>
        </div>

        {/* Integraciones */}
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Integraciones</h3>
          <div className="space-y-2">
            <Toggle checked={n8nEnabled} onChange={setN8nEnabled} label="n8n" hint="Automatizaciones vía n8n. Pedirá URL y API key en la instalación." />
            <Toggle checked={slackEnabled} onChange={setSlackEnabled} label="Slack (canal)" hint="Canal de Slack por Socket Mode. Pedirá los tokens en la instalación." />
          </div>
        </div>

        <p className="text-xs text-slate-500">
          Estos valores son el punto de partida; el resto de ajustes (plan-mode, modelos por agente, etc.) se configura en la consola tras instalar.
        </p>
      </div>
    </PhaseLayout>
  );
}
