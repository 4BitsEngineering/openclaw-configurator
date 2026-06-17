"use client";

import { PhaseLayout } from "@/components/wizard/phase-layout";
import { useWizard } from "@/lib/wizard-context";
import { useState } from "react";

type Files = Record<string, string>;

const ARTIFACTS = [
  { path: "base/openclaw.json", label: "OpenClaw base", desc: "Proveedor, modelo, canales y plugins base.", lang: "json" },
  { path: "overlay/overlay-config.json", label: "Overlay", desc: "Agentes clawcrew + perfil de arranque + integraciones.", lang: "json" },
  { path: "instance-manifest.json", label: "Manifiesto", desc: "Identidad, ENV requeridas y registro (install-time).", lang: "json" },
  { path: "install.sh", label: "Instalador (arrancable)", desc: "Copia config, instala el overlay y arranca gateway + bridge + UI.", lang: "bash" },
  { path: ".env.example", label: "Plantilla de secretos", desc: "Las claves que pide esta instancia (vacías). Rellénalas y renombra a .env.", lang: "bash" },
];

export default function ReviewStep() {
  const { config } = useWizard();
  const [files, setFiles] = useState<Files | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const generate = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(config),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setFiles(j.files as Files);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  const download = (path: string, content: string, lang: string) => {
    const type = lang === "bash" ? "text/x-shellscript" : "application/json";
    const blob = new Blob([content], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = path.split("/").pop() || "config";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  };

  const downloadAll = () => {
    if (!files) return;
    for (const a of ARTIFACTS) if (files[a.path]) download(a.path, files[a.path], a.lang);
  };

  const summary = [
    { k: "Proveedor", v: Object.keys(config.providers || {}).join(", ") || "ollama (keyless)" },
    { k: "Canales", v: Object.keys(config.channels || {}).filter((c) => (config.channels as Record<string, unknown>)[c]).join(", ") || "solo web" },
    { k: "Agentes", v: `${(config.clawcrewTeam?.agents || []).filter((a) => a.enabled).length} activos` },
    { k: "Integraciones", v: Object.keys(config.integrations || {}).filter((i) => (config.integrations as Record<string, { enabled?: boolean }>)[i]?.enabled).join(", ") || "—" },
  ];

  return (
    <PhaseLayout
      stepId="review"
      title="Revisar y generar"
      description="Genera el paquete de configuración y el arrancable. No contiene secretos: solo placeholders ${ENV}."
    >
      <div className="space-y-6">
        {/* Resumen */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {summary.map((s) => (
            <div key={s.k} className="rounded-xl border border-border bg-muted/40 p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.k}</div>
              <div className="mt-0.5 truncate text-sm font-medium text-foreground" title={s.v}>{s.v}</div>
            </div>
          ))}
        </div>

        {!files && (
          <button
            onClick={generate}
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? "Generando…" : "Generar paquete + arrancable"}
          </button>
        )}

        {err && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">⚠️ {err}</p>}

        {files && (
          <div className="space-y-3">
            {ARTIFACTS.map((a) => {
              const content = files[a.path];
              if (!content) return null;
              const isOpen = open === a.path;
              return (
                <div key={a.path} className="overflow-hidden rounded-xl border border-border bg-card">
                  <div className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-brand">{a.path}</span>
                        <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {(content.length / 1024).toFixed(1)} KB
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">{a.desc}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button onClick={() => setOpen(isOpen ? null : a.path)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground">
                        {isOpen ? "Ocultar" : "Ver"}
                      </button>
                      <button onClick={() => download(a.path, content, a.lang)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground">
                        Descargar
                      </button>
                    </div>
                  </div>
                  {isOpen && (
                    <pre className="max-h-80 overflow-auto border-t border-border bg-muted/30 px-4 py-3 text-xs text-foreground/80">{content}</pre>
                  )}
                </div>
              );
            })}

            <div className="flex items-center gap-3 pt-1">
              <button onClick={downloadAll} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90">
                Descargar todo
              </button>
              <button onClick={generate} disabled={busy} className="rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                Regenerar
              </button>
            </div>

            <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Qué hace el instalador (ai-office-install) con esto:</span> copia{" "}
              <code className="text-foreground">base/openclaw.json</code>, configura el overlay con{" "}
              <code className="text-foreground">overlay-config.json</code>, pide en destino las variables declaradas en el{" "}
              <code className="text-foreground">manifiesto</code> (claves/tokens) y ejecuta{" "}
              <code className="text-foreground">install.sh</code> para arrancar gateway + bridge + consola.
            </div>
          </div>
        )}
      </div>
    </PhaseLayout>
  );
}
