// ──────────────────────────────────────────────────────────────────────────────
// Capa de presentación de los canales de OpenClaw.
//
// channels-catalog.json (generado por sync:channels) = verdad técnica de OpenClaw
// (id + envVars). Aquí añadimos lo curado: etiqueta, descripción, si lo SOPORTAMOS
// hoy, y cómo se autentica. El resto se muestra como "Próximamente".
//
// SUPPORTED es la decisión de producto: solo estos 3 están rodados en ai-office
// (WhatsApp por QR, Telegram y Slack por token). Los demás quedan en gris.
// ──────────────────────────────────────────────────────────────────────────────

import channelsCatalog from "./channels-catalog.json";

export type AuthStyle = "qr" | "token" | "config";

export interface ChannelMeta {
  id: string;
  label: string;
  blurb: string;
  authStyle: AuthStyle;
  authNote: string; // qué pedirá el instalador en destino
  envVars: string[]; // de channels-catalog.json (OpenClaw)
  supported: boolean;
}

// Canales soportados HOY en ai-office.
export const SUPPORTED_CHANNELS = ["whatsapp", "telegram", "slack"] as const;

// Curado por canal (label legible + blurb + estilo de auth). Si un canal del
// catálogo no aparece aquí, se deriva un default razonable.
const CURATED: Record<string, Omit<ChannelMeta, "id" | "envVars" | "supported">> = {
  whatsapp:        { label: "WhatsApp",       blurb: "El canal más usado. Se vincula escaneando un QR.",          authStyle: "qr",     authNote: "Se empareja por QR durante la instalación (sin token)." },
  telegram:        { label: "Telegram",       blurb: "Bot de Telegram vía @BotFather.",                            authStyle: "token",  authNote: "El instalador pedirá el token del bot (TELEGRAM_BOT_TOKEN)." },
  slack:           { label: "Slack",          blurb: "App de Slack en Socket Mode para tu workspace.",             authStyle: "token",  authNote: "El instalador pedirá los tokens de la app de Slack." },
  discord:         { label: "Discord",        blurb: "Bot de Discord para servidores.",                            authStyle: "token",  authNote: "Requiere DISCORD_BOT_TOKEN." },
  signal:          { label: "Signal",         blurb: "Mensajería cifrada Signal.",                                 authStyle: "config", authNote: "Vinculación de dispositivo en destino." },
  matrix:          { label: "Matrix",         blurb: "Protocolo abierto y federado (Element).",                    authStyle: "config", authNote: "Homeserver + token de acceso." },
  msteams:         { label: "Microsoft Teams",blurb: "Bot para Microsoft Teams.",                                  authStyle: "token",  authNote: "App ID, password y tenant de Azure." },
  googlechat:      { label: "Google Chat",    blurb: "Bot de Google Chat (Workspace).",                            authStyle: "config", authNote: "Service account de Google." },
  line:            { label: "LINE",           blurb: "Mensajería LINE (Asia).",                                    authStyle: "token",  authNote: "Channel access token + secret." },
  sms:             { label: "SMS (Twilio)",   blurb: "SMS a través de Twilio.",                                    authStyle: "token",  authNote: "Credenciales de Twilio." },
  imessage:        { label: "iMessage",       blurb: "iMessage (requiere macOS).",                                 authStyle: "config", authNote: "Configuración local en un Mac." },
  mattermost:      { label: "Mattermost",     blurb: "Chat de equipo self-hosted.",                                authStyle: "token",  authNote: "Bot token + URL del servidor." },
  "nextcloud-talk":{ label: "Nextcloud Talk", blurb: "Chat de Nextcloud.",                                         authStyle: "token",  authNote: "Bot secret + password de la API." },
  "synology-chat": { label: "Synology Chat",  blurb: "Chat de Synology NAS.",                                      authStyle: "token",  authNote: "Token + URL del NAS." },
  irc:             { label: "IRC",            blurb: "Redes IRC clásicas.",                                        authStyle: "config", authNote: "Host, nick y canales." },
  twitch:          { label: "Twitch",         blurb: "Chat de canales de Twitch.",                                 authStyle: "token",  authNote: "Access token de Twitch." },
  nostr:           { label: "Nostr",          blurb: "Red social descentralizada Nostr.",                          authStyle: "config", authNote: "Clave privada Nostr." },
  feishu:          { label: "Feishu / Lark",  blurb: "Suite de colaboración de ByteDance.",                        authStyle: "config", authNote: "App ID, secret y tokens de Feishu." },
  qqbot:           { label: "QQ Bot",         blurb: "Bot oficial de QQ (Tencent).",                               authStyle: "token",  authNote: "App ID + client secret." },
  zalo:            { label: "Zalo",           blurb: "Mensajería Zalo (Vietnam).",                                 authStyle: "token",  authNote: "Bot token + webhook secret." },
  zalouser:        { label: "Zalo (usuario)", blurb: "Cuenta personal de Zalo.",                                   authStyle: "config", authNote: "Perfil de sesión Zalo." },
  tlon:            { label: "Tlon / Urbit",   blurb: "Mensajería sobre Urbit.",                                    authStyle: "config", authNote: "Configuración de nave Urbit." },
};

function titleCase(id: string) {
  return id.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Lista completa de canales: catálogo OpenClaw + capa curada + flag de soporte.
// Orden: soportados primero (en el orden de SUPPORTED_CHANNELS), resto alfabético.
export const ALL_CHANNELS: ChannelMeta[] = (() => {
  const supported = new Set<string>(SUPPORTED_CHANNELS);
  const merged: ChannelMeta[] = channelsCatalog.channels.map((c) => {
    const cur = CURATED[c.id];
    return {
      id: c.id,
      label: cur?.label ?? titleCase(c.id),
      blurb: cur?.blurb ?? "Canal de OpenClaw.",
      authStyle: cur?.authStyle ?? "config",
      authNote: cur?.authNote ?? "Configuración en destino.",
      envVars: c.envVars,
      supported: supported.has(c.id),
    };
  });
  const orderOf = (id: string) => {
    const i = (SUPPORTED_CHANNELS as readonly string[]).indexOf(id);
    return i === -1 ? 999 : i;
  };
  return merged.sort((a, b) => {
    if (a.supported !== b.supported) return a.supported ? -1 : 1;
    if (a.supported && b.supported) return orderOf(a.id) - orderOf(b.id);
    return a.label.localeCompare(b.label);
  });
})();

export const SUPPORTED_LIST = ALL_CHANNELS.filter((c) => c.supported);
export const UPCOMING_LIST = ALL_CHANNELS.filter((c) => !c.supported);
