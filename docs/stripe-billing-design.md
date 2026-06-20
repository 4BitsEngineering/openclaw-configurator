# Diseño — Cobro con Stripe en el configurador (self-serve de pago)

> Estado: **DISEÑO / preparación** (no implementado). Escrito 2026-06-20.
> Principio rector (JJ): **si Stripe no está configurado, NO debe bloquear nada.
> El paso de pago aparece como _disabled_ y el wizard sigue funcionando con el
> gate de operador actual (contraseña de acceso). Una integración sin clave =
> pendiente/disabled, nunca un error.** (Mismo patrón que las integraciones del
> overlay: ver memoria `project_installer_gateway_secrets_*`.)

## 1. Objetivo

Hoy el alta es **operator-driven**: el wizard registra la firma gateado por una
contraseña compartida (`CONFIGURATOR_ACCESS_TOKEN`) y el operador emite el
pairing code. Queremos un **self-serve de pago**: el cliente configura → paga con
Stripe → se le crea la firma con los seats pagados → recibe el código + la
descarga. Sin pago no hay firma activa.

Flujo objetivo:
```
wizard (config) → [Pagar con Stripe] → Checkout Session → pago OK
   → webhook (fuente de verdad) → firma ACTIVA con seats pagados + pairing code
   → página de éxito: código de instalación + "Descargar instalador"
```

## 2. Lo que YA existe y reusamos (no se rehace)

- `Firm.seatsPurchased` + `status(active|suspended)` + cuota en `/api/v0/pair`
  (bloquea si se superan los seats). **Stripe solo rellena `seatsPurchased` y
  activa la firma.**
- `/api/v0/register` (clawhub, operator key) crea firma+baseline+pairing code.
- Paso `wizard/register` con generación del paquete (`generateInstancePackage`).
- `/api/v0/installer` → signed URL del `.exe` (validado).
- `kill-switch` (suspend/resume de operador) → para impagos/cancelaciones.

## 3. Cambios de modelo (clawhub `prisma/schema.prisma`)

Añadir a `Firm` (todos opcionales → migración no rompe firmas existentes):
```prisma
  // Billing (Stripe). NULL en firmas operator-driven (alta manual sin pago).
  stripeCustomerId     String?  @unique
  stripeSubscriptionId String?  @unique
  billingStatus        String?  // null | "pending_payment" | "paid" | "past_due" | "canceled"
  paidSeats            Int?     // seats pagados (espejo de la quantity de Stripe)
```
`status(active|suspended)` se mantiene como el **kill-switch operativo**;
`billingStatus` es el **estado de cobro**. Un webhook de impago → `past_due` →
(política) suspend. Migración: `prisma migrate` con `DIRECT_URL`.

## 4. Arquitectura del pago (recomendada)

**Crear la firma en `pending_payment` ANTES del checkout, activarla en el webhook.**
Esto resuelve el problema de "el paquete del wizard tiene que sobrevivir al
redirect de Stripe": se persiste como baseline en clawhub desde el principio.

1. **`POST /api/checkout` (configurador, server)** — recibe `{config, firm, seats}`:
   - Genera el paquete (`generateInstancePackage`) como hoy.
   - Llama a un nuevo **`POST /api/v0/register`** con `billingStatus:"pending_payment"`
     y SIN emitir pairing code todavía (o emitido pero la firma inactiva hasta pago).
     → devuelve `firm_id`.
   - Crea **Stripe Checkout Session** (`mode:"subscription"` o `"payment"`),
     `line_items` con el price del plan × `quantity=seats`,
     `metadata:{ firm_id }`, `success_url=…/wizard/register?session_id={CHECKOUT_SESSION_ID}`,
     `cancel_url=…/wizard/register?canceled=1`.
   - Devuelve `{ checkout_url }` → el cliente va a Stripe.

2. **`POST /api/stripe/webhook` (configurador o clawhub, server)** — fuente de verdad:
   - Verifica firma del webhook con `STRIPE_WEBHOOK_SECRET` (obligatorio).
   - `checkout.session.completed` (payment_status=paid) → llama a clawhub
     **`POST /api/v0/firms/{id}/activate`** (nuevo, operator key): `status:"active"`,
     `billingStatus:"paid"`, `seatsPurchased = quantity`, guarda
     `stripeCustomerId/SubscriptionId`, **emite el pairing code** ahora.
   - `invoice.payment_failed` → `billingStatus:"past_due"` (+ política: suspend tras N días).
   - `customer.subscription.deleted` → `billingStatus:"canceled"` + suspend.
   - **Idempotente** por `event.id` (Stripe reintenta): tabla `StripeEvent(id)` o
     upsert por `stripeSubscriptionId`.

3. **Página de éxito (`wizard/register` con `?session_id`)** — al volver de Stripe:
   - `GET /api/checkout/result?session_id=…` → consulta el estado (firma activa +
     pairing code). Como el webhook puede tardar 1-2s, hace **polling** corto
     ("Confirmando el pago…") hasta que la firma esté `paid`.
   - Muestra el código de instalación + "Descargar instalador" (igual que hoy).

> Alternativa más simple (sin webhook, menos robusta): tras el redirect, el server
> hace `stripe.checkout.sessions.retrieve(session_id)` y si `payment_status==="paid"`
> activa la firma. **Pega el webhook igualmente** como red de seguridad (si el
> usuario cierra la pestaña antes del redirect, el webhook activa de todos modos).
> Recomendado: webhook como fuente de verdad + retrieve para UX inmediata.

## 5. El principio _disabled-si-no-configurado_ (clave)

Una **única fuente de verdad**: presencia de `STRIPE_SECRET_KEY` (+ price IDs) en
el entorno del configurador. Nada peta si faltan.

- Nuevo `GET /api/billing/status` → `{ stripeEnabled: boolean }` =
  `Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_*)`.
  Nunca lanza; si falta, devuelve `false`.
- En `wizard/register/page.tsx`:
  - `stripeEnabled === true` → botón **"Pagar y obtener instalador"** (→ `/api/checkout`).
    La contraseña de operador se oculta (o queda como vía "tengo un código de operador").
  - `stripeEnabled === false` → el bloque de pago se renderiza **disabled**
    ("💳 Pago online — próximamente") y SIGUE el flujo actual con la contraseña de
    acceso. El wizard funciona idéntico a hoy.
- `/api/checkout` y `/api/stripe/webhook`: si `!STRIPE_SECRET_KEY` → responden
  `503 {error:"billing_disabled"}` (no 500, no throw). El front ya lo evita por el
  flag, pero defensa en profundidad.
- Stripe SDK se importa de forma perezosa (solo cuando hay key) para que el build
  y el arranque no dependan de la env.

## 6. Stripe — setup que necesita JJ (fuera del código)

1. Cuenta Stripe (test mode primero). Productos + **Prices** por plan
   (STARTER/PRO/BUSINESS/ENTERPRISE), con precio **por seat** (`per_unit`) si el
   cobro es por PC, o flat por plan.
2. Secrets en el deploy del configurador (Vercel):
   - `STRIPE_SECRET_KEY` (`sk_test_…` / `sk_live_…`)
   - `STRIPE_WEBHOOK_SECRET` (`whsec_…`, del endpoint del webhook)
   - `STRIPE_PRICE_STARTER` / `_PRO` / `_BUSINESS` / `_ENTERPRISE` (price IDs)
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` solo si usamos Stripe.js en cliente
     (con Checkout redirigido NO hace falta; el server crea la sesión).
3. Registrar el endpoint del webhook en el dashboard de Stripe → copiar el
   `whsec_…`.

## 7. Seguridad

- El `STRIPE_SECRET_KEY` vive SOLO en el server del configurador (igual que la
  operator key). Nunca al cliente.
- Webhook: **verificar firma** con `stripe.webhooks.constructEvent` +
  `STRIPE_WEBHOOK_SECRET`. Rechazar lo no firmado.
- Idempotencia por `event.id` (Stripe reintenta).
- El precio/seats se fijan **en el server** desde los price IDs del env, NO desde
  el body del cliente (evita manipular el importe). El cliente solo elige plan +
  nº de seats; el server mapea a price.
- `activate` en clawhub gateado por operator key (M2M), como `register`.

## 8. Orden de implementación (fases)

1. **Schema + migración** clawhub (`stripe*` en Firm) + endpoint
   `POST /api/v0/firms/{id}/activate` (operator key) + `register` acepta
   `billingStatus:"pending_payment"`.
2. **`GET /api/billing/status`** + degradación _disabled_ en `wizard/register`
   (esto ya entrega valor: el paso aparece disabled sin Stripe, sin romper nada).
3. **`/api/checkout`** (crea firma pending + Checkout Session).
4. **`/api/stripe/webhook`** (activa la firma, emite pairing code) + idempotencia.
5. **Página de éxito** con polling por `session_id`.
6. **Impagos/cancelación** → past_due/canceled → política de suspend (reusa kill-switch).

Fases 1-2 son seguras y desbloqueables ya (no necesitan cuenta Stripe). 3-5
necesitan los price IDs + webhook secret de JJ. Estimado total: **2-4 días**.

## 9. Decisiones tomadas (JJ, 2026-06-20)

- **Cobro: suscripción recurrente** → `mode:"subscription"`. Renovación
  automática; `invoice.payment_failed`→`past_due`→(política) suspend;
  `customer.subscription.deleted`→`canceled`→suspend.
- **Precio: por seat (PC)** → price `per_unit` (recurring) × `quantity = nº de PCs`.
  El cliente elige cuántos PCs; el server pone el price del plan y la quantity.
  `seatsPurchased = quantity` comprada (la cuota de `/api/v0/pair` ya lo usa).
- **Dos gates en paralelo**: Stripe (self-serve público) **Y** la contraseña de
  operador (ventas manuales/enterprise). El paso Registro ofrece "Pagar" cuando
  `stripeEnabled`, y mantiene la vía de operador. Las firmas de alta manual
  quedan con `billingStatus=null` (no Stripe).
