"use client";

import { WizardLayout } from "@/components/wizard-layout";
import { useWizard } from "@/lib/wizard-context";
import { useEffect, useState } from "react";

function securityDefaults(template: "personal" | "developer" | "business" | "custom") {
  if (template === "custom") return { dmPolicy: "allowlist" as const, allowlist: [] as string[] };
  return { dmPolicy: "allowlist" as const, allowlist: [] as string[] };
}

export default function Step5() {
  const { config, updateConfig, selectedTemplate, touched, markTouched } = useWizard();
  const [dmPolicy, setDmPolicy] = useState<"allow" | "deny" | "allowlist">(config.security.dmPolicy);
  const [allowlist, setAllowlist] = useState((config.security.allowlist || []).join("\n"));

  useEffect(() => {
    if (touched.security) return;
    const d = securityDefaults(selectedTemplate);
    setDmPolicy(d.dmPolicy);
    setAllowlist(d.allowlist.join("\n"));
  }, [selectedTemplate, touched.security]);

  const handleNext = () => {
    const allowlistArray = allowlist.split("\n").map((x) => x.trim()).filter(Boolean);
    updateConfig({ security: { dmPolicy, allowlist: allowlistArray } });
    return true;
  };

  return (
    <WizardLayout step={5} title="Security & Privacy" description="Configure who can interact with your OpenClaw instance" onNext={handleNext}>
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-3">Direct Message Policy</label>
          <div className="space-y-2">
            {[
              { value: "allow", label: "Allow All", desc: "Anyone can message (not recommended)" },
              { value: "allowlist", label: "Allowlist Only", desc: "Only specific users (recommended)" },
              { value: "deny", label: "Deny All", desc: "No one can message via DM" },
            ].map((option) => (
              <button key={option.value} onClick={() => { setDmPolicy(option.value as "allow" | "deny" | "allowlist"); markTouched("security"); }} className={`w-full p-4 rounded-lg border-2 text-left transition-all ${dmPolicy === option.value ? "border-blue-500 bg-blue-500/10" : "border-slate-600 hover:border-slate-500"}`}>
                <div className="font-semibold mb-1">{option.label}</div>
                <div className="text-sm text-slate-400">{option.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {dmPolicy === "allowlist" && (
          <div>
            <label className="block text-sm font-medium mb-2">Allowed Users (one per line)</label>
            <textarea value={allowlist} onChange={(e) => { setAllowlist(e.target.value); markTouched("security"); }} rows={6} className="w-full px-4 py-2 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none font-mono text-sm" />
          </div>
        )}
      </div>
    </WizardLayout>
  );
}
