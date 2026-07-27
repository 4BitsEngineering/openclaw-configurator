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

// ¿Hay instalador servible para este SO? Preguntamos a clawhub sin descargar
// nada (no seguimos el redirect): 302 = disponible. Cualquier otra cosa (404
// porque esa plataforma no se ha publicado, o porque su binario ya no está en
// el bucket) marca el botón como "todavía no disponible" en vez de mandar al
// visitante a una página de error. Fail-open: si clawhub no contesta a tiempo,
// mostramos el botón — un enlace que quizá funcione es mejor que esconder la
// descarga por un hipo de red.
async function isAvailable(base: string, os: Os): Promise<boolean> {
  if (!base) return false;
  try {
    const r = await fetch(
      `${base}/api/v0/installer?channel=stable&platform=${os}`,
      { redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(2500) },
    );
    return r.status >= 300 && r.status < 400;
  } catch {
    return true;
  }
}

export default async function DownloadsPage() {
  const h = await headers();
  const ua = h.get("user-agent") || "";
  const detected = detectOs(ua);
  const base = (process.env.CLAWHUB_URL || "").replace(/\/$/, "");
  const href = (os: Os) => `${base}/api/v0/installer?channel=stable&platform=${os}`;

  const availability = new Map<Os, boolean>(
    await Promise.all(
      INSTALLERS.map(async (i) => [i.id, await isAvailable(base, i.id)] as const),
    ),
  );
  const ready = (os: Os) => availability.get(os) !== false;

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
            {ready(primary.id) ? (
              <a
                href={href(primary.id)}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              >
                Descargar para {primary.label}
              </a>
            ) : (
              <p className="mt-3 rounded-lg border border-dashed border-border px-5 py-3 text-center text-sm text-muted-foreground">
                El instalador para {primary.label} todavía no está disponible.
              </p>
            )}
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
                  {ready(it.id) ? (
                    <a
                      href={href(it.id)}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-brand/40"
                    >
                      Descargar
                    </a>
                  ) : (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      No disponible
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </main>
  );
}
