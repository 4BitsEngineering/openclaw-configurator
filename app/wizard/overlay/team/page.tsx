"use client";

import { PhaseLayout } from "@/components/wizard/phase-layout";
import {
  useWizard,
  CLAWCREW_ROLES,
  ClawcrewAgentSelection,
  ClawcrewTeamConfig,
  ClawcrewRoleSpec,
  buildAgentSelectionFromRole,
  AgentDefinition,
  NUCLEO_ROLE_IDS,
  isNucleoAgent,
} from "@/lib/wizard-context";
import { useState } from "react";

// ──────────────────────────────────────────────────────────────────────────────
// Fase 2 (Overlay) — Equipo de agentes
//
// Modelo agnóstico (decisión de producto 17-jun):
//   · Núcleo recomendado pre-seleccionado: el Asistente Personal (responde en los
//     canales y hace de generalista). Si hay canales activos, lo destacamos.
//   · El resto se elige A MANO del catálogo clawcrew (sin plantillas de sector;
//     los sectores —"Negocios"— quedan deshabilitados de momento).
//   · Personalización por agente (nombre + emoji) en la lista "Tu equipo".
//   · Sin "prefix": solo un Nombre de equipo; el prefix runtime se deriva de él.
//
// El bloque resultante (clawcrewTeam) es lo que install.sh pasa a
// scripts/configure-overlay.js en autonomous-agents.
// ──────────────────────────────────────────────────────────────────────────────

// Etiquetas de rol en español (algunos defaults del catálogo venían en inglés).
// Catálogo Lean PyME (11 roles). Los displayName del catálogo ya vienen en
// español; este mapa solo cubre overrides y los roles cuyo default está en
// inglés (automation-engineer). Núcleo: founder/planner van ocultos, PA visible.
const ROLE_LABEL_ES: Record<string, string> = {
  planner: "Planificador",
  founder: "Founder",
  "personal-assistant": "Asistente personal",
  executive: "Agenda y Correo",
  documents: "Gestor documental",
  webops: "WebOps",
  "legal-suite": "Asesoría jurídica",
  "automation-engineer": "Automatización",
  "marketing-strategist": "Estratega de marketing",
  copywriter: "Redactor",
  community: "Community manager",
};

const roleLabel = (roleId: string) =>
  ROLE_LABEL_ES[roleId] || CLAWCREW_ROLES[roleId]?.defaultDisplayName || roleId;

// Grupos del catálogo (el núcleo va aparte). Las categorías vienen del
// catálogo clawcrew (office→ai-office, marketing, content).
const GROUPS: { key: ClawcrewRoleSpec["category"]; label: string; hint: string }[] = [
  { key: "ai-office", label: "Oficina y operaciones", hint: "Agenda y correo, documentos, web, legal y automatización." },
  { key: "marketing", label: "Marketing", hint: "Estrategia, SEO, contenido y campañas." },
  { key: "content", label: "Contenido", hint: "Redacción y comunidad." },
];

// Construye una selección con el nombre en español por defecto.
function buildSel(roleId: string): ClawcrewAgentSelection {
  const base = buildAgentSelectionFromRole(roleId, true);
  const label = roleLabel(roleId);
  return { ...base, displayName: label, shortName: label };
}

// Deriva el prefix runtime del nombre del equipo (no se pide al usuario).
function derivePrefix(name: string): string {
  const slug = (name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const safe = /^[a-z]/.test(slug) ? slug : `eq-${slug}`;
  return (safe || "office").slice(0, 24);
}

export default function TeamStep() {
  const { config, updateConfig, markTouched } = useWizard();

  // Garantiza que el núcleo (planner + PA) esté siempre presente, al principio.
  const withNucleo = (t: ClawcrewTeamConfig): ClawcrewTeamConfig => {
    const have = new Set(t.agents.map((a) => a.agent));
    const missing = NUCLEO_ROLE_IDS.filter((id) => !have.has(id)).map((id) => buildSel(id));
    return missing.length ? { ...t, agents: [...missing, ...t.agents] } : t;
  };

  const initial: ClawcrewTeamConfig = withNucleo(
    config.clawcrewTeam || {
      sector: "custom",
      prefix: "office",
      overlayName: "Mi equipo",
      agents: [],
    },
  );

  const [team, setTeam] = useState<ClawcrewTeamConfig>(initial);

  const hasChannels = Object.keys(config.channels || {}).some(
    (k) => config.channels[k as keyof typeof config.channels],
  );

  const isSelected = (roleId: string) => team.agents.some((a) => a.agent === roleId);

  const toggleRole = (roleId: string) => {
    if (isNucleoAgent(roleId)) return; // el núcleo no se quita
    markTouched("clawcrewTeam");
    setTeam((t) => {
      if (t.agents.some((a) => a.agent === roleId)) {
        return { ...t, agents: t.agents.filter((a) => a.agent !== roleId) };
      }
      return { ...t, agents: [...t.agents, buildSel(roleId)] };
    });
  };

  const patchAgent = (roleId: string, patch: Partial<ClawcrewAgentSelection>) => {
    setTeam((t) => ({
      ...t,
      agents: t.agents.map((a) => (a.agent === roleId ? { ...a, ...patch } : a)),
    }));
  };

  const setName = (overlayName: string) => {
    const prefix = derivePrefix(overlayName);
    setTeam((t) => ({
      ...t,
      overlayName,
      prefix,
      planMode: t.planMode ? { ...t.planMode, plannerAgentId: `${prefix}-planner-v1` } : t.planMode,
    }));
    markTouched("clawcrewTeam");
  };

  const handleNext = () => {
    const ensured = withNucleo(team);
    const prefix = derivePrefix(ensured.overlayName);
    const agents = ensured.agents.map((a) => ({ ...a, enabled: true }));
    const planMode = ensured.planMode
      ? { ...ensured.planMode, plannerAgentId: `${prefix}-planner-v1` }
      : ensured.planMode;
    const reflectedLegacy: AgentDefinition[] = agents.map((a) => ({
      id: a.slug,
      name: a.displayName,
      role: CLAWCREW_ROLES[a.agent]?.description || "",
      enabled: true,
    }));
    updateConfig({
      clawcrewTeam: { ...ensured, prefix, agents, planMode },
      useCase: { type: "custom", agents: reflectedLegacy },
    });
    return true;
  };

  const count = team.agents.length;

  return (
    <PhaseLayout
      stepId="team"
      title="Equipo de agentes"
      description="Elige qué agentes formarán tu equipo y dales nombre. Puedes personalizarlos ahora o más tarde."
      onNext={handleNext}
      nextLabel="Continuar a Autonomía"
    >
      <div className="space-y-8">
        {/* Nombre del equipo + sectores (deshabilitados) */}
        <section className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="panel-eyebrow mb-2 block">Nombre del equipo</label>
            <input
              type="text"
              value={team.overlayName}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mi equipo"
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Identifica esta instalación. Lo verás en la consola de AI Office.
            </p>
          </div>
          <div>
            <label className="panel-eyebrow mb-2 block">Sector</label>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground opacity-70">
                💼 Negocios
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">Próximamente</span>
              </span>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Por ahora el equipo se arma a mano. Las plantillas por sector llegarán más adelante.
            </p>
          </div>
        </section>

        {/* Núcleo: siempre incluidos (planner + PA) */}
        <section>
          <div className="panel-eyebrow mb-1">Incluidos siempre</div>
          <p className="mb-3 text-xs text-muted-foreground">
            Toda instancia de AI Office lleva el Planificador (gestiona los proyectos) y el
            Asistente Personal. Puedes renombrarlos abajo, pero no quitarlos.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {NUCLEO_ROLE_IDS.map((id) => (
              <AgentCard
                key={id}
                roleId={id}
                selected
                locked
                onToggle={() => {}}
                channelsNote={hasChannels && id === "personal-assistant"}
              />
            ))}
          </div>
        </section>

        {/* Catálogo por categorías */}
        {GROUPS.map((g) => {
          const roles = Object.values(CLAWCREW_ROLES).filter(
            (r) => r.category === g.key && !isNucleoAgent(r.agent),
          );
          if (roles.length === 0) return null;
          return (
            <section key={g.key}>
              <div className="panel-eyebrow mb-1">{g.label}</div>
              <p className="mb-3 text-xs text-muted-foreground">{g.hint}</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {roles.map((r) => (
                  <AgentCard
                    key={r.agent}
                    roleId={r.agent}
                    selected={isSelected(r.agent)}
                    onToggle={() => toggleRole(r.agent)}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {/* Tu equipo: personalización */}
        <section>
          <div className="panel-eyebrow mb-3">
            Tu equipo{" "}
            <span className="font-normal normal-case tracking-normal text-muted-foreground">
              · {count} {count === 1 ? "agente" : "agentes"}
            </span>
          </div>

          {count === 0 ? (
            <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/60 px-4 py-3 text-sm text-amber-800">
              Aún no has elegido ningún agente. Selecciona al menos uno arriba para continuar.
            </div>
          ) : (
            <div className="space-y-2.5">
              {team.agents.map((a) => (
                <div
                  key={a.agent}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
                >
                  <input
                    type="text"
                    value={a.icon}
                    onChange={(e) => patchAgent(a.agent, { icon: e.target.value })}
                    maxLength={4}
                    aria-label="Emoji del agente"
                    className="h-10 w-10 shrink-0 rounded-lg border border-border bg-background text-center text-lg focus:border-brand focus:outline-none"
                  />
                  <input
                    type="text"
                    value={a.displayName}
                    onChange={(e) => patchAgent(a.agent, { displayName: e.target.value, shortName: e.target.value })}
                    placeholder={roleLabel(a.agent)}
                    aria-label="Nombre del agente"
                    className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm font-medium text-foreground hover:border-border focus:border-brand focus:bg-background focus:outline-none"
                  />
                  <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                    {roleLabel(a.agent)}
                  </span>
                  {isNucleoAgent(a.agent) ? (
                    <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                      Núcleo
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleRole(a.agent)}
                      className="shrink-0 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-600"
                      title="Quitar del equipo"
                    >
                      Quitar
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </PhaseLayout>
  );
}

// ── Tarjeta de agente del catálogo ───────────────────────────────────────────
function AgentCard({
  roleId,
  selected,
  onToggle,
  recommended,
  channelsNote,
  locked,
}: {
  roleId: string;
  selected: boolean;
  onToggle: () => void;
  recommended?: boolean;
  channelsNote?: boolean;
  locked?: boolean;
}) {
  const spec = CLAWCREW_ROLES[roleId];
  if (!spec) return null;
  const body = (
    <>
      {/* Indicador: candado "Siempre" si locked, si no check de selección */}
      {locked ? (
        <span className="absolute right-4 top-4 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
          Siempre
        </span>
      ) : (
        <span
          className={[
            "absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full border text-[11px] transition-colors",
            selected
              ? "border-brand bg-brand text-white"
              : "border-border bg-background text-transparent group-hover:border-brand/40",
          ].join(" ")}
        >
          ✓
        </span>
      )}

      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted/60 text-2xl">
        {spec.defaultIcon}
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-foreground">{roleLabel(roleId)}</span>
          {recommended && (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
              Recomendado
            </span>
          )}
        </div>
        <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{spec.description}</p>
      </div>

      {channelsNote && (
        <p className="mt-auto text-xs font-medium text-brand">
          Es quien responde a tus clientes en los canales que activaste.
        </p>
      )}
    </>
  );

  const base = "group relative flex flex-col gap-3 rounded-2xl border p-5 text-left transition-all";
  const selectedCls = "border-brand bg-brand/5 ring-1 ring-brand shadow-sm";
  const idleCls = "border-border bg-card hover:border-brand/40 hover:bg-accent/40";

  if (locked) {
    return <div className={[base, selectedCls].join(" ")}>{body}</div>;
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      className={[base, selected ? selectedCls : idleCls].join(" ")}
    >
      {body}
    </button>
  );
}
