"use client";

import { PhaseLayout } from "@/components/wizard/phase-layout";
import { useWizard } from "@/lib/wizard-context";
import { ProviderIcon } from "@/lib/provider-icon";
import rawCatalog from "@/lib/providers-catalog.json";
import { useState, useMemo } from "react";

const catalog = rawCatalog as typeof rawCatalog & {
  providers: Array<{
    id: string; label: string; featured: boolean;
    authMethods: string[]; envVars: string[];
    baseUrl: string | null; api: string | null;
    models: Array<{ id: string; name: string; reasoning: boolean; input: string[]; contextWindow: number | null }>;
  }>;
};

type CatalogProvider = (typeof catalog)["providers"][number];
type CatalogModel = CatalogProvider["models"][number];

// OpenRouter primero (1-ago-2026, decisión JJ tras el A/B real): es el modo de
// producto recomendado — multi-modelo con M3 primary (BYOK de la suscripción
// MiniMax) y reserva Kimi K2.6. Google sigue disponible en el buscador.
const FEATURED_IDS = ["openrouter", "minimax", "anthropic", "openai"];

const isKeyless = (p: CatalogProvider) =>
  p.authMethods.includes("local") || p.envVars.length === 0;

const credLabel = (p: CatalogProvider): string => {
  if (isKeyless(p)) return "Sin credencial";
  if (p.authMethods.includes("oauth")) return "OAuth";
  if (p.authMethods.includes("device-code")) return "Device pairing";
  if (p.authMethods.includes("cli")) return "CLI";
  return "API key";
};

const ctxLabel = (tokens: number | null): string => {
  if (!tokens) return "";
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(0)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(0)}k`;
  return `${tokens}`;
};

export default function ProviderStep() {
  const { config, updateConfig } = useWizard();

  const [selectedId, setSelectedId] = useState<string>(
    Object.keys(config.providers || {})[0] ?? "",
  );
  const [selectedModelId, setSelectedModelId] = useState<string>(
    (Object.values(config.providers || {})[0] as { model?: string } | undefined)?.model ?? "",
  );
  const [search, setSearch] = useState("");

  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [customModelId, setCustomModelId] = useState("");
  const [customEnvKey, setCustomEnvKey] = useState("CUSTOM_API_KEY");

  // Modo openrouter: acompañarlo de la suscripción MiniMax (TTS/imagen + BYOK).
  // Default ON — es el SKU recomendado. Se rehidrata de una selección previa.
  const [orWithMinimax, setOrWithMinimax] = useState<boolean>(() =>
    (config.providers || {}).openrouter ? !!(config.providers || {}).minimax : true,
  );

  const isCustom = selectedId === "__custom__";
  const isOpenRouter = selectedId === "openrouter";

  const featured = FEATURED_IDS
    .map((id) => catalog.providers.find((p) => p.id === id))
    .filter(Boolean) as CatalogProvider[];
  const rest = catalog.providers.filter((p) => !FEATURED_IDS.includes(p.id));

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rest.filter((p) => !q || p.id.includes(q) || p.label.toLowerCase().includes(q));
  }, [search]);

  const selected: CatalogProvider | null = isCustom
    ? null
    : (catalog.providers.find((p) => p.id === selectedId) ?? null);
  const models: CatalogModel[] = selected?.models ?? [];

  function pick(p: CatalogProvider) {
    setSelectedId(p.id);
    setSelectedModelId(p.models[0]?.id ?? "");
    setSearch("");
  }

  function pickCustom() {
    setSelectedId("__custom__");
    setSelectedModelId("");
    setSearch("");
  }

  function handleNext(): boolean {
    if (!selectedId) return false;
    if (isCustom) {
      if (!customBaseUrl.trim() || !customModelId.trim()) return false;
      updateConfig({
        providers: {
          __custom__: {
            baseUrl: customBaseUrl.trim(),
            model: customModelId.trim(),
            envKey: customEnvKey.trim() || "CUSTOM_API_KEY",
          },
        },
      });
      return true;
    }
    const entry: Record<string, unknown> = {};
    if (selectedModelId) entry.model = selectedModelId;
    // openrouter + suscripción MiniMax: el generador conserva el bloque directo
    // de minimax (TTS/imagen) y pide MINIMAX_API_KEY además de la de OpenRouter.
    if (isOpenRouter && orWithMinimax) {
      updateConfig({ providers: { openrouter: entry, minimax: {} } });
      return true;
    }
    updateConfig({ providers: { [selectedId]: entry } });
    return true;
  }

  // ── Subcomponentes de detalle (columna derecha) ──────────────────────────

  const detailEmpty = (
    <div className="rounded-xl border border-dashed border-border p-8 text-center">
      <p className="text-sm text-muted-foreground">Selecciona un proveedor para elegir el modelo</p>
    </div>
  );

  const detailCustom = (
    <div className="rounded-xl border border-border bg-muted/40 p-5 space-y-4 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <span className="text-xl">⚙</span>
        <div>
          <p className="font-semibold text-foreground text-sm">Provider personalizado</p>
          <p className="text-xs text-muted-foreground">OpenAI-compatible</p>
        </div>
      </div>
      <div className="space-y-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1.5">URL base del endpoint</label>
          <input
            type="text"
            placeholder="http://localhost:11434/v1"
            value={customBaseUrl}
            onChange={(e) => setCustomBaseUrl(e.target.value)}
            className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Ollama: <code className="font-mono">:11434/v1</code> · LM Studio: <code className="font-mono">:1234/v1</code>
          </p>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1.5">ID del modelo</label>
          <input
            type="text"
            placeholder="gemma3:12b"
            value={customModelId}
            onChange={(e) => setCustomModelId(e.target.value)}
            className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Variable API key (opcional)</label>
          <input
            type="text"
            placeholder="CUSTOM_API_KEY"
            value={customEnvKey}
            onChange={(e) => setCustomEnvKey(e.target.value)}
            className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>
      {!customBaseUrl.trim() && (
        <p className="text-xs text-amber-600 font-medium">Introduce la URL base para continuar.</p>
      )}
    </div>
  );

  const detailProvider = selected && (
    <div className="rounded-xl border border-border bg-muted/40 p-5 space-y-4 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <ProviderIcon id={selected.id} label={selected.label} size={32} />
        <div>
          <p className="font-semibold text-foreground">{selected.label}</p>
          <p className="text-xs text-muted-foreground">{credLabel(selected)}</p>
        </div>
      </div>

      {isOpenRouter ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-background p-3 space-y-1">
            <p className="text-sm font-medium text-foreground">Multi-modelo (recomendado)</p>
            <p className="text-xs text-muted-foreground">
              Principal <span className="font-mono">MiniMax M3</span> (proveedor oficial fijado) con
              reserva automática <span className="font-mono">Kimi K2.6</span>.{" "}
              <span className="font-mono">Qwen3.7 Plus</span> disponible para asignarlo por agente.
            </p>
          </div>
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={orWithMinimax}
              onChange={(e) => setOrWithMinimax(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-input accent-[var(--brand,#7c3aed)]"
            />
            <span>
              <span className="text-sm font-medium text-foreground block">Tengo suscripción MiniMax</span>
              <span className="text-xs text-muted-foreground block">
                Activa voz e imagen con su key y permite que el consumo de M3 lo cubra tu plan
                (registrándola como BYOK en OpenRouter, sección Prioritized).
              </span>
            </span>
          </label>
        </div>
      ) : models.length > 0 ? (
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-2">Modelo</label>
          <div className="space-y-1.5 max-h-[30rem] overflow-y-auto pr-1">
            {models.map((m) => {
              const active = selectedModelId === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedModelId(m.id)}
                  className={`w-full flex items-start justify-between gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                    active ? "border-brand bg-brand-soft" : "border-border bg-background hover:border-brand/30"
                  }`}
                >
                  <span className="flex-1 min-w-0">
                    <span className="font-medium text-sm text-foreground block">{m.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">{m.id}</span>
                  </span>
                  <span className="shrink-0 flex flex-col items-end gap-1">
                    {m.reasoning && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-medium">reasoning</span>
                    )}
                    {m.contextWindow && (
                      <span className="text-xs text-muted-foreground">{ctxLabel(m.contextWindow)} ctx</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1.5">ID de modelo</label>
          <input
            type="text"
            placeholder="p.ej. gemini-2.5-pro"
            value={selectedModelId}
            onChange={(e) => setSelectedModelId(e.target.value)}
            className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p className="text-xs text-muted-foreground mt-1">Este proveedor resuelve los modelos al conectar.</p>
        </div>
      )}

      {!isKeyless(selected) && selected.envVars.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-border">
          <span className="text-xs text-muted-foreground w-full">Se pedirán al instalar:</span>
          {selected.envVars.map((v) => (
            <span key={v} className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-xs font-mono">
              {v}
            </span>
          ))}
          {isOpenRouter && orWithMinimax && (
            <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-xs font-mono">
              MINIMAX_API_KEY
            </span>
          )}
        </div>
      )}
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <PhaseLayout
      stepId="provider"
      title="Proveedor de modelo"
      description="Elige el proveedor y modelo que dirigirá tu instancia de OpenClaw"
      onNext={handleNext}
    >
      <div className="space-y-6">

        {/* ── Destacados (ancho completo) ───────────────────────────────── */}
        <div>
          <p className="panel-eyebrow text-muted-foreground mb-3">Destacados</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {featured.map((p) => {
              const active = selectedId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pick(p)}
                  className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all text-center ${
                    active
                      ? "border-brand bg-brand-soft shadow-sm"
                      : "border-border bg-card hover:border-brand/30 hover:bg-accent"
                  }`}
                >
                  <ProviderIcon id={p.id} label={p.label} size={40} />
                  <span className="text-sm font-semibold text-foreground leading-tight">{p.label}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    isKeyless(p) ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
                  }`}>
                    {credLabel(p)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Dos columnas: lista | detalle ─────────────────────────────── */}
        <div className="lg:grid lg:grid-cols-[1fr_minmax(320px,360px)] lg:gap-8 space-y-6 lg:space-y-0 pt-2 border-t border-border">

          {/* IZQUIERDA: buscador + custom + lista (sin caja, sobre la card) */}
          <div className="min-w-0 space-y-3 pt-2">
            <div className="flex items-center justify-between gap-3">
              <p className="panel-eyebrow text-muted-foreground">Todos los proveedores</p>
              <input
                type="text"
                placeholder="Buscar…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-40 px-3 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            {/* Custom */}
            {!search && (
              <button
                type="button"
                onClick={pickCustom}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left border ${
                  isCustom ? "border-brand bg-brand-soft" : "border-dashed border-border hover:border-brand/30 hover:bg-accent"
                }`}
              >
                <span className="w-6 h-6 flex items-center justify-center text-sm shrink-0">⚙</span>
                <span className="flex-1 min-w-0">
                  <span className="font-medium text-sm text-foreground block">Custom (OpenAI-compatible)</span>
                  <span className="text-xs text-muted-foreground">Ollama remoto, LocalAI, LM Studio…</span>
                </span>
                {isCustom && <span className="text-brand text-xs shrink-0">✓</span>}
              </button>
            )}

            {/* Lista */}
            <div className="max-h-[30rem] overflow-y-auto space-y-0.5 -mx-1 px-1">
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">Sin resultados</p>
              )}
              {filtered.map((p) => {
                const active = selectedId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => pick(p)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors border ${
                      active ? "border-brand bg-brand-soft" : "border-transparent hover:bg-accent"
                    }`}
                  >
                    <ProviderIcon id={p.id} label={p.label} size={22} />
                    <span className="flex-1 min-w-0">
                      <span className="font-medium text-sm text-foreground block truncate">{p.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {credLabel(p)}{p.models.length > 0 ? ` · ${p.models.length} modelos` : ""}
                      </span>
                    </span>
                    {active && <span className="text-brand text-xs shrink-0">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* DERECHA: detalle (sticky en lg+) */}
          <div className="lg:sticky lg:top-32 lg:self-start pt-2">
            {!selectedId ? detailEmpty : isCustom ? detailCustom : detailProvider}
          </div>
        </div>
      </div>
    </PhaseLayout>
  );
}
