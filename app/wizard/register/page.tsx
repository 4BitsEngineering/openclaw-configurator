"use client";

import { PhaseLayout } from "@/components/wizard/phase-layout";
import { useWizard } from "@/lib/wizard-context";
import { useEffect, useState } from "react";

function slugify(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "instance";
}

const PLANS = ["STARTER", "PRO", "BUSINESS", "ENTERPRISE"] as const;

// Features conocidas del control plane (clawhub). Opt-in; viajan como metadata
// en el manifiesto (registration.features).
const FEATURES = [
  { id: "kill-switch", label: "Kill-switch remoto", hint: "Suspender/reactivar la instancia desde clawhub por suscripción." },
  { id: "usage-telemetry", label: "Telemetría de uso", hint: "Reporta uso (heartbeat) a clawhub para facturación/observabilidad." },
];

type RegisterResult = {
  firm_id: string;
  firm_name: string;
  firm_created: boolean;
  pairing_code: string;
  expires_at: string;
  baseline_id: string;
  baseline_version: number;
  file_count: number;
  total_bytes: number;
  installer_url: string;
};

export default function RegisterStep() {
  const { config, resetWizard } = useWizard();
  const team = config.clawcrewTeam;
  const name = team?.overlayName || "Instancia";
  const prefix = team?.prefix || "office";

  const [firmName, setFirmName] = useState(name);
  const [plan, setPlan] = useState<(typeof PLANS)[number]>(
    (config.registration?.plan?.toUpperCase() as (typeof PLANS)[number]) || "STARTER",
  );
  const [features, setFeatures] = useState<string[]>(config.registration?.features ?? []);
  const [accessPwd, setAccessPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<RegisterResult | null>(null);
  const [copied, setCopied] = useState(false);
  // null = consultando; "disabled" = sin cobro; "mock" = pago simulado; "stripe" = real.
  const [billingMode, setBillingMode] = useState<"stripe" | "mock" | "disabled" | null>(null);
  const [seats, setSeats] = useState(1);
  const [paying, setPaying] = useState(false);

  // "disabled-si-no-configurado": el server dice el modo de cobro. Si no hay
  // ninguno, el pago se muestra deshabilitado y el wizard sigue con el gate de
  // operador (contraseña). Nunca bloquea ni rompe el paso.
  useEffect(() => {
    let alive = true;
    fetch("/api/billing/status")
      .then((r) => r.json())
      .then((j) => alive && setBillingMode(j?.mode === "stripe" || j?.mode === "mock" ? j.mode : "disabled"))
      .catch(() => alive && setBillingMode("disabled"));
    return () => {
      alive = false;
    };
  }, []);

  const toggleFeature = (id: string) =>
    setFeatures((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

  const register = async () => {
    if (!firmName.trim()) {
      setErr("Indica el nombre de la firma / cliente.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/register", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-configurator-token": accessPwd,
        },
        body: JSON.stringify({ config, firm: { name: firmName.trim(), plan }, features }),
      });
      const j = await r.json();
      if (!r.ok) {
        if (j?.error === "access_denied") {
          throw new Error("Contraseña de acceso incorrecta.");
        }
        const detail = j?.clawhub?.error || j?.detail || j?.error || `HTTP ${r.status}`;
        throw new Error(detail);
      }
      setResult(j as RegisterResult);
      resetWizard(); // alta OK → limpia el estado persistido para la próxima firma
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  // Pago SIMULADO (modo mock): mismo resultado que un alta real (código +
  // instalador), sin Stripe. Cuando se enchufe Stripe, este botón redirigirá a
  // la Checkout Session real en su lugar.
  const payMock = async () => {
    if (!firmName.trim()) {
      setErr("Indica el nombre de la firma / cliente.");
      return;
    }
    setPaying(true);
    setErr("");
    try {
      const r = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ config, firm: { name: firmName.trim(), plan }, seats, features }),
      });
      const j = await r.json();
      if (!r.ok) {
        const detail = j?.clawhub?.error || j?.detail || j?.error || `HTTP ${r.status}`;
        throw new Error(detail);
      }
      setResult(j as RegisterResult);
      resetWizard(); // alta OK → limpia el estado persistido para la próxima firma
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setPaying(false);
    }
  };

  const copyCode = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.pairing_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard puede no estar disponible — no crítico */
    }
  };

  const expiresLabel = result
    ? new Date(result.expires_at).toLocaleString("es-ES", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <PhaseLayout
      stepId="register"
      title="Registrar y obtener el instalador"
      description="Registra esta instancia en clawhub: se crea/usa la firma del cliente, se guarda el paquete del wizard y se emite el código de instalación."
    >
      <div className="space-y-6">
        {!result && (
          <>
            {/* Identidad (derivada del equipo) */}
            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <h3 className="mb-3 text-sm font-semibold text-foreground">Identidad de la instancia</h3>
              <dl className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Nombre</dt>
                  <dd className="font-medium text-foreground">{name}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Slug</dt>
                  <dd className="font-mono text-brand">{slugify(name)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Prefijo agentes</dt>
                  <dd className="font-mono text-foreground">{prefix}</dd>
                </div>
              </dl>
              <p className="mt-3 text-[11px] text-muted-foreground">Se edita en el paso «Equipo» de la Fase 2.</p>
            </div>

            {/* Firma + plan */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Firma / cliente
                </label>
                <input
                  value={firmName}
                  onChange={(e) => setFirmName(e.target.value)}
                  placeholder="Despacho Acme"
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-brand/50"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Si ya existe en clawhub se reutiliza; si no, se da de alta.
                </p>
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Plan</label>
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value as (typeof PLANS)[number])}
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-brand/50"
                >
                  {PLANS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-muted-foreground">Determina los PCs (seats) que podrá parear.</p>
              </div>
            </div>

            {/* Pago online. mock = pago SIMULADO (demo, no cobra); disabled =
                no configurado → se muestra deshabilitado y el alta sigue por el
                gate de operador de abajo. Cuando STRIPE_* esté en el entorno, el
                modo será "stripe" y este bloque redirigirá a Checkout (Fase 3). */}
            {billingMode === "mock" && (
              <div className="rounded-xl border border-emerald-300/60 bg-emerald-50/50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">💳 Pago online</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Modo demo: no se cobra. Crea la firma con los PCs elegidos.
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-emerald-800">
                    Mock
                  </span>
                </div>
                <div className="mt-3 flex items-end gap-3">
                  <div className="w-28">
                    <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      PCs (seats)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={seats}
                      onChange={(e) =>
                        setSeats(Math.max(1, Math.min(100, Math.floor(Number(e.target.value) || 1))))
                      }
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-brand/50"
                    />
                  </div>
                  <button
                    onClick={payMock}
                    disabled={paying}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-60"
                  >
                    {paying ? "Procesando pago…" : "Pagar (simulado) y obtener instalador"}
                  </button>
                </div>
              </div>
            )}

            {billingMode === "disabled" && (
              <div
                aria-disabled="true"
                className="rounded-xl border border-dashed border-border bg-muted/30 p-4 opacity-70"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">💳 Pago online</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Pago con tarjeta para alta automática. Próximamente.
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Disabled
                  </span>
                </div>
                <button
                  type="button"
                  disabled
                  className="mt-3 inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-muted px-5 py-2.5 text-sm font-semibold text-muted-foreground"
                >
                  Pagar y obtener instalador
                </button>
              </div>
            )}

            {/* Vía de operador (gate por contraseña) — se mantiene SIEMPRE en
                paralelo (ventas manuales/enterprise), decisión de producto. */}
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Contraseña de acceso
              </label>
              <input
                type="password"
                value={accessPwd}
                onChange={(e) => setAccessPwd(e.target.value)}
                placeholder="La contraseña que te pasó el operador"
                autoComplete="off"
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-brand/50"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Necesaria para registrar en el control plane. Si instalas en local sin gate, déjala vacía.
              </p>
            </div>

            {/* Features */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-foreground">Capacidades de control plane</h3>
              <div className="space-y-2">
                {FEATURES.map((f) => (
                  <label
                    key={f.id}
                    className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:border-brand/40"
                  >
                    <span>
                      <span className="block font-medium text-foreground">{f.label}</span>
                      <span className="text-xs text-muted-foreground">{f.hint}</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={features.includes(f.id)}
                      onChange={() => toggleFeature(f.id)}
                      className="mt-1 shrink-0"
                    />
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={register}
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {busy ? "Registrando en clawhub…" : "Registrar y emitir código"}
            </button>
          </>
        )}

        {err && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">⚠️ {err}</p>
        )}

        {result && (
          <div className="space-y-5">
            {/* Código de instalación */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                Código de instalación
              </div>
              <div className="mt-2 font-mono text-3xl font-bold tracking-[0.2em] text-amber-900">
                {result.pairing_code}
              </div>
              <button
                onClick={copyCode}
                className="mt-3 rounded-lg border border-amber-300 bg-white/60 px-3 py-1.5 text-xs font-medium text-amber-800 transition-colors hover:bg-white"
              >
                {copied ? "¡Copiado!" : "Copiar código"}
              </button>
              <p className="mt-3 text-xs text-amber-700/80">
                Caduca el {expiresLabel}. El cliente lo introduce en el instalador para parear su PC.
              </p>
            </div>

            {/* Resumen del registro */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { k: "Firma", v: result.firm_name + (result.firm_created ? " (nueva)" : "") },
                { k: "Paquete", v: `baseline v${result.baseline_version}` },
                { k: "Archivos", v: String(result.file_count) },
                { k: "Tamaño", v: `${(result.total_bytes / 1024).toFixed(1)} KB` },
              ].map((s) => (
                <div key={s.k} className="rounded-xl border border-border bg-muted/40 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.k}</div>
                  <div className="mt-0.5 truncate text-sm font-medium text-foreground" title={s.v}>
                    {s.v}
                  </div>
                </div>
              ))}
            </div>

            {/* Descargar instalador */}
            <a
              href={result.installer_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              Descargar instalador
            </a>
            <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
              El instalador lleva el código, parea el PC contra clawhub (registra la MAC y consume un seat)
              y descarga este paquete para provisionar la instancia. Si aún no se ha publicado un instalador
              para el canal, el enlace devolverá <code className="text-foreground">no_installer_published</code>.
            </p>
          </div>
        )}
      </div>
    </PhaseLayout>
  );
}
