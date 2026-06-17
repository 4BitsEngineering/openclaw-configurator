"use client";

import {
  SiGoogle, SiBrave, SiElevenlabs, SiN8N, SiNotion, SiDeepgram, SiPerplexity, SiZapier,
} from "react-icons/si";
import { Globe, Search, Cloud } from "lucide-react";
import type { IconType } from "react-icons";

type Brand = { Icon: IconType; color: string };

const ICONS: Record<string, Brand> = {
  googleworkspace: { Icon: SiGoogle, color: "#4285F4" },
  elevenlabs:      { Icon: SiElevenlabs, color: "#0E0F14" },
  brave:           { Icon: SiBrave, color: "#FB542B" },
  n8n:             { Icon: SiN8N, color: "#EA4B71" },
  // Próximamente
  notion:          { Icon: SiNotion, color: "#0E0F14" },
  deepgram:        { Icon: SiDeepgram, color: "#13EF93" },
  perplexity:      { Icon: SiPerplexity, color: "#20808D" },
  zapier:          { Icon: SiZapier, color: "#FF4F00" },
  firecrawl:       { Icon: Globe, color: "#E8590C" },
  exa:             { Icon: Search, color: "#1F6FEB" },
};

const FALLBACK: Brand = { Icon: Cloud, color: "#9CA3AF" };

export function IntegrationIcon({ id, size = 24, muted = false }: { id: string; size?: number; muted?: boolean }) {
  const b = ICONS[id] ?? FALLBACK;
  const Icon = b.Icon;
  return <Icon size={size} color={muted ? "#9CA3AF" : b.color} aria-hidden />;
}
