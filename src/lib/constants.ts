/* Site-wide constants */

export const SITE_NAME = "SecaHub";
export const SITE_DESCRIPTION =
  "A tua comunidade de casino streaming e entretenimento";
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
