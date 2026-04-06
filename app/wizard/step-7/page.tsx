"use client";

import { WizardLayout } from "@/components/wizard-layout";
import { useWizard } from "@/lib/wizard-context";
import { useEffect, useState } from "react";

const EMOJI_OPTIONS = ["🤖", "🧠", "⚡", "📈", "🛠️"];

function personalityDefaults(template: "personal" | "developer" | "business" | "custom") {
  if (template === "developer") return { name: "JARVIS Dev", emoji: "🛠️", vibe: "Technical and direct" };
  if (template === "business") return { name: "JARVIS Biz", emoji: "📈", vibe: "Professional and concise" };
  return { name: "JARVIS", emoji: "🤖", vibe: "Professional yet approachable" };
}

export default function Step7() {
  const { config, updateConfig, selectedTemplate, touched, markTouched } = useWizard();
  const [name, setName] = useState(config.personality.name);
  const [emoji, setEmoji] = useState(config.personality.emoji);
  const [vibe, setVibe] = useState(config.personality.vibe);

  useEffect(() => {
    if (touched.personality) return;
    const d = personalityDefaults(selectedTemplate);
    setName(d.name);
    setEmoji(d.emoji);
    setVibe(d.vibe);
  }, [selectedTemplate, touched.personality]);

  const handleNext = () => {
    if (!name.trim()) return false;
    updateConfig({ personality: { name: name.trim(), emoji, vibe } });
    return true;
  };

  return (
    <WizardLayout step={7} title="Personalize Your Agent" description="Give your assistant a name and personality" onNext={handleNext}>
      <div className="space-y-6">
        <input type="text" value={name} onChange={(e) => { setName(e.target.value); markTouched("personality"); }} className="w-full px-4 py-2 bg-slate-700 rounded-lg border border-slate-600" />
        <div className="grid grid-cols-5 gap-2">
          {EMOJI_OPTIONS.map((e) => (
            <button key={e} onClick={() => { setEmoji(e); markTouched("personality"); }} className={`text-3xl p-2 rounded ${emoji === e ? "bg-blue-500/20" : "bg-slate-700"}`}>{e}</button>
          ))}
        </div>
        <textarea value={vibe} onChange={(e) => { setVibe(e.target.value); markTouched("personality"); }} rows={3} className="w-full px-4 py-2 bg-slate-700 rounded-lg border border-slate-600" />
      </div>
    </WizardLayout>
  );
}
