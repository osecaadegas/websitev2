/**
 * street-defs.ts
 * Static definitions for the Street Selling System:
 *  - Zone profiles
 *  - Customer type ranges (used for random spawn within type)
 *  - Negotiation reaction logic
 *  - Dialogue templates per customer type + situation
 *  - Heat delta constants
 */

// ─────────────────────────────────────────────────────────────
// ZONES
// ─────────────────────────────────────────────────────────────

export interface ZoneDef {
  id: string;
  name: string;
  description: string;
  /** Base heat generated per deal */
  heatPerDeal: number;
  /** Multiplier on earned cash */
  rewardMult: number;
  /** Base arrest risk (0–1) added to base */
  riskMod: number;
  /** Customer types allowed here */
  allowedTypes: CustomerType[];
  /** Undercover frequency modifier (1 = default) */
  undercoverMod: number;
  unlockLevel: number;
  icon: string;
}

export const ZONES: ZoneDef[] = [
  {
    id: "bairro_antigo",
    name: "Bairro Antigo",
    description: "Zona residencial calma. Clientes conhecidos, riscos baixos, mas lucros modestos.",
    heatPerDeal: 3,
    rewardMult: 0.85,
    riskMod: -0.05,
    allowedTypes: ["regular", "junkie", "undercover"],
    undercoverMod: 0.6,
    unlockLevel: 1,
    icon: "🏘️",
  },
  {
    id: "mercado_negro",
    name: "Mercado Negro",
    description: "Centro comercial subterrâneo. Mistura de clientes. Risco/recompensa equilibrados.",
    heatPerDeal: 5,
    rewardMult: 1.0,
    riskMod: 0,
    allowedTypes: ["regular", "junkie", "dealer", "undercover"],
    undercoverMod: 1.0,
    unlockLevel: 1,
    icon: "🏪",
  },
  {
    id: "porto",
    name: "Porto",
    description: "Cais movimentado. Dealers e turistas, grandes transações, alto risco.",
    heatPerDeal: 8,
    rewardMult: 1.25,
    riskMod: 0.08,
    allowedTypes: ["regular", "tourist", "dealer", "undercover"],
    undercoverMod: 1.0,
    unlockLevel: 2,
    icon: "⚓",
  },
  {
    id: "aeroporto",
    name: "Aeroporto",
    description: "Terminal internacional. Turistas ricos e ingénuos. Lucro máximo mas alguma vigilância policial.",
    heatPerDeal: 12,
    rewardMult: 1.6,
    riskMod: 0.12,
    allowedTypes: ["tourist", "dealer", "undercover"],
    undercoverMod: 1.3,
    unlockLevel: 4,
    icon: "✈️",
  },
];

export function getZone(id: string): ZoneDef | undefined {
  return ZONES.find((z) => z.id === id);
}

// ─────────────────────────────────────────────────────────────
// CUSTOMER TYPES
// ─────────────────────────────────────────────────────────────

export type CustomerType = "regular" | "tourist" | "junkie" | "dealer" | "undercover";

export interface CustomerTypeMeta {
  label: string;
  icon: string;
  color: string;
  /** Description shown to the player */
  hint: string;
}

export const CUSTOMER_TYPE_META: Record<CustomerType, CustomerTypeMeta> = {
  regular: {
    label: "Regular",
    icon: "🧑",
    color: "text-gray-300",
    hint: "Cliente habitual. Budget moderado, negoceia de forma razoável.",
  },
  tourist: {
    label: "Turista",
    icon: "🌍",
    color: "text-yellow-300",
    hint: "Orçamento alto, ingénuo. Aceita preços inflacionados facilmente.",
  },
  junkie: {
    label: "Viciado",
    icon: "💉",
    color: "text-orange-400",
    hint: "Budget baixo mas desesperado. Quantidade alta, paciência mínima.",
  },
  dealer: {
    label: "Dealer",
    icon: "💼",
    color: "text-purple-400",
    hint: "Compra em quantidade. Experiência elevada — vai négociar agressivamente.",
  },
  undercover: {
    label: "???",
    icon: "🕵️",
    color: "text-red-400",
    hint: "Identidade desconhecida. Procede com cautela.",
  },
};

// ─────────────────────────────────────────────────────────────
// NEGOTIATION OUTCOMES
// ─────────────────────────────────────────────────────────────

export type NegotiationOutcome =
  | "accept"
  | "counter"
  | "reject"
  | "hostile"
  | "snitch";

export interface NegotiationResult {
  outcome: NegotiationOutcome;
  /** Counter-price proposed by customer (only for "counter") */
  counterPrice?: number;
  /** Counter-quantity proposed by customer (only for "counter") */
  counterQty?: number;
  /** Suspicion delta from this interaction (can be negative) */
  suspicionDelta: number;
  /** Heat added to session */
  heatDelta: number;
  /** Dirty cash earned (only for "accept") */
  earned?: number;
  /** Dialogue key for the customer reaction */
  dialogueKey: DialogueKey;
}

// ─────────────────────────────────────────────────────────────
// NEGOTIATION ENGINE
// ─────────────────────────────────────────────────────────────

export interface SpawnedCustomer {
  id: string;          // street_customers.id
  name: string;
  type: CustomerType;
  /** Randomised effective budget for THIS encounter */
  budget: number;
  patience: number;
  riskTolerance: number;
  snitchChance: number;
  preferredQty: number;
  /** How many offers they've received this encounter */
  offersReceived: number;
  /** Current suspicion level 0–100 */
  suspicion: number;
  // ── Client request (set at spawn time) ──────────────────────
  /** Drug name the client is requesting */
  requestedDrugName: string;
  /** Quantity client wants */
  requestedQty: number;
  /** Price per unit the client expects to pay (max) */
  requestedPriceExpectation: number;
  /** How flexible client is to alternative drugs/qty (0-1) */
  flexibility: number;
}

/**
 * Core negotiation resolution.
 * Called by the API with the current encounter state.
 */
export function resolveNegotiation(opts: {
  customer: SpawnedCustomer;
  pricePerUnit: number;    // player's offered price
  quantity: number;
  itemBasePrice: number;   // reference fair price
  action: "offer" | "push" | "discount" | "rush";
  zoneDef: ZoneDef;
  playerLevel: number;
}): NegotiationResult {
  const { customer, pricePerUnit, quantity, itemBasePrice, action, zoneDef } = opts;

  const fairness = pricePerUnit / itemBasePrice; // 1.0 = fair, >1 = overpriced
  let suspicionDelta = 0;
  let heatDelta = 0;

  // ── Action modifiers
  if (action === "push") {
    suspicionDelta += 12;
    heatDelta += 4;
  } else if (action === "discount") {
    suspicionDelta -= 8;
  } else if (action === "rush") {
    suspicionDelta += 6;
    // Reduces effective patience by 2 for this exchange
    customer.patience = Math.max(1, customer.patience - 2);
  }

  // ── Fairness suspicion
  if (fairness > 2.0) suspicionDelta += 20;
  else if (fairness > 1.5) suspicionDelta += 12;
  else if (fairness > 1.2) suspicionDelta += 5;
  else if (fairness < 0.9) suspicionDelta -= 5; // undercut
  else if (fairness <= 1.05) suspicionDelta -= 3; // near-fair

  // ── Offers received penalty (impatience grows)
  suspicionDelta += customer.offersReceived * 5;

  // ── Accumulate suspicion
  const newSuspicion = Math.min(100, Math.max(0, customer.suspicion + suspicionDelta));
  customer.suspicion = newSuspicion;

  // ── Snitch check (based on snitch_chance * suspicion factor)
  const snitchRoll = Math.random();
  const snitchThreshold = customer.snitchChance * (newSuspicion / 80);
  if (snitchRoll < snitchThreshold && newSuspicion >= 55) {
    return {
      outcome: "snitch",
      suspicionDelta,
      heatDelta: 20 + Math.floor(Math.random() * 15), // snitch = heat spike
      dialogueKey: "snitch",
    };
  }

  // ── Undercover: always snitch above suspicion 75
  if (customer.type === "undercover" && newSuspicion >= 75) {
    return {
      outcome: "snitch",
      suspicionDelta,
      heatDelta: 30,
      dialogueKey: "undercover_bust",
    };
  }

  // ── Patience exhausted → hostile / leave
  if (customer.offersReceived >= customer.patience) {
    heatDelta += 5;
    return {
      outcome: "hostile",
      suspicionDelta,
      heatDelta,
      dialogueKey: "out_of_patience",
    };
  }

  // ── Acceptance check
  // Customer accepts if: total cost ≤ budget AND price ≤ their expectation AND suspicion < threshold
  const totalCost = pricePerUnit * quantity;
  const acceptSuspicionCap = 30 + customer.riskTolerance * 5; // 35–80
  // Price expectation check — with flexibility as tolerance
  const priceOK = pricePerUnit <= customer.requestedPriceExpectation * (1 + customer.flexibility);

  if (totalCost <= customer.budget && priceOK && newSuspicion < acceptSuspicionCap) {
    const earned = totalCost * zoneDef.rewardMult;
    heatDelta += zoneDef.heatPerDeal;
    return {
      outcome: "accept",
      suspicionDelta,
      heatDelta,
      earned: Math.floor(earned),
      dialogueKey: fairness > 1.3 ? "accept_expensive" : "accept_fair",
    };
  }

  // ── Counter-offer
  if (totalCost > customer.budget && customer.offersReceived < customer.patience - 1) {
    // Customer proposes what they can afford
    const counterPrice = Math.floor(customer.budget / quantity * 0.85);
    const counterQty = quantity > customer.preferredQty
      ? customer.preferredQty
      : quantity;
    heatDelta += 1;
    return {
      outcome: "counter",
      counterPrice: Math.max(1, counterPrice),
      counterQty,
      suspicionDelta,
      heatDelta,
      dialogueKey: fairness > 1.5 ? "counter_expensive" : "counter_normal",
    };
  }

  // ── Reject
  heatDelta += 2;
  return {
    outcome: "reject",
    suspicionDelta,
    heatDelta,
    dialogueKey: newSuspicion >= 50 ? "reject_suspicious" : "reject_normal",
  };
}

// ─────────────────────────────────────────────────────────────
// DIALOGUE SYSTEM
// ─────────────────────────────────────────────────────────────

export type DialogueKey =
  | "greeting"
  | "accept_fair"
  | "accept_expensive"
  | "counter_normal"
  | "counter_expensive"
  | "reject_normal"
  | "reject_suspicious"
  | "out_of_patience"
  | "hostile"
  | "snitch"
  | "undercover_bust"
  | "session_heat_warning"
  | "session_busted";

type DialogueBank = Record<CustomerType, Partial<Record<DialogueKey, string[]>>>;

export const DIALOGUE_BANK: DialogueBank = {
  regular: {
    greeting: [
      "Preciso de {qty}g de {drug}. Não me faças esperar.",
      "Ouve, tenho pressa. Quero {qty}g de {drug}, quanto é?",
      "Tens {drug}? Precisava de umas {qty}g.",
      "Passa-me {qty} de {drug}. Quanto me sai?",
    ],
    accept_fair: [
      "Trato feito. Rápido e limpo.",
      "OK, aceito. Não me decepciones.",
      "Combinado. Não digas nada a ninguém.",
      "Tá bem. Amanhã aqui outra vez.",
    ],
    accept_expensive: [
      "Está caro, mas preciso. Vai.",
      "Estás a arrancar-me a pele, mas OK.",
      "Não gosto do preço mas desta vez aceito.",
    ],
    counter_normal: [
      "Consegues fazer por menos? Não tenho muito.",
      "Esse preço não vai dar. Baixa um bocado.",
      "Tens {qty}g mas por esse valor não consigo.",
    ],
    counter_expensive: [
      "Isso é dinheiro a mais. Faz-me um preço melhor.",
      "Só se fores louco. Oferece outro valor.",
      "Por {drug} a esse preço? Não estás bem da cabeça.",
    ],
    reject_normal: [
      "Não vai ser desta vez. Até logo.",
      "Não tens nada para mim hoje.",
      "Deixa. Encontro melhor noutro lado.",
    ],
    reject_suspicious: [
      "Espera... isto não cheira bem. Fico por aqui.",
      "Não sei, algo não está certo. Vou embora.",
      "Fica com o teu {drug}. Isto tá esquisito.",
    ],
    out_of_patience: [
      "Já perdi demasiado tempo aqui. Saio.",
      "Chega. Não estamos a chegar a lado nenhum.",
      "Tens de te decidir mais rápido do que isto.",
    ],
    snitch: [
      "Sabes o quê? Vou ligar para a polícia.",
    ],
  },

  tourist: {
    greeting: [
      "Hello! I'm looking for some {drug}... about {qty} grams? My friend said you're the guy.",
      "Bonsoir! Someone told me you have {drug}. I need like {qty}g, is that possible?",
      "Hey! I heard you can get me some {drug}? Just {qty}g, I'm on holiday!",
      "Excuse me... {qty} grams of {drug}? Is that something you can do?",
    ],
    accept_fair: [
      "Excellent! Very discreet, I like that.",
      "Perfect! This is so exciting, thank you!",
      "Wonderful! You're a lifesaver.",
    ],
    accept_expensive: [
      "A bit pricey but why not, I'm on holiday!",
      "You're expensive! But OK, I trust you.",
      "Fine, fine. I'll pay. Just be quick.",
    ],
    counter_normal: [
      "Hmm, can you do a little bit cheaper? I don't have much cash.",
      "That's a lot... maybe a small discount?",
      "I only wanted {qty}g of {drug}, not to buy your whole stash!",
    ],
    counter_expensive: [
      "Oh wow, that is way too much! I'm a tourist, not a millionaire!",
      "For {drug}? Seriously? I can buy a plane ticket for that.",
    ],
    reject_normal: [
      "Sorry, I think I'll pass. Thank you anyway!",
      "Never mind. I'll find somewhere else.",
    ],
    reject_suspicious: [
      "Wait... this doesn't feel right. I'm leaving.",
      "Something feels off. I'm sorry, goodbye.",
    ],
    out_of_patience: [
      "I need to go, my flight leaves soon. Goodbye!",
      "OK I really have to go now. Bye!",
    ],
  },

  junkie: {
    greeting: [
      "Tens {drug}? Preciso de {qty}g AGORA.",
      "Vá... {qty} de {drug}, rápido, não tenho o dia todo.",
      "Faz favor... tens {drug}? Umas {qty}g chegam.",
      "{qty}g de {drug}, por favor. Não me faças esperar.",
    ],
    accept_fair: [
      "Sim, sim, sim! Vá rápido.",
      "Ok, ok. Dá cá.",
      "Ótimo. Obrigado, obrigado.",
    ],
    accept_expensive: [
      "Tá bem, tá bem, pago o que disseste.",
      "Caríssimo mas não me importo agora.",
      "Arranjas-me {drug} por qualquer preço. Aceito.",
    ],
    counter_normal: [
      "Não tenho isso tudo. Podes baixar?",
      "Faz por menos, tou a pedir por favor.",
      "Tenho pouco. Consegues {qty}g por menos?",
    ],
    counter_expensive: [
      "Isso é uma piada? Não tenho isso.",
      "Vá, não sejas assim. Dá-me o {drug} por menos.",
    ],
    reject_normal: [
      "Chega. Vou a outro lado.",
      "Não dá. Até logo.",
    ],
    reject_suspicious: [
      "Nah... tens ar de gato. Saio.",
      "Estás a fazer-me sentir mal. Vou embora.",
    ],
    out_of_patience: [
      "Não tenho tempo para isto. Adeus.",
      "Tás a perder-me a paciência. Xau.",
    ],
    snitch: [
      "Sabes que mais? Eu conheço os gajos da esquadra.",
    ],
  },

  dealer: {
    greeting: [
      "Quero {qty}g de {drug}. Dá-me o teu melhor preço.",
      "Tenho um cliente para {drug}. Precisava de {qty}g. Quanto pedes?",
      "Vamos ao que interessa. {qty}g de {drug} — faz o número.",
      "Ouvi dizer que tens {drug} de qualidade. {qty}g. Quanto?",
    ],
    accept_fair: [
      "Bom preço. Vamos fazer isto direito.",
      "Aceitável. Pode ser. Mas da próxima, melhor.",
      "OK. {qty}g de {drug} por esse valor. Fechado.",
    ],
    accept_expensive: [
      "Estás a exagerar no preço, mas desta vez passa.",
      "Caro, mas tenho necessidade. Feito.",
    ],
    counter_normal: [
      "Esse valor não vai, conheces-me. Baixa.",
      "Achas que nasci ontem? Dá-me um número sério.",
      "{qty}g de {drug} por esse preço? Tens de melhorar.",
    ],
    counter_expensive: [
      "Isso é insulto. Fazes-me uma proposta ou não faço negócio.",
      "Preço de turista? Sou dealer, não estúpido.",
      "Por {drug} a esse preço vou buscar a outro fornecedor.",
    ],
    reject_normal: [
      "Hoje não. Talvez na próxima.",
      "Não me interessas com esses preços.",
    ],
    reject_suspicious: [
      "Algo não bate certo aqui. Vou embora antes de me meter em sarilhos.",
      "Não gosto do teu aspeto hoje. Volto outro dia.",
    ],
    out_of_patience: [
      "Tempo é dinheiro. Perdi demasiado aqui.",
      "Não posso ficar aqui para sempre. Adeus.",
    ],
    snitch: [
      "Sabes o que vou fazer? Falar com quem preciso falar.",
    ],
  },

  undercover: {
    greeting: [
      "Boa tarde. Um amigo deu-me o teu contacto... tens {drug}? Umas {qty}g.",
      "Precisava de {qty}g de {drug} para uma festa. Tens algo?",
      "Olá. Vim ver o que tens. {drug}, {qty} gramas.",
      "Disseram-me que podias arranjar {drug}. {qty}g — tens?",
    ],
    accept_fair: [
      "Ótimo. Podemos fechar negócio.",
      "Parece bem. Prosseguimos.",
      "Perfeito. Muito obrigado.",
    ],
    accept_expensive: [
      "Um pouco caro, mas posso pagar.",
      "Está bem, aceito.",
    ],
    counter_normal: [
      "Será que consegues um preço um bocadinho mais simpático?",
      "Hmm, podes fazer melhor que isso?",
    ],
    reject_normal: [
      "Hmm, vou pensar. Volto mais tarde.",
      "Não é bem o que precisava. Obrigado na mesma.",
    ],
    reject_suspicious: [
      "Deixa para outra altura.",
      "Tá bem, não há problema.",
    ],
    out_of_patience: [
      "Tenho de ir. Obrigado pelo teu tempo.",
      "Deixa andar, estou com pressa.",
    ],
    undercover_bust: [
      "POLÍCIA! Não te mexas! Estás detido!",
      "PSP! Mãos à vista! Estás rodeado!",
      "Brigada Criminal. Não faz nenhum movimento brusco.",
      "STOP! Polícia! Tens o direito de permanecer em silêncio!",
    ],
  },
};

export function getDialogue(
  type: CustomerType,
  key: DialogueKey,
  vars?: { drug?: string; qty?: number }
): string {
  const bank = DIALOGUE_BANK[type];
  const lines = bank[key];
  if (!lines || lines.length === 0) {
    return DIALOGUE_BANK["regular"][key]?.[0] ?? "...";
  }
  let line = lines[Math.floor(Math.random() * lines.length)];
  if (vars?.drug) line = line.replace(/\{drug\}/g, vars.drug);
  if (vars?.qty  != null) line = line.replace(/\{qty\}/g, String(vars.qty));
  return line;
}

// ─────────────────────────────────────────────────────────────
// HEAT / SESSION HELPERS
// ─────────────────────────────────────────────────────────────

export type HeatStage = "safe" | "warning" | "danger" | "busted";

export function getHeatStage(heat: number): HeatStage {
  if (heat >= 100) return "busted";
  if (heat >= 70)  return "danger";
  if (heat >= 40)  return "warning";
  return "safe";
}

export const HEAT_STAGE_STYLE: Record<HeatStage, { color: string; label: string; bg: string }> = {
  safe:    { color: "text-green-400",  label: "SEGURO",  bg: "bg-green-500" },
  warning: { color: "text-yellow-400", label: "ATENÇÃO", bg: "bg-yellow-500" },
  danger:  { color: "text-red-400",    label: "PERIGO",  bg: "bg-red-500" },
  busted:  { color: "text-red-600",    label: "BUSTADO", bg: "bg-red-700" },
};

// ─────────────────────────────────────────────────────────────
// SPAWN HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Randomly pick a customer type for the given zone, weighted by zone's allowedTypes
 * and undercover frequency.
 */
export function pickCustomerType(zoneDef: ZoneDef, heatPct: number): CustomerType {
  // Higher heat → higher undercover chance
  const undercoverBoost = heatPct > 0.7 ? 2.0 : 1.0;
  const pool: CustomerType[] = [];

  for (const t of zoneDef.allowedTypes) {
    const weight = t === "undercover"
      ? Math.ceil(zoneDef.undercoverMod * undercoverBoost * 2)
      : 3;
    for (let i = 0; i < weight; i++) pool.push(t);
  }

  return pool[Math.floor(Math.random() * pool.length)];
}
