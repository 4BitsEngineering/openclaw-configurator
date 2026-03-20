"use client";

import { WizardLayout } from "@/components/wizard-layout";
import { useWizard } from "@/lib/wizard-context";

export default function Step6() {
  const { config } = useWizard();

  const providerCount = Object.keys(config.providers).length;
  const channelCount = Object.keys(config.channels).length;

  return (
    <WizardLayout
      step={6}
      title="Review Your Configuration"
      description="Double-check everything before generating files"
      nextLabel="Generate Files"
    >
      <div className="space-y-4">
        {/* Providers */}
        <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
          <div className="font-semibold mb-2">🧠 LLM Providers</div>
          <div className="text-sm text-slate-400">
            {providerCount > 0 ? (
              <ul className="list-disc list-inside space-y-1">
                {Object.keys(config.providers).map((provider) => (
                  <li key={provider} className="capitalize">
                    {provider}
                  </li>
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

        {/* Channels */}
        <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
          <div className="font-semibold mb-2">💬 Messaging Channels</div>
          <div className="text-sm text-slate-400">
            {channelCount > 0 ? (
              <ul className="list-disc list-inside space-y-1">
                {Object.keys(config.channels).map((channel) => (
                  <li key={channel} className="capitalize">
                    {channel}
                  </li>
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
                  <li key={skill} className="capitalize">
                    {skill}
                  </li>
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
      </div>
    </WizardLayout>
  );
}
