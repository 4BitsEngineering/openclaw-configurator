import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateOpenclawJson, generateInstallScript, generateOverlayConfig, generateEnvFile } from '../lib/generators.ts';
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

test('bundle E2E: openclaw.json completo escribible junto al install.sh', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cfg-bundle-'));
  writeFileSync(join(dir, 'openclaw.json'), generateOpenclawJson(baseConfig));
  writeFileSync(join(dir, 'install.sh'), generateInstallScript());
  const oc = JSON.parse(readFileSync(join(dir, 'openclaw.json'), 'utf8'));
  assert.ok(oc.models && oc.models.providers, 'openclaw.json del bundle tiene models.providers');
  assert.ok(oc.plugins && oc.plugins.entries, 'tiene plugins.entries');
});
