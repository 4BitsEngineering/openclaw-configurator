"use client";

import { WizardLayout } from "@/components/wizard-layout";
import { useWizard } from "@/lib/wizard-context";

const SENSITIVITY_LABELS = {
  S1: { label: "Público", emoji: "🌐", color: "text-emerald-400" },
  S2: { label: "Privado", emoji: "🔒", color: "text-amber-400" },
  S3: { label: "Sensible / Regulado", emoji: "🏛️", color: "text-rose-400" },
};

const USE_CASE_LABELS: Record<string, string> = {
  "software-dev": "💻 Desarrollo Software",
  compliance: "⚖️ Compliance / Legal",
  content: "✍️ Contenido / Marketing",
  support: "🎧 Soporte Técnico",
  custom: "🔧 Custom",
};

export default function Step8() {
  const { config } = useWizard();

  const providerCount = Object.keys(config.providers).length;
  const channelCount = Object.keys(config.channels).length;
  const sensitivityMeta = SENSITIVITY_LABELS[config.guardClaw.sensitivity];
  const activeAgents = config.useCase.agents.filter((a) => a.enabled);

  return (
    <WizardLayout
      step={8}
      title="Review Your Configuration"
      description="Revisa el stack completo antes de generar los ficheros"
      nextLabel="Generate Files"
    >
      <div className="space-y-3">
        {/* Providers */}
        <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
          <div className="font-semibold mb-2">🧠 LLM Providers</div>
          <div className="text-sm text-slate-400">
            {providerCount > 0 ? (
              <ul className="list-disc list-inside space-y-1">
                {Object.keys(config.providers).map((provider) => (
                  <li key={provider} className="capitalize">{provider}</li>
                ))}
              </ul>
            ) : (
              <span>None configured</span>
            )}
            {config.providers.axet && (
              <div className="mt-3 space-y-1 text-xs text-slate-500 border-t border-slate-600 pt-2">
                <div>Gateway: {config.providers.axet.axetGatewayUrl}</div>
                <div>Token: ****{config.providers.axet.axetGatewayToken.slice(-4)}</div>
                <div>Okta Issuer: {config.providers.axet.oktaIssuer}</div>
                <div>Client ID: {config.providers.axet.oktaClientId}</div>
                <div>Scope: {config.providers.axet.oktaScope}</div>
                <div>API Base: {config.providers.axet.axetApiBaseUrl}</div>
              </div>
            )}
          </div>
        </div>

        {/* Use Case */}
        <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
          <div className="font-semibold mb-2">🎯 Caso de Uso</div>
          <div className="text-sm text-slate-300 mb-2">
            {USE_CASE_LABELS[config.useCase.type] || config.useCase.type}
          </div>
          {activeAgents.length > 0 && (
            <div className="space-y-1">
              {activeAgents.map((agent) => (
                <div key={agent.id} className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0" />
                  <span className="font-medium text-slate-300">{agent.name}</span>
                  <span>— {agent.role}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* GuardClaw */}
        <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
          <div className="font-semibold mb-2">🛡️ GuardClaw</div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 text-xs font-bold rounded border ${
                config.guardClaw.sensitivity === "S1"
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                  : config.guardClaw.sensitivity === "S2"
                  ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                  : "bg-rose-500/20 text-rose-400 border-rose-500/30"
              }`}
            >
              {config.guardClaw.sensitivity}
            </span>
            <span className={`text-sm font-medium ${sensitivityMeta.color}`}>
              {sensitivityMeta.emoji} {sensitivityMeta.label}
            </span>
          </div>
        </div>

        {/* Channels */}
        <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
          <div className="font-semibold mb-2">💬 Messaging Channels</div>
          <div className="text-sm text-slate-400">
            {channelCount > 0 ? (
              <ul className="list-disc list-inside space-y-1">
                {Object.keys(config.channels).map((channel) => (
                  <li key={channel} className="capitalize">{channel}</li>
                ))}
              </ul>
            ) : (
              <span>None configured</span>
            )}
          </div>
        </div>

        {/* Security */}
        <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
          <div className="font-semibold mb-2">🔒 Security</div>
          <div className="text-sm text-slate-400">
            <div>DM Policy: <span className="capitalize">{config.security.dmPolicy}</span></div>
            {config.security.allowlist.length > 0 && (
              <div className="mt-1">
                Allowlist: {config.security.allowlist.length} user{config.security.allowlist.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        </div>

        {/* Skills */}
        <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
          <div className="font-semibold mb-2">🛠️ Skills</div>
          <div className="text-sm text-slate-400">
            {config.skills.length > 0 ? (
              <ul className="list-disc list-inside space-y-1">
                {config.skills.map((skill) => (
                  <li key={skill} className="capitalize">{skill}</li>
                ))}
              </ul>
            ) : (
              <span>None selected</span>
            )}
          </div>
        </div>

        {/* Personality */}
        <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
          <div className="font-semibold mb-2">✨ Personality</div>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{config.personality.emoji}</span>
            <div>
              <div className="font-semibold">{config.personality.name}</div>
              <div className="text-sm text-slate-400">{config.personality.vibe}</div>
            </div>
          </div>
        </div>

        {/* Files to generate */}
        <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60">
          <p className="text-xs text-slate-500 mb-2">Se generarán los siguientes ficheros:</p>
          <div className="flex flex-wrap gap-2">
            {["openclaw.yaml", "agents-config.yaml", "bridge-config.yaml", "guardclaw-config.yaml", "gateway-config.yaml", ".env", "install.sh"].map((f) => (
              <span key={f} className="px-2 py-0.5 text-xs rounded bg-slate-700/80 text-slate-300 border border-slate-600/50 font-mono">{f}</span>
            ))}
          </div>
        </div>
      </div>
    </WizardLayout>
  );
}
