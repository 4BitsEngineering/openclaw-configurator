// ──────────────────────────────────────────────────────────────────────────────
// Catálogo de INTEGRACIONES (tools de OpenClaw que usan los agentes).
//
// Mismo patrón que channels-meta: las soportadas HOY son seleccionables; el resto
// se muestra como "Próximamente". Las credenciales NO se piden aquí: se declaran
// como ENV en el manifiesto (ver contract/env-spec.ts INTEGRATION_ENV) y el
// instalador las solicita en destino. Slack NO está: es un CANAL (Fase 1).
// ──────────────────────────────────────────────────────────────────────────────

export type IntegrationAuth = "oauth" | "key" | "url";

export interface IntegrationMeta {
  id: string;
  label: string;
  blurb: string;
  authStyle: IntegrationAuth;
  authNote: string;
  supported: boolean;
}

export const SUPPORTED_INTEGRATIONS = ["googleworkspace", "n8n", "brave", "elevenlabs"] as const;

const CATALOG: Omit<IntegrationMeta, "supported">[] = [
  // Soportadas
  { id: "googleworkspace", label: "Google Workspace", blurb: "Gmail y Calendar: leer/redactar correos y gestionar la agenda.", authStyle: "oauth", authNote: "Se conecta por OAuth durante la instalación (sin API key)." },
  { id: "n8n",             label: "n8n",              blurb: "Dispara automatizaciones y workflows de n8n.",               authStyle: "url",  authNote: "Pedirá la URL de la instancia y la API key." },
  { id: "brave",           label: "Brave Search",     blurb: "Búsqueda web de calidad para research (precios, fichas…).",   authStyle: "key",  authNote: "Pedirá BRAVE_API_KEY." },
  { id: "elevenlabs",      label: "ElevenLabs",       blurb: "Voz / TTS premium para las respuestas de los agentes.",       authStyle: "key",  authNote: "Pedirá ELEVENLABS_API_KEY (opcional)." },
  // Próximamente (existen en OpenClaw pero aún no validadas en AI Office)
  { id: "firecrawl",       label: "Firecrawl",        blurb: "Scraping y extracción de páginas web.",                       authStyle: "key",  authNote: "FIRECRAWL_API_KEY." },
  { id: "exa",             label: "Exa",              blurb: "Búsqueda web semántica (neural search).",                     authStyle: "key",  authNote: "EXA_API_KEY." },
  { id: "deepgram",        label: "Deepgram",         blurb: "Transcripción de audio (speech-to-text).",                    authStyle: "key",  authNote: "DEEPGRAM_API_KEY." },
  { id: "notion",          label: "Notion",           blurb: "Lee y escribe en tus bases de datos de Notion.",              authStyle: "oauth", authNote: "OAuth de Notion." },
  { id: "perplexity",      label: "Perplexity",       blurb: "Respuestas con búsqueda en tiempo real.",                     authStyle: "key",  authNote: "PERPLEXITY_API_KEY." },
  { id: "zapier",          label: "Zapier",           blurb: "Conecta con miles de apps vía Zaps.",                         authStyle: "key",  authNote: "Token de Zapier." },
];

export const ALL_INTEGRATIONS: IntegrationMeta[] = (() => {
  const supported = new Set<string>(SUPPORTED_INTEGRATIONS);
  const merged = CATALOG.map((c) => ({ ...c, supported: supported.has(c.id) }));
  const orderOf = (id: string) => {
    const i = (SUPPORTED_INTEGRATIONS as readonly string[]).indexOf(id);
    return i === -1 ? 999 : i;
  };
  return merged.sort((a, b) => {
    if (a.supported !== b.supported) return a.supported ? -1 : 1;
    if (a.supported && b.supported) return orderOf(a.id) - orderOf(b.id);
    return a.label.localeCompare(b.label);
  });
})();

export const SUPPORTED_INTEGRATIONS_LIST = ALL_INTEGRATIONS.filter((i) => i.supported);
export const UPCOMING_INTEGRATIONS_LIST = ALL_INTEGRATIONS.filter((i) => !i.supported);
