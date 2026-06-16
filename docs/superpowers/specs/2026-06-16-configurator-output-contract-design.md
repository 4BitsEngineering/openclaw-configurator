# Configurator — Contrato de salidas (entregable #1)

**Fecha:** 2026-06-16
**Estado:** Aprobado (diseño). Implementación en curso.

## Contexto

`openclaw-configurator` (Next.js) genera hoy la configuración de una instancia
ai-office en un único wizard de 9 pasos que **mezcla tres responsabilidades**:
config base de OpenClaw (providers/channels), overlay (agentes del catálogo
clawcrew), y parámetros de autonomous-agents. Además ofrece al cliente un
**selector de skills** que no queremos exponer.

El objetivo global es rediseñar el configurator en torno a un flujo de
**dos fases + registro**, alineado con cómo el stack se despliega en runtime
(OpenClaw base → overlay ai-office encima → control plane clawhub):

1. **Fase 1 — OpenClaw base:** providers + channels. Skills base las fijamos
   nosotros, no el cliente. Salida: `openclaw.json` base.
2. **Fase 2 — Overlay:** agentes del catálogo clawcrew + parámetros de *nuestro*
   autonomous-agents (GuardClaw, autonomía, etc.). Salida: config del overlay.
3. **Fase 3 — Registro:** la instancia se registra en clawhub para que el
   instalador (repo `ai-office-install`, app Tauri) la consuma.

Ese rediseño se descompone en cuatro entregables: **(1) contrato de salidas**,
(2) UI/generación Fase 1, (3) UI/generación Fase 2, (4) registro + handoff. Este
documento especifica **el entregable #1: el contrato de las salidas**, que fija
los artefactos y schemas de los que dependen los otros tres.

## Estado actual del código (lo que se reutiliza)

`lib/generators.ts` ya produce cuatro artefactos en un solo paso:

- `generateOpenclawJson()` → `openclaw.json` completo desde
  `lib/templates/openclaw.template.json`, con placeholders `${ENV}` para keys y
  `__STACK_ROOT__`/`__NODE_BIN__`/`__NODE_DIR__` para rutas de máquina. **Se
  reutiliza casi tal cual como Salida A.**
- `generateOverlayConfig()` → `overlay-config.json` (agentes clawcrew,
  identidades, `defaultModel`, `planMode`). **Base de la Salida B; se le añade
  el bloque `autonomy`.**
- `generateEnvFile()` → un `.env` con líneas de relleno. **Se sustituye** por la
  declaración de ENV en el manifiesto (ver Decisión 1).
- `generateInstallScript()` → `install.sh` legacy (modo bundle). **Fuera del
  contrato**: el instalador real (Tauri) embebe el código del stack y no usa
  este script. Se conserva pero deja de ser una salida del contrato.

El instalador real (`ai-office-install`) embebe `ai-office-stack`
(ai-office + autonomous-agents) como recurso, instala en `C:\4bitsengine\`, elige
modelo con `openclaw onboard` interactivo, configura el overlay con `setup.ps1`
(`-BaseConfig openclaw.json -ConfigPath ai-office/openclaw.json`) y valida
licencia contra `smartbotics.eu/licencias`. **Hoy no consume nada del
configurator**; cerrar ese gap es el objetivo de la alineación futura.

## Decisiones de diseño

1. **Cero secretos en los artefactos.** El configurator declara *qué* provider y
   *qué* channels, pero nunca recoge ni persiste valores. Todas las variables
   sensibles (keys de provider, tokens de canal, URL/key de n8n, etc.) se
   declaran en el manifiesto como entradas que el instalador pedirá en destino.
   Motivación: evitar el escarmiento de keys reales en historial git.

2. **Handoff config-only.** El configurator produce *configuración*, no código.
   El código del stack viaja en el instalador (que ya lo embebe y protege la IP
   borrando `web/src` tras el build).

3. **Registro en install-time.** El configurator no habla con clawhub en
   config-time. Emite config + un manifiesto con metadata de registro
   (`plan`, `features`); el instalador da de alta/parea la instancia en destino.

4. **(a) División JSON-estructural vs ENV-declarada.** Los parámetros de AA
   *estructurales* (qué agentes, plan-mode, políticas GuardClaw, nivel de
   autonomía, `minPhases`) van como **JSON** en `overlay-config.json`. Los
   *valores de entorno* (timeouts numéricos, URLs de integración, keys) van como
   **ENV declaradas** en el manifiesto.

5. **(b) El manifiesto lleva un bloque `compat`/versionado** para que el
   instalador pueda rechazar una config generada contra un stack incompatible.

## Artefactos del contrato

El configurator emite un directorio de instancia con esta forma:

```
<instance-slug>/
├── base/
│   └── openclaw.json          ← Salida A (config base OpenClaw)
├── overlay/
│   └── overlay-config.json    ← Salida B (agentes + autonomy)
└── instance-manifest.json     ← el handoff (identidad, versiones, ENV, registro)
```

### Salida A — `base/openclaw.json`

Generado por `generateOpenclawJson()` (reutilizado). Contiene:

- `models.providers` con el/los provider(s) elegido(s); `apiKey: "${ENV_KEY}"`.
- `agents.defaults.model` = primary elegido + fallback keyless `ollama/gemma4-gpu`.
- `channels` con los canales elegidos (flags/IDs, **sin tokens**; los tokens son
  `${ENV}`).
- **Skills base curadas por nosotros** (fijadas en la plantilla, no en el
  wizard). El `skills: string[]` del wizard deja de alimentar la salida.
- Placeholders de máquina `__STACK_ROOT__` / `__NODE_BIN__` / `__NODE_DIR__`.

### Salida B — `overlay/overlay-config.json`

Generado por `generateOverlayConfig()` extendido. Bloques:

- Lo existente: `overlay` (path/prefix/name), `library`, `openclawConfig`
  (`"./openclaw.json"`, referencia a la base), `defaultModel`, `agents[]` (del
  catálogo clawcrew, con identidades), `planMode`.
- **Nuevo bloque `settingsSeed`** — "perfil de arranque". Hallazgo del entregable
  #3: casi todos los ajustes de autonomous-agents viven en el **settings store del
  bridge (SQLite)**, no en `openclaw.json`. El configurator NO puede escribir ese
  store, así que emite un seed con las CLAVES REALES del registry; el instalador
  las siembra en destino (install-time). El resto de los 40+ settings quedan en
  sus defaults, editables en la consola. Solo se pre-configura el subconjunto que
  importa al provisionar:
  ```jsonc
  "settingsSeed": {
    "AUTONOMY_LEVEL": "n0" | "n1" | "n2",        // humano-en-bucle / autónomo+reglas / full
    "GUARDCLAW_ENABLED": true,
    "GUARDCLAW_OUTPUT_REDACT": true,             // masking de PII en outputs
    "WEB_EGRESS_ENABLED": true,                  // filtra búsquedas/URLs a terceros
    "AGENTS_DEFAULT_LANGUAGE": "es-ES",
    "AGENT_TIMEOUT": 1800,                       // segundos (60..3600)
    "CONVERSATIONS_IDLE_DAYS": 90                // retención
  }
  ```
- **Nuevo bloque `integrations`** (solo flags + qué ENV requieren; sin valores):
  ```jsonc
  "integrations": {
    "n8n":   { "enabled": false, "envBaseUrl": "N8N_BASE_URL", "envToken": "N8N_AUTH_TOKEN" },
    "slack": { "enabled": false, "envAppToken": "SLACK_APP_TOKEN", "envBotToken": "SLACK_BOT_TOKEN" }
  }
  ```
- **Nuevo bloque `knowledge`** (RAG; flags):
  ```jsonc
  "knowledge": { "ragEnabled": false, "embeddingsProvider": null }
  ```

### Salida C — `instance-manifest.json`

Generado por una función nueva `generateInstanceManifest()`:

```jsonc
{
  "instance":   { "slug": "...", "name": "...", "prefix": "..." },
  "compat": {
    "configSchemaVersion": "1.0",
    "generatedBy": "openclaw-configurator@<version>",
    "targetStack": {
      "openclaw": ">=2026.5",
      "aiOffice": "<pin|null>",
      "autonomousAgents": "<pin|null>",
      "clawcrewCatalogCommit": "<sha|null>"
    }
  },
  "artifacts": { "base": "base/openclaw.json", "overlay": "overlay/overlay-config.json" },
  "env": [
    { "key": "ANTHROPIC_API_KEY", "scope": "base", "desc": "...", "example": "sk-ant-...", "required": true }
    // ... derivado de providers + channels + integrations elegidos
  ],
  "providers": [ { "id": "anthropic", "model": "claude-sonnet-4-6" } ],
  "channels":  [ { "id": "telegram" } ],
  "registration": { "target": "clawhub", "plan": null, "features": [], "mode": "install-time" }
}
```

Reglas:

- **`env` es la única fuente de verdad de qué secretos pedir.** Se deriva de los
  providers, channels e integrations seleccionados. Cero valores.
- `compat.configSchemaVersion` lo valida el instalador; un mismatch mayor →
  rechazo.
- `registration` es metadata; no contiene tokens ni pairing.

## Composición base ↔ overlay

`overlay-config.json.openclawConfig` apunta a `./openclaw.json`. El overlay
hereda providers/channels de la base y solo añade agentes + políticas. Esto
permite (futuro) montar otro overlay sobre la misma base sin regenerarla.

## Consumo por el instalador (alineación futura, fuera de este entregable)

- `openclaw onboard` → reemplazado por copiar `base/openclaw.json` (resolviendo
  placeholders de máquina).
- `setup.ps1` → parametrizado con `overlay/overlay-config.json` vía
  `configure-overlay.js`.
- `manifest.env` → formulario de secretos en destino; escribe el `.env` allí.
- `manifest.registration` → alta/pairing en clawhub.
- Punto abierto para esa fase: si clawhub sustituye o coexiste con la licencia
  smartbotics actual.

## No-objetivos (YAGNI)

- **No** se recogen ni persisten secretos en el configurator.
- **No** se conserva el selector de skills de cliente (las skills base las
  fijamos nosotros; las de agente vienen del rol clawcrew).
- **No** se mantiene `personality` ni `useCase` legacy en el contrato de salida
  (redundantes con `clawcrewTeam`). La limpieza de su UI es de entregables 2/3.
- **No** se "levanta" ninguna instancia desde el configurator: solo genera y
  valida. Levantar es del instalador en destino.
- **No** se implementa el alta en clawhub en config-time.

## Plan de implementación (entregable #1)

1. Tipos del contrato en `lib/contract/types.ts` (ManifestEnvVar, InstanceManifest,
   AutonomyBlock, etc.).
2. `lib/contract/env-spec.ts`: deriva la lista `env[]` a partir de
   `WizardConfig` (providers + channels + integrations).
3. Extender `generateOverlayConfig()` con `autonomy` / `integrations` /
   `knowledge` (valores por defecto sensatos; el wizard los irá poblando en
   entregables 2/3).
4. `generateInstanceManifest(config)` nueva.
5. `generateInstancePackage(config)` que orquesta y devuelve el árbol de
   artefactos `{ "base/openclaw.json", "overlay/overlay-config.json",
   "instance-manifest.json" }`.
6. Dejar `generateEnvFile()` deprecado (no es salida del contrato) y `skills` sin
   efecto en la salida.

## Testing

Extender `scripts/test-generate.mjs` (`npm run test:generate`):

- El manifiesto valida contra el schema (campos requeridos presentes).
- `env[]` no contiene valores (solo `key`/`desc`/`example`), y cubre cada
  provider/channel/integration habilitado.
- `overlay-config.json` incluye el bloque `autonomy` con defaults.
- `base/openclaw.json` no contiene secretos literales (solo `${ENV}`).
- Ningún artefacto contiene una API key con forma real (regex `sk-`, `xoxb-`,
  JWT) fuera de los `example` del manifiesto.
