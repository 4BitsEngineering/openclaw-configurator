"use client";

import { PhaseLayout } from "@/components/wizard/phase-layout";
import { useWizard } from "@/lib/wizard-context";
import { useState } from "react";

type Files = Record<string, string>;

const ARTIFACTS = [
  { path: "base/openclaw.json", label: "OpenClaw base", desc: "Proveedor, canales y skills base." },
  { path: "overlay/overlay-config.json", label: "Overlay", desc: "Agentes clawcrew + perfil de arranque." },
  { path: "instance-manifest.json", label: "Manifiesto", desc: "Identidad, ENV requeridas y registro." },
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

  const download = (path: string, content: string) => {
    const blob = new Blob([content], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = path.split("/").pop() || "config.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  };

  const downloadAll = () => {
    if (!files) return;
    for (const a of ARTIFACTS) if (files[a.path]) download(a.path, files[a.path]);
  };

  return (
    <PhaseLayout stepId="review" title="Revisar y generar" description="Genera el paquete de configuración. No contiene secretos: solo placeholders.">
      <div className="space-y-6">
        {/* Resumen */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div className="p-3 bg-slate-700/40 rounded-lg border border-slate-600">
            <div className="text-slate-500 text-xs">Proveedores</div>
            <div className="font-medium">{Object.keys(config.providers || {}).join(", ") || "ollama (keyless)"}</div>
          </div>
          <div className="p-3 bg-slate-700/40 rounded-lg border border-slate-600">
            <div className="text-slate-500 text-xs">Canales</div>
            <div className="font-medium">{Object.keys(config.channels || {}).filter((c) => (config.channels as Record<string, unknown>)[c]).join(", ") || "—"}</div>
          </div>
          <div className="p-3 bg-slate-700/40 rounded-lg border border-slate-600">
            <div className="text-slate-500 text-xs">Agentes</div>
            <div className="font-medium">{(config.clawcrewTeam?.agents || []).filter((a) => a.enabled).length} activos</div>
          </div>
        </div>

        {!files && (
          <button onClick={generate} disabled={busy} className="btn-primary w-full justify-center py-3">
            {busy ? "Generando…" : "Generar paquete de configuración"}
          </button>
        )}

        {err && <p className="text-sm text-rose-400">❌ {err}</p>}

        {files && (
          <div className="space-y-3">
            {ARTIFACTS.map((a) => {
              const content = files[a.path];
              if (!content) return null;
              const isOpen = open === a.path;
              return (
                <div key={a.path} className="rounded-lg border border-slate-600 bg-slate-700/40">
                  <div className="flex items-center justify-between p-4">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        <span className="font-mono text-xs text-cyan-400">{a.path}</span>
                      </div>
                      <div className="text-xs text-slate-400">{a.desc} · {(content.length / 1024).toFixed(1)} KB</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setOpen(isOpen ? null : a.path)} className="px-3 py-1 rounded border border-slate-500 hover:border-cyan-500 text-xs">
                        {isOpen ? "Ocultar" : "Ver"}
                      </button>
                      <button onClick={() => download(a.path, content)} className="px-3 py-1 rounded border border-slate-500 hover:border-cyan-500 text-xs">
                        Descargar
                      </button>
                    </div>
                  </div>
                  {isOpen && (
                    <pre className="px-4 pb-4 text-xs text-slate-300 overflow-auto max-h-80 whitespace-pre-wrap break-all">{content}</pre>
                  )}
                </div>
              );
            })}

            <div className="flex items-center gap-3 pt-2">
              <button onClick={downloadAll} className="btn-primary flex-1 justify-center">Descargar todo</button>
              <button onClick={generate} disabled={busy} className="btn-ghost">Regenerar</button>
            </div>

            <p className="text-xs text-slate-500">
              Estos artefactos los consume el instalador: copia <code className="text-slate-400">base/openclaw.json</code>,
              configura el overlay con <code className="text-slate-400">overlay-config.json</code>, pide las variables del
              manifiesto en destino y siembra el perfil de arranque en el bridge.
            </p>
          </div>
        )}
      </div>
    </PhaseLayout>
  );
}
