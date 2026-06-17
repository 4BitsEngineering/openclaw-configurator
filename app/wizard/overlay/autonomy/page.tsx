"use client";

import { PhaseLayout } from "@/components/wizard/phase-layout";
import { useWizard } from "@/lib/wizard-context";
import { IntegrationIcon } from "@/lib/integration-icon";
import { SUPPORTED_INTEGRATIONS_LIST, UPCOMING_INTEGRATIONS_LIST } from "@/lib/integrations-meta";
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
  const [integrations, setIntegrations] = useState<Set<string>>(() => {
    const init = new Set<string>();
    for (const it of SUPPORTED_INTEGRATIONS_LIST) {
      if (i?.[it.id]?.enabled) init.add(it.id);
    }
    return init;
  });

  const toggleIntegration = (id: string) => {
    setIntegrations((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleNext = () => {
    const integrationsMap: Record<string, { enabled: boolean }> = {};
    for (const id of integrations) integrationsMap[id] = { enabled: true };
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
      integrations: integrationsMap,
    });
    return true;
  };

  const authBadge: Record<string, string> = { oauth: "OAuth", key: "API key", url: "URL + key" };

  const inputCls =
    "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

  return (
    <PhaseLayout
      stepId="autonomy"
      title="Autonomía, seguridad e integraciones"
      description="Perfil de arranque de la instancia. El resto se ajusta luego en la consola."
      onNext={handleNext}
      nextLabel="Continuar a Revisión"
    >
      <div className="space-y-5">
        {/* Nivel de autonomía */}
        <section>
          <div className="panel-eyebrow mb-2">Nivel de autonomía</div>
          <div className="grid gap-3 sm:grid-cols-3">
            {LEVELS.map((lv) => {
              const on = autonomyLevel === lv.id;
              return (
                <button
                  key={lv.id}
                  type="button"
                  onClick={() => setAutonomyLevel(lv.id)}
                  className={[
                    "group relative flex flex-col gap-1.5 rounded-xl border p-4 text-left transition-all",
                    on
                      ? "border-brand bg-brand/5 ring-1 ring-brand shadow-sm"
                      : "border-border bg-card hover:border-brand/40 hover:bg-accent/40",
                  ].join(" ")}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold ${
                        on ? "bg-brand text-white" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {lv.id}
                    </span>
                    <span className="text-sm font-semibold text-foreground">{lv.label}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{lv.desc}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* GuardClaw */}
        <section>
          <div className="panel-eyebrow mb-2">GuardClaw · seguridad de datos</div>
          <div className="grid gap-3 sm:grid-cols-3">
            <ToggleRow checked={guardClawEnabled} onChange={setGuardClawEnabled} label="GuardClaw activado" hint="Clasifica la sensibilidad de los datos (S1/S2/S3) en cada acción." />
            <ToggleRow checked={outputRedact} onChange={setOutputRedact} label="Enmascarar PII" hint="Redacta datos personales en las respuestas de los agentes." />
            <ToggleRow checked={webEgress} onChange={setWebEgress} label="Filtrar salida a la web" hint="Revisa búsquedas y URLs antes de enviarlas a terceros." />
          </div>
        </section>

        {/* Idioma + límites */}
        <section>
          <div className="panel-eyebrow mb-2">Idioma y límites</div>
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

        {/* Integraciones — patrón de canales: soportadas seleccionables + próximamente */}
        <section>
          <div className="panel-eyebrow mb-1">Integraciones</div>
          <p className="mb-2.5 text-xs text-muted-foreground">
            Tools que usan los agentes; el instalador pedirá las credenciales en destino.
            Slack no aparece: es un <span className="font-medium text-foreground">canal</span> (Fase 1).
          </p>

          <div className="grid gap-2.5 sm:grid-cols-2">
            {SUPPORTED_INTEGRATIONS_LIST.map((it) => {
              const on = integrations.has(it.id);
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => toggleIntegration(it.id)}
                  title={it.authNote}
                  className={[
                    "group flex items-center gap-3 rounded-xl border p-3 text-left transition-all",
                    on
                      ? "border-brand bg-brand/5 ring-1 ring-brand shadow-sm"
                      : "border-border bg-card hover:border-brand/40 hover:bg-accent/40",
                  ].join(" ")}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                    <IntegrationIcon id={it.id} size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">{it.label}</span>
                      <span className="shrink-0 rounded-full border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {authBadge[it.authStyle]}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{it.blurb}</p>
                  </div>
                  <span
                    className={[
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] transition-colors",
                      on ? "border-brand bg-brand text-white" : "border-border bg-background text-transparent group-hover:border-brand/40",
                    ].join(" ")}
                  >
                    ✓
                  </span>
                </button>
              );
            })}
          </div>

          <div className="panel-eyebrow mb-2 mt-4">
            Próximamente{" "}
            <span className="font-normal normal-case tracking-normal text-muted-foreground">
              · {UPCOMING_INTEGRATIONS_LIST.length} integraciones más de OpenClaw
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            {UPCOMING_INTEGRATIONS_LIST.map((it) => (
              <div
                key={it.id}
                title={`${it.label} — próximamente`}
                className="flex items-center gap-2 rounded-xl border border-dashed border-border/70 bg-muted/20 px-3 py-2 opacity-70"
              >
                <IntegrationIcon id={it.id} size={18} muted />
                <span className="truncate text-sm text-muted-foreground">{it.label}</span>
              </div>
            ))}
          </div>
        </section>

        <p className="text-xs text-muted-foreground">
          Estos valores son el punto de partida; el resto (plan-mode, modelos por agente, etc.) se ajusta en la consola tras instalar.
        </p>
      </div>
    </PhaseLayout>
  );
}
