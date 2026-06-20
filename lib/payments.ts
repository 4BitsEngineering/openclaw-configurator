// Abstracción de cobro — el ÚNICO punto que cambia al enchufar Stripe real.
//
// `startCheckout` decide qué pasa al "pagar":
//   - mock:     devuelve { kind: "paid" } SIEMPRE (pago simulado, acepta todo).
//   - stripe:   (TODO Fases 3-5) crearía la Checkout Session y devolvería
//               { kind: "redirect", url } para que el cliente vaya a Stripe; el
//               alta real la confirmaría el webhook (/api/stripe/webhook).
//   - disabled: { kind: "error", reason: "billing_disabled" }.
//
// Mantener este contrato estable: /api/checkout y el front no cambian al pasar a
// Stripe; solo se implementa la rama "stripe" de aquí + el webhook.

import { billingMode } from "./billing";

export interface CheckoutInput {
  plan: string;
  seats: number;
  firmName: string;
  instanceName: string;
}

export type CheckoutOutcome =
  | { kind: "paid"; provider: "mock"; reference: string } // cobro resuelto al instante (mock)
  | { kind: "redirect"; provider: "stripe"; url: string } // ir a Stripe Checkout
  | { kind: "error"; reason: string };

export async function startCheckout(input: CheckoutInput): Promise<CheckoutOutcome> {
  const mode = billingMode();

  if (mode === "mock") {
    // ── EL SEAM MOCKEADO: acepta el pago SIEMPRE. ──────────────────────────────
    // Sustituir por la verificación real de Stripe al enchufarlo. `reference`
    // imita un id de pago para trazabilidad.
    return {
      kind: "paid",
      provider: "mock",
      reference: `mock_${input.plan}_${input.seats}_${input.firmName.replace(/\s+/g, "-").slice(0, 24)}`,
    };
  }

  if (mode === "stripe") {
    // TODO Fases 3-5: crear Stripe Checkout Session (mode:"subscription",
    // line_items con el price del plan × quantity=seats, metadata:{firm_id},
    // success_url/cancel_url) y devolver { kind:"redirect", url: session.url }.
    return { kind: "error", reason: "stripe_not_implemented" };
  }

  return { kind: "error", reason: "billing_disabled" };
}
