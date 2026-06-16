"use client";

import {
  Anthropic, Claude,
  OpenAI,
  Google,
  Minimax,
  Groq,
  Mistral,
  DeepSeek,
  Ollama,
  Fireworks,
  Cerebras,
  Grok,
  Qwen,
  Moonshot,
  Novita,
  Nvidia,
  Meta,
  GithubCopilot,
  Copilot,
  DeepInfra,
  Cohere,
  Together,
  Perplexity,
  HuggingFace,
  Replicate,
  Azure,
  Bedrock,
  Cloudflare,
  SambaNova,
  Featherless,
  Gemini,
  ComfyUI,
  Fal,
  LmStudio,
  OpenRouter,
  Stepfun,
  TencentCloud,
  Vllm,
  OpenCode,
  Alibaba,
  ByteDance,
  Venice,
  Volcengine,
  Microsoft,
  Vercel,
  XiaomiMiMo,
  Arcee,
  ZAI,
  KiloCode,
  VertexAI,
  Wenxin,
  LlmApi,
  Kimi,
} from "@lobehub/icons";
import { Shield, Cloud, Server, Cpu, Zap } from "lucide-react";

// Ink oscuro — mismo valor que --ink de ai-office
const INK = "#0E0F14";

type IconProps = { size?: number };

function GenericIcon({ label, size = 28 }: { label: string; size?: number }) {
  const s = Math.round(size * 0.55);
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <rect width="28" height="28" rx="6" fill={INK} fillOpacity="0.08" />
      <text
        x="14" y="14"
        dominantBaseline="central"
        textAnchor="middle"
        fontSize={s}
        fontWeight="700"
        fill={INK}
        opacity="0.5"
        fontFamily="system-ui, sans-serif"
      >
        {label.slice(0, 2).toUpperCase()}
      </text>
    </svg>
  );
}

// Todos los iconos directo sobre fondo claro.
// Mono = color ink. Con .Color = color de marca.
const ICON_MAP: Record<string, (p: IconProps) => React.ReactElement> = {
  "openai":            ({ size = 28 }) => <OpenAI size={size} style={{ color: INK }} />,
  "anthropic":         ({ size = 28 }) => <Anthropic size={size} style={{ color: INK }} />,
  "google":            ({ size = 28 }) => <Google.Color size={size} />,
  "minimax":           ({ size = 28 }) => <Minimax.Color size={size} />,
  "groq":              ({ size = 28 }) => <Groq size={size} style={{ color: INK }} />,
  "mistral":           ({ size = 28 }) => <Mistral.Color size={size} />,
  "deepseek":          ({ size = 28 }) => <DeepSeek.Color size={size} />,
  "ollama":            ({ size = 28 }) => <Ollama size={size} style={{ color: INK }} />,
  "ollama-cloud":      ({ size = 28 }) => <Ollama size={size} style={{ color: INK }} />,
  "fireworks":         ({ size = 28 }) => <Fireworks.Color size={size} />,
  "cerebras":          ({ size = 28 }) => <Cerebras.Color size={size} />,
  "xai":               ({ size = 28 }) => <Grok size={size} style={{ color: INK }} />,
  "grok":              ({ size = 28 }) => <Grok size={size} style={{ color: INK }} />,
  "qwen":              ({ size = 28 }) => <Qwen.Color size={size} />,
  "moonshot":          ({ size = 28 }) => <Moonshot size={size} style={{ color: INK }} />,
  "kimi":              ({ size = 28 }) => <Moonshot size={size} style={{ color: INK }} />,
  "novita":            ({ size = 28 }) => <Novita.Color size={size} />,
  "nvidia":            ({ size = 28 }) => <Nvidia.Color size={size} />,
  "meta":              ({ size = 28 }) => <Meta.Color size={size} />,
  "github-copilot":    ({ size = 28 }) => <GithubCopilot size={size} style={{ color: INK }} />,
  "copilot-proxy":     ({ size = 28 }) => <Copilot.Color size={size} />,
  "deepinfra":         ({ size = 28 }) => <DeepInfra.Color size={size} />,
  "cohere":            ({ size = 28 }) => <Cohere.Color size={size} />,
  "together":          ({ size = 28 }) => <Together.Color size={size} />,
  "perplexity":        ({ size = 28 }) => <Perplexity.Color size={size} />,
  "huggingface":       ({ size = 28 }) => <HuggingFace.Color size={size} />,
  "replicate":         ({ size = 28 }) => <Replicate size={size} style={{ color: INK }} />,
  "azure":             ({ size = 28 }) => <Azure.Color size={size} />,
  "bedrock":           ({ size = 28 }) => <Bedrock.Color size={size} />,
  "cloudflare":        ({ size = 28 }) => <Cloudflare.Color size={size} />,
  "sambanova":         ({ size = 28 }) => <SambaNova.Color size={size} />,
  "featherless":       ({ size = 28 }) => <Featherless.Color size={size} />,
  "gemini":            ({ size = 28 }) => <Gemini.Color size={size} />,
  "google-gemini-cli": ({ size = 28 }) => <Gemini.Color size={size} />,
  "claude-cli":        ({ size = 28 }) => <Claude.Color size={size} />,
  "minimax-portal":    ({ size = 28 }) => <Minimax.Color size={size} />,
  "comfy":             ({ size = 28 }) => <ComfyUI.Color size={size} />,
  "fal":               ({ size = 28 }) => <Fal.Color size={size} />,
  "lmstudio":          ({ size = 28 }) => <LmStudio size={size} style={{ color: INK }} />,
  "opencode":          ({ size = 28 }) => <OpenCode size={size} style={{ color: INK }} />,
  "opencode-go":       ({ size = 28 }) => <OpenCode size={size} style={{ color: INK }} />,
  "openrouter":        ({ size = 28 }) => <OpenRouter size={size} style={{ color: INK }} />,
  "stepfun":           ({ size = 28 }) => <Stepfun.Color size={size} />,
  "stepfun-plan":      ({ size = 28 }) => <Stepfun.Color size={size} />,
  "tencent-tokenhub":  ({ size = 28 }) => <TencentCloud.Color size={size} />,
  "vllm":              ({ size = 28 }) => <Vllm.Color size={size} />,
  // Recuperados en batida adicional
  "alibaba":           ({ size = 28 }) => <Alibaba.Color size={size} />,
  "byteplus":          ({ size = 28 }) => <ByteDance.Color size={size} />,
  "byteplus-plan":     ({ size = 28 }) => <ByteDance.Color size={size} />,
  "venice":            ({ size = 28 }) => <Venice.Color size={size} />,
  "volcengine":        ({ size = 28 }) => <Volcengine.Color size={size} />,
  "volcengine-plan":   ({ size = 28 }) => <Volcengine.Color size={size} />,
  "microsoft-foundry": ({ size = 28 }) => <Microsoft.Color size={size} />,
  "vercel-ai-gateway": ({ size = 28 }) => <Vercel size={size} style={{ color: INK }} />,
  "xiaomi":            ({ size = 28 }) => <XiaomiMiMo size={size} style={{ color: INK }} />,
  "xiaomi-token-plan": ({ size = 28 }) => <XiaomiMiMo size={size} style={{ color: INK }} />,
  "arcee":             ({ size = 28 }) => <Arcee.Color size={size} />,
  "zai":               ({ size = 28 }) => <ZAI size={size} style={{ color: INK }} />,
  "kilocode":          ({ size = 28 }) => <KiloCode size={size} style={{ color: INK }} />,
  "google-vertex":     ({ size = 28 }) => <VertexAI.Color size={size} />,
  // Encontrados en batida adicional
  "qianfan":           ({ size = 28 }) => <Wenxin.Color size={size} />,
  "qwen-oauth":        ({ size = 28 }) => <Qwen.Color size={size} />,
  "litellm":           ({ size = 28 }) => <LlmApi.Color size={size} />,
  // Sin logo oficial → icono semántico de Lucide (mismo sistema que ai-office)
  "brave":             ({ size = 28 }) => <Shield size={size} style={{ color: "#FB542B" }} />,
  "chutes":            ({ size = 28 }) => <Cloud size={size} style={{ color: "#6366F1" }} />,
  "gmi":               ({ size = 28 }) => <Server size={size} style={{ color: "#10B981" }} />,
  "sglang":            ({ size = 28 }) => <Cpu size={size} style={{ color: "#8B5CF6" }} />,
  "synthetic":         ({ size = 28 }) => <Zap size={size} style={{ color: "#F59E0B" }} />,
};

export function ProviderIcon({
  id,
  label,
  size = 28,
}: {
  id: string;
  label: string;
  size?: number;
}) {
  const factory = ICON_MAP[id.toLowerCase()];
  if (factory) return factory({ size });
  return <GenericIcon label={label} size={size} />;
}
