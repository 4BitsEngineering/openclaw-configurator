import { NextResponse } from "next/server";
import { billingMode } from "@/lib/billing";

// POST /api/stripe/webhook — fuente de verdad del cobro con Stripe (Fases 3-5).
//
// MONTADO pero aún NO operativo: solo entra en juego con Stripe real
// (billingMode()==="stripe"). En modo mock/disabled no hay webhooks → responde
// 204 (ack benigno) para no ensuciar logs si Stripe apunta aquí por error.
//
// Cuando se enchufe Stripe (TODO):
//   1. Verificar firma con stripe.webhooks.constructEvent(rawBody, sig,
//      STRIPE_WEBHOOK_SECRET) — rechazar lo no firmado.
//   2. Idempotencia por event.id (Stripe reintenta).
//   3. checkout.session.completed (payment_status=paid) → clawhub
//      POST /api/v0/firms/{metadata.firm_id}/activate (operator key):
//      status=active, billingStatus=paid, seatsPurchased=quantity,
//      guardar stripeCustomerId/SubscriptionId, EMITIR el pairing code.
//   4. invoice.payment_failed → billingStatus=past_due (+ política suspend).
//   5. customer.subscription.deleted → billingStatus=canceled + suspend.
//
// NOTA: requiere antes la Fase 1 de clawhub (columnas Stripe en Firm + endpoint
// activate). Ese paso necesita una migración en la BD de producción.

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const mode = billingMode();

  if (mode !== "stripe") {
    // Sin Stripe real no esperamos webhooks. Ack benigno (no es un error del
    // emisor); consumimos el body para cerrar la conexión limpiamente.
    await req.text().catch(() => "");
    return new NextResponse(null, { status: 204 });
  }

  // mode === "stripe": pendiente de implementar (Fases 3-5). De momento NO
  // confirmamos para no marcar como procesado un evento que no atendemos.
  return NextResponse.json({ error: "stripe_webhook_not_implemented" }, { status: 501 });
}
