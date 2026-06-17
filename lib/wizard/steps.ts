// ──────────────────────────────────────────────────────────────────────────────
// Modelo de navegación del wizard por FASES.
//
// El wizard se reestructura en torno a las fases del contrato de salidas
// (ver docs/superpowers/specs/2026-06-16-configurator-output-contract-design.md):
//   Fase 1 — OpenClaw base   → base/openclaw.json
//   Fase 2 — Overlay         → overlay/overlay-config.json
//   Fase 3 — Registro        → instance-manifest.json (registration)
//   Final  — Revisión        → genera el paquete completo
//
// Las rutas son por fase (/wizard/<phase>/<step>). El PhaseLayout deriva fase,
// índice y progreso de este modelo, así que añadir/mover pasos es editar SOLO
// este archivo.
// ──────────────────────────────────────────────────────────────────────────────

export type PhaseId = "base" | "overlay" | "register" | "review";

export interface Phase {
  id: PhaseId;
  label: string;
  // Estado de implementación: los pasos de fases no construidas aún muestran
  // un placeholder y no bloquean la navegación de las fases ya hechas.
  ready: boolean;
}

export interface WizardStep {
  id: string;
  route: string;
  label: string;
  phase: PhaseId;
}

// Orden del flujo: base → overlay → revisión (genera/inspecciona el paquete) →
// registro (sube el paquete a clawhub, obtiene el código + instalador). Registro
// es el paso FINAL porque necesita el paquete ya generado.
export const PHASES: Phase[] = [
  { id: "base", label: "OpenClaw base", ready: true },
  { id: "overlay", label: "Overlay", ready: true },
  { id: "review", label: "Revisión", ready: true },
  { id: "register", label: "Registro", ready: true },
];

export const STEPS: WizardStep[] = [
  // Fase 1 — OpenClaw base (entregable #2)
  { id: "provider", route: "/wizard/base/provider", label: "Proveedor", phase: "base" },
  { id: "channels", route: "/wizard/base/channels", label: "Canales", phase: "base" },
  { id: "security", route: "/wizard/base/security", label: "Seguridad", phase: "base" },
  // Fase 2 — Overlay (entregable #3)
  { id: "team", route: "/wizard/overlay/team", label: "Equipo", phase: "overlay" },
  { id: "autonomy", route: "/wizard/overlay/autonomy", label: "Autonomía", phase: "overlay" },
  // Revisión — genera el paquete completo y permite inspeccionarlo/descargarlo
  { id: "review", route: "/wizard/review", label: "Revisar y generar", phase: "review" },
  // Registro — registra la instancia en clawhub (Firm + baseline) y emite el
  // código de instalación + enlace al instalador. Paso final del flujo.
  { id: "register", route: "/wizard/register", label: "Registro", phase: "register" },
];

export const FIRST_ROUTE = STEPS[0].route;

export function stepIndexById(id: string): number {
  return STEPS.findIndex((s) => s.id === id);
}

export function stepById(id: string): WizardStep | undefined {
  return STEPS.find((s) => s.id === id);
}

export function phaseById(id: PhaseId): Phase | undefined {
  return PHASES.find((p) => p.id === id);
}

// Pasos agrupados por fase, en orden — solo fases con pasos (flujo lineal).
export function stepsByPhase(): Array<{ phase: Phase; steps: WizardStep[] }> {
  return PHASES.map((phase) => ({
    phase,
    steps: STEPS.filter((s) => s.phase === phase.id),
  })).filter((g) => g.steps.length > 0);
}

// TODAS las fases (incluidas las deshabilitadas/sin pasos como Registro) — para
// pintar la nav/progreso mostrando las no-ready grisadas.
export function allPhaseGroups(): Array<{ phase: Phase; steps: WizardStep[] }> {
  return PHASES.map((phase) => ({
    phase,
    steps: STEPS.filter((s) => s.phase === phase.id),
  }));
}
