import { headers } from "next/headers";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Descargar AI Office — Instaladores",
  description: "Descarga el instalador de AI Office para Windows o macOS.",
  robots: { index: false, follow: false },
};

// Zona de descargas abierta (sin login). Server Component: detecta el SO por el
// User-Agent y construye los enlaces a clawhub (que redirige 302 al instalador
// firmado en Supabase). La URL de clawhub no se expone al cliente.
type Os = "windows" | "darwin" | "linux";

const INSTALLERS: { id: Os; label: string; sub: string; note?: string }[] = [
  { id: "windows", label: "Windows", sub: "Windows 10 / 11 · instalador .exe" },
  {
    id: "darwin",
    label: "macOS",
    sub: "Apple Silicon (M1+) · imagen .dmg",
    note: "La primera vez, haz clic derecho sobre la app → «Abrir» (aún sin firmar con Apple).",
  },
];

function detectOs(ua: string): Os {
  if (/Macintosh|Mac OS/i.test(ua)) return "darwin";
  if (/Linux/i.test(ua) && !/Android/i.test(ua)) return "linux";
  return "windows";
}

export default async function DownloadsPage() {
  const h = await headers();
  const ua = h.get("user-agent") || "";
  const detected = detectOs(ua);
  const base = (process.env.CLAWHUB_URL || "").replace(/\/$/, "");
  const href = (os: Os) => `${base}/api/v0/installer?channel=stable&platform=${os}`;

  // El SO detectado va primero (botón destacado); el resto, debajo.
  const primary = INSTALLERS.find((i) => i.id === detected) ?? INSTALLERS[0];
  const others = INSTALLERS.filter((i) => i.id !== primary.id);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-8 px-6 py-16">
      <header className="text-center">
        <h1 className="font-display text-3xl font-bold text-foreground">Descargar AI Office</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Elige tu sistema operativo. El instalador se descarga directamente.
        </p>
      </header>

      {!base ? (
        <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          No hay servidor de descargas configurado (falta <code className="font-mono">CLAWHUB_URL</code>).
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* SO detectado — botón principal */}
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Detectado: {primary.label}
            </p>
            <a
              href={href(primary.id)}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              Descargar para {primary.label}
            </a>
            <p className="mt-2 text-xs text-muted-foreground">{primary.sub}</p>
            {primary.note && <p className="mt-1 text-[11px] text-muted-foreground">{primary.note}</p>}
          </div>

          {/* Otros sistemas */}
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="mb-3 text-sm font-semibold text-foreground">Otros sistemas</p>
            <ul className="flex flex-col gap-3">
              {others.map((it) => (
                <li key={it.id} className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{it.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{it.sub}</p>
                  </div>
                  <a
                    href={href(it.id)}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-brand/40"
                  >
                    Descargar
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </main>
  );
}
