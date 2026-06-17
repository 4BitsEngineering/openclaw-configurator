"use client";

import { PhaseLayout } from "@/components/wizard/phase-layout";
import { useWizard } from "@/lib/wizard-context";
import { useState } from "react";

type AutonomyLevel = "n0" | "n1" | "n2";

const LEVELS: Array<{ id: AutonomyLevel; label: string; desc: string }> = [
  { id: "n0", label: "Humano en el bucle", desc: "El agente propone; tú apruebas cada acción sensible (escritura, correo, ejecución)." },
  { id: "n1", label: "Autónomo con reglas", desc: "Ejecuta lo permitido por las reglas; pide aprobación para el resto (correo, calendario, webhooks)." },
  { id: "n2", label: "Autónomo total", desc: "Ejecuta sin aprobaciones (salvo el suelo de seguridad S3). Para entornos de confianza." },
];

const LANGUAGES = ["es-ES", "en-US", "ca-ES", "eu-ES", "gl-ES", "pt-BR", "fr-FR", "de-DE", "it-IT"];

// Switch al estilo ai-office (brand cuando está activo).
function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-brand" : "bg-muted-foreground/25"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function ToggleRow({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      <span className="pt-0.5">
        <Switch checked={checked} onChange={onChange} />
      </span>
    </div>
  );
}

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
  const [conversationIdleDays, setConversationIdleDays] = useState(s?.conversationIdleDays ?? 30);
  const [n8nEnabled, setN8nEnabled] = useState(i?.n8n?.enabled ?? false);

  const handleNext = () => {
    updateConfig({
      bridgeSettings: {
        autonomyLevel,
        guardClawEnabled,
        outputRedact,
        webEgress,
        language,
        agentTimeout: Math.max(60, Math.min(3600, Number(agentTimeout) || 1800)),
        conversationIdleDays: Math.max(1, Math.min(365, Number(conversationIdleDays) || 30)),
      },
      integrations: { n8n: { enabled: n8nEnabled } },
    });
    return true;
  };

  const inputCls =
    "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

  return (
    <PhaseLayout
      stepId="autonomy"
      title="Autonomía y seguridad"
      description="Perfil de arranque de la instancia. El resto se ajusta luego en la consola."
      onNext={handleNext}
      nextLabel="Continuar a Registro"
    >
      <div className="space-y-8">
        {/* Nivel de autonomía */}
        <section>
          <div className="panel-eyebrow mb-3">Nivel de autonomía</div>
          <div className="grid gap-4 sm:grid-cols-3">
            {LEVELS.map((lv) => {
              const on = autonomyLevel === lv.id;
              return (
                <button
                  key={lv.id}
                  type="button"
                  onClick={() => setAutonomyLevel(lv.id)}
                  className={[
                    "group relative flex flex-col gap-2 rounded-2xl border p-5 text-left transition-all",
                    on
                      ? "border-brand bg-brand/5 ring-1 ring-brand shadow-sm"
                      : "border-border bg-card hover:border-brand/40 hover:bg-accent/40",
                  ].join(" ")}
                >
                  <span
                    className={`inline-flex w-fit items-center rounded-md px-2 py-0.5 font-mono text-xs font-semibold ${
                      on ? "bg-brand text-white" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {lv.id}
                  </span>
                  <span className="font-semibold text-foreground">{lv.label}</span>
                  <span className="text-sm text-muted-foreground">{lv.desc}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* GuardClaw */}
        <section>
          <div className="panel-eyebrow mb-3">GuardClaw · seguridad de datos</div>
          <div className="grid gap-3 sm:grid-cols-3">
            <ToggleRow checked={guardClawEnabled} onChange={setGuardClawEnabled} label="GuardClaw activado" hint="Clasifica la sensibilidad de los datos (S1/S2/S3) en cada acción." />
            <ToggleRow checked={outputRedact} onChange={setOutputRedact} label="Enmascarar PII" hint="Redacta datos personales en las respuestas de los agentes." />
            <ToggleRow checked={webEgress} onChange={setWebEgress} label="Filtrar salida a la web" hint="Revisa búsquedas y URLs antes de enviarlas a terceros." />
          </div>
        </section>

        {/* Idioma + límites */}
        <section>
          <div className="panel-eyebrow mb-3">Idioma y límites</div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Idioma por defecto</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className={inputCls}>
                {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Timeout de agente (s)</label>
              <input type="number" min={60} max={3600} value={agentTimeout} onChange={(e) => setAgentTimeout(Number(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Retención de conversaciones (días)</label>
              <input type="number" min={1} max={365} value={conversationIdleDays} onChange={(e) => setConversationIdleDays(Number(e.target.value))} className={inputCls} />
            </div>
          </div>
        </section>

        {/* Integraciones */}
        <section>
          <div className="panel-eyebrow mb-3">Integraciones</div>
          <ToggleRow checked={n8nEnabled} onChange={setN8nEnabled} label="n8n" hint="Automatizaciones vía n8n. Pedirá la URL y la API key en la instalación." />
          <p className="mt-2 text-xs text-muted-foreground">
            Slack no aparece aquí: se configura como <span className="font-medium text-foreground">canal</span> en la Fase 1 (usa los mismos tokens de Socket Mode).
          </p>
        </section>

        <p className="text-xs text-muted-foreground">
          Estos valores son el punto de partida; el resto (plan-mode, modelos por agente, etc.) se ajusta en la consola tras instalar.
        </p>
      </div>
    </PhaseLayout>
  );
}
