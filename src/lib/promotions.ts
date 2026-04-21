/* Portuguese Online Casino Promotions Data
   Licensed brands regulated by SRIJ (Serviço de Regulação e Inspeção de Jogos)
   This data can be replaced with API calls to affiliate platforms or CMS */

export interface CasinoPromotion {
  id: string;
  casino: string;
  logo: string;
  title: string;
  description: string;
  bonusValue: string;
  type: "welcome" | "freespins" | "cashback" | "reload" | "tournament" | "vip";
  badge?: string;
  terms: string;
  url: string;
  rating: number;
  featured: boolean;
  expiresAt: string | null;
  updatedAt: string;
}

export interface CasinoBrand {
  name: string;
  slug: string;
  logo: string;
  color: string;
  srij: boolean;
}

export const PORTUGUESE_CASINOS: CasinoBrand[] = [
  { name: "Betclic", slug: "betclic", logo: "🟢", color: "#e30613", srij: true },
  { name: "Betano", slug: "betano", logo: "🔵", color: "#0d2e5c", srij: true },
  { name: "Casino Portugal", slug: "casino-portugal", logo: "🟡", color: "#c8102e", srij: true },
  { name: "Solverde", slug: "solverde", logo: "🟠", color: "#00a651", srij: true },
  { name: "ESC Online", slug: "esc-online", logo: "🔴", color: "#e4002b", srij: true },
  { name: "Placard", slug: "placard", logo: "🟤", color: "#005ea6", srij: true },
  { name: "Luckia", slug: "luckia", logo: "🟣", color: "#1d1d1b", srij: true },
  { name: "Nossa Aposta", slug: "nossa-aposta", logo: "⚪", color: "#ff6600", srij: true },
  { name: "PokerStars Casino", slug: "pokerstars", logo: "♠️", color: "#c00", srij: true },
  { name: "888 Casino", slug: "888casino", logo: "🎰", color: "#1a1a6c", srij: true },
];

function generatePromotionId(casino: string, index: number): string {
  return `${casino}-${index}-${Date.now()}`;
}

function getRotatingPromotions(): CasinoPromotion[] {
  const now = new Date();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
  );
  const hour = now.getHours();

  /* Promotion templates that rotate based on date/time to simulate dynamic updates */
  const allPromotions: Omit<CasinoPromotion, "id" | "updatedAt">[] = [
    {
      casino: "Betclic",
      logo: "🟢",
      title: "Bónus de Boas-Vindas",
      description: "Regista-te e recebe um bónus de 100% até 200€ no teu primeiro depósito. Aposta desportiva ou casino.",
      bonusValue: "200€",
      type: "welcome",
      badge: "Popular",
      terms: "Rollover 10x. Depósito mínimo 10€. Apenas novos utilizadores.",
      url: "#",
      rating: 4.7,
      featured: true,
      expiresAt: null,
    },
    {
      casino: "Betano",
      logo: "🔵",
      title: "Freebets até 200€",
      description: "Bónus de registo com Freebet até 200€. Válido para apostas desportivas e casino ao vivo.",
      bonusValue: "200€",
      type: "welcome",
      badge: "Exclusivo",
      terms: "Rollover 6x. Depósito mínimo 10€. Odds mínimas 1.50.",
      url: "#",
      rating: 4.8,
      featured: true,
      expiresAt: null,
    },
    {
      casino: "Casino Portugal",
      logo: "🟡",
      title: "Pack de Boas-Vindas Casino",
      description: "Até 1000€ em bónus + 200 rodadas grátis nos primeiros 3 depósitos. A melhor oferta portuguesa.",
      bonusValue: "1000€ + 200 FS",
      type: "welcome",
      badge: "Melhor Oferta",
      terms: "Rollover 35x. Depósito mínimo 20€. Dividido em 3 depósitos.",
      url: "#",
      rating: 4.5,
      featured: true,
      expiresAt: null,
    },
    {
      casino: "Solverde",
      logo: "🟠",
      title: "50 Rodadas Grátis sem Depósito",
      description: "Experimenta o casino Solverde com 50 free spins sem necessidade de depósito. Marca portuguesa de confiança.",
      bonusValue: "50 Free Spins",
      type: "freespins",
      badge: "Sem Depósito",
      terms: "Wager 30x. Ganhos máximos 50€. Slots selecionadas.",
      url: "#",
      rating: 4.3,
      featured: false,
      expiresAt: null,
    },
    {
      casino: "ESC Online",
      logo: "🔴",
      title: "Cashback Semanal 10%",
      description: "Recebe 10% de cashback sobre as tuas perdas semanais até 100€. Todos os jogos de casino.",
      bonusValue: "Até 100€",
      type: "cashback",
      terms: "Cashback creditado às segundas. Wager 1x. Mínimo 20€ em perdas.",
      url: "#",
      rating: 4.2,
      featured: false,
      expiresAt: null,
    },
    {
      casino: "Placard",
      logo: "🟤",
      title: "Bónus Casino 100%",
      description: "Duplica o teu depósito com 100% de bónus até 250€. O casino oficial da Santa Casa.",
      bonusValue: "250€",
      type: "welcome",
      terms: "Rollover 25x. Depósito mínimo 10€. Válido 30 dias.",
      url: "#",
      rating: 4.0,
      featured: false,
      expiresAt: null,
    },
    {
      casino: "Luckia",
      logo: "🟣",
      title: "Reload de Fim-de-Semana",
      description: "Bónus de 50% até 100€ em cada depósito de sexta a domingo. Todas as semanas.",
      bonusValue: "100€",
      type: "reload",
      terms: "Rollover 20x. Depósito mínimo 15€. Sexta a Domingo apenas.",
      url: "#",
      rating: 4.1,
      featured: false,
      expiresAt: null,
    },
    {
      casino: "Nossa Aposta",
      logo: "⚪",
      title: "Torneio Slots Mensal",
      description: "Prize pool de 5000€ todos os meses. Joga slots e acumula pontos no ranking.",
      bonusValue: "5000€ Prize Pool",
      type: "tournament",
      badge: "Torneio",
      terms: "Aposta mínima 0.50€ por spin. Top 50 premiados. Sem wager nos prémios.",
      url: "#",
      rating: 4.4,
      featured: true,
      expiresAt: null,
    },
    {
      casino: "PokerStars Casino",
      logo: "♠️",
      title: "Roda da Fortuna Diária",
      description: "Gira a roda todos os dias e ganha free spins, bónus ou cashback. Prémios até 500€.",
      bonusValue: "Até 500€",
      type: "vip",
      terms: "1 giro por dia. Depósito mínimo de 10€ nas últimas 24h.",
      url: "#",
      rating: 4.6,
      featured: false,
      expiresAt: null,
    },
    {
      casino: "888 Casino",
      logo: "🎰",
      title: "88€ Grátis sem Depósito",
      description: "Bónus exclusivo de 88€ sem depósito para novos jogadores. Experimenta o casino sem risco.",
      bonusValue: "88€ Grátis",
      type: "welcome",
      badge: "Sem Depósito",
      terms: "Wager 30x. Ganhos máximos 200€. Válido 14 dias.",
      url: "#",
      rating: 4.5,
      featured: true,
      expiresAt: null,
    },
    /* Rotating seasonal promotions */
    {
      casino: "Betclic",
      logo: "🟢",
      title: "Missões Diárias Casino",
      description: "Completa missões diárias e ganha prémios extra. Novas missões todos os dias às 00:00.",
      bonusValue: "Prémios Variados",
      type: "vip",
      terms: "Missões renovam diariamente. Aposta mínima aplicável.",
      url: "#",
      rating: 4.3,
      featured: false,
      expiresAt: null,
    },
    {
      casino: "Betano",
      logo: "🔵",
      title: "Drops & Wins - Slots Pragmatic",
      description: "Prize pool de 2.000.000€/mês nos torneios Drops & Wins. Prémios aleatórios a qualquer momento.",
      bonusValue: "2M€/mês",
      type: "tournament",
      badge: "Mega Torneio",
      terms: "Aposta mínima 0.50€. Slots Pragmatic Play elegíveis.",
      url: "#",
      rating: 4.7,
      featured: true,
      expiresAt: null,
    },
    {
      casino: "Casino Portugal",
      logo: "🟡",
      title: "Happy Hour - Rodadas Extra",
      description: "Das 18h às 22h ganha o dobro das rodadas grátis em depósitos. Todos os dias úteis.",
      bonusValue: "2x Free Spins",
      type: "freespins",
      terms: "Depósito mínimo 15€. Horário: 18:00-22:00. Dias úteis.",
      url: "#",
      rating: 4.2,
      featured: false,
      expiresAt: null,
    },
    {
      casino: "Solverde",
      logo: "🟠",
      title: "Programa VIP Gladiador",
      description: "Sobe de nível e desbloqueia cashback superior, bónus exclusivos e gestor de conta dedicado.",
      bonusValue: "Até 25% Cashback",
      type: "vip",
      badge: "VIP",
      terms: "Progressão automática. 5 níveis. Benefícios crescentes.",
      url: "#",
      rating: 4.6,
      featured: false,
      expiresAt: null,
    },
    {
      casino: "ESC Online",
      logo: "🔴",
      title: "Bónus Primeiro Depósito 150%",
      description: "150% de bónus até 300€ no teu primeiro depósito no casino ESC Online.",
      bonusValue: "300€",
      type: "welcome",
      terms: "Rollover 30x. Depósito mínimo 10€. Novos jogadores apenas.",
      url: "#",
      rating: 4.3,
      featured: false,
      expiresAt: null,
    },
  ];

  /* Rotate promotions based on day/hour to simulate constant updates */
  const rotationSeed = dayOfYear * 24 + hour;
  const shuffled = [...allPromotions].sort((a, b) => {
    const hashA = (a.casino.charCodeAt(0) * 31 + rotationSeed) % 100;
    const hashB = (b.casino.charCodeAt(0) * 31 + rotationSeed) % 100;
    return hashA - hashB;
  });

  const timestamp = now.toISOString();

  return shuffled.map((promo, i) => ({
    ...promo,
    id: generatePromotionId(promo.casino.toLowerCase().replace(/\s+/g, "-"), i),
    updatedAt: timestamp,
  }));
}

export function getPromotions(filter?: {
  type?: CasinoPromotion["type"];
  casino?: string;
  featuredOnly?: boolean;
}): { promotions: CasinoPromotion[]; lastUpdated: string } {
  let promos = getRotatingPromotions();

  if (filter?.type) {
    promos = promos.filter((p) => p.type === filter.type);
  }
  if (filter?.casino) {
    promos = promos.filter(
      (p) => p.casino.toLowerCase() === filter.casino!.toLowerCase()
    );
  }
  if (filter?.featuredOnly) {
    promos = promos.filter((p) => p.featured);
  }

  return {
    promotions: promos,
    lastUpdated: new Date().toISOString(),
  };
}
