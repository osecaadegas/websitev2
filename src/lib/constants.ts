/* Site-wide constants */

export const SITE_NAME = "Secahub";
export const SITE_DESCRIPTION =
  "Slots Drinks and Wins";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://websitev2-zeta-nine.vercel.app";
export const TWITCH_CHANNEL = process.env.NEXT_PUBLIC_TWITCH_CHANNEL || "secaadegas";

export const NAV_LINKS = [
  { href: "/sobre", label: "Sobre" },
  { href: "/ofertas", label: "Ofertas" },
  { href: "/destaques", label: "Destaques" },
  { href: "/stream", label: "Stream" },
  { href: "/liga-dos-secas", label: "Liga dos Secas" },
  { href: "/loja", label: "Loja" },
] as const;
