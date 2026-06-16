"use client";

import { PhaseLayout } from "@/components/wizard/phase-layout";
import { useWizard } from "@/lib/wizard-context";
import { Users, ShieldCheck, ShieldBan } from "lucide-react";
import { useState } from "react";
import type { ComponentType } from "react";

type DmPolicy = "allow" | "allowlist" | "deny";

const POLICIES: {
  value: DmPolicy;
  label: string;
  desc: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
  recommended?: boolean;
}[] = [
  {
    value: "allowlist",
    label: "Solo lista permitida",
    desc: "Únicamente los usuarios que indiques pueden escribir por mensaje directo.",
    Icon: ShieldCheck,
    recommended: true,
  },
  {
    value: "allow",
    label: "Permitir a todos",
    desc: "Cualquiera que encuentre la instancia puede escribirle. No recomendado.",
    Icon: Users,
  },
  {
    value: "deny",
    label: "Denegar a todos",
    desc: "Nadie puede iniciar conversación por DM; la interacción va por la web.",
    Icon: ShieldBan,
  },
];

export default function SecurityStep() {
  const { config, updateConfig, markTouched } = useWizard();
  const [dmPolicy, setDmPolicy] = useState<DmPolicy>(config.security.dmPolicy);
  const [allowlist, setAllowlist] = useState((config.security.allowlist || []).join("\n"));

  const handleNext = () => {
    const allowlistArray = allowlist.split("\n").map((x) => x.trim()).filter(Boolean);
    updateConfig({ security: { dmPolicy, allowlist: allowlistArray } });
    return true;
  };

  const allowlistCount = allowlist.split("\n").map((x) => x.trim()).filter(Boolean).length;

  return (
    <PhaseLayout
      stepId="security"
      title="Seguridad y privacidad"
      description="Decide quién puede iniciar conversación con la instancia por mensaje directo."
      onNext={handleNext}
      nextLabel="Continuar a Overlay"
    >
      <div className="flex min-h-[51rem] flex-col gap-8">
        {/* Política de DM */}
        <section>
          <div className="panel-eyebrow mb-3">Política de mensajes directos</div>
          <div className="grid gap-4 sm:grid-cols-3">
            {POLICIES.map((p) => {
              const isOn = dmPolicy === p.value;
              const Icon = p.Icon;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => { setDmPolicy(p.value); markTouched("security"); }}
                  className={[
                    "group relative flex flex-col gap-3 rounded-2xl border p-5 text-left transition-all",
                    isOn
                      ? "border-brand bg-brand/5 ring-1 ring-brand shadow-sm"
                      : "border-border bg-card hover:border-brand/40 hover:bg-accent/40",
                  ].join(" ")}
                >
                  {/* Indicador radio */}
                  <span
                    className={[
                      "absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full border transition-colors",
                      isOn ? "border-brand" : "border-border group-hover:border-brand/40",
                    ].join(" ")}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full transition-colors ${isOn ? "bg-brand" : "bg-transparent"}`} />
                  </span>

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted/60">
                    <Icon size={22} className={isOn ? "text-brand" : "text-muted-foreground"} />
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">{p.label}</span>
                      {p.recommended && (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                          Recomendado
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{p.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Lista permitida (condicional) */}
        {dmPolicy === "allowlist" && (
          <section className="animate-fade-in-up">
            <div className="panel-eyebrow mb-3">
              Usuarios permitidos{" "}
              <span className="font-normal normal-case tracking-normal text-muted-foreground">
                · {allowlistCount} {allowlistCount === 1 ? "entrada" : "entradas"}
              </span>
            </div>
            <textarea
              value={allowlist}
              onChange={(e) => { setAllowlist(e.target.value); markTouched("security"); }}
              rows={7}
              placeholder={"@usuario_telegram\n+34600111222\nnombre#1234"}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Un identificador por línea (usuario, teléfono o handle según el canal).
              Puedes dejarla vacía ahora y completarla más tarde desde la consola.
            </p>
          </section>
        )}

        {/* Nota al fondo */}
        <div className="mt-auto rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Estos ajustes solo afectan a los mensajes directos por canal.</span>{" "}
          El acceso a la consola web de AI Office se protege aparte (login propio en la instalación).
        </div>
      </div>
    </PhaseLayout>
  );
}
