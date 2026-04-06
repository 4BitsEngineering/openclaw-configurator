"use client";

import { WizardLayout } from "@/components/wizard-layout";
import { useWizard } from "@/lib/wizard-context";
import { useEffect, useState } from "react";

const AVAILABLE_SKILLS = [
  { id: "github", name: "GitHub", emoji: "🐙", desc: "Manage repos, issues, PRs" },
  { id: "himalaya", name: "Email (Himalaya)", emoji: "📧", desc: "IMAP/SMTP email client" },
  { id: "weather", name: "Weather", emoji: "🌤️", desc: "Current weather & forecasts" },
  { id: "coding-agent", name: "Coding Agent", emoji: "💻", desc: "Claude Code, Codex, etc." },
];

function skillDefaults(template: "personal" | "developer" | "business" | "custom") {
  if (template === "personal") return ["weather"];
  if (template === "developer") return ["github", "coding-agent", "himalaya"];
  if (template === "business") return ["himalaya", "weather"];
  return [];
}

export default function Step6() {
  const { config, updateConfig, selectedTemplate, touched, markTouched } = useWizard();
  const [selectedSkills, setSelectedSkills] = useState<string[]>(config.skills);

  useEffect(() => {
    if (touched.skills) return;
    setSelectedSkills(skillDefaults(selectedTemplate));
  }, [selectedTemplate, touched.skills]);

  const toggleSkill = (skillId: string) => {
    markTouched("skills");
    setSelectedSkills((prev) => (prev.includes(skillId) ? prev.filter((id) => id !== skillId) : [...prev, skillId]));
  };

  const handleNext = () => {
    updateConfig({ skills: selectedSkills });
    return true;
  };

  return (
    <WizardLayout step={6} title="Select Skills" description="Choose the capabilities your agent will have" onNext={handleNext}>
      <div className="space-y-4">
        <p className="text-sm text-slate-400 mb-4">Selected: {selectedSkills.length} skills</p>
        <div className="grid grid-cols-1 gap-3">
          {AVAILABLE_SKILLS.map((skill) => {
            const isSelected = selectedSkills.includes(skill.id);
            return (
              <button key={skill.id} onClick={() => toggleSkill(skill.id)} className={`p-4 rounded-lg border-2 text-left transition-all ${isSelected ? "border-blue-500 bg-blue-500/10" : "border-slate-600 hover:border-slate-500"}`}>
                <div className="flex items-start gap-3"><span className="text-2xl">{skill.emoji}</span><div className="flex-1"><div className="font-semibold mb-1">{skill.name}</div><div className="text-sm text-slate-400">{skill.desc}</div></div></div>
              </button>
            );
          })}
        </div>
      </div>
    </WizardLayout>
  );
}
