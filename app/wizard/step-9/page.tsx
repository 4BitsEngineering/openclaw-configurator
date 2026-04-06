"use client";

import { useState } from "react";
import { useWizard } from "@/lib/wizard-context";
import {
  generateConfigYAML,
  generateEnvFile,
  generateInstallScript,
  generateAgentsConfig,
  generateBridgeConfig,
  generateGuardClawConfig,
} from "@/lib/generators";

type HealthData = {
  integrationMode?: string;
  connectorReadiness?: Record<string, { configured: boolean; writeEnabled: boolean }>;
  [key: string]: unknown;
};

export default function Step9() {
  const { config } = useWizard();
  const [verifyStatus, setVerifyStatus] = useState<"idle" | "checking" | "ok" | "error">("idle");
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [verifyError, setVerifyError] = useState("");

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAllFiles = () => {
    downloadFile("openclaw.yaml", generateConfigYAML(config));
    downloadFile("agents-config.yaml", generateAgentsConfig(config));
    downloadFile("bridge-config.yaml", generateBridgeConfig(config));
    downloadFile("guardclaw-config.yaml", generateGuardClawConfig(config));
    downloadFile(".env", generateEnvFile(config));
    downloadFile("install.sh", generateInstallScript(config));
  };

  const verifyInstallation = async () => {
    setVerifyStatus("checking");
    setHealthData(null);
    setVerifyError("");
    try {
      const r = await fetch("http://localhost:3700/api/health");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data: HealthData = await r.json();
      setHealthData(data);
      setVerifyStatus("ok");
    } catch (e) {
      setVerifyError(e instanceof Error ? e.message : "No se pudo conectar a localhost:3700");
      setVerifyStatus("error");
    }
  };

  const FILES: { name: string; emoji: string; generator: () => string }[] = [
    { name: "openclaw.yaml", emoji: "📄", generator: () => generateConfigYAML(config) },
    { name: "agents-config.yaml", emoji: "🤖", generator: () => generateAgentsConfig(config) },
    { name: "bridge-config.yaml", emoji: "🌉", generator: () => generateBridgeConfig(config) },
    { name: "guardclaw-config.yaml", emoji: "🛡️", generator: () => generateGuardClawConfig(config) },
    { name: ".env", emoji: "🔐", generator: () => generateEnvFile(config) },
    { name: "install.sh", emoji: "🛠️", generator: () => generateInstallScript(config) },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 dot-pattern">
      <div className="w-full max-w-3xl animate-fadeIn">
        {/* Progress complete */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-slate-400">Step 9 of 9</span>
            <span className="text-sm text-emerald-400 font-medium">100% completo</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full rounded-full w-full transition-all duration-500" style={{ background: "linear-gradient(90deg, #06b6d4, #3b82f6, #10b981)" }} />
          </div>
        </div>

        {/* Success Card */}
        <div className="glass-card shadow-2xl shadow-black/20 p-8 animate-fadeInUp">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4 animate-float">🎉</div>
            <h1 className="text-3xl font-bold mb-2 gradient-text">Stack Empresarial Listo</h1>
            <p className="text-slate-400">
              OpenClaw + autonomous-agents + GuardClaw configurados
            </p>
          </div>

          {/* Stack summary badges */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {["OpenClaw", "autonomous-agents", "GuardClaw"].map((component) => (
              <span
                key={component}
                className="px-3 py-1 text-xs font-medium rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30"
              >
                {component}
              </span>
            ))}
          </div>

          {/* Download All */}
          <button
            onClick={downloadAllFiles}
            className="w-full px-6 py-4 rounded-xl mb-4 font-semibold text-lg transition-all shadow-lg btn-primary flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Descargar Todos los Ficheros (6)
          </button>

          {/* Individual downloads */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-8">
            {FILES.map((f) => (
              <button
                key={f.name}
                onClick={() => downloadFile(f.name, f.generator())}
                className="px-3 py-2.5 rounded-lg bg-slate-700/60 hover:bg-slate-600/60 border border-slate-600/50 hover:border-slate-500 transition-all text-left group"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg shrink-0">{f.emoji}</span>
                  <span className="text-xs font-mono text-slate-300 group-hover:text-white truncate">{f.name}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Deploy info */}
          <div className="p-4 bg-violet-500/10 border border-violet-500/30 rounded-xl mb-4">
            <div className="font-semibold mb-2">🚀 Deploy (opcional)</div>
            <p className="text-sm text-slate-300 mb-2">
              No se ejecuta ningún deploy automático. Solo referencias para cuando quieras publicar.
            </p>
            <div className="text-sm space-x-3">
              <a href="https://railway.app/new" target="_blank" rel="noreferrer" className="text-violet-300 underline">Railway</a>
              <a href="https://vercel.com/new" target="_blank" rel="noreferrer" className="text-violet-300 underline">Vercel</a>
              <a href="https://dashboard.render.com" target="_blank" rel="noreferrer" className="text-violet-300 underline">Render</a>
            </div>
          </div>

          {/* Next Steps */}
          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl mb-6">
            <div className="font-semibold mb-2">📋 Próximos pasos:</div>
            <ol className="text-sm text-slate-300 space-y-2 list-decimal list-inside">
              <li>Descarga todos los ficheros con el botón de arriba</li>
              <li>Ejecuta <code className="bg-slate-700 px-1 rounded">bash install.sh</code> — clona el repo, instala deps y arranca el bridge</li>
              <li>El script lee <code className="bg-slate-700 px-1 rounded">~/.openclaw/openclaw.json</code> para obtener el GATEWAY_TOKEN automáticamente</li>
              <li>Work Console UI: <code className="bg-slate-700 px-1 rounded">http://localhost:8080</code></li>
              <li>Usa el botón de verificación aquí abajo para confirmar que el bridge responde</li>
            </ol>
          </div>

          {/* Verification */}
          <div className="p-4 bg-slate-700/40 border border-slate-600/50 rounded-xl mb-4">
            <div className="font-semibold mb-2">🔍 Verificar instalación</div>
            <p className="text-sm text-slate-400 mb-3">
              Después de ejecutar <code className="bg-slate-700 px-1 rounded">install.sh</code>, comprueba que el bridge responde.
            </p>
            <button
              onClick={verifyInstallation}
              disabled={verifyStatus === "checking"}
              className="px-4 py-2 rounded-lg border border-slate-500 hover:border-cyan-500 text-sm transition-colors disabled:opacity-50"
            >
              {verifyStatus === "checking" ? "Verificando..." : "Verificar instalación"}
            </button>

            {verifyStatus === "ok" && healthData && (
              <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-sm space-y-1">
                <div className="text-emerald-300 font-medium">Bridge activo</div>
                {healthData.integrationMode && (
                  <div className="text-slate-300">
                    Modo: <code className="bg-slate-700 px-1 rounded">{healthData.integrationMode}</code>
                  </div>
                )}
                {healthData.connectorReadiness && (
                  <div className="text-slate-300">
                    Conectores:{" "}
                    {Object.entries(healthData.connectorReadiness).map(([name, info]) => (
                      <span key={name} className={`inline-block mr-2 px-1.5 py-0.5 rounded text-xs ${info.configured ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-600 text-slate-400"}`}>
                        {name} {info.configured ? "✓" : "—"}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {verifyStatus === "error" && (
              <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-sm text-rose-300">
                No se pudo conectar al bridge: {verifyError}
                <div className="text-slate-400 mt-1">Asegúrate de haber ejecutado <code className="bg-slate-700 px-1 rounded">install.sh</code> y que el bridge está arrancado.</div>
              </div>
            )}
          </div>

          {/* Resources */}
          <div className="pt-4 border-t border-white/[0.06] space-y-2 text-center text-sm text-slate-400">
            <div>
              📚 <a href="https://docs.openclaw.ai" className="text-blue-400 hover:underline">Documentation</a>
              {" · "}
              💬 <a href="https://discord.gg/clawd" className="text-blue-400 hover:underline">Discord Community</a>
              {" · "}
              🎁 <a href="https://clawhub.com" className="text-blue-400 hover:underline">ClawHub Skills</a>
            </div>
          </div>

          <div className="mt-6 text-center">
            <a href="/" className="text-sm text-slate-400 hover:text-slate-300 underline">
              ← Empezar de nuevo
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
