/**
 * Bounty flavor system — random "Wanted" descriptions for Mercado Negro.
 * Pick is deterministic per contract id so the description doesn't flicker
 * between renders.
 */

export const BOUNTY_FLAVORS: readonly string[] = [
  "Visto pela última vez a atacar um carro forte na zona industrial.",
  "Conhecido por emboscadas brutais. Aproxima-te com cuidado.",
  "Um fora-da-lei escorregadio que escapa sempre à última.",
  "Tem um histórico de traições. Não confies se te oferecer um aperto de mão.",
  "Já mandou três assassinos para o hospital este mês.",
  "Anda armado até aos dentes. Não te deixes enganar pelo sorriso.",
  "Roubou o cofre dos chefes e ainda anda à solta. Vingança garantida.",
  "Vinga cada balde de sangue com dois. Profissional perigoso.",
  "Tem informadores em cada esquina. Difícil de apanhar de surpresa.",
  "Procurado por crimes em três cidades. A polícia desistiu.",
  "Diz-se que tem uma jaula cheia de cabeças. Lenda urbana, mas...",
  "Trafica armas por baixo da mesa do próprio chefe. Avarento e perigoso.",
  "Operava no submundo do casino. Conhece todos os truques.",
  "Já matou um hitman com a própria arma do hitman.",
  "Tem ligações à máfia. Mexer com ele traz consequências.",
  "Vive escondido nos subúrbios. Apanhá-lo será um desafio.",
  "Anda sempre acompanhado por dois pit bulls e uma shotgun.",
  "Disse uma vez: \"sou demasiado rápido para uma bala\".",
  "Reza-se que paga aos polícias para olharem para o lado.",
  "Tem cicatrizes que contam histórias. Nenhuma boa.",
  "Roubou o carro do chefe, fugiu com a namorada e ainda riu na cara dele.",
  "Quem o encontrar primeiro, fica com o ouro. E com a vingança.",
  "Os seus inimigos desaparecem. Os amigos também.",
  "Não fala muito. Mas a sua arma tem muito a dizer.",
] as const;

/** Cheap deterministic hash from a string. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/** Pick a deterministic flavor line for a given contract id (or any seed). */
export function pickBountyFlavor(seed: string): string {
  return BOUNTY_FLAVORS[hash(seed) % BOUNTY_FLAVORS.length];
}

/** Risk tier from level diff (target - me). */
export type RiskTier = "facil" | "justo" | "perigoso" | "letal";

export function riskTier(myLevel: number, targetLevel: number): RiskTier {
  const diff = targetLevel - myLevel;
  if (diff <= -5) return "facil";
  if (diff <= 2) return "justo";
  if (diff <= 8) return "perigoso";
  return "letal";
}

export const RISK_META: Record<RiskTier, {
  label: string;
  short: string;
  color: string;
  glow: string;
  icon: string;
}> = {
  facil:     { label: "ALVO FÁCIL",   short: "FÁCIL",   color: "#22c55e", glow: "rgba(34,197,94,0.35)",  icon: "🎯" },
  justo:     { label: "DESAFIO JUSTO",short: "JUSTO",   color: "#fbbf24", glow: "rgba(251,191,36,0.30)", icon: "🔫" },
  perigoso:  { label: "PERIGOSO",     short: "PERIGO",  color: "#f97316", glow: "rgba(249,115,22,0.40)", icon: "💀" },
  letal:     { label: "LETAL",        short: "LETAL",   color: "#ef4444", glow: "rgba(239,68,68,0.55)",  icon: "☠️" },
};

/** Reward tier for visual treatment. */
export type RewardTier = "standard" | "alto" | "elite" | "lendario";

export function rewardTier(reward: number): RewardTier {
  if (reward >= 500_000) return "lendario";
  if (reward >= 200_000) return "elite";
  if (reward >= 50_000)  return "alto";
  return "standard";
}

export const REWARD_META: Record<RewardTier, {
  label: string;
  color: string;
  gradient: string;
  border: string;
}> = {
  standard: {
    label: "STANDARD",
    color: "#a8896b",
    gradient: "linear-gradient(135deg,#3a2a18 0%,#5a4226 50%,#3a2a18 100%)",
    border: "rgba(168,137,107,0.30)",
  },
  alto: {
    label: "ALTO VALOR",
    color: "#fbbf24",
    gradient: "linear-gradient(135deg,#5c3a0a 0%,#a06a1a 35%,#fbbf24 50%,#a06a1a 65%,#5c3a0a 100%)",
    border: "rgba(251,191,36,0.45)",
  },
  elite: {
    label: "ELITE",
    color: "#fb923c",
    gradient: "linear-gradient(135deg,#7c2d12 0%,#c2410c 35%,#fb923c 50%,#c2410c 65%,#7c2d12 100%)",
    border: "rgba(251,146,60,0.55)",
  },
  lendario: {
    label: "DEAD OR ALIVE",
    color: "#ef4444",
    gradient: "linear-gradient(135deg,#450a0a 0%,#991b1b 30%,#ef4444 50%,#991b1b 70%,#450a0a 100%)",
    border: "rgba(239,68,68,0.70)",
  },
};

/** Initials for avatar fallback. */
export function avatarInitials(name: string): string {
  const parts = name.replace(/[^a-zA-Z0-9 ]/g, " ").trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Deterministic sepia hue per username for avatar background. */
export function avatarHue(seed: string): number {
  return hash(seed) % 60; // 0–60 = warm sepia/orange band
}
