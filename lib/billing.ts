// Modo de cobro del deploy. Única fuente de verdad para el principio
// "disabled-si-no-configurado". Se lee de envs de servidor; nunca lanza.
//
//   "stripe"   → STRIPE_SECRET_KEY + algún STRIPE_PRICE_* → cobro real.
//   "mock"     → BILLING_MOCK=1 → pago simulado (demo/test), no cobra.
//   "disabled" → nada configurado → pago deshabilitado, alta por operador.
//
// Precedencia: stripe > mock > disabled.

export type BillingMode = "stripe" | "mock" | "disabled";

export function billingMode(): BillingMode {
  const hasSecret = Boolean(process.env.STRIPE_SECRET_KEY);
  const hasAnyPrice = Boolean(
    process.env.STRIPE_PRICE_STARTER ||
      process.env.STRIPE_PRICE_PRO ||
      process.env.STRIPE_PRICE_BUSINESS ||
      process.env.STRIPE_PRICE_ENTERPRISE,
  );
  if (hasSecret && hasAnyPrice) return "stripe";
  if (process.env.BILLING_MOCK === "1" || process.env.BILLING_MOCK === "true") return "mock";
  return "disabled";
}
