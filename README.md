# OpenClaw Configurator

Wizard web para generar una instalación cliente-facing de OpenClaw + autonomous-agents + un overlay (p. ej. ai-office). Sustituye un proceso manual de 1-3h por uno guiado de 10-15min.

## Qué hace hoy

El operador (o, en el futuro, el cliente final desde una página pública) recorre un wizard que captura:

1. **Datos del negocio** — nombre, sector (asesoría / abogados / e-commerce / clínica / agencia / PYME genérico).
2. **Equipo** — sobre la plantilla del sector, elegir qué roles activar (los 15 disponibles en `clawcrew/agents/`: executive, outbound-sdr, community, seo-writer, legal-light, automation-engineer, copywriter, paid-media, content-strategist, …) y darles identidad (nombre humano, icono, voz).
3. **Stack** — provider (axet / Anthropic / OpenAI / Ollama), canales (Slack, Webchat, Email opcional), límites de seguridad.
4. **Despliegue** — descargar un bundle portable o, en modo managed, generar `install.sh` parametrizado.

Outputs concretos:

- `overlay-config.json` — consumido por `autonomous-agents/work-console/scripts/configure-overlay.js apply` para hidratar un overlay completo en una pasada.
- `openclaw.json` + `.env` — listos para arrancar gateway + bridge.
- `install.sh` — clona los 3 repos requeridos (`openclaw`, `autonomous-agents`, `clawcrew`), monta el overlay, levanta servicios.

El wizard NO instala nada localmente; produce los artefactos. La instalación real la ejecuta `install.sh` en la máquina destino o el operador con `configure-overlay.js`.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS
- React Context API para el estado del wizard

## Quick start

```bash
git clone https://github.com/jotajota1302/openclaw-configurator.git
cd openclaw-configurator
npm install
npm run dev
```

Abre `http://localhost:3000`.

## Cómo encaja con el resto del ecosistema

```
        ┌─────────────────────┐
        │  openclaw-          │   wizard cliente-facing
        │  configurator       │
        └──────────┬──────────┘
                   │ overlay-config.json
                   ▼
        ┌─────────────────────┐
        │  autonomous-agents/ │   wrapper que instala N roles en
        │  configure-overlay  │   un overlay leyendo el config
        └──────────┬──────────┘
                   │ N × agent-cli install
                   ▼
        ┌──────────────────────────────┐
        │  clawcrew/agents/<role>/     │   library source-of-truth
        │  (15 manifest.json + assets) │   (catálogo de roles)
        └──────────────────────────────┘
                   │ snapshot copiado
                   ▼
        ┌─────────────────────┐
        │  ai-office (etc)    │   overlay con agentes instalados
        │  agent-registry.json│
        │  .installed-from/   │   trackers de versión
        └─────────────────────┘
```

Para detectar desincronización entre overlay y library: `autonomous-agents/work-console/scripts/drift-check.js <overlay> --library <path-to-clawcrew>`.

## Estado

- ✓ Wizard sector → equipo → identidades operativo (commit `3aaeaac`).
- ✓ `install.sh` modo bundle + overlay UI + gateway auto-bootstrap (`9a318b3`).
- ✓ Bootstrap de `openclaw.json` con `gateway.mode=local` + env overrides (`47ab692`).
- Pendiente: integración con clawhub (multi-tenant pairing token + license check).
- Pendiente: paso opcional `planMode` toggle en step-2.

## Referencia técnica

`OPENCLAW-CONFIG-GUIDE.md` documenta el contrato de configuración OpenClaw (capas `*.md` del agente, `openclaw.json`, sandbox, MCP). Es referencia interna del operador, no parte del wizard.

## Licencia

MIT.
