"use client";

import { PhaseLayout } from "@/components/wizard/phase-layout";
import { useWizard } from "@/lib/wizard-context";
import { ChannelIcon } from "@/lib/channel-icon";
import { SUPPORTED_LIST, UPCOMING_LIST } from "@/lib/channels-meta";
import { useState } from "react";

export default function ChannelsStep() {
  const { config, updateConfig, markTouched } = useWizard();

  // Set de ids de canal soportados que el operador ha activado.
  const [selected, setSelected] = useState<Set<string>>(() => {
    const init = new Set<string>();
    for (const c of SUPPORTED_LIST) {
      if (config.channels?.[c.id]) init.add(c.id);
    }
    return init;
  });

  const toggle = (id: string) => {
    markTouched("channels");
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleNext = () => {
    // CERO secretos: solo marcamos qué canales (presencia = activado). Los tokens
    // los pedirá el instalador en destino vía manifest.env.
    const channels: Record<string, { enabled: boolean }> = {};
    for (const id of selected) channels[id] = { enabled: true };
    updateConfig({ channels });
    return true;
  };

  const authBadge: Record<string, string> = {
    qr: "Por QR",
    token: "Por token",
    config: "Configuración",
  };

  return (
    <PhaseLayout
      stepId="channels"
      title="Canales de mensajería"
      description="Elige por qué canales hablará la instancia. Los tokens no se piden aquí: el instalador los solicitará en destino."
      onNext={handleNext}
    >
      <div className="flex min-h-[51rem] flex-col gap-8">
        {/* Nota: ninguno es válido */}
        <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Todos los canales son opcionales.</span>{" "}
          Si no eliges ninguno, la instancia funcionará igualmente y la interacción irá
          únicamente por la <span className="font-medium text-foreground">web de AI Office</span>.
        </div>

        {/* Disponibles ahora */}
        <section>
          <div className="panel-eyebrow mb-3">Disponibles ahora</div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SUPPORTED_LIST.map((ch) => {
              const isOn = selected.has(ch.id);
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => toggle(ch.id)}
                  className={[
                    "group relative flex flex-col gap-3 rounded-2xl border p-5 text-left transition-all",
                    isOn
                      ? "border-brand bg-brand/5 ring-1 ring-brand shadow-sm"
                      : "border-border bg-card hover:border-brand/40 hover:bg-accent/40",
                  ].join(" ")}
                >
                  {/* Check de seleccionado */}
                  <span
                    className={[
                      "absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full border text-[11px] transition-colors",
                      isOn
                        ? "border-brand bg-brand text-white"
                        : "border-border bg-background text-transparent group-hover:border-brand/40",
                    ].join(" ")}
                  >
                    ✓
                  </span>

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted/60">
                    <ChannelIcon id={ch.id} size={26} />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{ch.label}</span>
                      <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {authBadge[ch.authStyle]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{ch.blurb}</p>
                  </div>

                  <p className="mt-auto text-xs text-muted-foreground/80">{ch.authNote}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Próximamente */}
        <section className="flex flex-1 flex-col">
          <div className="panel-eyebrow mb-3">
            Próximamente{" "}
            <span className="font-normal normal-case tracking-normal text-muted-foreground">
              · {UPCOMING_LIST.length} canales más de OpenClaw
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {UPCOMING_LIST.map((ch) => (
              <div
                key={ch.id}
                title={`${ch.label} — próximamente`}
                className="flex items-center gap-2.5 rounded-xl border border-dashed border-border/70 bg-muted/20 px-3 py-2.5 opacity-70"
              >
                <ChannelIcon id={ch.id} size={20} muted />
                <span className="truncate text-sm text-muted-foreground">{ch.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-auto pt-4 text-xs text-muted-foreground">
            Estos canales existen en OpenClaw pero todavía no están validados en AI Office.
            Se irán habilitando en próximas versiones.
          </p>
        </section>
      </div>
    </PhaseLayout>
  );
}
