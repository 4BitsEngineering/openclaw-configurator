import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { generateInstancePackage } from "@/lib/generators";
import { PACKAGE_PATHS } from "@/lib/contract/types";
import type { WizardConfig } from "@/lib/wizard-context";
import { billingMode } from "@/lib/billing";

// POST /api/checkout — alta self-serve "de pago".
//
// MODO MOCK (BILLING_MOCK=1): simula el cobro. Genera el paquete del wizard y
// registra la firma en clawhub con los seats elegidos (vía OPERATOR_API_KEY,
// server-side), devolviendo el pairing code + el enlace del instalador — igual
// que un pago real, pero sin Stripe. Sirve para probar el flujo completo.
//
// MODO STRIPE: aún no implementado (Fases 3-5 del diseño) → 501.
// MODO DISABLED: 503 (el front ya lo evita mostrando el pago deshabilitado).
//
// Cuando se enchufe Stripe, este endpoint creará la Checkout Session (firma en
// pending_payment) y el webhook activará + emitirá el código. La forma del
// resultado mock imita la del flujo real para que el front no cambie.

export const dynamic = "force-dynamic";

const VALID_PLANS = ["STARTER", "PRO", "BUSINESS", "ENTERPRISE"] as const;
type Plan = (typeof VALID_PLANS)[number];

function categoryFor(path: string): "OPENCLAW_CONFIG" | "OTHER" {
  return path === PACKAGE_PATHS.base ? "OPENCLAW_CONFIG" : "OTHER";
}

interface CheckoutRequest {
  config: WizardConfig;
  firm: { name?: string; plan?: string };
  seats?: number;
  features?: string[];
}

export async function POST(req: Request) {
  // Anti-CSRF: mismo patrón que /api/register.
  if (req.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "cross_origin_forbidden" }, { status: 403 });
  }

  const mode = billingMode();
  if (mode === "disabled") {
    return NextResponse.json({ error: "billing_disabled" }, { status: 503 });
  }
  if (mode === "stripe") {
    // TODO Fases 3-5: crear Stripe Checkout Session aquí.
    return NextResponse.json({ error: "stripe_not_implemented" }, { status: 501 });
  }

  // ── MODO MOCK ───────────────────────────────────────────────────────────────
  const clawhubUrl = process.env.CLAWHUB_URL;
  const operatorKey = process.env.OPERATOR_API_KEY;
  if (!clawhubUrl || !operatorKey) {
    return NextResponse.json(
      { error: "configurator_misconfigured", detail: "Faltan CLAWHUB_URL u OPERATOR_API_KEY." },
      { status: 500 },
    );
  }

  let body: CheckoutRequest;
  try {
    body = (await req.json()) as CheckoutRequest;
  } catch (e) {
    return NextResponse.json({ error: "bad_request", detail: String(e) }, { status: 400 });
  }

  const firmName = typeof body?.firm?.name === "string" ? body.firm.name.trim() : "";
  if (!firmName) {
    return NextResponse.json({ error: "firm_required" }, { status: 400 });
  }

  let plan: Plan = "STARTER";
  if (body.firm.plan != null) {
    if (!VALID_PLANS.includes(body.firm.plan as Plan)) {
      return NextResponse.json({ error: "invalid_plan", detail: String(body.firm.plan) }, { status: 400 });
    }
    plan = body.firm.plan as Plan;
  }

  // Seats comprados (precio por PC). Acotado a [1, 100] para el mock.
  const seats = Math.max(1, Math.min(100, Math.floor(Number(body.seats) || 1)));

  // Generar el paquete (igual que el paso de Revisión).
  const cfg: WizardConfig = {
    ...body.config,
    registration: { plan, features: body.features ?? body.config.registration?.features ?? [] },
  };
  let files: Record<string, string>;
  try {
    files = generateInstancePackage(cfg);
  } catch (e) {
    return NextResponse.json({ error: "generate_failed", detail: String(e) }, { status: 400 });
  }

  const baselineFiles = Object.entries(files).map(([path, content]) => ({
    path,
    category: categoryFor(path),
    content,
    sha256: crypto.createHash("sha256").update(content, "utf8").digest("hex"),
    sizeBytes: Buffer.byteLength(content, "utf8"),
    isBinary: false,
  }));

  const instanceName = body.config.clawcrewTeam?.overlayName || "Instancia";

  let clawhubRes: Response;
  try {
    clawhubRes = await fetch(`${clawhubUrl.replace(/\/$/, "")}/api/v0/register`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${operatorKey}` },
      body: JSON.stringify({
        // seatsPurchased = seats "pagados" (mock). overlayId fijo a ai-office.
        firm: { name: firmName, plan, seatsPurchased: seats, overlayId: "ai-office" },
        label: `Checkout (mock) — ${instanceName}`,
        description: `Alta self-serve simulada (${seats} PC/s) para "${instanceName}".`,
        files: baselineFiles,
      }),
    });
  } catch (e) {
    return NextResponse.json({ error: "clawhub_unreachable", detail: String(e) }, { status: 502 });
  }

  const data = await clawhubRes.json().catch(() => ({}));
  if (!clawhubRes.ok) {
    return NextResponse.json(
      { error: "clawhub_register_failed", status: clawhubRes.status, clawhub: data },
      { status: clawhubRes.status },
    );
  }

  const code = (data as { pairing_code?: string }).pairing_code;
  const installerUrl = `${clawhubUrl.replace(/\/$/, "")}/api/v0/installer?channel=stable${
    code ? `&pairing=${encodeURIComponent(code)}` : ""
  }`;

  return NextResponse.json({ ...data, mock: true, seats, installer_url: installerUrl });
}
