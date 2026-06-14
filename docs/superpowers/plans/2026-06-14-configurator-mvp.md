# Configurator MVP — instancias que arrancan y responden (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el `openclaw-configurator` produzca instalaciones ai-office **completas y funcionales** (la instancia arranca y los agentes responden), personalizables (modelo, equipo clawcrew, canales, plan-mode), no solo un esqueleto.

**Architecture:** El hueco crítico es que el `openclaw.json` generado es un esqueleto. Lo resolvemos derivando una **plantilla del `openclaw.json` REAL de ai-office** (que ya funciona) y parametrizándola con las respuestas del wizard vía `generateOpenclawJson(config)`. El `install.sh` escribe esa plantilla en vez del heredoc esqueleto. Añadimos selección de modelo (step-1), toggle de plan-mode (step-2), limpiamos generadores YAML legacy y un test E2E del install en dry-run.

**Tech Stack:** Next.js 15 (App Router, React, TS), `lib/generators.ts`, `lib/wizard-context.tsx`, bash `install.sh` (string en generators.ts), Node `node:test` para el E2E.

**Scope/constraints:** Rama `feat/configurator-mvp` (basada en main + merge de `feat/catalog-from-clawcrew`). El configurator NO está en el stack vivo (herramienta del operador) → bajo riesgo. NO mergear a main hasta que JJ lo decida. La key Xiaomi hardcodeada (`DEMO_XIAOMI_API_KEY_HARDCODED`) queda como está (decisión JJ 14-jun) — no se toca en este plan.

---

## File Structure

- Create: `lib/templates/openclaw.template.json` — copia del `openclaw.json` de ai-office con placeholders `__VAR__` en los campos por-instancia. Responsabilidad: ser la base probada de un openclaw.json completo.
- Modify: `lib/generators.ts` — nueva `generateOpenclawJson(config)`; borrar 4 generadores YAML legacy; ajustar `generateInstallScript()` para escribir el openclaw.json generado en vez del heredoc esqueleto.
- Modify: `lib/wizard-context.tsx` — añadir `model`/`fallbacks` al bloque providers; exponer `planMode` en el step-2 (el tipo ya existe).
- Modify: `app/wizard/step-1/page.tsx` — selector de modelo + fallbacks por provider.
- Modify: `app/wizard/step-2/page.tsx` — toggle plan-mode + selector de planner.
- Modify: `app/wizard/step-9/page.tsx` — incluir `openclaw.json` en la descarga; quitar los YAML legacy.
- Create: `scripts/test-generate.mjs` — E2E: genera config de muestra → valida que el openclaw.json tiene todas las secciones; corre `install.sh --dry-run` si hay bash.
- Modify: `package.json` — script `test:generate`.

**Campos a parametrizar en la plantilla** (lo que cambia por instancia; el resto se hereda tal cual de ai-office):
`gateway.auth.token` + `gateway.remote.token` (mismo token aleatorio), `agents.list` (lo inyecta configure-overlay, así que en la plantilla va `[]`), `models.providers` (según provider/modelo elegidos), `channels` (según step-4), y rutas de workspace (las pone configure-overlay). El resto (plugins.entries, memorySearch, session, logging, tools, skills, browser, mcp) se hereda.

---

## Task 0: Rama base + merge del catálogo

**Files:** (ninguno)

- [ ] **Step 1: Crear rama desde main**

Run:
```bash
cd openclaw-configurator
git checkout main && git checkout -b feat/configurator-mvp
```
Expected: `Switched to a new branch 'feat/configurator-mvp'`

- [ ] **Step 2: Traer la pieza 4 (catálogo dinámico) ya hecha**

Run: `git merge --no-ff feat/catalog-from-clawcrew -m "merge: catálogo dinámico de clawcrew en el wizard"`
Expected: merge limpio (la rama existe y no toca los mismos ficheros que tocaremos salvo wizard-context.tsx; si hay conflicto en wizard-context.tsx, conservar AMBOS: la derivación del catálogo Y los cambios nuevos).

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: exit 0.

---

## Task 1: Plantilla + `generateOpenclawJson()` (TDD)

**Files:**
- Create: `lib/templates/openclaw.template.json`
- Create: `scripts/test-generate.mjs` (sección generateOpenclawJson)
- Modify: `lib/generators.ts`

- [ ] **Step 1: Crear la plantilla copiando el openclaw.json de ai-office**

Run (genera la plantilla a partir de la config probada, sustituyendo lo por-instancia):
```bash
cd openclaw-configurator
node -e "
const fs=require('fs');
const src=JSON.parse(fs.readFileSync('C:/Users/Nitropc/.openclaw/ai-office/openclaw.json','utf8'));
// Vaciar lo por-instancia; el resto (plugins, memorySearch, session, logging,
// tools, skills, browser, mcp, discovery) se hereda tal cual.
src.agents = src.agents || {};
src.agents.list = []; // configure-overlay los inyecta tras el install
if (src.gateway && src.gateway.auth) src.gateway.auth.token = '__GATEWAY_TOKEN__';
if (src.gateway && src.gateway.remote) src.gateway.remote.token = '__GATEWAY_TOKEN__';
// channels: dejar slack/whatsapp deshabilitados por defecto (el cliente los
// activa por su tarjeta /integrations). Mantener la estructura.
if (src.channels && src.channels.slack) src.channels.slack = { enabled: false };
if (src.channels && src.channels.whatsapp) src.channels.whatsapp = { enabled: false };
fs.mkdirSync('lib/templates',{recursive:true});
fs.writeFileSync('lib/templates/openclaw.template.json', JSON.stringify(src,null,2)+'\n');
console.log('plantilla escrita; modelo provider:', Object.keys(src.models&&src.models.providers||{}).join(','));
"
```
Expected: imprime `plantilla escrita; modelo provider: ...` (al menos `minimax,ollama` u `ollama`).

- [ ] **Step 2: Escribir el test que falla**

Crear `scripts/test-generate.mjs` con:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateOpenclawJson } from '../lib/generators.ts';

const baseConfig = {
  providers: { ollama: { baseUrl: 'http://127.0.0.1:11434/v1', model: 'gemma4-gpu' } },
  clawcrewTeam: { sector: 'general', prefix: 'acme', overlayName: 'Acme', agents: [] },
  guardClaw: { sensitivity: 'S2' },
  channels: {},
  security: { dmPolicy: 'allowlist', allowlist: [] },
  skills: [], personality: { name: 'Acme', emoji: '🏢', vibe: '' },
  useCase: { type: 'business', agents: [] },
};

test('openclaw.json generado tiene las secciones críticas', () => {
  const out = JSON.parse(generateOpenclawJson(baseConfig));
  assert.ok(out.gateway, 'gateway');
  assert.ok(out.models && out.models.providers, 'models.providers');
  assert.ok(out.plugins && out.plugins.entries, 'plugins.entries');
  assert.ok(Array.isArray(out.agents.list), 'agents.list array');
  assert.notEqual(out.gateway.auth.token, '__GATEWAY_TOKEN__', 'token sustituido');
  assert.equal(out.gateway.auth.token, out.gateway.remote.token, 'mismo token gw/remote');
});

test('el provider/modelo elegido entra en models.providers', () => {
  const out = JSON.parse(generateOpenclawJson(baseConfig));
  // ollama elegido → debe existir un provider ollama con el modelo
  const prov = out.models.providers.ollama;
  assert.ok(prov, 'provider ollama presente');
  assert.ok(JSON.stringify(prov).includes('gemma4-gpu'), 'modelo gemma4-gpu presente');
});
```

- [ ] **Step 3: Ejecutar para verlo fallar**

Run: `node --experimental-strip-types --test scripts/test-generate.mjs`
Expected: FAIL — `generateOpenclawJson` no existe / no exportada.

- [ ] **Step 4: Implementar `generateOpenclawJson` en `lib/generators.ts`**

Añadir al principio de `lib/generators.ts` (tras los imports existentes):
```ts
import openclawTemplate from "./templates/openclaw.template.json";
import { randomBytes } from "crypto";
```
Y añadir la función (usa la plantilla, sustituye token y ajusta el provider/modelo elegido):
```ts
// Genera un openclaw.json COMPLETO partiendo de la plantilla (derivada de la
// config probada de ai-office) y parametrizando lo por-instancia. agents.list
// queda [] — configure-overlay.js los inyecta tras instalar los agentes.
export function generateOpenclawJson(config: WizardConfig): string {
  const tpl = JSON.parse(JSON.stringify(openclawTemplate));
  const token = randomBytes(24).toString("base64url");
  if (tpl.gateway?.auth) tpl.gateway.auth.token = token;
  if (tpl.gateway?.remote) tpl.gateway.remote.token = token;

  // Provider + modelo elegidos en step-1 → models.providers (replace mode).
  const chosen = pickProviderModel(config);
  if (chosen) {
    tpl.models = tpl.models || { mode: "replace", providers: {} };
    tpl.models.providers = tpl.models.providers || {};
    tpl.models.providers[chosen.providerId] = chosen.providerEntry;
  }
  return JSON.stringify(tpl, null, 2) + "\n";
}

// Mapea el bloque providers del wizard a una entrada models.providers de openclaw.
// Devuelve null si no hay provider elegido (se conserva el de la plantilla).
function pickProviderModel(config: WizardConfig): { providerId: string; providerEntry: unknown } | null {
  const p = config.providers || {};
  if (p.ollama) {
    return { providerId: "ollama", providerEntry: {
      baseUrl: p.ollama.baseUrl || "http://127.0.0.1:11434/v1",
      apiKey: "ollama-local", api: "openai-completions",
      models: [{ id: p.ollama.model || "gemma4-gpu", name: p.ollama.model || "gemma4-gpu", reasoning: false, input: ["text"] }],
    } };
  }
  if (p.anthropic) {
    return { providerId: "anthropic", providerEntry: {
      apiKey: "${ANTHROPIC_API_KEY}", api: "anthropic-messages",
      models: [{ id: p.anthropic.model || "claude-sonnet-4-6", name: p.anthropic.model || "claude-sonnet-4-6" }],
    } };
  }
  if (p.openai) {
    return { providerId: "openai", providerEntry: {
      apiKey: "${OPENAI_API_KEY}", api: "openai-completions",
      models: [{ id: p.openai.model || "gpt-5.2-chat-latest", name: p.openai.model || "gpt-5.2-chat-latest" }],
    } };
  }
  if (p.google) {
    return { providerId: "google", providerEntry: {
      apiKey: "${GOOGLE_API_KEY}", api: "openai-completions",
      models: [{ id: p.google.model || "gemini-2.5-pro", name: p.google.model || "gemini-2.5-pro" }],
    } };
  }
  return null;
}
```
Nota: `WizardConfig.providers.*` se extiende con un campo opcional `model?: string` en Task 3; aquí ya se lee (TS lo permite si el campo es opcional en el tipo — se añade en Task 3 Step 1; si Task 3 va después, `p.ollama.model` compila igual porque el tipo se amplía allí. Para evitar error de orden, AÑADIR el campo `model?` a los tipos providers en este Step también — ver Task 3 Step 1 e incluirlo ya).

Asegurar que `tsconfig.json` tiene `resolveJsonModule: true` (ya lo tiene) para importar la plantilla.

- [ ] **Step 5: Ejecutar para verlo pasar**

Run: `node --experimental-strip-types --test scripts/test-generate.mjs`
Expected: PASS — 2 tests verdes.

- [ ] **Step 6: tsc + commit**

Run: `npx tsc --noEmit` (exit 0)
```bash
git add lib/templates/openclaw.template.json lib/generators.ts scripts/test-generate.mjs
git commit -m "feat: generateOpenclawJson — openclaw.json completo desde plantilla de ai-office"
```

---

## Task 2: install.sh y step-9 usan el openclaw.json generado

**Files:**
- Modify: `lib/generators.ts` (`generateInstallScript` + el set de ficheros de descarga)
- Modify: `app/wizard/step-9/page.tsx`

- [ ] **Step 1: Reemplazar el heredoc esqueleto del install.sh**

En `lib/generators.ts`, dentro de `generateInstallScript()`, localizar el heredoc que escribe el openclaw.json (la sección "bootstrap overlay-specific openclaw.json", ~`cat > "$OPENCLAW_CONFIG" <<'OPENCLAWEOF'` … `OPENCLAWEOF`). Sustituir TODO ese bloque por una copia del fichero `openclaw.json` que el wizard descarga junto al install.sh:
```bash
# ── Step 3.b — overlay openclaw.json (generado por el wizard, completo) ───────
if [ -f "$SCRIPT_DIR/openclaw.json" ]; then
  cp "$SCRIPT_DIR/openclaw.json" "$OPENCLAW_CONFIG"
  info "openclaw.json copiado desde el bundle del wizard"
else
  warn "openclaw.json no está junto al install.sh — usando esqueleto mínimo"
  cat > "$OPENCLAW_CONFIG" <<'OPENCLAWEOF'
{ "gateway": { "mode": "local", "auth": { "mode": "token", "token": "CHANGE_ME" } }, "agents": { "list": [] } }
OPENCLAWEOF
fi
```

- [ ] **Step 2: Incluir openclaw.json en la descarga del step-9**

En `app/wizard/step-9/page.tsx`, en el array `FILES` (la lista de ficheros descargables), añadir la entrada para el openclaw.json y quitar (en Task 5) los YAML. Importar `generateOpenclawJson`:
```tsx
import { generateOpenclawJson } from "@/lib/generators";
// …dentro del array FILES:
{ name: "openclaw.json", icon: "⚙️", build: (c) => generateOpenclawJson(c) },
```
(Adaptar `name`/`icon`/`build` a la forma real del array `FILES` del fichero — cada entrada tiene un nombre, un icono y una función que devuelve el contenido string a partir del WizardConfig.)

- [ ] **Step 3: tsc + commit**

Run: `npx tsc --noEmit` (exit 0)
```bash
git add lib/generators.ts app/wizard/step-9/page.tsx
git commit -m "feat: install.sh copia el openclaw.json completo del bundle; step-9 lo descarga"
```

---

## Task 3: Selección de modelo en step-1

**Files:**
- Modify: `lib/wizard-context.tsx`
- Modify: `app/wizard/step-1/page.tsx`

- [ ] **Step 1: Añadir `model`/`fallbacks` a los tipos providers**

En `lib/wizard-context.tsx`, en `WizardConfig.providers`, añadir el campo opcional `model` (y `fallbacks`) a cada provider:
```ts
providers: {
  anthropic?: { apiKey?: string; sessionToken?: string; model?: string; fallbacks?: string[] };
  openai?: { apiKey: string; model?: string; fallbacks?: string[] };
  google?: { apiKey: string; model?: string; fallbacks?: string[] };
  ollama?: { baseUrl: string; model?: string; fallbacks?: string[] };
  axet?: AxetProviderConfig;
};
```

- [ ] **Step 2: Catálogo de modelos por provider**

En `app/wizard/step-1/page.tsx`, añadir una constante con modelos sugeridos por provider:
```tsx
const MODELS_BY_PROVIDER: Record<string, string[]> = {
  anthropic: ["claude-sonnet-4-6", "claude-opus-4-8", "claude-haiku-4-5"],
  openai: ["gpt-5.2-chat-latest", "gpt-5.2"],
  google: ["gemini-2.5-pro", "gemini-2.5-flash"],
  ollama: ["gemma4-gpu", "gemma4:e4b", "qwen2.5-coder:7b"],
};
```

- [ ] **Step 3: UI selector de modelo**

Tras elegir provider en step-1, renderizar un `<select>` con `MODELS_BY_PROVIDER[provider]` y, al cambiar, persistir vía `updateConfig`:
```tsx
<select
  value={config.providers[provider]?.model || ""}
  onChange={(e) => updateConfig({ providers: { ...config.providers, [provider]: { ...config.providers[provider], model: e.target.value } } })}
  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
>
  <option value="">Modelo por defecto del proveedor</option>
  {(MODELS_BY_PROVIDER[provider] || []).map((m) => <option key={m} value={m}>{m}</option>)}
</select>
```
(Adaptar `provider` a la variable real que el step-1 usa para el proveedor seleccionado, y el patrón `updateConfig` al existente en el fichero.)

- [ ] **Step 4: tsc + commit**

Run: `npx tsc --noEmit` (exit 0)
```bash
git add lib/wizard-context.tsx app/wizard/step-1/page.tsx
git commit -m "feat(step-1): elegir modelo (+fallbacks) por proveedor → openclaw.json"
```

---

## Task 4: Toggle plan-mode en step-2

**Files:**
- Modify: `app/wizard/step-2/page.tsx`

- [ ] **Step 1: UI del toggle + selector de planner**

`ClawcrewPlanMode` ya existe en el tipo (`{ enabled, plannerAgentId, autoSuggest, fallbackPlanFirst }`) y `generateOverlayConfig`/`configure-overlay.js` ya lo soportan. En `app/wizard/step-2/page.tsx`, tras el equipo, añadir:
```tsx
<label className="flex items-center gap-2 text-sm">
  <input type="checkbox"
    checked={!!config.clawcrewTeam?.planMode?.enabled}
    onChange={(e) => updateConfig({ clawcrewTeam: { ...config.clawcrewTeam!, planMode: { enabled: e.target.checked, plannerAgentId: config.clawcrewTeam?.planMode?.plannerAgentId || "", autoSuggest: false, fallbackPlanFirst: false } } })}
  />
  Activar planificador (un agente coordina al equipo en tareas complejas)
</label>
{config.clawcrewTeam?.planMode?.enabled && (
  <select
    value={config.clawcrewTeam?.planMode?.plannerAgentId || ""}
    onChange={(e) => updateConfig({ clawcrewTeam: { ...config.clawcrewTeam!, planMode: { ...config.clawcrewTeam!.planMode!, plannerAgentId: e.target.value } } })}
    className="mt-2 h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
  >
    <option value="">Elige el agente planificador…</option>
    {(config.clawcrewTeam?.agents || []).filter(a => a.enabled).map(a => (
      <option key={a.slug} value={`${config.clawcrewTeam!.prefix}-${a.slug}-v1`}>{a.displayName}</option>
    ))}
  </select>
)}
```
(Adaptar `updateConfig` al patrón real del fichero; los nombres de campo de `ClawcrewAgentSelection` son `enabled/slug/displayName` — confirmados en wizard-context.tsx.)

- [ ] **Step 2: tsc + commit**

Run: `npx tsc --noEmit` (exit 0)
```bash
git add app/wizard/step-2/page.tsx
git commit -m "feat(step-2): toggle plan-mode + selector de planner"
```

---

## Task 5: Quitar generadores YAML legacy

**Files:**
- Modify: `lib/generators.ts`
- Modify: `app/wizard/step-9/page.tsx`

- [ ] **Step 1: Borrar las funciones y sus usos**

En `lib/generators.ts`, eliminar `generateConfigYAML`, `generateAgentsConfig`, `generateBridgeConfig`, `generateGuardClawConfig` (no las consume el runtime: el gateway lee JSON, el bridge lee env). En `app/wizard/step-9/page.tsx`, quitar del array `FILES` las entradas que producían `openclaw.yaml`, `agents-config.yaml`, `bridge-config.yaml`, `guardclaw-config.yaml` y sus imports.

- [ ] **Step 2: tsc + verificar que no quedan referencias**

Run:
```bash
npx tsc --noEmit
grep -rnE "generateConfigYAML|generateAgentsConfig|generateBridgeConfig|generateGuardClawConfig" lib app || echo "sin referencias colgando"
```
Expected: tsc exit 0; el grep no devuelve usos (solo, como mucho, la definición ya borrada → nada).

- [ ] **Step 3: Commit**

```bash
git add lib/generators.ts app/wizard/step-9/page.tsx
git commit -m "chore: eliminar generadores YAML legacy (no los consume el runtime)"
```

---

## Task 6: Test E2E de generación + dry-run

**Files:**
- Modify: `scripts/test-generate.mjs` (añadir E2E)
- Modify: `package.json`

- [ ] **Step 1: Añadir el E2E al script de test**

Añadir al final de `scripts/test-generate.mjs`:
```js
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateInstallScript } from '../lib/generators.ts';

test('install.sh generado referencia el openclaw.json del bundle (no esqueleto)', () => {
  const sh = generateInstallScript();
  assert.ok(sh.includes('cp "$SCRIPT_DIR/openclaw.json"'), 'install.sh copia el openclaw.json del bundle');
});

test('bundle E2E: openclaw.json completo escribible junto al install.sh', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cfg-bundle-'));
  writeFileSync(join(dir, 'openclaw.json'), generateOpenclawJson(baseConfig));
  writeFileSync(join(dir, 'install.sh'), generateInstallScript());
  const oc = JSON.parse(require('node:fs').readFileSync(join(dir, 'openclaw.json'), 'utf8'));
  assert.ok(oc.models.providers, 'openclaw.json del bundle tiene models.providers');
});
```

- [ ] **Step 2: Añadir npm script**

En `package.json`, dentro de `scripts`, añadir:
```json
"test:generate": "node --experimental-strip-types --test scripts/test-generate.mjs"
```

- [ ] **Step 3: Ejecutar**

Run: `npm run test:generate`
Expected: PASS — todos los tests (los de Task 1 + los E2E) verdes.

- [ ] **Step 4: Commit**

```bash
git add scripts/test-generate.mjs package.json
git commit -m "test: E2E de generación de bundle (openclaw.json completo + install.sh)"
```

---

## Self-Review (hecho al escribir el plan)

- **Cobertura del MVP**: openclaw.json completo (Task 1-2) ✅, merge catálogo (Task 0) ✅, selección de modelo (Task 3) ✅, plan-mode toggle (Task 4) ✅, limpieza YAML legacy (Task 5) ✅, test E2E (Task 6) ✅.
- **Placeholders**: las instrucciones "adaptar al patrón real del fichero" son por componentes UI que se leen en ejecución; el diseño (qué estado/JSX) va concreto. La plantilla openclaw.json se genera por copia de la config probada (instrucción concreta, no placeholder).
- **Consistencia de tipos**: `generateOpenclawJson`, `pickProviderModel`, `providers.*.model`, `clawcrewTeam.planMode` usados coherentes entre tareas. El campo `model?` se añade a los tipos en Task 1/Task 3 (anotado para evitar error de orden).
- **Riesgo**: el `--experimental-strip-types` para importar `.ts` desde el test en Node 22 puede requerir Node ≥22.6; si falla, alternativa: compilar con `tsx` o testear `generateOpenclawJson` vía un pequeño import en un `.mjs` que use `tsx`. Anotado.
- **No se toca** la key Xiaomi hardcodeada (decisión JJ) ni el stack vivo.
