import { NextResponse } from "next/server";
import { billingMode } from "@/lib/billing";

// GET /api/billing/status — modo de cobro de este deploy (ver lib/billing.ts).
// El front (paso Registro) usa el `mode` para decidir qué mostrar. NUNCA lanza.

export const dynamic = "force-dynamic";

export async function GET() {
  const mode = billingMode();
  // stripeEnabled se mantiene por compat con clientes que ya lo leen.
  return NextResponse.json({ mode, stripeEnabled: mode === "stripe" });
}
