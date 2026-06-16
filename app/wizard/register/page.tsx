"use client";

import { PhaseLayout } from "@/components/wizard/phase-layout";
import { useWizard } from "@/lib/wizard-context";
import { useState } from "react";

function slugify(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "instance";
}

const PLANS = [
  { id: "", label: "Definir luego" },
  { id: "starter", label: "Starter" },
  { id: "pro", label: "Pro" },
  { id: "business", label: "Business" },
];

// Features conocidas del control plane (clawhub). Opt-in; metadata para el alta.
const FEATURES = [
  { id: "kill-switch", label: "Kill-switch remoto", hint: "Permite suspender/reactivar la instancia desde clawhub por suscripción." },
  { id: "usage-telemetry", label: "Telemetría de uso", hint: "Reporta uso (heartbeat) a clawhub para facturación/observabilidad." },
];

export default function RegisterStep() {
  const { config, updateConfig } = useWizard();
  const team = config.clawcrewTeam;
  const name = team?.overlayName || "Instancia";
  const prefix = team?.prefix || "office";

  const [plan, setPlan] = useState(config.registration?.plan ?? "");
  const [features, setFeatures] = useState<string[]>(config.registration?.features ?? []);

  const toggleFeature = (id: string) =>
    setFeatures((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

  const handleNext = () => {
    updateConfig({ registration: { plan: plan || null, features } });
    return true;
  };

  return (
    <PhaseLayout stepId="register" title="Registro" description="Identidad de la instancia y metadata para clawhub. El alta real ocurre al instalar." onNext={handleNext} nextLabel="Revisar y generar">
      <div className="space-y-6">
        {/* Identidad (derivada del equipo) */}
        <div className="p-4 bg-slate-700/40 rounded-lg border border-slate-600">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Identidad de la instancia</h3>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div><dt className="text-slate-500 text-xs">Nombre</dt><dd className="font-medium">{name}</dd></div>
            <div><dt className="text-slate-500 text-xs">Slug</dt><dd className="font-mono text-cyan-400">{slugify(name)}</dd></div>
            <div><dt className="text-slate-500 text-xs">Prefijo agentes</dt><dd className="font-mono">{prefix}</dd></div>
          </dl>
          <p className="text-xs text-slate-500 mt-3">Se edita en el paso «Equipo» de la Fase 2.</p>
        </div>

        {/* Plan */}
        <div>
          <label className="text-sm font-medium block mb-1">Plan</label>
          <select value={plan} onChange={(e) => setPlan(e.target.value)} className="w-full px-3 py-2 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none">
            {PLANS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <p className="text-xs text-slate-500 mt-1">El plan se confirma/asocia en clawhub al dar de alta la instancia en destino.</p>
        </div>

        {/* Features */}
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Capacidades de control plane</h3>
          <div className="space-y-2">
            {FEATURES.map((f) => (
              <label key={f.id} className="flex items-start justify-between gap-4 p-4 bg-slate-700/50 rounded-lg border border-slate-600 cursor-pointer">
                <span>
                  <span className="font-medium block">{f.label}</span>
                  <span className="text-xs text-slate-400">{f.hint}</span>
                </span>
                <input type="checkbox" checked={features.includes(f.id)} onChange={() => toggleFeature(f.id)} className="mt-1 shrink-0" />
              </label>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-500">
          Esto es solo metadata: el manifiesto la lleva como <code className="text-slate-400">registration</code> y el instalador
          da de alta/parea la instancia en clawhub en la máquina destino (no se contacta a clawhub ahora).
        </p>
      </div>
    </PhaseLayout>
  );
}
