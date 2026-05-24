"use client";

import { WizardLayout } from "@/components/wizard-layout";
import {
  useWizard,
  CLAWCREW_ROLES,
  SECTOR_TEMPLATES,
  ClawcrewSector,
  ClawcrewAgentSelection,
  ClawcrewVoiceKind,
  ClawcrewTeamConfig,
  buildAgentSelectionFromRole,
  AgentDefinition,
} from "@/lib/wizard-context";
import { useState } from "react";

// ──────────────────────────────────────────────────────────────────────────────
// Step-2 — Equipo de agentes para tu negocio
//
// Wizard "sector → equipo → identidades":
//   A. Sector picker (chips de 7: 6 verticales + custom). Selección rellena
//      el equipo sugerido del SECTOR_TEMPLATES.
//   B. Equipo: grid de roles seleccionados (+toggle enable/disable, +remove,
//      +"añadir más roles" que abre full catálogo de los 15).
//   C. Identidad por agente: accordeon con slug / displayName / icon / color
//      / voz. Defaults vienen del manifest del rol (CLAWCREW_ROLES) — el
//      operator puede sobre-escribir todo.
//
// El bloque resultante (clawcrewTeam) es lo que el install.sh del Step-9
// usará para invocar scripts/configure-overlay.js en autonomous-agents.
//
// IMPORTANTE: por compat retro mantenemos el useCase legacy populado con un
// reflejo de los displayNames del nuevo clawcrewTeam, para que los generators
// existentes (generateAgentsConfig, generateBridgeConfig) sigan trabajando
// sin reescribirlos en este paso.
// ──────────────────────────────────────────────────────────────────────────────

const SECTORS: ClawcrewSector[] = [
  "general", "asesoria", "ecommerce", "agencia", "clinica", "inmobiliaria", "custom",
];

export default function Step2() {
  const { config, updateConfig, markTouched } = useWizard();

  // Estado inicial — clawcrewTeam viene pre-poblado del provider con sector
  // "general". Defensivo por si alguien rehidratara sin ese bloque.
  const initial: ClawcrewTeamConfig = config.clawcrewTeam || {
    sector: "general",
    prefix: SECTOR_TEMPLATES.general.suggestedPrefix,
    overlayName: SECTOR_TEMPLATES.general.suggestedOverlayName,
    agents: SECTOR_TEMPLATES.general.agentIds.map((id) => buildAgentSelectionFromRole(id, true)),
  };

  const [team, setTeam] = useState<ClawcrewTeamConfig>(initial);
  const [showCatalog, setShowCatalog] = useState(false);
  const [openAgent, setOpenAgent] = useState<string | null>(null);

  // ── Mutators ──────────────────────────────────────────────────────────────
  const selectSector = (sector: ClawcrewSector) => {
    const tpl = SECTOR_TEMPLATES[sector];
    setTeam({
      sector,
      prefix: tpl.suggestedPrefix,
      overlayName: tpl.suggestedOverlayName,
      agents: tpl.agentIds.map((id) => buildAgentSelectionFromRole(id, true)),
    });
    setOpenAgent(null);
    markTouched("clawcrewTeam");
  };

  const toggleAgentEnabled = (slug: string) => {
    setTeam((t) => ({
      ...t,
      agents: t.agents.map((a) => a.slug === slug ? { ...a, enabled: !a.enabled } : a),
    }));
  };

  const removeAgent = (slug: string) => {
    setTeam((t) => ({ ...t, agents: t.agents.filter((a) => a.slug !== slug) }));
    if (openAgent === slug) setOpenAgent(null);
  };

  const addRoleToTeam = (roleId: string) => {
    // No duplicar: si el rol ya está, no añadir.
    if (team.agents.some((a) => a.agent === roleId)) return;
    const sel = buildAgentSelectionFromRole(roleId, true);
    setTeam((t) => ({ ...t, agents: [...t.agents, sel] }));
    markTouched("clawcrewTeam");
  };

  const patchAgent = (slug: string, patch: Partial<ClawcrewAgentSelection>) => {
    setTeam((t) => ({
      ...t,
      agents: t.agents.map((a) => a.slug === slug ? { ...a, ...patch } : a),
    }));
  };

  // ── Commit + sync legacy useCase ──────────────────────────────────────────
  const handleNext = () => {
    if (!team.prefix || !/^[a-z][a-z0-9-]*$/.test(team.prefix)) {
      // El operator debe poner un prefix válido. La UI ya muestra warning.
      return false;
    }
    if (team.agents.filter((a) => a.enabled).length === 0) {
      return false;
    }
    // Reflejo legacy: useCase.agents espeja los selected/enabled para que
    // generators viejos (agents-config.yaml, bridge-config.yaml) sigan
    // recibiendo un agents[] poblado. type queda como "custom" porque ya no
    // mapeamos a software-dev/compliance/etc.
    const reflectedLegacy: AgentDefinition[] = team.agents
      .filter((a) => a.enabled)
      .map((a) => ({
        id: a.slug,
        name: a.displayName,
        role: CLAWCREW_ROLES[a.agent]?.description || a.workingVerb || "",
        enabled: true,
      }));
    updateConfig({
      clawcrewTeam: team,
      useCase: { type: "custom", agents: reflectedLegacy },
    });
    return true;
  };

  const activeAgents = team.agents.filter((a) => a.enabled);
  const prefixValid = /^[a-z][a-z0-9-]*$/.test(team.prefix);
  const canContinue = prefixValid && activeAgents.length > 0;

  // Catálogo de roles que NO están aún en el team (para el botón "+ añadir")
  const availableToAdd = Object.values(CLAWCREW_ROLES)
    .filter((spec) => !team.agents.some((a) => a.agent === spec.agent));

  return (
    <WizardLayout
      step={2}
      title="Equipo de agentes"
      description="Elige tu sector, selecciona quiénes trabajan contigo y dale identidad a cada uno"
      onNext={handleNext}
    >
      <div className="space-y-6">

        {/* ── A. Sector picker ─────────────────────────────────────────── */}
        <section>
          <h3 className="text-sm font-semibold text-slate-300 mb-2">A. Sector</h3>
          <div className="flex flex-wrap gap-2">
            {SECTORS.map((s) => {
              const tpl = SECTOR_TEMPLATES[s];
              const isSelected = team.sector === s;
              return (
                <button
                  key={s}
                  onClick={() => selectSector(s)}
                  className={`px-3 py-2 rounded-lg border-2 text-left transition-all ${
                    isSelected
                      ? "border-cyan-500 bg-cyan-500/10 shadow shadow-cyan-500/20"
                      : "border-slate-600/60 hover:border-slate-500 bg-slate-800/40"
                  }`}
                  title={tpl.description}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{tpl.emoji}</span>
                    <span className="text-sm font-medium">{tpl.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {SECTOR_TEMPLATES[team.sector].description}
          </p>
        </section>

        {/* ── Prefix + overlayName ──────────────────────────────────────── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Nombre del overlay
            </label>
            <input
              type="text"
              value={team.overlayName}
              onChange={(e) => setTeam((t) => ({ ...t, overlayName: e.target.value }))}
              placeholder="Mi Despacho Acme"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-sm focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Prefix (runtime id: <code className="text-cyan-400">{team.prefix || "?"}-slug-v1</code>)
            </label>
            <input
              type="text"
              value={team.prefix}
              onChange={(e) => setTeam((t) => ({ ...t, prefix: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
              placeholder="office"
              className={`w-full px-3 py-2 rounded-lg bg-slate-800 border text-sm focus:outline-none ${
                prefixValid ? "border-slate-600 focus:border-cyan-500" : "border-red-500"
              }`}
            />
            {!prefixValid && (
              <p className="text-xs text-red-400 mt-1">
                Solo minúsculas, números y guiones. Empieza por letra.
              </p>
            )}
          </div>
        </section>

        {/* ── B. Equipo ─────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-300">
              B. Equipo <span className="text-xs text-slate-500 font-normal">
                ({activeAgents.length} activo{activeAgents.length === 1 ? "" : "s"})
              </span>
            </h3>
            <button
              onClick={() => setShowCatalog(!showCatalog)}
              className="text-xs px-2 py-1 rounded border border-slate-600 hover:border-cyan-500 hover:text-cyan-400 transition"
            >
              {showCatalog ? "× Cerrar catálogo" : `+ Añadir rol (${availableToAdd.length} disponibles)`}
            </button>
          </div>

          {team.agents.length === 0 && (
            <div className="p-4 rounded-lg border border-amber-500/40 bg-amber-500/5 text-sm text-amber-300">
              No hay agentes en tu equipo. Elige un sector arriba o abre el catálogo para añadirlos a mano.
            </div>
          )}

          <div className="space-y-2">
            {team.agents.map((agent) => {
              const spec = CLAWCREW_ROLES[agent.agent];
              const isOpen = openAgent === agent.slug;
              return (
                <div
                  key={agent.slug}
                  className={`rounded-lg border-2 transition ${
                    agent.enabled
                      ? "border-slate-600/60 bg-slate-800/40"
                      : "border-slate-700/40 bg-slate-900/40 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-3 p-3">
                    <button
                      onClick={() => toggleAgentEnabled(agent.slug)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                        agent.enabled ? "border-cyan-500 bg-cyan-500" : "border-slate-500"
                      }`}
                      title={agent.enabled ? "Desactivar" : "Activar"}
                    >
                      {agent.enabled && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      )}
                    </button>
                    <span className="text-xl shrink-0">{agent.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{agent.displayName}</span>
                        <span className="text-xs text-slate-500 truncate">
                          ({team.prefix}-{agent.slug}-v1)
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 truncate">
                        {spec?.description || "—"}
                      </p>
                    </div>
                    <button
                      onClick={() => setOpenAgent(isOpen ? null : agent.slug)}
                      className="text-xs px-2 py-1 rounded border border-slate-600 hover:border-cyan-500 hover:text-cyan-400 transition shrink-0"
                    >
                      {isOpen ? "✕ Cerrar" : "✎ Identidad"}
                    </button>
                    <button
                      onClick={() => removeAgent(agent.slug)}
                      className="text-xs px-2 py-1 rounded border border-slate-600 hover:border-red-500 hover:text-red-400 transition shrink-0"
                      title="Quitar del equipo"
                    >
                      🗑️
                    </button>
                  </div>

                  {/* ── C. Identidad inline ─────────────────────────────── */}
                  {isOpen && (
                    <div className="border-t border-slate-700/60 p-3 space-y-3 bg-slate-900/40 animate-fadeInUp">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <IdField
                          label="Slug (runtime)"
                          value={agent.slug}
                          onChange={(v) => patchAgent(agent.slug, { slug: v.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                          placeholder="elena"
                          mono
                        />
                        <IdField
                          label="Display name"
                          value={agent.displayName}
                          onChange={(v) => patchAgent(agent.slug, { displayName: v, shortName: v })}
                          placeholder="Elena"
                        />
                        <IdField
                          label="Icon (emoji)"
                          value={agent.icon}
                          onChange={(v) => patchAgent(agent.slug, { icon: v })}
                          placeholder="📋"
                        />
                        <IdField
                          label="Color (hex)"
                          value={agent.color || ""}
                          onChange={(v) => patchAgent(agent.slug, { color: v || null })}
                          placeholder="#4F6D9E"
                          mono
                        />
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 mb-1">Voz</label>
                          <select
                            value={agent.voice?.kind || ""}
                            onChange={(e) => patchAgent(agent.slug, {
                              voice: { kind: (e.target.value || null) as ClawcrewVoiceKind, elevenlabsId: agent.voice?.elevenlabsId || null },
                            })}
                            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-sm focus:border-cyan-500 focus:outline-none"
                          >
                            <option value="">(sin TTS)</option>
                            <option value="female">Femenina</option>
                            <option value="male">Masculina</option>
                            <option value="neutral">Neutra</option>
                          </select>
                        </div>
                        <IdField
                          label="Verbo en marcha"
                          value={agent.workingVerb || ""}
                          onChange={(v) => patchAgent(agent.slug, { workingVerb: v })}
                          placeholder="ordenando tu día"
                        />
                      </div>
                      <p className="text-xs text-slate-500">
                        Rol library: <code className="text-cyan-400">{agent.agent}</code> · category{" "}
                        <code className="text-cyan-400">{spec?.category}</code>
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Catálogo de roles disponibles para añadir */}
          {showCatalog && (
            <div className="mt-3 p-4 rounded-lg border border-slate-600/60 bg-slate-800/40 animate-fadeInUp">
              <p className="text-xs text-slate-400 mb-3">
                Catálogo clawcrew — {availableToAdd.length} roles disponibles para añadir
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {availableToAdd.map((spec) => (
                  <button
                    key={spec.agent}
                    onClick={() => addRoleToTeam(spec.agent)}
                    className="p-2 rounded-lg border border-slate-600/60 hover:border-cyan-500 bg-slate-700/30 hover:bg-slate-700/60 text-left transition group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg shrink-0">{spec.defaultIcon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{spec.defaultDisplayName}</div>
                        <div className="text-xs text-slate-400 truncate">{spec.description}</div>
                      </div>
                      <span className="text-xs text-cyan-400 opacity-0 group-hover:opacity-100 transition shrink-0">+</span>
                    </div>
                  </button>
                ))}
                {availableToAdd.length === 0 && (
                  <p className="text-xs text-slate-500 col-span-2">
                    Todos los roles ya están en el equipo. Puedes desactivar los que no necesites.
                  </p>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ── Summary footer ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/60 border border-slate-700/60">
          <div className="text-sm text-slate-400">
            <span className="font-medium text-slate-200">{activeAgents.length}</span> agentes activos ·
            sector{" "}
            <span className="font-medium text-slate-200">{SECTOR_TEMPLATES[team.sector].label}</span>
          </div>
          {!canContinue && (
            <span className="text-xs text-amber-400">
              {activeAgents.length === 0
                ? "Activa al menos 1 agente"
                : "Corrige el prefix para continuar"}
            </span>
          )}
        </div>
      </div>
    </WizardLayout>
  );
}

// ── Inline field helper ─────────────────────────────────────────────────────
function IdField({
  label, value, onChange, placeholder, mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-sm focus:border-cyan-500 focus:outline-none ${
          mono ? "font-mono" : ""
        }`}
      />
    </div>
  );
}
