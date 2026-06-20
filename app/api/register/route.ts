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
//
// SEGURIDAD: este endpoint hace de proxy de un secreto de operador (la
// OPERATOR_API_KEY). NO debe quedar expuesto sin autenticación. El deploy
// público del configurator DEBE ir detrás de auth de borde (Vercel Deployment
// Protection: password/SSO), que gatea toda la app. En código aplicamos defensa
// en profundidad: guard de mismo-origen (anti-CSRF), allowlist de campos de la
// firma (solo name + plan; NO se acepta firm.id → evita escritura cross-tenant)
// y validación del plan (evita escalada por body manipulado).

export const dynamic = "force-dynamic";

const VALID_PLANS = ["STARTER", "PRO", "BUSINESS", "ENTERPRISE"] as const;
type Plan = (typeof VALID_PLANS)[number];

// path del paquete → categoría de FirmBaselineFile en clawhub. El único con
// categoría propia es openclaw.json; el resto del handoff (overlay-config,
// manifiesto, install.sh, .env.example) va como OTHER — clawhub no necesita
// distinguirlos para servirlos al instalador.
function categoryFor(path: string): "OPENCLAW_CONFIG" | "OTHER" {
  return path === PACKAGE_PATHS.base ? "OPENCLAW_CONFIG" : "OTHER";
}

interface RegisterRequest {
  config: WizardConfig;
  // Solo se acepta el NOMBRE de la firma (clawhub la crea/reusa) y el plan
  // (validado). NO se acepta firm.id desde el cliente: aceptarlo permitiría
  // escribir el baseline en una firma ajena (cross-tenant). El alta/gestión de
  // firmas existentes va por la consola de operador de clawhub, con su auth.
  firm: { name?: string; plan?: string };
  // Features de control plane elegidas en el step Registro. Se pliegan en
  // config.registration para que el manifiesto generado las lleve.
  features?: string[];
}

export async function POST(req: Request) {
  // Guard de mismo-origen (anti-CSRF): un sitio de terceros no puede provocar
  // este POST desde el navegador de una víctima. Permitimos same-origin/same-site,
  // navegación directa (none) o clientes no-navegador (sin la cabecera).
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") {
    return NextResponse.json({ error: "cross_origin_forbidden" }, { status: 403 });
  }

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

  // Gate de acceso a nivel de app: si CONFIGURATOR_ACCESS_TOKEN está configurado
  // (deploys públicos DEBEN configurarlo), exigimos que el cliente envíe la misma
  // contraseña en la cabecera `x-configurator-token`. Es lo que evita que el
  // endpoint —que hace de proxy de la operator key— sea usable por cualquiera
  // sin la auth de borde de Vercel. En local sin la env, el gate está inactivo.
  const accessToken = process.env.CONFIGURATOR_ACCESS_TOKEN;
  if (accessToken) {
    const provided = req.headers.get("x-configurator-token");
    if (!provided || provided !== accessToken) {
      return NextResponse.json({ error: "access_denied" }, { status: 401 });
    }
  }

  let body: RegisterRequest;
  try {
    body = (await req.json()) as RegisterRequest;
  } catch (e) {
    return NextResponse.json({ error: "bad_request", detail: String(e) }, { status: 400 });
  }

  const firmName = typeof body?.firm?.name === "string" ? body.firm.name.trim() : "";
  if (!firmName) {
    return NextResponse.json(
      { error: "firm_required", detail: "Indica el nombre de la firma." },
      { status: 400 },
    );
  }
  // Plan: opcional, pero si viene debe ser uno válido (evita valores arbitrarios
  // en el body). Default STARTER cuando no se indica.
  let plan: Plan = "STARTER";
  if (body.firm.plan != null) {
    if (!VALID_PLANS.includes(body.firm.plan as Plan)) {
      return NextResponse.json(
        { error: "invalid_plan", detail: `Plan no válido: ${body.firm.plan}` },
        { status: 400 },
      );
    }
    plan = body.firm.plan as Plan;
  }

  // 1) Generar el paquete (mismo que la pantalla de Revisión). Plegamos el
  // plan/features elegidos aquí en config.registration para que el manifiesto
  // refleje el registro real (no solo lo que se capturó en pasos anteriores).
  const cfg: WizardConfig = {
    ...body.config,
    registration: {
      plan,
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
        // Allowlist explícito — nunca reenviamos el body.firm crudo a clawhub.
        // overlayId: producto del que la firma recibe el stack (bootstrapper).
        firm: { name: firmName, plan, overlayId: "ai-office" },
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
