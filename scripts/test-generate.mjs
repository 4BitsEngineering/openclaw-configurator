import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateOpenclawJson, generateInstallScript, generateOverlayConfig, generateEnvFile, generateInstanceManifest, generateInstancePackage, generateDispatchConfig } from '../lib/generators.ts';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
  const prov = out.models.providers.ollama;
  assert.ok(prov, 'provider ollama presente');
  assert.ok(JSON.stringify(prov).includes('gemma4-gpu'), 'modelo gemma4-gpu presente');
});

test('no se filtran secretos crudos al openclaw.json generado', () => {
  const out = generateOpenclawJson({ ...baseConfig, integrations: { brave: { enabled: true } } });
  assert.equal(/BSAfi|eyJ[A-Za-z0-9_-]{10,}/.test(out), false, 'no debe haber keys/JWT crudos');
  // brave SELECCIONADA: la key NO va en el config (ni cruda ni placeholder) — se
  // resuelve por SecretRef service:brave desde el store cifrado del bridge.
  assert.ok(out.includes('service:brave'), 'brave por SecretRef service:brave (cuando se selecciona)');
  // ...pero PENDIENTE (enabled:false) para no abortar el boot sin key (Capa A).
  assert.equal(JSON.parse(out).plugins?.entries?.brave?.enabled, false, 'brave pendiente (off) al seleccionarlo');
});
test('ollama conserva sus modelos del template y añade el elegido', () => {
  const out = JSON.parse(generateOpenclawJson(baseConfig));
  const ids = (out.models.providers.ollama.models || []).map(m => m.id);
  assert.ok(ids.includes('gemma4-gpu'), 'modelo elegido presente');
  assert.ok(ids.length >= 2, 'se conservan otros modelos del template (no replace destructivo)');
});

test('install.sh generado copia el openclaw.json del bundle (no esqueleto)', () => {
  const sh = generateInstallScript();
  assert.ok(sh.includes('$SCRIPT_DIR/openclaw.json'), 'install.sh referencia el openclaw.json del bundle');
  assert.ok(sh.includes('__STACK_ROOT__'), 'install.sh sustituye el placeholder de ruta');
});

// Equipo con 1 agente para que generateOverlayConfig emita el config real
// (no el esqueleto vacío que se devuelve cuando no se eligió equipo en step-2).
const teamWithAgent = {
  sector: 'general', prefix: 'acme', overlayName: 'Acme',
  agents: [{ agent: 'office-executive', slug: 'office-executive', displayName: 'Iván', icon: '🤝', enabled: true }],
};

test('el modelo elegido en step-1 es el primary, SOLO ese provider y sin fallback de ollama ni MiniMax', () => {
  const cfg = { ...baseConfig, clawcrewTeam: teamWithAgent, providers: { anthropic: { apiKey: 'x', model: 'claude-opus-4-8' } } };
  const oc = JSON.parse(generateOpenclawJson(cfg));
  const primary = oc.agents?.defaults?.model?.primary;
  assert.equal(primary, 'anthropic/claude-opus-4-8');
  // Decisión 29-jun: el config generado lleva SOLO el provider elegido. Sin
  // fallback de ollama y sin minimax residual (provider/TTS) que exigiría su key.
  assert.deepEqual(oc.agents?.defaults?.model?.fallbacks || [], [], 'sin fallback de ollama');
  assert.deepEqual(Object.keys(oc.models?.providers || {}), ['anthropic'], 'solo el provider elegido en models.providers');
  assert.ok(!JSON.stringify(oc).includes('${MINIMAX_API_KEY}'), 'sin referencia a MINIMAX_API_KEY');
  const overlay = JSON.parse(generateOverlayConfig(cfg));
  assert.equal(overlay.defaultModel, 'anthropic/claude-opus-4-8');
});

test('provider del catálogo (minimax) dirige el primary y declara su key', () => {
  const cfg = { ...baseConfig, clawcrewTeam: teamWithAgent, providers: { minimax: { model: 'MiniMax-M3' } } };
  const oc = JSON.parse(generateOpenclawJson(cfg));
  assert.equal(oc.agents.defaults.model.primary, 'minimax/MiniMax-M3', 'minimax como primary (antes caía a ollama)');
  assert.ok('minimax' in (oc.models.providers || {}), 'minimax presente en models.providers (de la plantilla)');
  const keys = JSON.parse(generateInstanceManifest(cfg)).env.map(e => e.key);
  assert.ok(keys.includes('MINIMAX_API_KEY'), 'MINIMAX_API_KEY declarada en el manifiesto');
});

test('provider custom: cablea models.providers.custom y pide SOLO su envKey (sin minimax)', () => {
  const cfg = { ...baseConfig, clawcrewTeam: teamWithAgent, channels: {}, providers: { __custom__: { baseUrl: 'http://127.0.0.1:4010/v1', model: 'mi-modelo', envKey: 'CUSTOM_API_KEY' } } };
  const oc = JSON.parse(generateOpenclawJson(cfg));
  assert.equal(oc.agents?.defaults?.model?.primary, 'custom/mi-modelo');
  assert.deepEqual(Object.keys(oc.models?.providers || {}), ['custom'], 'solo el provider custom');
  assert.equal(oc.models.providers.custom.baseUrl, 'http://127.0.0.1:4010/v1');
  assert.equal(oc.models.providers.custom.api, 'openai-completions');
  assert.ok(!JSON.stringify(oc).includes('${MINIMAX_API_KEY}'), 'sin MiniMax residual');
  const keys = JSON.parse(generateInstanceManifest(cfg)).env.map(e => e.key);
  assert.deepEqual(keys, ['CUSTOM_API_KEY'], 'solo pide la envKey del custom');
});

test('provider custom keyless (sin envKey): no pide NINGÚN secreto', () => {
  const cfg = { ...baseConfig, clawcrewTeam: teamWithAgent, channels: {}, providers: { __custom__: { baseUrl: 'http://127.0.0.1:4010/v1', model: 'mi-modelo', envKey: '' } } };
  const oc = JSON.parse(generateOpenclawJson(cfg));
  assert.equal(oc.models.providers.custom.apiKey, 'not-needed', 'placeholder no-vacío para keyless');
  const keys = JSON.parse(generateInstanceManifest(cfg)).env.map(e => e.key);
  assert.deepEqual(keys, [], 'keyless: el installer no pide secretos');
});

test('sin proveedor elegido → ERROR duro (no se promueve un baseline muerto con ollama)', () => {
  // Antes caía SILENCIOSAMENTE a ollama/gemma4-gpu keyless → en un cliente sin
  // Ollama el LLM no respondía (instalación muerta), y sin fallback de minimax no
  // había red. Ahora generar sin provider lanza, así register/baseline no puede
  // promover una config sin provider. (Regresión real observada 29-jun.)
  const cfg = { ...baseConfig, clawcrewTeam: teamWithAgent, providers: {} };
  assert.throws(() => generateOpenclawJson(cfg), /No se eligió ningún provider/);
});

test('memorySearch sale keyword-only (provider "none"), sin el Ollama de dev fosilizado', () => {
  // Regresión 15-jul: la plantilla llevaba memorySearch → ollama/nomic-embed-text
  // en 127.0.0.1:11434 (config de dev). Un cliente sin Ollama quedaba con la
  // búsqueda semántica muerta en silencio. Verificado en openclaw 2026.6.11:
  // - enabled:true SIN provider ⇒ el CLI ni arranca (default openai exige key)
  // - provider "none" ⇒ índice FTS5 real (keyword-only), cero dependencias
  const cfg = { ...baseConfig, clawcrewTeam: teamWithAgent, providers: { minimax: {} } };
  const oc = JSON.parse(generateOpenclawJson(cfg));
  const ms = oc.agents?.defaults?.memorySearch;
  assert.equal(ms?.enabled, true, 'memorySearch habilitado');
  assert.equal(ms?.provider, 'none', 'provider "none" explícito (keyword-only)');
  assert.equal(ms?.remote, undefined, 'sin remote residual');
  assert.ok(!JSON.stringify(ms).includes('11434'), 'sin el endpoint de Ollama de dev');
});

test('provider elegido (minimax) → primary minimax/MiniMax-M3 (no ollama)', () => {
  const cfg = { ...baseConfig, clawcrewTeam: teamWithAgent, providers: { minimax: {} } };
  const oc = JSON.parse(generateOpenclawJson(cfg));
  assert.equal(oc.agents?.defaults?.model?.primary, 'minimax/MiniMax-M3');
  assert.deepEqual(Object.keys(oc.models?.providers || {}), ['minimax']);
});

test('el .env emite la API key del modelo elegido (vacía) y nada extra para ollama', () => {
  const anth = generateEnvFile({ ...baseConfig, providers: { anthropic: { apiKey: 'x', model: 'claude-opus-4-8' } } });
  assert.ok(/ANTHROPIC_API_KEY=/.test(anth), 'ANTHROPIC_API_KEY presente');
  const oll = generateEnvFile({ ...baseConfig, providers: { ollama: { baseUrl: 'http://127.0.0.1:11434/v1', model: 'gemma4-gpu' } } });
  assert.equal(/ANTHROPIC_API_KEY|OPENAI_API_KEY|GOOGLE_API_KEY/.test(oll), false, 'ollama keyless: no emite keys');
});

// ── Contrato de salidas (entregable #1) ─────────────────────────────────────────

const contractConfig = {
  ...baseConfig,
  clawcrewTeam: teamWithAgent,
  providers: { anthropic: { apiKey: 'x', model: 'claude-opus-4-8' } },
  channels: { telegram: { token: 'x' } },
};

test('manifest: estructura mínima y compat/registro correctos', () => {
  const m = JSON.parse(generateInstanceManifest(contractConfig));
  assert.ok(m.instance && m.instance.slug && m.instance.prefix, 'instance');
  assert.equal(m.compat.configSchemaVersion, '1.0', 'schema version');
  assert.ok(m.compat.generatedBy.startsWith('openclaw-configurator@'), 'generatedBy');
  assert.equal(m.artifacts.base, 'base/openclaw.json');
  assert.equal(m.artifacts.overlay, 'overlay/overlay-config.json');
  assert.equal(m.registration.target, 'clawhub');
  assert.equal(m.registration.mode, 'install-time');
});

test('manifest.env: declara provider+channel elegidos, sin valores y sin duplicados', () => {
  const m = JSON.parse(generateInstanceManifest(contractConfig));
  const keys = m.env.map(e => e.key);
  assert.ok(keys.includes('ANTHROPIC_API_KEY'), 'key del provider');
  assert.ok(keys.includes('TELEGRAM_BOT_TOKEN'), 'token del canal');
  assert.equal(new Set(keys).size, keys.length, 'sin duplicados');
  // Cada entrada es solo declaración: nada parecido a un valor real.
  for (const e of m.env) {
    assert.ok(e.key && e.scope && e.desc, `entrada ${e.key} declarada`);
    assert.equal(/^(sk-ant-api03|xoxb)-[A-Za-z0-9]{20,}/.test(e.example), false, `example de ${e.key} no es un secreto real`);
  }
});

test('manifest.env: ollama keyless no aporta ENV de provider', () => {
  const m = JSON.parse(generateInstanceManifest({ ...baseConfig, clawcrewTeam: teamWithAgent, providers: { ollama: { baseUrl: 'http://127.0.0.1:11434/v1', model: 'gemma4-gpu' } }, channels: {} }));
  const keys = m.env.map(e => e.key);
  assert.equal(keys.some(k => /API_KEY$/.test(k)), false, 'ollama keyless: sin API keys');
});

test('overlay-config: settingsSeed con defaults seguros y claves reales del bridge', () => {
  const overlay = JSON.parse(generateOverlayConfig(contractConfig));
  assert.ok(overlay.settingsSeed, 'settingsSeed presente');
  // Defaults seguros cuando el wizard no pobló bridgeSettings.
  assert.equal(overlay.settingsSeed.AUTONOMY_LEVEL, 'n0', 'autonomía humano-en-bucle por defecto');
  assert.equal(overlay.settingsSeed.GUARDCLAW_ENABLED, true);
  assert.equal(overlay.settingsSeed.GUARDCLAW_OUTPUT_REDACT, true);
  assert.equal(overlay.settingsSeed.AGENT_TIMEOUT, 1800);
  assert.equal(overlay.settingsSeed.CONVERSATIONS_IDLE_DAYS, 30);
  assert.ok(overlay.integrations && overlay.knowledge, 'integrations + knowledge');
});

test('overlay-config: settingsSeed refleja el perfil de arranque elegido', () => {
  const cfg = {
    ...contractConfig,
    bridgeSettings: { autonomyLevel: 'n1', guardClawEnabled: true, outputRedact: false, webEgress: true, language: 'en-US', agentTimeout: 600, conversationIdleDays: 30 },
  };
  const overlay = JSON.parse(generateOverlayConfig(cfg));
  assert.equal(overlay.settingsSeed.AUTONOMY_LEVEL, 'n1');
  assert.equal(overlay.settingsSeed.GUARDCLAW_OUTPUT_REDACT, false);
  assert.equal(overlay.settingsSeed.AGENTS_DEFAULT_LANGUAGE, 'en-US');
  assert.equal(overlay.settingsSeed.AGENT_TIMEOUT, 600);
});

test('manifest.env: las integraciones (n8n/brave/elevenlabs) NO van por .env (consola/cifradas)', () => {
  const cfg = { ...contractConfig, integrations: { n8n: { enabled: true }, brave: { enabled: true } } };
  const m = JSON.parse(generateInstanceManifest(cfg));
  const keys = m.env.map(e => e.key);
  // n8n/brave/elevenlabs se configuran en la consola (key cifrada → service:X), no por .env.
  assert.equal(keys.some(k => /^N8N_|^BRAVE_|^ELEVENLABS_/.test(k)), false, 'integraciones sin ENV en el manifiesto');
  assert.equal(keys.includes('SLACK_APP_TOKEN'), false, 'slack no se declara vía integración');
});

test('openclaw.json: n8n SELECCIONADO queda PENDIENTE (enabled:false) y SIN SecretRef inline (boot-safe)', () => {
  const oc = JSON.parse(generateOpenclawJson({ ...baseConfig, integrations: { n8n: { enabled: true } } }));
  // Pendiente hasta meter la key en /integrations: enabled:false. CLAVE: el apiKey
  // NO puede quedar como objeto SecretRef inline — openclaw valida el SCHEMA de la
  // entry (apiKey DEBE ser string) AUNQUE esté disabled, así que un objeto
  // {source:exec, provider:bridge_tokens, id:service:n8n} sin resolver aborta el
  // boot. La key real (string) la inyecta el bind al guardarla en la consola.
  assert.equal(oc.plugins?.entries?.n8n?.enabled, false, 'n8n pendiente (off) al seleccionarlo');
  assert.equal(oc.plugins?.entries?.n8n?.config?.apiKey, undefined, 'n8n sin SecretRef inline (boot-safe)');
  assert.equal(JSON.stringify(oc).includes('service:n8n'), false, 'sin SecretRef service:n8n en el config');
  assert.equal(JSON.stringify(oc).includes('${N8N_'), false, 'sin placeholders ${N8N_*}');
});

test('openclaw.json: integraciones NO seleccionadas se desactivan y SIN service:* (no rompen el boot)', () => {
  const oc = JSON.parse(generateOpenclawJson(baseConfig)); // baseConfig no trae integrations
  assert.equal(oc.plugins?.entries?.n8n?.enabled, false, 'n8n off por defecto');
  assert.equal(oc.plugins?.entries?.brave?.enabled, false, 'brave off por defecto');
  assert.equal(oc.plugins?.entries?.n8n?.config?.apiKey, undefined, 'n8n sin SecretRef');
  assert.equal(oc.plugins?.entries?.brave?.config, undefined, 'brave sin config/SecretRef');
  assert.equal(oc.messages?.tts?.providers?.elevenlabs, undefined, 'elevenlabs TTS fuera');
  assert.equal(/service:(n8n|brave|elevenlabs)/.test(JSON.stringify(oc)), false, 'ningún service:* sin seleccionar');
});

test('openclaw.json: integraciones SELECCIONADAS son boot-safe (pendientes, no abortan)', () => {
  // El reloader solo resuelve providers HABILITADOS; con plugins disabled su
  // SecretRef no se resuelve al boot → no aborta. elevenlabs (TTS, sin gate
  // enabled) se deja fuera hasta que la tarjeta lo re-inyecte con la key.
  const oc = JSON.parse(generateOpenclawJson({
    ...baseConfig,
    integrations: { n8n: { enabled: true }, brave: { enabled: true }, elevenlabs: { enabled: true } },
  }));
  assert.equal(oc.plugins?.entries?.n8n?.enabled, false, 'n8n elegido pero pendiente (off)');
  assert.equal(oc.plugins?.entries?.brave?.enabled, false, 'brave elegido pero pendiente (off)');
  assert.equal(oc.messages?.tts?.providers?.elevenlabs, undefined, 'elevenlabs TTS fuera del config generado');
  // Boot-safety REAL: NINGÚN plugin entry (habilitado o no) puede llevar un apiKey
  // objeto SecretRef sin resolver — el validador de schema de openclaw lo rechaza
  // aunque la entry esté disabled, así que comprobar solo los habilitados daba
  // falsa seguridad (era el bug: n8n off pero con el objeto tumbaba el gateway).
  const anyRefObject = Object.values(oc.plugins?.entries ?? {}).some(
    (e) => e && typeof e === 'object' && e.config
      && typeof e.config.apiKey === 'object' && e.config.apiKey !== null,
  );
  assert.equal(anyRefObject, false, 'ningún plugin con apiKey objeto SecretRef sin resolver');
});

test('canales: los seleccionados se activan en el openclaw.json (presencia = enabled)', () => {
  const cfg = { ...baseConfig, channels: { telegram: { enabled: true }, slack: { enabled: true } } };
  const oc = JSON.parse(generateOpenclawJson(cfg));
  assert.equal(oc.channels.telegram.enabled, true, 'telegram activado');
  assert.equal(oc.channels.slack.enabled, true, 'slack activado');
  // whatsapp viene en la plantilla pero no se eligió → sigue desactivado.
  assert.equal(oc.channels.whatsapp.enabled, false, 'whatsapp no elegido sigue off');
});

test('canales: sin canales (solo web) → openclaw.json no activa ninguno', () => {
  const oc = JSON.parse(generateOpenclawJson({ ...baseConfig, channels: {} }));
  const enabled = Object.values(oc.channels || {}).filter((c) => c && c.enabled);
  assert.equal(enabled.length, 0, 'ningún canal activado cuando el map está vacío');
});

test('manifest.env: slack como canal declara bot+app token', () => {
  const m = JSON.parse(generateInstanceManifest({ ...baseConfig, clawcrewTeam: teamWithAgent, channels: { slack: { enabled: true } } }));
  const keys = m.env.map(e => e.key);
  assert.ok(keys.includes('SLACK_BOT_TOKEN') && keys.includes('SLACK_APP_TOKEN'), 'slack ENV declaradas');
});

test('manifest.env: whatsapp (QR) no declara ENV', () => {
  const m = JSON.parse(generateInstanceManifest({ ...baseConfig, clawcrewTeam: teamWithAgent, channels: { whatsapp: { enabled: true } } }));
  const keys = m.env.map(e => e.key);
  assert.equal(keys.some(k => /WHATSAPP/i.test(k)), false, 'whatsapp no aporta ENV (se vincula por QR)');
});

test('manifest.env: brave/elevenlabs (consola, cifradas) y google workspace (OAuth) NO declaran ENV', () => {
  const cfg = { ...baseConfig, clawcrewTeam: teamWithAgent, integrations: { brave: { enabled: true }, elevenlabs: { enabled: true }, googleworkspace: { enabled: true } } };
  const m = JSON.parse(generateInstanceManifest(cfg));
  const keys = m.env.map(e => e.key);
  // Brave/ElevenLabs se configuran en la consola (key cifrada → service:brave/elevenlabs),
  // no por .env; Google Workspace por OAuth. Ninguna aporta ENV.
  assert.equal(keys.includes('BRAVE_API_KEY'), false, 'brave NO por .env');
  assert.equal(keys.includes('ELEVENLABS_API_KEY'), false, 'elevenlabs NO por .env');
  assert.equal(keys.some(k => /GOOGLE|GMAIL|OAUTH/i.test(k)), false, 'google workspace por OAuth: sin ENV');
});

test('openclaw.json: brave SELECCIONADO usa SecretRef service:brave (no ${BRAVE_API_KEY})', () => {
  const oc = JSON.parse(generateOpenclawJson({ ...baseConfig, integrations: { brave: { enabled: true } } }));
  // Pendiente (off) hasta meter la key en /integrations; la tarjeta lo activa.
  assert.equal(oc.plugins?.entries?.brave?.enabled, false, 'brave pendiente (off) al seleccionarlo');
  const apiKey = oc.plugins?.entries?.brave?.config?.webSearch?.apiKey;
  assert.deepEqual(apiKey, { source: 'exec', provider: 'bridge_tokens', id: 'service:brave' }, 'brave apiKey = SecretRef service:brave');
  assert.equal(JSON.stringify(oc).includes('${BRAVE_API_KEY}'), false, 'sin placeholder ${BRAVE_API_KEY}');
});

test('overlay-config: integrations emite el mapa de soportadas con su enabled', () => {
  const cfg = { ...contractConfig, integrations: { n8n: { enabled: true }, brave: { enabled: false } } };
  const overlay = JSON.parse(generateOverlayConfig(cfg));
  assert.equal(overlay.integrations.n8n.enabled, true);
  assert.equal(overlay.integrations.brave.enabled, false);
  assert.ok('googleworkspace' in overlay.integrations && 'elevenlabs' in overlay.integrations, 'todas las soportadas presentes');
});

test('generateInstancePackage: emite los 3 artefactos del contrato', () => {
  const pkg = generateInstancePackage(contractConfig);
  assert.ok(pkg['base/openclaw.json'], 'base');
  assert.ok(pkg['overlay/overlay-config.json'], 'overlay');
  assert.ok(pkg['instance-manifest.json'], 'manifest');
  assert.ok(pkg['install.sh'] && pkg['install.sh'].includes('#!/usr/bin/env bash'), 'install.sh arrancable');
  assert.ok(typeof pkg['.env.example'] === 'string', '.env.example presente');
  // El .env.example lleva las keys del provider/canal, NO las de integraciones service-key.
  const envEx = generateInstancePackage({ ...contractConfig, providers: { minimax: { model: 'MiniMax-M3' } }, channels: { slack: { enabled: true } }, integrations: { n8n: { enabled: true }, brave: { enabled: true } } })['.env.example'];
  assert.ok(/MINIMAX_API_KEY=/.test(envEx) && /SLACK_BOT_TOKEN=/.test(envEx), 'env.example lista provider+canal');
  assert.equal(/N8N_|BRAVE_/.test(envEx), false, 'env.example NO lista integraciones service-key (van en consola)');
  // Ninguna API key con forma real fuera de los example del manifiesto.
  const base = pkg['base/openclaw.json'];
  assert.equal(/sk-ant-api03-[A-Za-z0-9]{20,}|xoxb-[0-9]{8,}/.test(base), false, 'base sin secretos crudos');
});

test('bundle E2E: openclaw.json completo escribible junto al install.sh', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cfg-bundle-'));
  writeFileSync(join(dir, 'openclaw.json'), generateOpenclawJson(baseConfig));
  writeFileSync(join(dir, 'install.sh'), generateInstallScript());
  const oc = JSON.parse(readFileSync(join(dir, 'openclaw.json'), 'utf8'));
  assert.ok(oc.models && oc.models.providers, 'openclaw.json del bundle tiene models.providers');
  assert.ok(oc.plugins && oc.plugins.entries, 'tiene plugins.entries');
});

// ── dispatch.config.json generado por-cliente ──────────────────────────────
const teamDispatch = {
  sector: 'general', prefix: 'office', overlayName: 'Demo MiniMax',
  agents: [
    { agent: 'executive', slug: 'executive', displayName: 'Elena', icon: '📋', enabled: true },
    { agent: 'community', slug: 'community', displayName: 'Bruno', icon: '✨', enabled: true },
    { agent: 'legal-light', slug: 'paralegal', displayName: 'Lex', icon: '⚖️', enabled: false },
  ],
};

test('dispatch.config: roles = agentes habilitados; agentId = prefix-slug-v1; blurb del catálogo', () => {
  const d = JSON.parse(generateDispatchConfig({ ...baseConfig, clawcrewTeam: teamDispatch }));
  assert.equal(d.roles.length, 2, 'solo los enabled (legal-light off fuera)');
  const exec = d.roles.find(r => r.id === 'executive');
  assert.equal(exec.agentId, 'office-executive-v1', 'agentId = prefix-slug-v1 (idPattern uniforme)');
  assert.equal(exec.label, 'Elena', 'label = displayName del wizard');
  assert.ok(exec.blurb.length > 0, 'blurb tomado del catálogo clawcrew');
  assert.ok(!d.roles.some(r => r.id === 'legal-light'), 'el deshabilitado no aparece');
  assert.deepEqual(d.namePool.executive, ['Elena'], 'namePool por rol');
  assert.equal(d.firmName, 'Demo MiniMax', 'firmName = overlayName');
});

test('package incluye overlay/dispatch.config.json', () => {
  const pkg = generateInstancePackage({ ...baseConfig, clawcrewTeam: teamDispatch });
  assert.ok(pkg['overlay/dispatch.config.json'], 'dispatch.config.json en el paquete');
  const d = JSON.parse(pkg['overlay/dispatch.config.json']);
  assert.equal(d.roles.length, 2, 'roles en el paquete');
});
