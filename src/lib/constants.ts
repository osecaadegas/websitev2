/* Site-wide constants */

export const SITE_NAME = "Arena Gladiator";
export const SITE_DESCRIPTION =
  "Enter the Arena — the ultimate iGaming casino streamer experience. Live streams, bonus hunts, slot battles, and gladiator rankings.";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://website-iota-two-90.vercel.app";
export const TWITCH_CHANNEL = process.env.NEXT_PUBLIC_TWITCH_CHANNEL || "secaadegas";

export const NAV_LINKS = [
  { href: "/sobre", label: "Sobre" },
  { href: "/ofertas", label: "Ofertas" },
  { href: "/destaques", label: "Destaques" },
  { href: "/stream", label: "Stream" },
  { href: "/liga-dos-secas", label: "Liga dos Secas" },
  { href: "/loja", label: "Loja" },
] as const;
