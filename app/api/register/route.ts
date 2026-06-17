import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { generateInstancePackage } from "@/lib/generators";
import { PACKAGE_PATHS } from "@/lib/contract/types";
import type { WizardConfig } from "@/lib/wizard-context";

// Registro de la instancia en clawhub al cerrar el wizard.
//
// Este handler corre en el SERVIDOR del configurator: genera el paquete con
// generateInstancePackage(config) y lo sube a clawhub vía POST /api/v0/register
// usando OPERATOR_API_KEY (secreto de servidor, NUNCA viaja al navegador).
// clawhub resuelve/crea la Firm, guarda el paquete como FirmBaseline promovido
// y devuelve un pairing code que el cliente lleva al instalador.
//
// Env requeridas (en el deploy del configurator):
//   CLAWHUB_URL        p.ej. https://clawhub-three.vercel.app
//   OPERATOR_API_KEY   misma key M2M que usa clawhub para bundles/register

export const dynamic = "force-dynamic";

// path del paquete → categoría de FirmBaselineFile en clawhub. El único con
// categoría propia es openclaw.json; el resto del handoff (overlay-config,
// manifiesto, install.sh, .env.example) va como OTHER — clawhub no necesita
// distinguirlos para servirlos al instalador.
function categoryFor(path: string): "OPENCLAW_CONFIG" | "OTHER" {
  return path === PACKAGE_PATHS.base ? "OPENCLAW_CONFIG" : "OTHER";
}

interface RegisterRequest {
  config: WizardConfig;
  firm: {
    id?: string;
    name?: string;
    plan?: "STARTER" | "PRO" | "BUSINESS" | "ENTERPRISE";
    seatsPurchased?: number;
  };
  // Features de control plane elegidas en el step Registro. Se pliegan en
  // config.registration para que el manifiesto generado las lleve.
  features?: string[];
}

export async function POST(req: Request) {
  const clawhubUrl = process.env.CLAWHUB_URL;
  const operatorKey = process.env.OPERATOR_API_KEY;
  if (!clawhubUrl || !operatorKey) {
    return NextResponse.json(
      {
        error: "configurator_misconfigured",
        detail:
          "Faltan CLAWHUB_URL u OPERATOR_API_KEY en el entorno del configurator.",
      },
      { status: 500 },
    );
  }

  let body: RegisterRequest;
  try {
    body = (await req.json()) as RegisterRequest;
  } catch (e) {
    return NextResponse.json({ error: "bad_request", detail: String(e) }, { status: 400 });
  }

  if (!body?.firm || (!body.firm.id && !body.firm.name)) {
    return NextResponse.json(
      { error: "firm_required", detail: "Indica el nombre o el id de la firma." },
      { status: 400 },
    );
  }

  // 1) Generar el paquete (mismo que la pantalla de Revisión). Plegamos el
  // plan/features elegidos aquí en config.registration para que el manifiesto
  // refleje el registro real (no solo lo que se capturó en pasos anteriores).
  const cfg: WizardConfig = {
    ...body.config,
    registration: {
      plan: body.firm.plan ?? body.config.registration?.plan ?? null,
      features: body.features ?? body.config.registration?.features ?? [],
    },
  };
  let files: Record<string, string>;
  try {
    files = generateInstancePackage(cfg);
  } catch (e) {
    return NextResponse.json({ error: "generate_failed", detail: String(e) }, { status: 400 });
  }

  // 2) Mapear el paquete a la forma de FirmBaselineFile que espera clawhub.
  const baselineFiles = Object.entries(files).map(([path, content]) => ({
    path,
    category: categoryFor(path),
    content,
    sha256: crypto.createHash("sha256").update(content, "utf8").digest("hex"),
    sizeBytes: Buffer.byteLength(content, "utf8"),
    isBinary: false,
  }));

  const instanceName = body.config.clawcrewTeam?.overlayName || "Instancia";

  // 3) Llamar a clawhub (M2M).
  let clawhubRes: Response;
  try {
    clawhubRes = await fetch(`${clawhubUrl.replace(/\/$/, "")}/api/v0/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${operatorKey}`,
      },
      body: JSON.stringify({
        firm: body.firm,
        label: `Configurator — ${instanceName}`,
        description: `Paquete generado por el configurator para "${instanceName}".`,
        files: baselineFiles,
      }),
    });
  } catch (e) {
    return NextResponse.json(
      { error: "clawhub_unreachable", detail: String(e) },
      { status: 502 },
    );
  }

  const data = await clawhubRes.json().catch(() => ({}));
  if (!clawhubRes.ok) {
    return NextResponse.json(
      { error: "clawhub_register_failed", status: clawhubRes.status, clawhub: data },
      { status: clawhubRes.status },
    );
  }

  // 4) Componer el enlace de descarga del instalador (clawhub redirige al .exe
  // del bundle INSTALLER del canal; 404 si aún no se ha publicado ninguno).
  const code = (data as { pairing_code?: string }).pairing_code;
  const installerUrl = `${clawhubUrl.replace(/\/$/, "")}/api/v0/installer?channel=stable${
    code ? `&pairing=${encodeURIComponent(code)}` : ""
  }`;

  return NextResponse.json({ ...data, installer_url: installerUrl });
}
