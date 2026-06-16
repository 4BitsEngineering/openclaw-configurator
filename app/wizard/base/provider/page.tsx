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

// Destacados: los 4 que mostramos como tarjetas grandes.
const FEATURED_IDS = ["openai", "anthropic", "google", "minimax"];

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
  const [showAll, setShowAll] = useState(true);

  // Estado para provider custom (OpenAI-compatible)
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [customModelId, setCustomModelId] = useState("");
  const [customEnvKey, setCustomEnvKey] = useState("CUSTOM_API_KEY");

  const isCustom = selectedId === "__custom__";

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
    updateConfig({ providers: { [selectedId]: entry } });
    return true;
  }

  return (
    <PhaseLayout
      stepId="provider"
      title="Proveedor de modelo"
      description="Elige el proveedor y modelo que dirigirá tu instancia de OpenClaw"
      onNext={handleNext}
    >
      <div className="space-y-8">

        {/* ── Destacados ──────────────────────────────────────────────────── */}
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
                    isKeyless(p)
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {credLabel(p)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Más proveedores + Custom ─────────────────────────────────── */}
        <div>
          <p className="panel-eyebrow text-muted-foreground mb-3">Más proveedores</p>
          <div className="rounded-xl border border-border bg-card p-3 space-y-2">
            {/* Botón Custom OpenAI-compatible */}
            <button
              type="button"
              onClick={pickCustom}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left border ${
                isCustom
                  ? "border-brand bg-brand-soft"
                  : "border-dashed border-border hover:border-brand/30 hover:bg-accent"
              }`}
            >
              <span className="w-6 h-6 flex items-center justify-center text-sm shrink-0">⚙</span>
              <span className="flex-1 min-w-0">
                <span className="font-medium text-sm text-foreground block">Custom (OpenAI-compatible)</span>
                <span className="text-xs text-muted-foreground">Ollama remoto, LocalAI, LM Studio, servidor propio…</span>
              </span>
              {isCustom && <span className="text-brand text-xs shrink-0">✓</span>}
            </button>

            <input
              type="text"
              placeholder="Buscar proveedor…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-input bg-transparent text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />

            <div className="max-h-[28rem] overflow-y-auto space-y-0.5">
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
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      active ? "bg-brand-soft" : "hover:bg-accent"
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
        </div>

        {/* ── Panel: Custom ──────────────────────────────────────────────── */}
        {isCustom && (
          <div className="rounded-xl border border-border bg-card p-5 space-y-4 animate-fade-in-up">
            <div className="flex items-center gap-3">
              <span className="text-lg">⚙</span>
              <div>
                <p className="font-semibold text-foreground text-sm">Provider personalizado</p>
                <p className="text-xs text-muted-foreground">OpenAI-compatible — cualquier servidor local o remoto</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">URL base del endpoint</label>
                <input
                  type="text"
                  placeholder="http://localhost:11434/v1"
                  value={customBaseUrl}
                  onChange={(e) => setCustomBaseUrl(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-input bg-transparent text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Ollama local: <code className="font-mono">http://localhost:11434/v1</code> · LM Studio: <code className="font-mono">http://localhost:1234/v1</code>
                </p>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">ID del modelo</label>
                <input
                  type="text"
                  placeholder="gemma3:12b"
                  value={customModelId}
                  onChange={(e) => setCustomModelId(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-input bg-transparent text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Variable de API key (opcional)</label>
                <input
                  type="text"
                  placeholder="CUSTOM_API_KEY"
                  value={customEnvKey}
                  onChange={(e) => setCustomEnvKey(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-input bg-transparent text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Deja vacío si el servidor no requiere autenticación (Ollama local).
                </p>
              </div>
            </div>
            {!customBaseUrl.trim() && (
              <p className="text-xs text-amber-600 font-medium">Introduce la URL base para continuar.</p>
            )}
          </div>
        )}

        {/* ── Panel: Provider del catálogo seleccionado ─────────────────── */}
        {selected && (
          <div className="rounded-xl border border-border bg-card p-5 space-y-4 animate-fade-in-up">
            <div className="flex items-center gap-3">
              <ProviderIcon id={selected.id} label={selected.label} size={32} />
              <div>
                <p className="font-semibold text-foreground">{selected.label}</p>
                <p className="text-xs text-muted-foreground">{credLabel(selected)}</p>
              </div>
            </div>

            {/* Modelo del catálogo */}
            {models.length > 0 ? (
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-2">Modelo</label>
                <div className="grid gap-2 max-h-60 overflow-y-auto pr-1">
                  {models.map((m) => {
                    const active = selectedModelId === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedModelId(m.id)}
                        className={`flex items-start justify-between gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                          active
                            ? "border-brand bg-brand-soft"
                            : "border-border hover:border-brand/30 hover:bg-accent"
                        }`}
                      >
                        <span className="flex-1 min-w-0">
                          <span className="font-medium text-sm text-foreground block">{m.name}</span>
                          <span className="text-xs text-muted-foreground font-mono">{m.id}</span>
                        </span>
                        <span className="shrink-0 flex flex-col items-end gap-1">
                          {m.reasoning && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-medium">
                              reasoning
                            </span>
                          )}
                          {m.contextWindow && (
                            <span className="text-xs text-muted-foreground">
                              {ctxLabel(m.contextWindow)} ctx
                            </span>
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
                  className="w-full h-9 px-3 rounded-lg border border-input bg-transparent text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Este proveedor resuelve los modelos disponibles al conectar.
                </p>
              </div>
            )}

            {/* ENV informativas */}
            {!isKeyless(selected) && selected.envVars.length > 0 && (
              <div className="flex flex-wrap gap-2 items-center pt-1 border-t border-border">
                <span className="text-xs text-muted-foreground">Se pedirán al instalar:</span>
                {selected.envVars.map((v) => (
                  <span key={v} className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-xs font-mono">
                    {v}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {!selectedId && (
          <p className="text-sm text-muted-foreground text-center py-2">
            Selecciona un proveedor para continuar →
          </p>
        )}
      </div>
    </PhaseLayout>
  );
}
