# AI Office — Manual de piezas e instalación

> Para el equipo. Explica **qué es cada componente**, **cómo encajan** y **cómo se
> instala** una "AI Office" en el PC de un cliente, de punta a punta.
> Última revisión: 2026-06-20.

---

## 1. En una frase

Vendemos **"AI Office"**: un equipo de agentes de IA que se instala en el PC del
cliente. Nosotros (operador) **configuramos** la instancia de cada cliente en una
web, el cliente **se descarga un instalador**, mete un **código** y el instalador
**baja y monta todo** solo. Desde nuestro **panel de control** vemos cada PC,
le mandamos **actualizaciones** y podemos **suspenderlo**.

```
   NOSOTROS (operador)                          EL CLIENTE (su PC)
 ┌───────────────────┐   registra    ┌──────────────────────────────────┐
 │  CONFIGURADOR     │──────────────▶│  INSTALADOR (.exe)                │
 │  (wizard web)     │   firma+código│   parea → baja overlay → arranca  │
 └─────────┬─────────┘               └───────────────┬──────────────────┘
           │  (operator key, M2M)                    │  (instance_token)
           ▼                                          ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │                          CLAWHUB  (plano de control, en la nube)        │
 │  firmas · instancias · códigos · baselines · versiones · heartbeats     │
 └───────────────┬───────────────────────────────────────┬───────────────┘
                 │ signed URLs                             │ heartbeat/comandos
                 ▼                                         ▲
        ┌────────────────┐                  ┌──────────────┴───────────────┐
        │ SUPABASE STORAGE│                 │  STACK en el PC del cliente   │
        │ overlay + .exe  │                 │  gateway + bridge + web + UI  │
        └────────────────┘                 │  (agentes de CLAWCREW)        │
                                            └───────────────────────────────┘
```

---

## 2. Las piezas

| Pieza | Qué es | Repo | Tecnología | Dónde corre |
|---|---|---|---|---|
| **openclaw** (gateway) | El motor de IA. Ejecuta los agentes, habla con los proveedores de LLM. | `openclaw` | Node | PC cliente, puerto **18789** |
| **clawcrew** | La **biblioteca de agentes**: definiciones, skills, prompts, retratos. De aquí se "instalan" los agentes en cada overlay. | `clawcrew` | JSON/MD + CLI | (fuente; se empaqueta) |
| **ai-office** (overlay) | El **producto**: la web que ve el cliente (su "oficina") + el equipo de agentes concreto + textos. Es un "vertical" montado sobre openclaw. | `ai-office` | Next.js | PC cliente, web puerto **3000** |
| **autonomous-agents** (bridge + consola) | El **orquestador local**: coordina tareas, habla con el gateway, guarda el historial, expone la API que consume la web. Incluye la **Work Console** (panel admin) y el bucle que reporta a clawhub. | `autonomous-agents` (`work-console`) | Node + SQLite | PC cliente, bridge **3700**, consola **8080** |
| **clawhub** | El **plano de control** (lo nuestro, en la nube). Gestiona clientes (firmas), PCs (instancias), códigos de instalación, configuraciones (baselines), versiones del stack, monitorización y kill-switch. | `clawhub` | Next.js + Prisma + Postgres | **Vercel** (`clawhub-three.vercel.app`) |
| **openclaw-configurator** | El **wizard de alta**: configura la instancia de un cliente (proveedores, canales, integraciones, equipo) → genera el paquete → lo registra en clawhub → da el código + el enlace de descarga. | `openclaw-configurator` | Next.js | **Vercel** |
| **ai-office-install** | El **instalador** de Windows (un solo `.exe`, ~1.7 MB). Parea con clawhub, descarga el overlay, lo monta, lanza la app y la actualiza. | `ai-office-install` | Tauri (Rust + web) | Se descarga y corre en el PC cliente |
| **Supabase Storage** | El **almacén privado** de los binarios (el overlay empaquetado y el `.exe`). clawhub firma URLs caducables para descargarlos sin exponer nada. | (servicio) | Supabase | Nube |

**Relaciones clave:**
- El **configurador** y el **instalador** NO hablan entre sí: ambos hablan con **clawhub**.
- El **overlay** (ai-office + bridge + clawcrew) NO va dentro del `.exe`: el `.exe` lo **descarga** de clawhub/Supabase tras parear (por eso pesa tan poco). Eso permite **actualizar sin reinstalar**.
- **clawhub** es el centro: todo pasa por él (alta, descarga, pairing, versiones, monitorización).

---

## 3. Conceptos (glosario rápido)

- **Firma (firm)**: el cliente/empresa. Tiene un plan y un número de **seats** (PCs permitidos).
- **Instancia (instance)**: un PC concreto del cliente, pareado a una firma. Consume un seat.
- **Pairing code (código de instalación)**: código corto (p.ej. `AMDG-CPJQ`) que el cliente mete en el instalador para vincular su PC a su firma. Caduca.
- **instance_token**: credencial que recibe el PC al parear; con ella habla con clawhub (descargas, heartbeat).
- **operator key (`OPERATOR_API_KEY`)**: nuestra clave de operador (servidor). La usan el configurador y el CI para crear firmas y publicar versiones. NUNCA llega al navegador/cliente.
- **Baseline**: el paquete de configuración de un cliente (su `openclaw.json`, ajustes, etc.) guardado en clawhub. El instalador lo descarga para provisionar.
- **Overlay**: el stack del producto empaquetado (web + bridge + clawcrew). Se versiona y se publica en clawhub.
- **Stack bundle**: una versión publicada de algo descargable (kind: OVERLAY o INSTALLER).
- **Heartbeat**: latido periódico que el PC manda a clawhub (sigue vivo + versión + uptime) → monitorización.

---

## 4. El flujo de instalación, paso a paso

### Fase A — Nosotros damos de alta al cliente (configurador)
1. Abrimos el **configurador** y completamos el wizard: nombre del cliente, plan, proveedor de IA, canales (Telegram/Slack…), integraciones y el **equipo de agentes**.
2. (Pago — hoy en **modo simulado**; con Stripe real será aquí.)
3. Al cerrar, el configurador (en su servidor, con la operator key) llama a **clawhub `/api/v0/register`**: se **crea la firma**, se sube la config como **baseline** y se emite un **pairing code** + un **enlace de descarga**.

### Fase B — El cliente instala
4. El cliente abre el enlace → **clawhub `/api/v0/installer`** le redirige a la **signed URL** de Supabase y descarga el **`.exe`**.
5. Ejecuta el `.exe` (asistente): mete el **pairing code** → el instalador llama a **clawhub `/api/v0/pair`** → recibe su **instance_token** (consume un seat).
6. El instalador pide al cliente las **credenciales** necesarias (las que declaró el configurador, p.ej. la API key del proveedor).
7. **Provisión**: el instalador pide a **clawhub `/api/v0/stack-manifest`** qué overlay le toca → descarga el **overlay** (signed URL de Supabase), verifica el hash, lo **extrae** en el PC, instala los **agentes de clawcrew** y aplica el **baseline**.
8. **Arranca el stack**: gateway (18789) + bridge (3700) + web (3000) + consola (8080). El cliente abre su **AI Office** y ya tiene a su equipo trabajando.

### Fase C — Día a día
9. **Actualizaciones**: cuando publicamos una versión nueva del overlay, el instalador la detecta y, con el botón **ACTUALIZAR**, la baja y la aplica **sin reinstalar** (preserva config y datos).
10. **Monitorización**: el bridge manda **heartbeats** a clawhub → en nuestra **consola de operador** vemos cada PC: online/offline, versión que corre, uptime.
11. **Control**: desde clawhub podemos **suspender** una firma (kill-switch, p.ej. por impago) o mandar comandos remotos (p.ej. cambiar la contraseña de la consola de admin).

---

## 5. Cómo publicamos una versión del overlay (resumen operador)

1. Se compila la web en modo *standalone* y se **empaqueta** el overlay (`ai-office/scripts/pack-overlay.mjs`) → un `.tar.gz`.
2. Se **sube a Supabase Storage** y se **registra** en clawhub (`/api/v0/bundles/register`) como `OVERLAY` con su versión, hash y tamaño.
3. (Automático: al hacer `git tag stack-vX.Y.Z` en `ai-office`, el CI `publish-overlay` lo hace solo.)
4. A partir de ahí, las instalaciones lo ven en `stack-manifest` y pueden actualizar.

El **instalador** (`.exe`) se publica igual pero como `INSTALLER`.

---

## 6. Estado actual (qué está en producción)

- **En producción y vivo**: clawhub (control plane, signed URLs, monitorización, comandos) y el configurador (con pago **simulado**).
- **Overlay** v1.3.0 publicado y descargable; **instalador** v0.2.0 (bootstrapper) registrado.
- **Pendiente para "vender de verdad"**: (a) **firma de código** del `.exe` (certificado Authenticode, quita el aviso de Windows), (b) **Stripe real** (hoy mock), (c) **E2E** de instalación limpia validado de punta a punta.

> Detalle técnico del E2E y de las ramas: `ai-office-install/E2E-INTEGRATION.md`.
> Regla de ramas: **todo en `main`** salvo `ai-office-install` (que va en la rama
> `integration/e2e`; su `main` es de Ramón y no se toca).
