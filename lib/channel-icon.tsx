"use client";

import {
  SiTelegram, SiWhatsapp, SiSlack, SiDiscord, SiSignal, SiMatrix,
  SiGooglechat, SiLine, SiTwitch, SiZalo, SiMattermost, SiNextcloud,
  SiTwilio, SiSynology, SiImessage, SiQq, SiApple,
} from "react-icons/si";
import { MessageSquare, Hash, KeyRound, Cloud } from "lucide-react";
import type { IconType } from "react-icons";

// Color de marca por canal — se usa SOLO cuando el canal está soportado/activo;
// los "próximamente" se pintan en gris para no llamar la atención.
type Brand = { Icon: IconType | typeof MessageSquare; color: string };

const CHANNEL_ICONS: Record<string, Brand> = {
  telegram:        { Icon: SiTelegram, color: "#26A5E4" },
  whatsapp:        { Icon: SiWhatsapp, color: "#25D366" },
  slack:           { Icon: SiSlack, color: "#4A154B" },
  discord:         { Icon: SiDiscord, color: "#5865F2" },
  signal:          { Icon: SiSignal, color: "#3A76F0" },
  matrix:          { Icon: SiMatrix, color: "#0DBD8B" },
  googlechat:      { Icon: SiGooglechat, color: "#34A853" },
  line:            { Icon: SiLine, color: "#00C300" },
  twitch:          { Icon: SiTwitch, color: "#9146FF" },
  zalo:            { Icon: SiZalo, color: "#0068FF" },
  zalouser:        { Icon: SiZalo, color: "#0068FF" },
  mattermost:      { Icon: SiMattermost, color: "#0058CC" },
  "nextcloud-talk":{ Icon: SiNextcloud, color: "#0082C9" },
  "synology-chat": { Icon: SiSynology, color: "#B5B5B6" },
  sms:             { Icon: SiTwilio, color: "#F22F46" },
  imessage:        { Icon: SiImessage, color: "#34DA50" },
  qqbot:           { Icon: SiQq, color: "#1296DB" },
  msteams:         { Icon: MessageSquare, color: "#6264A7" },
  tlon:            { Icon: SiApple, color: "#000000" }, // placeholder neutro
  // Sin logo de marca en el set → icono semántico de Lucide
  feishu:          { Icon: MessageSquare, color: "#00D6B9" },
  nostr:           { Icon: KeyRound, color: "#8E30EB" },
  irc:             { Icon: Hash, color: "#5B5B5B" },
};

const FALLBACK: Brand = { Icon: Cloud, color: "#9CA3AF" };

export function ChannelIcon({
  id,
  size = 26,
  muted = false,
}: {
  id: string;
  size?: number;
  muted?: boolean;
}) {
  const b = CHANNEL_ICONS[id] ?? FALLBACK;
  const Icon = b.Icon;
  return <Icon size={size} color={muted ? "#9CA3AF" : b.color} aria-hidden />;
}
