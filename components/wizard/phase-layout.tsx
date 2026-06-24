"use client";

import { useRouter } from "next/navigation";
import { ReactNode } from "react";
import {
  PHASES,
  STEPS,
  stepIndexById,
  stepById,
  allPhaseGroups,
  type PhaseId,
} from "@/lib/wizard/steps";

interface PhaseLayoutProps {
  children: ReactNode;
  stepId: string;
  title: string;
  description: string;
  onNext?: () => boolean;
  nextLabel?: string;
}

// Colores de acento por fase — mismo idioma de color que ai-office
const PHASE_ACCENT: Record<PhaseId, { bar: string; badge: string; text: string }> = {
  base:     { bar: "bg-brand",       badge: "bg-brand/10 text-brand border-brand/20",           text: "text-brand" },
  overlay:  { bar: "bg-violet-500",  badge: "bg-violet-50 text-violet-700 border-violet-200",   text: "text-violet-600" },
  register: { bar: "bg-amber-500",   badge: "bg-amber-50 text-amber-700 border-amber-200",      text: "text-amber-600" },
  review:   { bar: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", text: "text-emerald-600" },
};

export function PhaseLayout({
  children,
  stepId,
  title,
  description,
  onNext,
  nextLabel = "Siguiente",
}: PhaseLayoutProps) {
  const router = useRouter();
  const current = stepIndexById(stepId);
  const step = stepById(stepId);
  const phase = PHASES.find((p) => p.id === step?.phase);
  const groups = allPhaseGroups();
  const isLast = current >= STEPS.length - 1;
  const accent = phase ? PHASE_ACCENT[phase.id] : PHASE_ACCENT.base;

  const handleNext = () => {
    if (onNext && !onNext()) return;
    const next = STEPS[current + 1];
    if (next) router.push(next.route);
  };

  const handleBack = () => {
    const prev = STEPS[current - 1];
    if (prev) router.push(prev.route);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">

      {/* ── Header: clon exacto del header de AI Office ─────────────────── */}
      <header className="sticky top-0 z-30 border-b border-white/5" style={{ background: "#0E0F14" }}>
        <div className="container-page flex h-16 items-center gap-2 text-white sm:gap-4">
          {/* Logo */}
          <div className="flex flex-1 items-center justify-start">
            <span className="whitespace-nowrap font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              AI Office{" "}
              <span className="font-sans text-sm font-normal text-white/40 tracking-normal">
                configurator
              </span>
            </span>
          </div>

          {/* Pasos de la fase actual como nav central (visible ≥ md) */}
          <nav className="hidden md:flex items-center gap-1 text-sm">
            {groups.map((g) => {
              const isActive = g.phase.id === step?.phase;
              const isDone = g.steps.length > 0 && g.steps.every((s) => stepIndexById(s.id) < current);
              const disabled = !g.phase.ready;
              return (
                <span
                  key={g.phase.id}
                  title={disabled ? "Deshabilitado por ahora" : undefined}
                  className={[
                    "relative inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 sm:px-2.5 transition-colors",
                    disabled
                      ? "text-white/25 line-through decoration-white/20"
                      : isActive ? "bg-white/15 text-white" : isDone ? "text-white/50" : "text-white/30",
                  ].join(" ")}
                >
                  {isDone && !disabled && <span className="w-3 h-3 inline-flex items-center justify-center">✓</span>}
                  <span className="hidden sm:inline">{g.phase.label}</span>
                </span>
              );
            })}
          </nav>

          {/* Derecha: paso actual + acceso a descargas */}
          <div className="flex flex-1 items-center justify-end gap-3">
            <span className="text-xs text-white/50 hidden sm:inline">{step?.label}</span>
            <a
              href="/descargas"
              title="Descargar instaladores (Windows / macOS)"
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              <span className="hidden sm:inline">Descargas</span>
            </a>
          </div>
        </div>

        {/* Barra de progreso — bajo el header, igual que el dock row de ai-office */}
        <div className="border-t border-white/5">
          <div className="container-page py-2.5">
            <div className="flex items-center gap-4">
              {groups.map((g) => {
                const isActive = g.phase.id === step?.phase;
                const isDone = g.steps.length > 0 && g.steps.every((s) => stepIndexById(s.id) < current);
                const disabled = !g.phase.ready;
                const barColor = PHASE_ACCENT[g.phase.id].bar;
                return (
                  <div key={g.phase.id} className="flex items-center gap-2 flex-1 min-w-0">
                    <span className={`text-[11px] font-semibold whitespace-nowrap hidden sm:inline ${
                      disabled ? "text-white/15" : isActive ? "text-white/80" : isDone ? "text-white/40" : "text-white/20"
                    }`}>
                      {g.phase.label}
                    </span>
                    <div className="flex gap-1 flex-1">
                      {g.steps.length === 0 ? (
                        <div className="h-1 flex-1 rounded-full bg-white/[0.04]" title="Deshabilitado por ahora" />
                      ) : (
                        g.steps.map((s) => {
                          const idx = stepIndexById(s.id);
                          const done = idx < current;
                          const cur = idx === current;
                          return (
                            <div
                              key={s.id}
                              title={s.label}
                              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                                cur ? barColor : done ? `${barColor} opacity-50` : "bg-white/10"
                              }`}
                            />
                          );
                        })
                      )}
                    </div>
                    {g.phase.id !== groups[groups.length - 1].phase.id && (
                      <span className="text-white/15 text-xs hidden sm:inline">›</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      {/* ── Contenido principal ──────────────────────────────────────────── */}
      <main className="flex-1 py-8 sm:py-10">
        <div className="container-page">

          {/* Cabecera del paso */}
          <div className="mb-6 sm:mb-8">
            {phase && (
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border mb-3 ${accent.badge}`}>
                {phase.label}
              </span>
            )}
            <h1 className="text-2xl sm:text-3xl font-display font-semibold text-foreground tracking-tight">
              {title}
            </h1>
            <p className="mt-1.5 text-sm sm:text-base text-muted-foreground max-w-2xl">
              {description}
            </p>
          </div>

          {/* Card contenido */}
          <div className="card-soft p-6 sm:p-8 animate-fade-in-up">
            {children}
          </div>

          {/* Navegación */}
          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={handleBack}
              disabled={current <= 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
              Atrás
            </button>

            {!isLast && (
              <button
                onClick={handleNext}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
              >
                {nextLabel}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
