"use client";

import { WizardLayout } from "@/components/wizard-layout";
import { useWizard, DataSensitivity } from "@/lib/wizard-context";
import { useState } from "react";

const SENSITIVITY_LEVELS: {
  id: DataSensitivity;
  label: string;
  badge: string;
  emoji: string;
  desc: string;
  details: string[];
  color: string;
  badgeColor: string;
}[] = [
  {
    id: "S1",
    label: "Público",
    badge: "S1",
    emoji: "🌐",
    desc: "Datos no sensibles — procesamiento cloud estándar",
    details: [
      "Sin restricciones de routing de datos",
      "Todo procesado por el proveedor LLM configurado",
      "Logs completos habilitados",
      "Ideal para documentación pública o prototipos",
    ],
    color: "border-emerald-500 bg-emerald-500/10 shadow-emerald-500/10",
    badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  },
  {
    id: "S2",
    label: "Privado",
    badge: "S2",
    emoji: "🔒",
    desc: "Datos con PII — redacción automática antes de enviar al cloud",
    details: [
      "PII (nombres, emails, teléfonos, IDs) redactado automáticamente",
      "Datos sensibles sustituidos por tokens antes de enviar al LLM",
      "Logs anonimizados",
      "Compatible con GDPR y políticas de privacidad corporativas",
    ],
    color: "border-amber-500 bg-amber-500/10 shadow-amber-500/10",
    badgeColor: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  },
  {
    id: "S3",
    label: "Sensible / Regulado",
    badge: "S3",
    emoji: "🏛️",
    desc: "Datos regulados — ejecución local únicamente, sin cloud",
    details: [
      "Todo el procesamiento permanece en infraestructura local",
      "Requiere Ollama u otro LLM local configurado",
      "Sin datos salientes al exterior",
      "Cumple con normativas estrictas (HIPAA, PCI-DSS, secreto industrial)",
    ],
    color: "border-rose-500 bg-rose-500/10 shadow-rose-500/10",
    badgeColor: "bg-rose-500/20 text-rose-400 border-rose-500/30",
  },
];

export default function Step3() {
  const { config, updateConfig, markTouched } = useWizard();
  const [sensitivity, setSensitivity] = useState<DataSensitivity>(config.guardClaw.sensitivity);

  const handleNext = () => {
    updateConfig({ guardClaw: { sensitivity } });
    return true;
  };

  const selected = SENSITIVITY_LEVELS.find((s) => s.id === sensitivity)!;

  return (
    <WizardLayout
      step={3}
      title="GuardClaw — Sensibilidad de Datos"
      description="Define el nivel de protección para los datos que procesará tu stack"
      onNext={handleNext}
    >
      <div className="space-y-3">
        {SENSITIVITY_LEVELS.map((level) => {
          const isSelected = sensitivity === level.id;
          return (
            <button
              key={level.id}
              onClick={() => { setSensitivity(level.id); markTouched("guardClaw"); }}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                isSelected
                  ? `${level.color} shadow-lg`
                  : "border-slate-600/60 hover:border-slate-500 bg-slate-800/40"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0">{level.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`px-2 py-0.5 text-xs font-bold rounded border ${
                        isSelected ? level.badgeColor : "bg-slate-700 text-slate-400 border-slate-600"
                      }`}
                    >
                      {level.badge}
                    </span>
                    <span className="font-semibold">{level.label}</span>
                  </div>
                  <p className="text-sm text-slate-400 mb-2">{level.desc}</p>
                  {isSelected && (
                    <ul className="space-y-1 animate-fadeInUp">
                      {level.details.map((d) => (
                        <li key={d} className="flex items-start gap-2 text-xs text-slate-300">
                          <span className="mt-0.5 shrink-0">•</span>
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </button>
          );
        })}

        {/* Callout for S3 + no local LLM */}
        {sensitivity === "S3" && (
          <div className="p-3 rounded-lg border border-amber-500/40 bg-amber-500/5 animate-fadeInUp">
            <div className="flex gap-2 text-sm text-amber-300">
              <span className="shrink-0">⚠️</span>
              <span>
                Nivel S3 requiere un proveedor local (Ollama). Asegúrate de haberlo configurado en el paso anterior.
              </span>
            </div>
          </div>
        )}

        {/* Summary badge */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/60 border border-slate-700/60">
          <span className="text-sm text-slate-400">Nivel activo:</span>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 text-xs font-bold rounded border ${selected.badgeColor}`}>
              {selected.badge}
            </span>
            <span className="text-sm font-medium">{selected.label}</span>
            <span className="text-lg">{selected.emoji}</span>
          </div>
        </div>
      </div>
    </WizardLayout>
  );
}
