import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateOpenclawJson, generateInstallScript } from '../lib/generators.ts';
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

test('bundle E2E: openclaw.json completo escribible junto al install.sh', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cfg-bundle-'));
  writeFileSync(join(dir, 'openclaw.json'), generateOpenclawJson(baseConfig));
  writeFileSync(join(dir, 'install.sh'), generateInstallScript());
  const oc = JSON.parse(readFileSync(join(dir, 'openclaw.json'), 'utf8'));
  assert.ok(oc.models && oc.models.providers, 'openclaw.json del bundle tiene models.providers');
  assert.ok(oc.plugins && oc.plugins.entries, 'tiene plugins.entries');
});
