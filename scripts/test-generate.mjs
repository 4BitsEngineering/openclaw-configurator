import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateOpenclawJson, generateInstallScript, generateOverlayConfig, generateEnvFile, generateInstanceManifest, generateInstancePackage } from '../lib/generators.ts';
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
  const out = generateOpenclawJson(baseConfig);
  assert.equal(/BSAfi|eyJ[A-Za-z0-9_-]{10,}/.test(out), false, 'no debe haber keys/JWT crudos');
  assert.ok(out.includes('${BRAVE_API_KEY}') || !out.includes('brave'), 'brave key como placeholder');
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

test('el modelo elegido en step-1 es el primary del openclaw.json y el defaultModel del overlay', () => {
  const cfg = { ...baseConfig, clawcrewTeam: teamWithAgent, providers: { anthropic: { apiKey: 'x', model: 'claude-opus-4-8' } } };
  const oc = JSON.parse(generateOpenclawJson(cfg));
  const primary = oc.agents?.defaults?.model?.primary;
  assert.equal(primary, 'anthropic/claude-opus-4-8');
  assert.ok((oc.agents?.defaults?.model?.fallbacks || []).includes('ollama/gemma4-gpu'), 'fallback keyless presente');
  const overlay = JSON.parse(generateOverlayConfig(cfg));
  assert.equal(overlay.defaultModel, 'anthropic/claude-opus-4-8');
});

test('sin proveedor elegido → default keyless ollama/gemma4-gpu', () => {
  const cfg = { ...baseConfig, clawcrewTeam: teamWithAgent, providers: {} };
  const oc = JSON.parse(generateOpenclawJson(cfg));
  assert.equal(oc.agents?.defaults?.model?.primary, 'ollama/gemma4-gpu');
  const overlay = JSON.parse(generateOverlayConfig(cfg));
  assert.equal(overlay.defaultModel, 'ollama/gemma4-gpu');
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
  assert.equal(overlay.settingsSeed.CONVERSATIONS_IDLE_DAYS, 90);
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

test('manifest.env: integraciones habilitadas declaran sus ENV', () => {
  const cfg = { ...contractConfig, integrations: { n8n: { enabled: true }, slack: { enabled: false } } };
  const m = JSON.parse(generateInstanceManifest(cfg));
  const keys = m.env.map(e => e.key);
  assert.ok(keys.includes('N8N_BASE_URL') && keys.includes('N8N_AUTH_TOKEN'), 'n8n ENV declaradas');
  assert.equal(keys.includes('SLACK_APP_TOKEN'), false, 'slack deshabilitado no declara ENV');
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

test('generateInstancePackage: emite los 3 artefactos del contrato', () => {
  const pkg = generateInstancePackage(contractConfig);
  assert.ok(pkg['base/openclaw.json'], 'base');
  assert.ok(pkg['overlay/overlay-config.json'], 'overlay');
  assert.ok(pkg['instance-manifest.json'], 'manifest');
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
