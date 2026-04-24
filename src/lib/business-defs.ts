// ─────────────────────────────────────────────────────────────────────────────
// CRIME EMPIRE — BUSINESS DEFINITIONS
// All static game data: worker pools, upgrade trees, event pools per type.
// ─────────────────────────────────────────────────────────────────────────────

export type SkillType = "production" | "efficiency" | "stealth";
export type TraitType =
  | "loyal"
  | "lazy"
  | "risky"
  | "efficient"
  | "paranoid"
  | "greedy"
  | "dedicated";
export type ProductionLevel = "low" | "normal" | "overdrive";
export type RiskLevel = "low" | "medium" | "high";
export type BusinessStatus = "running" | "idle" | "raided" | "suspended";

// ── Worker ──────────────────────────────────────────────────────────────────
export interface WorkerDef {
  id: string;
  name: string;
  skill: SkillType;
  trait: TraitType;
  salary: number; // per hour (deducted from income)
  production_bonus: number; // multiplier added to income  0.0–0.50
  efficiency_bonus: number; // reduces effective salary cost  0.0–0.30
  stealth_bonus: number; // reduces heat generation  0.0–0.30
  description: string; // flavour
}

// ── Upgrade ─────────────────────────────────────────────────────────────────
export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  cost: number;
  icon: string;
  income_bonus: number; // additive multiplier e.g. 0.25 = +25%
  heat_reduction: number; // fraction 0.0–0.50
  capacity_bonus: number; // extra max_employees
}

// ── Event ───────────────────────────────────────────────────────────────────
export interface EventChoice {
  id: string;
  label: string;
  cash_cost?: number;
  dirty_cost?: number;
  heat_change: number; // negative = reduces heat
  cash_gain?: number;
  dirty_gain?: number;
  outcome: string; // message after choice
  success_chance?: number; // if undefined = 100%
  fail_outcome?: string;
  fail_heat_change?: number;
}

export interface EventDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  severity: "info" | "warning" | "danger";
  min_heat: number; // minimum heat to spawn (0 = always eligible)
  base_chance: number; // 0–1 chance per collect attempt
  expires_hours: number;
  choices: EventChoice[];
}

// ── Business type ────────────────────────────────────────────────────────────
export interface BusinessTypeDef {
  type: string;
  label: string;
  icon: string;
  tagline: string;
  description_short: string;
  risk_level: RiskLevel;
  heat_per_hour: number; // at normal production
  income_type: "dirty_cash" | "launder" | "drugs" | "crypto_farm"; // crypto_farm = produces coin units
  drug_output_item_slug?: string; // display name of the drug item produced (reference only)
  crypto_coin_id?: string;      // fake coin ID (e.g. "nether-coin") for crypto_farm businesses
  crypto_real_coin_id?: string; // CoinGecko real coin ID (server-only, for price fetching)
  crypto_coin_display?: { name: string; symbol: string; color: string };
  unique_mechanic: string; // one-liner description
  launder_cap_per_worker?: number; // extra $/hr of launder throughput per hired worker
  production_multipliers: { low: number; normal: number; overdrive: number };
  heat_multipliers: { low: number; normal: number; overdrive: number };
  worker_pool: WorkerDef[];
  upgrades: UpgradeDef[];
  events: EventDef[];
}

// ─────────────────────────────────────────────────────────────────────────────
// TRAIT META
// ─────────────────────────────────────────────────────────────────────────────
export const TRAIT_META: Record<TraitType, { label: string; color: string; icon: string }> = {
  loyal:     { label: "Leal",        color: "text-blue-400",   icon: "🤝" },
  lazy:      { label: "Preguiçoso",  color: "text-gray-400",   icon: "😴" },
  risky:     { label: "Arriscado",   color: "text-red-400",    icon: "⚡" },
  efficient: { label: "Eficiente",   color: "text-green-400",  icon: "⚙️" },
  paranoid:  { label: "Paranoico",   color: "text-purple-400", icon: "👁️" },
  greedy:    { label: "Ganancioso",  color: "text-yellow-500", icon: "💰" },
  dedicated: { label: "Dedicado",    color: "text-orange-400", icon: "🔥" },
};

export const SKILL_META: Record<SkillType, { label: string; icon: string }> = {
  production: { label: "Produção",    icon: "🔧" },
  efficiency: { label: "Eficiência",  icon: "⚙️" },
  stealth:    { label: "Furtividade", icon: "🎭" },
};

export const PRODUCTION_META: Record<ProductionLevel, {
  label: string; income: number; heat: number; color: string;
}> = {
  low:       { label: "Baixa",     income: 0.35, heat: 0.30, color: "text-green-400" },
  normal:    { label: "Normal",    income: 1.00, heat: 1.00, color: "text-yellow-400" },
  overdrive: { label: "Overdrive", income: 1.75, heat: 2.50, color: "text-red-400" },
};

export const STATUS_META: Record<BusinessStatus, { label: string; color: string; bg: string }> = {
  running:   { label: "Ativo",      color: "text-green-400",  bg: "bg-green-400/10 border-green-400/30" },
  idle:      { label: "Inativo",    color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/30" },
  raided:    { label: "Invadido!",  color: "text-red-400",    bg: "bg-red-400/10 border-red-400/30" },
  suspended: { label: "Suspenso",   color: "text-gray-400",   bg: "bg-gray-400/10 border-gray-400/30" },
};

// ─────────────────────────────────────────────────────────────────────────────
// BUSINESS DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

const WEED_FARM: BusinessTypeDef = {
  type: "weed_farm",
  label: "Quinta de Cannabis",
  icon: "🌿",
  tagline: "Cultiva e vende cannabis de alta qualidade",
  description_short: "Negócio de cultivo com risco policial constante. Gere bem os teus trabalhadores e mantém o calor baixo.",
  risk_level: "medium",
  heat_per_hour: 8,
  income_type: "drugs",
  drug_output_item_slug: "Cannabis",
  unique_mechanic: "Calor policial — quanto mais produzires, maior a chance de inspeção",
  production_multipliers: { low: 0.35, normal: 1.0, overdrive: 1.75 },
  heat_multipliers:       { low: 0.30, normal: 1.0, overdrive: 2.50 },
  worker_pool: [
    { id: "wf_carlos",  name: "Carlos",  skill: "production", trait: "loyal",     salary: 45, production_bonus: 0.18, efficiency_bonus: 0.05, stealth_bonus: 0.05, description: "Trabalha com dedicação e nunca falta" },
    { id: "wf_joao",    name: "João",    skill: "stealth",    trait: "paranoid",  salary: 52, production_bonus: -0.05, efficiency_bonus: 0,   stealth_bonus: 0.25, description: "Extremamente discreto, nunca atrai atenção" },
    { id: "wf_miguel",  name: "Miguel",  skill: "production", trait: "risky",     salary: 58, production_bonus: 0.32, efficiency_bonus: 0,   stealth_bonus: -0.15, description: "Produz muito mas é imprudente" },
    { id: "wf_rui",     name: "Rui",     skill: "efficiency", trait: "efficient", salary: 40, production_bonus: 0.08, efficiency_bonus: 0.28, stealth_bonus: 0.05, description: "Otimiza cada recurso ao máximo" },
    { id: "wf_paulo",   name: "Paulo",   skill: "production", trait: "greedy",    salary: 35, production_bonus: 0.14, efficiency_bonus: 0,   stealth_bonus: -0.05, description: "Pode desviar dinheiro da caixa" },
    { id: "wf_tiago",   name: "Tiago",   skill: "production", trait: "dedicated", salary: 60, production_bonus: 0.22, efficiency_bonus: 0.10, stealth_bonus: 0.12, description: "Totalmente comprometido com o negócio" },
    { id: "wf_andre",   name: "André",   skill: "efficiency", trait: "lazy",      salary: 28, production_bonus: -0.18, efficiency_bonus: 0.10, stealth_bonus: 0.03, description: "Faz o mínimo possível" },
    { id: "wf_nuno",    name: "Nuno",    skill: "stealth",    trait: "paranoid",  salary: 54, production_bonus: -0.03, efficiency_bonus: 0,   stealth_bonus: 0.30, description: "Obcecado com segurança e discrição" },
  ],
  upgrades: [
    { id: "wf_lights",   name: "Iluminação LED",         description: "Sistema de iluminação especial aumenta produção em 25%",   cost: 5000,  icon: "💡", income_bonus: 0.25, heat_reduction: 0,    capacity_bonus: 0 },
    { id: "wf_cameras",  name: "Câmeras de Segurança",   description: "Sistema de vigilância avançado reduz calor em 30%",        cost: 8000,  icon: "📷", income_bonus: 0,    heat_reduction: 0.30, capacity_bonus: 0 },
    { id: "wf_van",      name: "Van de Distribuição",    description: "Distribuição direta a clientes aumenta lucros em 35%",     cost: 12000, icon: "🚐", income_bonus: 0.35, heat_reduction: 0,    capacity_bonus: 0 },
    { id: "wf_estufa",   name: "Estufa Avançada",        description: "Expansão do espaço: +3 trabalhadores e +20% produção",     cost: 20000, icon: "🏠", income_bonus: 0.20, heat_reduction: 0,    capacity_bonus: 3 },
  ],
  events: [
    {
      id: "wf_supplier", title: "Fornecedor de Sementes", icon: "🌱", severity: "info", min_heat: 0, base_chance: 0.12, expires_hours: 12,
      description: "Um fornecedor contactou-te com sementes de qualidade superior por um preço especial.",
      choices: [
        { id: "buy",    label: "Comprar ($2.000)",   cash_cost: 2000, heat_change: 2,  dirty_gain: 8000, outcome: "Ótimo negócio! As novas sementes vão render muito mais." },
        { id: "ignore", label: "Ignorar",             heat_change: 0,                              outcome: "Passaste a oportunidade. Próxima vez talvez." },
      ],
    },
    {
      id: "wf_steal", title: "Trabalhador Ladrão", icon: "🤬", severity: "warning", min_heat: 0, base_chance: 0.10, expires_hours: 8,
      description: "Um dos teus trabalhadores foi apanhado a desviar produto para venda própria.",
      choices: [
        { id: "fire",   label: "Despedir (perde 1 worker)",  heat_change: -5,  outcome: "Despediste o ladrão. A equipa está mais concentrada agora." },
        { id: "pay",    label: "Comprar silêncio ($1.500)",  cash_cost: 1500, heat_change: -10, outcome: "Pagaste o silêncio. O trabalhador ficou e está 'grato'." },
      ],
    },
    {
      id: "wf_inspection", title: "Inspeção Policial", icon: "🚔", severity: "danger", min_heat: 55, base_chance: 0.18, expires_hours: 6,
      description: "Informação chegou de que a polícia planeia fazer uma inspeção à tua quinta.",
      choices: [
        { id: "bribe",    label: "Subornar ($3.500)",    cash_cost: 3500,  heat_change: -25, outcome: "O polícia saiu de mãos cheias. Inspeção cancelada.", success_chance: 0.80, fail_outcome: "O suborno foi recusado! A polícia vai aparecer.", fail_heat_change: 15 },
        { id: "shutdown", label: "Fechar temporariamente", heat_change: -30,              outcome: "Fechaste tudo. Sem produção por enquanto, mas estás seguro." },
      ],
    },
    {
      id: "wf_equipment", title: "Avaria de Equipamento", icon: "🔧", severity: "warning", min_heat: 0, base_chance: 0.08, expires_hours: 16,
      description: "O sistema de rega avariou. A produção está a ser afetada.",
      choices: [
        { id: "repair",  label: "Reparar ($1.200)",  cash_cost: 1200, heat_change: 0, outcome: "Equipamento reparado. Produção voltou ao normal." },
        { id: "ignore",  label: "Ignorar",            heat_change: 5,               outcome: "Deixaste avariar. A produção está 20% abaixo do normal." },
      ],
    },
    {
      id: "wf_buyer", title: "Comprador VIP", icon: "💎", severity: "info", min_heat: 0, base_chance: 0.07, expires_hours: 10,
      description: "Um comprador de alto nível quer comprar toda a produção de uma vez por um preço premium.",
      choices: [
        { id: "sell",   label: "Vender (ganho triplo!)", heat_change: 8,  dirty_gain: 0, outcome: "Negócio fechado! Recebeste 3x o valor normal desta coleta." },
        { id: "refuse", label: "Recusar",                heat_change: 0,               outcome: "Recusaste. Continua com o negócio normal." },
      ],
    },
  ],
};

const PILL_FACTORY: BusinessTypeDef = {
  type: "pill_factory",
  label: "Fábrica de Pílulas",
  icon: "💊",
  tagline: "Produz pílulas ilegais em escala industrial",
  description_short: "Alto risco, alto retorno. A eficiência dos teus trabalhadores determina o output. Escala gradualmente.",
  risk_level: "high",
  heat_per_hour: 13,
  income_type: "drugs",
  drug_output_item_slug: "Pastilhas",
  unique_mechanic: "Escala de eficiência — mais trabalhadores eficientes = produção exponencial",
  production_multipliers: { low: 0.35, normal: 1.0, overdrive: 1.75 },
  heat_multipliers:       { low: 0.30, normal: 1.0, overdrive: 2.50 },
  worker_pool: [
    { id: "pf_filipe",  name: "Filipe",  skill: "production", trait: "dedicated", salary: 80, production_bonus: 0.25, efficiency_bonus: 0.10, stealth_bonus: 0.05, description: "Químico especializado, sabe o que faz" },
    { id: "pf_diana",   name: "Diana",   skill: "efficiency", trait: "efficient", salary: 72, production_bonus: 0.08, efficiency_bonus: 0.30, stealth_bonus: 0.05, description: "Otimiza o processo de produção como ninguém" },
    { id: "pf_hugo",    name: "Hugo",    skill: "production", trait: "risky",     salary: 90, production_bonus: 0.35, efficiency_bonus: 0,   stealth_bonus: -0.18, description: "Trabalha em overdrive mas é descuidado" },
    { id: "pf_sofia",   name: "Sofia",   skill: "stealth",    trait: "paranoid",  salary: 75, production_bonus: -0.05, efficiency_bonus: 0,  stealth_bonus: 0.28, description: "Deixa zero rasto nas operações" },
    { id: "pf_marco",   name: "Marco",   skill: "production", trait: "loyal",     salary: 70, production_bonus: 0.20, efficiency_bonus: 0.05, stealth_bonus: 0.08, description: "Confiável, nunca falta, nunca rouba" },
    { id: "pf_ines",    name: "Inês",    skill: "efficiency", trait: "greedy",    salary: 55, production_bonus: 0.12, efficiency_bonus: 0.18, stealth_bonus: -0.05, description: "Trabalha bem mas vai querer bónus extra" },
    { id: "pf_pedro",   name: "Pedro",   skill: "production", trait: "lazy",      salary: 45, production_bonus: -0.20, efficiency_bonus: 0.05, stealth_bonus: 0.03, description: "Faz o mínimo, frequentemente ausente" },
    { id: "pf_luis",    name: "Luís",    skill: "stealth",    trait: "efficient", salary: 78, production_bonus: 0.10, efficiency_bonus: 0.22, stealth_bonus: 0.20, description: "Especialista em cobertura e logística" },
  ],
  upgrades: [
    { id: "pf_centrifuge", name: "Centrífuga Industrial",   description: "Equipamento de produção avançado: +30% output total",           cost: 10000, icon: "⚗️", income_bonus: 0.30, heat_reduction: 0,    capacity_bonus: 0 },
    { id: "pf_ventilation",name: "Sistema de Ventilação",   description: "Elimina cheiros e vestígios: -35% geração de calor",             cost: 12000, icon: "💨", income_bonus: 0,    heat_reduction: 0.35, capacity_bonus: 0 },
    { id: "pf_lab",        name: "Laboratório Secreto",     description: "Laboratório adicional no sub-solo: +4 trabalhadores, +15% income", cost: 25000, icon: "🔬", income_bonus: 0.15, heat_reduction: 0,    capacity_bonus: 4 },
    { id: "pf_distribution",name: "Rede de Distribuição",  description: "Canal de distribuição próprio: +40% lucro líquido",               cost: 18000, icon: "🌐", income_bonus: 0.40, heat_reduction: 0,    capacity_bonus: 0 },
  ],
  events: [
    {
      id: "pf_shortage", title: "Falta de Matéria-Prima", icon: "⚠️", severity: "warning", min_heat: 0, base_chance: 0.12, expires_hours: 12,
      description: "O teu fornecedor de químicos cortou o abastecimento. Precisas de resolver isto.",
      choices: [
        { id: "buy",    label: "Comprar no mercado negro ($4.000)", cash_cost: 4000, heat_change: 5,  outcome: "Conseguiste matéria-prima. Produção mantida." },
        { id: "reduce", label: "Reduzir produção",                   heat_change: -5,                  outcome: "Reduziste a produção para o stock existente durar." },
      ],
    },
    {
      id: "pf_rival", title: "Rival Quer Território", icon: "⚔️", severity: "danger", min_heat: 40, base_chance: 0.10, expires_hours: 8,
      description: "Uma gang rival descobriu a tua fábrica e ameaça destruí-la se não pagares proteção.",
      choices: [
        { id: "pay",    label: "Pagar proteção ($5.000)",   cash_cost: 5000, heat_change: -8,  outcome: "Pagaste. Ficaste em paz por agora." },
        { id: "resist", label: "Resistir",                   heat_change: 20,                  outcome: "Resististe! Mas o calor aumentou muito. Cuidado.", success_chance: 0.60, fail_outcome: "Perdeste a batalha. Parte do stock foi destruído.", fail_heat_change: 35 },
      ],
    },
    {
      id: "pf_defective", title: "Lote Defeituoso", icon: "☣️", severity: "warning", min_heat: 0, base_chance: 0.10, expires_hours: 16,
      description: "Um lote saiu com defeitos. Os clientes estão insatisfeitos e a reputação está em risco.",
      choices: [
        { id: "replace", label: "Substituir o lote ($2.500)",  cash_cost: 2500, heat_change: -5, outcome: "Substituíste. Reputação mantida." },
        { id: "sell",    label: "Vender mesmo assim",           heat_change: 12,                 outcome: "Vendeste na mesma. Mas a reputação caiu — e os clientes falam." },
      ],
    },
    {
      id: "pf_tip", title: "Denúncia Anónima", icon: "📞", severity: "danger", min_heat: 60, base_chance: 0.20, expires_hours: 6,
      description: "Alguém denunciou a tua operação anonimamente. A polícia está a investigar.",
      choices: [
        { id: "shutdown", label: "Fechar operação (24h idle)", heat_change: -40, outcome: "Fechaste tudo. Perdeste produção mas safaste-te da investigação." },
        { id: "bribe",    label: "Subornar investigador ($6.000)", cash_cost: 6000, heat_change: -20, outcome: "Investigação cancelada.", success_chance: 0.70, fail_outcome: "O investigador era honesto. Calor disparou!", fail_heat_change: 30 },
      ],
    },
    {
      id: "pf_inspector", title: "Trabalhador Destacado", icon: "⭐", severity: "info", min_heat: 0, base_chance: 0.08, expires_hours: 24,
      description: "Um dos teus trabalhadores pediu um aumento em troca de dobrar a produção esta semana.",
      choices: [
        { id: "bonus",  label: "Dar bónus ($1.000)", cash_cost: 1000, heat_change: 0, dirty_gain: 4000, outcome: "Pagaste o bónus. O trabalhador produziu o dobro!" },
        { id: "refuse", label: "Recusar",              heat_change: 0,                                   outcome: "Recusaste. O trabalhador ficou desmotivado por uns dias." },
      ],
    },
  ],
};

const CRYPTO_MINING: BusinessTypeDef = {
  type: "crypto_mining",
  label: "Rig Farm",
  icon: "⛏️",
  tagline: "Minera NetherCoin com rigs ilegais de alta potência",
  description_short: "Os teus rigs minam NetherCoin dia e noite. Recolhe os coins e vende no mercado de crypto. Pouco calor, lucro dependente do mercado.",
  risk_level: "low",
  heat_per_hour: 3,
  income_type: "crypto_farm",
  crypto_coin_id: "nether-coin",
  crypto_real_coin_id: "bitcoin",
  crypto_coin_display: { name: "NetherCoin", symbol: "NTC", color: "#f7931a" },
  unique_mechanic: "Crypto farm — acumula NetherCoin para vender no mercado de stocks",
  production_multipliers: { low: 0.35, normal: 1.0, overdrive: 1.75 },
  heat_multipliers:       { low: 0.30, normal: 1.0, overdrive: 2.50 },
  worker_pool: [
    { id: "cm_diogo",  name: "Diogo",   skill: "efficiency", trait: "efficient", salary: 120, production_bonus: 0.10, efficiency_bonus: 0.30, stealth_bonus: 0.05, description: "Guru de hardware, otimiza cada GPU" },
    { id: "cm_beatriz",name: "Beatriz", skill: "stealth",    trait: "paranoid",  salary: 130, production_bonus: -0.05, efficiency_bonus: 0.05, stealth_bonus: 0.28, description: "Especialista em VPNs e anonimato" },
    { id: "cm_ana",    name: "Ana",     skill: "production", trait: "dedicated", salary: 145, production_bonus: 0.25, efficiency_bonus: 0.10, stealth_bonus: 0.08, description: "Mantém os rigs a funcionar 24/7" },
    { id: "cm_ricardo",name: "Ricardo", skill: "efficiency", trait: "greedy",    salary: 100, production_bonus: 0.08, efficiency_bonus: 0.20, stealth_bonus: -0.05, description: "Bom tecnicamente mas quer cortes extras" },
    { id: "cm_vasco",  name: "Vasco",   skill: "production", trait: "risky",     salary: 155, production_bonus: 0.35, efficiency_bonus: 0,    stealth_bonus: -0.20, description: "Overclocka tudo, afunda tudo eventualmente" },
    { id: "cm_helena", name: "Helena",  skill: "stealth",    trait: "loyal",     salary: 125, production_bonus: 0.12, efficiency_bonus: 0.08, stealth_bonus: 0.18, description: "Discreta, confiável, nunca deixa rasto" },
  ],
  upgrades: [
    { id: "cm_asics",    name: "ASICs Dedicados",     description: "Hardware de mining profissional: +35% hashrate",                  cost: 15000, icon: "🖥️", income_bonus: 0.35, heat_reduction: 0,    capacity_bonus: 0 },
    { id: "cm_solar",    name: "Painéis Solares",     description: "Electricidade gratuita reduz custos em 25% e calor em 20%",      cost: 12000, icon: "☀️", income_bonus: 0.25, heat_reduction: 0.20, capacity_bonus: 0 },
    { id: "cm_cooling",  name: "Sistema de Cooling",  description: "Refrigeração avançada: mais capacidade +2 e +15% estabilidade",  cost: 8000,  icon: "❄️", income_bonus: 0.15, heat_reduction: 0.15, capacity_bonus: 2 },
    { id: "cm_vpn",      name: "VPN Enterprise",      description: "Infraestrutura anonimizada: -40% geração de calor total",        cost: 10000, icon: "🔒", income_bonus: 0,    heat_reduction: 0.40, capacity_bonus: 0 },
  ],
  events: [
    {
      id: "cm_boom", title: "Boom do Mercado", icon: "📈", severity: "info", min_heat: 0, base_chance: 0.12, expires_hours: 8,
      description: "O preço da crypto subiu 300%! Esta é a janela de oportunidade para maximizar o output.",
      choices: [
        { id: "overdrive", label: "Overdrive total (calor +20)", heat_change: 20, dirty_gain: 0, outcome: "Puseste tudo no limite. Os lucros desta coleta foram 3x!" },
        { id: "normal",    label: "Manter ritmo",                 heat_change: 0,                outcome: "Mantiveste o ritmo. Perdeste a oportunidade mas evitaste calor." },
      ],
    },
    {
      id: "cm_crash", title: "Crash do Mercado", icon: "📉", severity: "warning", min_heat: 0, base_chance: 0.10, expires_hours: 12,
      description: "O mercado caiu 80%. Continuar a minar agora é quase um prejuízo.",
      choices: [
        { id: "pause",    label: "Pausar operação",               heat_change: -15, outcome: "Pausaste. Evitaste prejuízo e reduziste calor." },
        { id: "continue", label: "Continuar (income -60%)",       heat_change: 0,   outcome: "Continuaste. Perdeste margem mas mantiveste operação ativa." },
      ],
    },
    {
      id: "cm_electric", title: "Fatura de Electricidade", icon: "⚡", severity: "warning", min_heat: 0, base_chance: 0.15, expires_hours: 24,
      description: "A fatura de electricidade está astronómica. A empresa distribuidora está a investigar o consumo anormal.",
      choices: [
        { id: "pay",    label: "Pagar + propina ($3.000)", cash_cost: 3000, heat_change: -10, outcome: "Resolveste discretamente. A investigação foi encerrada." },
        { id: "reduce", label: "Reduzir consumo",           heat_change: -8,                  outcome: "Reduziste o consumo. Produção caiu mas a suspeita baixou." },
      ],
    },
    {
      id: "cm_hack", title: "Tentativa de Hack", icon: "💻", severity: "danger", min_heat: 30, base_chance: 0.08, expires_hours: 6,
      description: "Detetaste uma tentativa de intrusão nos teus sistemas. Alguém quer roubar a tua carteira.",
      choices: [
        { id: "secure", label: "Investir em segurança ($2.500)", cash_cost: 2500, heat_change: -5,  outcome: "Sistemas seguros. O ataque foi repelido." },
        { id: "ignore", label: "Ignorar",                         heat_change: 5,  dirty_gain: -5000, outcome: "Foste hackeado. Perdeste fundos da carteira." },
      ],
    },
  ],
};

const SCAM_OFFICE: BusinessTypeDef = {
  type: "scam_office",
  label: "Pump & Dump HQ",
  icon: "📈",
  tagline: "Orquestra esquemas de pump & dump que geram PhantomChain",
  description_short: "Coordenas campanhas de manipulação de mercado. Cada ciclo de hype gera PhantomChain para vender no mercado de crypto.",
  risk_level: "medium",
  heat_per_hour: 7,
  income_type: "crypto_farm",
  crypto_coin_id: "phantom-chain",
  crypto_real_coin_id: "ripple",
  crypto_coin_display: { name: "PhantomChain", symbol: "PHC", color: "#00aae4" },
  unique_mechanic: "Pump & dump — cada ciclo de manipulação gera PhantomChain para vender",
  production_multipliers: { low: 0.35, normal: 1.0, overdrive: 1.75 },
  heat_multipliers:       { low: 0.30, normal: 1.0, overdrive: 2.50 },
  worker_pool: [
    { id: "so_catarina",name: "Catarina", skill: "production", trait: "dedicated", salary: 65, production_bonus: 0.28, efficiency_bonus: 0.08, stealth_bonus: 0.05, description: "Engenheira social brilhante, fecha qualquer deal" },
    { id: "so_gustavo", name: "Gustavo",  skill: "stealth",    trait: "paranoid",  salary: 70, production_bonus: -0.03, efficiency_bonus: 0,   stealth_bonus: 0.30, description: "Nunca deixa rasto digital, paranóico profissional" },
    { id: "so_mariana", name: "Mariana",  skill: "efficiency", trait: "efficient", salary: 58, production_bonus: 0.08, efficiency_bonus: 0.28, stealth_bonus: 0.08, description: "Otimiza os scripts de scam ao máximo" },
    { id: "so_tomas",   name: "Tomás",    skill: "production", trait: "greedy",    salary: 50, production_bonus: 0.20, efficiency_bonus: 0,   stealth_bonus: -0.08, description: "Bom a vender mentiras, mas quer corte extra" },
    { id: "so_marta",   name: "Marta",    skill: "production", trait: "loyal",     salary: 62, production_bonus: 0.18, efficiency_bonus: 0.05, stealth_bonus: 0.08, description: "A mais confiável da equipa, zero falhas" },
    { id: "so_afonso",  name: "Afonso",   skill: "efficiency", trait: "risky",     salary: 72, production_bonus: 0.30, efficiency_bonus: 0.15, stealth_bonus: -0.12, description: "Muito capaz mas usa métodos perigosos" },
    { id: "so_leonor",  name: "Leonor",   skill: "stealth",    trait: "efficient", salary: 60, production_bonus: 0.10, efficiency_bonus: 0.20, stealth_bonus: 0.22, description: "Mestre em cobrir os rastos digitais" },
    { id: "so_gabriel", name: "Gabriel",  skill: "production", trait: "lazy",      salary: 35, production_bonus: -0.22, efficiency_bonus: 0.05, stealth_bonus: 0.02, description: "Dorme mais do que trabalha" },
  ],
  upgrades: [
    { id: "so_servers",  name: "Servidores VPS",      description: "Infraestrutura profissional: +25% taxa de sucesso e income",  cost: 8000,  icon: "🖥️", income_bonus: 0.25, heat_reduction: 0.10, capacity_bonus: 0 },
    { id: "so_scripts",  name: "Scripts Avançados",   description: "Automação de operações: +30% volume de scams",                cost: 12000, icon: "📝", income_bonus: 0.30, heat_reduction: 0,    capacity_bonus: 0 },
    { id: "so_vpn",      name: "VPN Cadeia Dupla",    description: "Anonimato total: -35% geração de calor",                      cost: 10000, icon: "🔐", income_bonus: 0,    heat_reduction: 0.35, capacity_bonus: 0 },
    { id: "so_callcenter",name: "Call Center Falso",  description: "Operação maior: +5 operadores, +20% income",                  cost: 20000, icon: "📞", income_bonus: 0.20, heat_reduction: 0,    capacity_bonus: 5 },
  ],
  events: [
    {
      id: "so_bigfish", title: "Peixe Grande Fisgado", icon: "🐟", severity: "info", min_heat: 0, base_chance: 0.10, expires_hours: 6,
      description: "Um dos teus operadores fisgou um alvo de alto valor. Esta operação pode render muito.",
      choices: [
        { id: "execute", label: "Executar operação ($500 risco)", cash_cost: 500, heat_change: 8, dirty_gain: 15000, outcome: "Operação perfeita! Lucro enorme desta vez.", success_chance: 0.75, fail_outcome: "O alvo desconfiou e denunciou. Calor aumentou!", fail_heat_change: 20 },
        { id: "skip",    label: "Passar à frente",                heat_change: 0,                                    outcome: "Passaste o alvo. Talvez na próxima." },
      ],
    },
    {
      id: "so_exposed", title: "Operador Identificado", icon: "😨", severity: "danger", min_heat: 50, base_chance: 0.15, expires_hours: 8,
      description: "Um dos teus operadores foi identificado pela Polícia Judiciária. Estão a fechar o cerco.",
      choices: [
        { id: "relocate", label: "Realocar operação ($4.000)", cash_cost: 4000, heat_change: -30, outcome: "Mudaste de localização. Safaste-te desta." },
        { id: "shutdown", label: "Suspender temporariamente",   heat_change: -20,                 outcome: "Suspendeste por 48h. Calor baixou mas perdeste produção." },
      ],
    },
    {
      id: "so_intern", title: "Novato Promissor", icon: "🌟", severity: "info", min_heat: 0, base_chance: 0.08, expires_hours: 24,
      description: "Um novo recruta mostrou talento extraordinário. Quer trabalhar para ti.",
      choices: [
        { id: "hire",   label: "Contratar ($500 bónus)",  cash_cost: 500, heat_change: 0, outcome: "O novato entrou. +1 slot de trabalhador disponível com bónus de 15%." },
        { id: "refuse", label: "Recusar",                  heat_change: 0,                outcome: "Recusaste o novato. Ficou chateado e pode falar..." },
      ],
    },
    {
      id: "so_raid", title: "Operação Policial", icon: "🚨", severity: "danger", min_heat: 65, base_chance: 0.22, expires_hours: 4,
      description: "Recebes aviso de que a PJ tem mandado de busca ao teu escritório.",
      choices: [
        { id: "run",    label: "Evacuar tudo",                    heat_change: -35, outcome: "Evacuaste a tempo. Perdeste um dia de produção mas ficaste livre." },
        { id: "bribe",  label: "Subornar agente ($8.000)",         cash_cost: 8000, heat_change: -25, outcome: "O agente foi subornado. Mandado retirado.", success_chance: 0.65, fail_outcome: "O agente era incorruptível! Escritório invadido!", fail_heat_change: 40 },
      ],
    },
  ],
};

const CHOP_SHOP: BusinessTypeDef = {
  type: "chop_shop",
  label: "Chop Shop",
  icon: "🔧",
  tagline: "Desmonta carros roubados e lava dinheiro",
  description_short: "Negócio de lavagem. Converte dinheiro sujo em limpo. Mais trabalhadores = taxa de conversão mais alta.",
  risk_level: "high",
  heat_per_hour: 15,
  income_type: "launder",
  unique_mechanic: "Lavagem de dinheiro — taxa de conversão de sujo para limpo baseada nos teus trabalhadores",
  launder_cap_per_worker: 1000, // +$1 000/hr de cap por trabalhador
  production_multipliers: { low: 0.35, normal: 1.0, overdrive: 1.75 },
  heat_multipliers:       { low: 0.30, normal: 1.0, overdrive: 2.50 },
  worker_pool: [
    { id: "cs_jorge",  name: "Jorge",   skill: "efficiency", trait: "dedicated", salary: 90, production_bonus: 0.20, efficiency_bonus: 0.30, stealth_bonus: 0.05, description: "Especialista em lavagem, conhece todos os truques" },
    { id: "cs_bruno",  name: "Bruno",   skill: "production", trait: "loyal",     salary: 80, production_bonus: 0.22, efficiency_bonus: 0.08, stealth_bonus: 0.08, description: "Mecânico de confiança, mão de ferro" },
    { id: "cs_estela", name: "Estela",  skill: "stealth",    trait: "paranoid",  salary: 85, production_bonus: -0.05, efficiency_bonus: 0,   stealth_bonus: 0.28, description: "Faz tudo no segredo absoluto" },
    { id: "cs_rafa",   name: "Rafa",    skill: "production", trait: "risky",     salary: 95, production_bonus: 0.35, efficiency_bonus: 0,   stealth_bonus: -0.15, description: "Muito rápido mas deixa rastos" },
    { id: "cs_simao",  name: "Simão",   skill: "efficiency", trait: "efficient", salary: 75, production_bonus: 0.10, efficiency_bonus: 0.28, stealth_bonus: 0.08, description: "Maximiza cada euro lavado" },
    { id: "cs_teresa", name: "Teresa",  skill: "stealth",    trait: "greedy",    salary: 65, production_bonus: 0.12, efficiency_bonus: 0.05, stealth_bonus: 0.18, description: "Discreta mas quer comissão em tudo" },
  ],
  upgrades: [
    { id: "cs_press",   name: "Prensa Hidráulica",    description: "Processa carros mais rápido: +30% taxa de lavagem",        cost: 12000, icon: "⚙️", income_bonus: 0.30, heat_reduction: 0,    capacity_bonus: 0 },
    { id: "cs_cameras", name: "Câmeras Falsas",        description: "Câmeras apontadas para fora: -30% calor das ruas",         cost: 8000,  icon: "📹", income_bonus: 0,    heat_reduction: 0.30, capacity_bonus: 0 },
    { id: "cs_garage",  name: "Garagem Subterrânea",   description: "Operação expandida: +3 mecânicos, +20% eficiência",        cost: 22000, icon: "🏗️", income_bonus: 0.20, heat_reduction: 0.15, capacity_bonus: 3 },
    { id: "cs_network", name: "Rede de Fornecedores",  description: "Carros chegam automaticamente: +40% volume de operações",  cost: 18000, icon: "🌐", income_bonus: 0.40, heat_reduction: 0,    capacity_bonus: 0 },
  ],
  events: [
    {
      id: "cs_heist", title: "Oportunidade de Negócio", icon: "🚗", severity: "info", min_heat: 0, base_chance: 0.10, expires_hours: 8,
      description: "Um ladrão quer descarregar 5 carros de luxo de uma vez. Podes processar tudo?",
      choices: [
        { id: "accept", label: "Aceitar ($1.000 upfront)", cash_cost: 1000, heat_change: 15, dirty_gain: 20000, outcome: "Processaste tudo! Grande lucro.", success_chance: 0.80, fail_outcome: "Os carros eram armadilha da polícia!", fail_heat_change: 45 },
        { id: "refuse", label: "Recusar",                  heat_change: 0,                                      outcome: "Recusaste. Era demasiado arriscado." },
      ],
    },
    {
      id: "cs_snitch", title: "Vizinho Curioso", icon: "👀", severity: "warning", min_heat: 30, base_chance: 0.14, expires_hours: 10,
      description: "Um vizinho está a tirar fotos à tua garagem e ao movimento de carros.",
      choices: [
        { id: "bribe",  label: "Subornar ($1.500)", cash_cost: 1500, heat_change: -15, outcome: "O vizinho ficou em silêncio. Por agora." },
        { id: "move",   label: "Mudar operação",     heat_change: -20,                 outcome: "Mudaste para outra garagem. Produção parada 12h." },
      ],
    },
    {
      id: "cs_bust", title: "Rusga Policial", icon: "🚔", severity: "danger", min_heat: 70, base_chance: 0.25, expires_hours: 4,
      description: "A PSP está com viaturas paradas perto do teu negócio. Algo vai acontecer.",
      choices: [
        { id: "evacuate", label: "Evacuar tudo",             heat_change: -40, outcome: "Evacuaste a tempo. Garagem vazia quando chegaram." },
        { id: "bribe",    label: "Subornar ($7.000)",        cash_cost: 7000, heat_change: -30, outcome: "Os agentes foram subornados.", success_chance: 0.60, fail_outcome: "Suborno recusado! Negócio invadido.", fail_heat_change: 50 },
      ],
    },
    {
      id: "cs_tools", title: "Ferramenta Avariada", icon: "🔩", severity: "warning", min_heat: 0, base_chance: 0.08, expires_hours: 20,
      description: "O equipamento principal avariou. A lavagem está a 30% da eficiência.",
      choices: [
        { id: "repair",  label: "Reparar ($2.000)", cash_cost: 2000, heat_change: 0, outcome: "Equipamento reparado. Back to full speed." },
        { id: "workaround", label: "Continuar na mesma", heat_change: 3,              outcome: "Continuaste degradado. Mas a operação não parou." },
      ],
    },
  ],
};

const COUNTERFEIT_LAB: BusinessTypeDef = {
  type: "counterfeit_lab",
  label: "Token Forge",
  icon: "🔐",
  tagline: "Forja tokens IronLedger no mercado negro digital",
  description_short: "Mint de tokens fraudulentos em escala industrial. Alto risco, alto retorno. Trabalhadores de stealth são críticos para evitar detecção.",
  risk_level: "high",
  heat_per_hour: 14,
  income_type: "crypto_farm",
  crypto_coin_id: "iron-ledger",
  crypto_real_coin_id: "cardano",
  crypto_coin_display: { name: "IronLedger", symbol: "ILD", color: "#0033ad" },
  unique_mechanic: "Token forging — mint de IronLedger com qualidade ditada pelo stealth dos trabalhadores",
  production_multipliers: { low: 0.35, normal: 1.0, overdrive: 1.75 },
  heat_multipliers:       { low: 0.30, normal: 1.0, overdrive: 2.50 },
  worker_pool: [
    { id: "cl_aida",    name: "Aída",    skill: "production", trait: "dedicated", salary: 100, production_bonus: 0.28, efficiency_bonus: 0.08, stealth_bonus: 0.05, description: "Gravurista mestre, produz notas impecáveis" },
    { id: "cl_norberto",name: "Norberto",skill: "stealth",    trait: "paranoid",  salary: 95,  production_bonus: -0.05, efficiency_bonus: 0,   stealth_bonus: 0.32, description: "Distribui as notas sem nunca levantar suspeitas" },
    { id: "cl_vanda",   name: "Vanda",   skill: "efficiency", trait: "efficient", salary: 85,  production_bonus: 0.10, efficiency_bonus: 0.30, stealth_bonus: 0.08, description: "Gerente de produção, nunca desperdiça papel" },
    { id: "cl_paulo2",  name: "Paulinho",skill: "production", trait: "risky",     salary: 108, production_bonus: 0.38, efficiency_bonus: 0,   stealth_bonus: -0.20, description: "O mais rápido da equipa, o mais descuidado também" },
    { id: "cl_lurdes",  name: "Lurdes",  skill: "stealth",    trait: "loyal",     salary: 88,  production_bonus: 0.12, efficiency_bonus: 0.05, stealth_bonus: 0.22, description: "Vinte anos no negócio, nunca traiu ninguém" },
    { id: "cl_fenix",   name: "Fénix",   skill: "production", trait: "greedy",    salary: 75,  production_bonus: 0.20, efficiency_bonus: 0,   stealth_bonus: -0.08, description: "Bom impressor, quer % de tudo que sai" },
  ],
  upgrades: [
    { id: "cl_printer",  name: "Impressora Industrial",  description: "Impressão profissional: +35% output de notas",           cost: 15000, icon: "🖨️", income_bonus: 0.35, heat_reduction: 0,    capacity_bonus: 0 },
    { id: "cl_paper",    name: "Papel Especial",          description: "Papel indetectável: -30% chance de detecção (calor)",    cost: 10000, icon: "📄", income_bonus: 0,    heat_reduction: 0.30, capacity_bonus: 0 },
    { id: "cl_uv",       name: "Tinta UV Avançada",       description: "Notas passam em qualquer máquina: +25% income, -15% heat", cost: 20000, icon: "💜", income_bonus: 0.25, heat_reduction: 0.15, capacity_bonus: 0 },
    { id: "cl_warehouse",name: "Armazém Secreto",         description: "Espaço expandido: +3 operadores, +20% produção",         cost: 18000, icon: "🏭", income_bonus: 0.20, heat_reduction: 0,    capacity_bonus: 3 },
  ],
  events: [
    {
      id: "cl_detection", title: "Nota Detetada", icon: "🔍", severity: "danger", min_heat: 50, base_chance: 0.18, expires_hours: 6,
      description: "Uma das tuas notas foi detetada numa caixa de supermercado. O banco está a investigar.",
      choices: [
        { id: "abort",   label: "Abortar lote atual",           heat_change: -20, outcome: "Abortaste o lote defeituoso. Perda de produção mas estás seguro." },
        { id: "distract",label: "Distração ($3.000)",           cash_cost: 3000, heat_change: -10, outcome: "Criaste ruído suficiente para desviar as atenções." },
      ],
    },
    {
      id: "cl_supplier2", title: "Papel Especial Disponível", icon: "📦", severity: "info", min_heat: 0, base_chance: 0.10, expires_hours: 12,
      description: "O teu fornecedor tem stock de papel de segurança roubado. Está a preço de saldo.",
      choices: [
        { id: "buy",    label: "Comprar ($3.500)", cash_cost: 3500, heat_change: 3, dirty_gain: 10000, outcome: "Comprado! O novo papel vai melhorar a qualidade." },
        { id: "skip",   label: "Passar",           heat_change: 0,                                     outcome: "Passaste a oportunidade." },
      ],
    },
    {
      id: "cl_raid2", title: "Mandado de Busca", icon: "🚨", severity: "danger", min_heat: 70, base_chance: 0.20, expires_hours: 4,
      description: "Mandado de busca emitido para o teu laboratório. Tens poucas horas.",
      choices: [
        { id: "run",   label: "Evacuar laboratório",       heat_change: -45, outcome: "Evacuaste tudo. Quando chegaram estava vazio." },
        { id: "bribe", label: "Subornar juiz ($10.000)",   cash_cost: 10000, heat_change: -30, outcome: "Mandado cancelado.", success_chance: 0.55, fail_outcome: "Juiz recusou. Operação descoberta!", fail_heat_change: 55 },
      ],
    },
    {
      id: "cl_newclient", title: "Cliente Novo em Quantidade", icon: "💼", severity: "info", min_heat: 0, base_chance: 0.08, expires_hours: 10,
      description: "Um intermediário quer comprar grandes quantidades de forma regular.",
      choices: [
        { id: "deal",   label: "Fechar contrato", heat_change: 5, dirty_gain: 12000, outcome: "Contrato fechado! Rendimento garantido.", success_chance: 0.85, fail_outcome: "Era polícia disfarçado. Calor disparou!", fail_heat_change: 35 },
        { id: "refuse", label: "Recusar",          heat_change: 0,                    outcome: "Recusaste. Segurança acima de tudo." },
      ],
    },
  ],
};

const NIGHTCLUB: BusinessTypeDef = {
  type: "nightclub",
  label: "Câmbio Negro",
  icon: "🌑",
  tagline: "Câmbio clandestino de GhostToken na economia sombria",
  description_short: "Trocas de GhostToken no mercado subterrâneo. Baixo calor, fluxo constante de coins. O negócio mais discreto que existe.",
  risk_level: "low",
  heat_per_hour: 2,
  income_type: "crypto_farm",
  crypto_coin_id: "ghost-token",
  crypto_real_coin_id: "ethereum",
  crypto_coin_display: { name: "GhostToken", symbol: "GTK", color: "#627eea" },
  unique_mechanic: "Dark exchange — acumula GhostToken através de trocas clandestinas de confiança",
  production_multipliers: { low: 0.35, normal: 1.0, overdrive: 1.75 },
  heat_multipliers:       { low: 0.30, normal: 1.0, overdrive: 2.50 },
  worker_pool: [
    { id: "nc_sergio",  name: "Sérgio",  skill: "production", trait: "dedicated", salary: 180, production_bonus: 0.25, efficiency_bonus: 0.10, stealth_bonus: 0.10, description: "Manager geral, sabe como encher a casa" },
    { id: "nc_patricia",name: "Patrícia",skill: "efficiency", trait: "efficient", salary: 160, production_bonus: 0.08, efficiency_bonus: 0.30, stealth_bonus: 0.08, description: "Gere as finanças sem deixar buracos" },
    { id: "nc_dj_mike", name: "DJ Mike", skill: "production", trait: "loyal",     salary: 200, production_bonus: 0.30, efficiency_bonus: 0.05, stealth_bonus: 0.05, description: "O DJ mais popular da cidade, atrai multidões" },
    { id: "nc_carla",   name: "Carla",   skill: "stealth",    trait: "paranoid",  salary: 155, production_bonus: -0.05, efficiency_bonus: 0,   stealth_bonus: 0.28, description: "Responsável pela 'contabilidade criativa'" },
    { id: "nc_chefe",   name: "Chefe",   skill: "production", trait: "greedy",    salary: 145, production_bonus: 0.18, efficiency_bonus: 0,   stealth_bonus: -0.05, description: "Arranja clientes VIP, quer comissão em tudo" },
    { id: "nc_seguranca",name: "Romão",  skill: "stealth",    trait: "dedicated", salary: 170, production_bonus: 0.08, efficiency_bonus: 0.05, stealth_bonus: 0.25, description: "Segurança discreto que gere situações silenciosamente" },
    { id: "nc_lara",    name: "Lara",    skill: "efficiency", trait: "loyal",     salary: 150, production_bonus: 0.10, efficiency_bonus: 0.25, stealth_bonus: 0.10, description: "Gestora de evento, reduz custos e maximiza lucro" },
  ],
  upgrades: [
    { id: "nc_vip",      name: "Área VIP",           description: "Atrai clientes de alto valor: +30% income por noite",     cost: 20000, icon: "💎", income_bonus: 0.30, heat_reduction: 0,    capacity_bonus: 0 },
    { id: "nc_soundsys", name: "Sistema de Som",     description: "Melhor experiência = mais clientes: +25% income",         cost: 15000, icon: "🔊", income_bonus: 0.25, heat_reduction: 0,    capacity_bonus: 0 },
    { id: "nc_lawyers",  name: "Advogados em Reter", description: "Proteção legal: -45% calor de qualquer fonte",            cost: 25000, icon: "⚖️", income_bonus: 0,    heat_reduction: 0.45, capacity_bonus: 0 },
    { id: "nc_expansion",name: "Expansão do Espaço", description: "Capacidade dobrada: +5 staff, +20% fluxo de clientes",   cost: 30000, icon: "🏗️", income_bonus: 0.20, heat_reduction: 0,    capacity_bonus: 5 },
  ],
  events: [
    {
      id: "nc_celebrity", title: "Celebridade Quer Vir", icon: "⭐", severity: "info", min_heat: 0, base_chance: 0.10, expires_hours: 8,
      description: "Uma celebridade quer vir ao teu clube esta semana. Vai trazer atenção — e muita gente.",
      choices: [
        { id: "invite",  label: "Convidar (pagar $3.000)", cash_cost: 3000, heat_change: 5,  dirty_gain: 18000, outcome: "A noite foi um sucesso total. Casa cheia, caixa cheia!" },
        { id: "decline", label: "Recusar",                  heat_change: 0,                                      outcome: "Recusaste a atenção extra. Mais seguro assim." },
      ],
    },
    {
      id: "nc_inspector", title: "Inspeção das Finanças", icon: "📊", severity: "warning", min_heat: 40, base_chance: 0.12, expires_hours: 24,
      description: "A Autoridade Tributária vai fazer uma auditoria às tuas contas.",
      choices: [
        { id: "bribe",   label: "Preparar documentos ($5.000)", cash_cost: 5000, heat_change: -20, outcome: "Contabilidade 'ajustada'. Auditoria passou sem problemas." },
        { id: "comply",  label: "Cooperar",                     heat_change: -10,                  outcome: "Cooperaste. Multa pequena mas ficaste limpo oficialmente." },
      ],
    },
    {
      id: "nc_fight", title: "Briga no Club", icon: "👊", severity: "warning", min_heat: 0, base_chance: 0.12, expires_hours: 10,
      description: "Uma briga séria aconteceu. Há filmagens e a polícia foi chamada.",
      choices: [
        { id: "security", label: "Contratar mais segurança ($2.000)", cash_cost: 2000, heat_change: -5,  outcome: "Situação controlada. Reputação mantida." },
        { id: "ignore",   label: "Ignorar",                            heat_change: 12,                   outcome: "A história correu nas redes sociais. Má imprensa." },
      ],
    },
    {
      id: "nc_drug", title: "Droga Encontrada", icon: "🚨", severity: "danger", min_heat: 55, base_chance: 0.16, expires_hours: 6,
      description: "A polícia encontrou droga nas casas de banho durante uma rusga.",
      choices: [
        { id: "bribe",   label: "Subornar ($9.000)",    cash_cost: 9000, heat_change: -30, outcome: "Situação resolvida discretamente.", success_chance: 0.70, fail_outcome: "Suborno recusado. Club sob investigação!", fail_heat_change: 40 },
        { id: "lawyer",  label: "Chamar advogados",     heat_change: -15,                  outcome: "Os advogados controlaram o dano. Pode custar mais tarde." },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// PHANTOM CORP — Corporação Fantasma (tier-2 launder, 20 000/hr base)
// ─────────────────────────────────────────────────────────────────────────────
const PHANTOM_CORP: BusinessTypeDef = {
  type: "phantom_corp",
  label: "Corporação Fantasma",
  icon: "👻",
  tagline: "Empresas-fantasma para esconder fortunas",
  description_short: "Uma rede de empresas fictícias em paraísos fiscais. Transforma grandes volumes de dinheiro sujo em rendimentos empresariais \"legítimos\".",
  risk_level: "medium",
  heat_per_hour: 8,
  income_type: "launder",
  unique_mechanic: "Lavagem empresarial — cada advogado ou contabilista aumenta o cap de lavagem horário em $2.000",
  launder_cap_per_worker: 2000,
  production_multipliers: { low: 0.35, normal: 1.0, overdrive: 1.75 },
  heat_multipliers:       { low: 0.30, normal: 1.0, overdrive: 2.50 },
  worker_pool: [
    { id: "pc_mendes",     name: "Dr. Mendes",   skill: "stealth",    trait: "dedicated", salary: 200, production_bonus: 0.18, efficiency_bonus: 0.10, stealth_bonus: 0.20, description: "Advogado fiscalista. Especializado em estruturas societárias invisíveis." },
    { id: "pc_fatima",     name: "Fátima",        skill: "efficiency", trait: "efficient", salary: 180, production_bonus: 0.10, efficiency_bonus: 0.28, stealth_bonus: 0.08, description: "Contabilista criativa. Faz os números sempre fazerem sentido." },
    { id: "pc_carlos",     name: "Carlos",        skill: "production", trait: "loyal",     salary: 160, production_bonus: 0.22, efficiency_bonus: 0.05, stealth_bonus: 0.08, description: "Director fictício de 47 empresas diferentes. Fiável e discreto." },
    { id: "pc_helio",      name: "Hélio",         skill: "stealth",    trait: "paranoid",  salary: 195, production_bonus: -0.05, efficiency_bonus: 0,   stealth_bonus: 0.30, description: "Notário corrupto. Certifica tudo sem fazer perguntas." },
    { id: "pc_vera",       name: "Vera",          skill: "production", trait: "risky",     salary: 175, production_bonus: 0.32, efficiency_bonus: 0,   stealth_bonus: -0.12, description: "Analista financeira brilhante. Maximiza o volume mas é imprudente." },
    { id: "pc_nuno",       name: "Nuno",          skill: "efficiency", trait: "greedy",    salary: 155, production_bonus: 0.12, efficiency_bonus: 0.20, stealth_bonus: 0.05, description: "Intermediário que conhece toda a gente. Quer comissão em tudo." },
  ],
  upgrades: [
    { id: "pc_holding",    name: "Estrutura Holding",     description: "Rede de holdings multinacionais: +30% volume de lavagem",   cost: 25000, icon: "🏛️", income_bonus: 0.30, heat_reduction: 0,    capacity_bonus: 0 },
    { id: "pc_offshore",   name: "Contas Offshore",        description: "Contas em paraísos fiscais: -35% exposição a investigações", cost: 18000, icon: "🌴", income_bonus: 0,    heat_reduction: 0.35, capacity_bonus: 0 },
    { id: "pc_lawyers",    name: "Equipa Jurídica",        description: "Escritório de advogados a full-time: +25% eficiência, +2 vagas", cost: 30000, icon: "⚖️", income_bonus: 0.25, heat_reduction: 0, capacity_bonus: 2 },
    { id: "pc_crypto",     name: "Ponte Cripto",           description: "Lavagem via criptomoedas mistas: +40% output anónimo",      cost: 22000, icon: "🔗", income_bonus: 0.40, heat_reduction: 0,    capacity_bonus: 0 },
  ],
  events: [
    {
      id: "pc_audit", title: "Auditoria Fiscal", icon: "📊", severity: "warning", min_heat: 40, base_chance: 0.14, expires_hours: 24,
      description: "A Autoridade Tributária abriu um processo de auditoria às tuas empresas.",
      choices: [
        { id: "fix_books",  label: "Arranjar documentação ($6.000)",  cash_cost: 6000, heat_change: -25, outcome: "Contabilidade 'corrigida'. A auditoria não encontrou nada." },
        { id: "comply",     label: "Cooperar com a auditoria",                          heat_change: -10, outcome: "Cooperaste. Multa menor mas a empresa ficou exposta.", success_chance: 0.70, fail_outcome: "A auditoria encontrou irregularidades graves!", fail_heat_change: 35 },
      ],
    },
    {
      id: "pc_whistleblower", title: "Informador Interno", icon: "🐀", severity: "danger", min_heat: 50, base_chance: 0.16, expires_hours: 8,
      description: "Um dos teus funcionários está a considerar falar com as autoridades.",
      choices: [
        { id: "bribe",      label: "Comprar silêncio ($10.000)", cash_cost: 10000, heat_change: -30, outcome: "O informador foi convencido a ficar calado.", success_chance: 0.75, fail_outcome: "O informador fugiu antes de poderes agir!", fail_heat_change: 50 },
        { id: "fire",       label: "Despedir imediatamente",                        heat_change: -10, outcome: "Despediste o funcionário. Pode ainda falar, mas levará tempo." },
      ],
    },
    {
      id: "pc_big_client", title: "Cliente de Alto Valor", icon: "💼", severity: "info", min_heat: 0, base_chance: 0.10, expires_hours: 12,
      description: "Um intermediário quer encaminhar um volume enorme de fundos pelas tuas empresas.",
      choices: [
        { id: "accept",     label: "Aceitar contrato ($2.000 upfront)", cash_cost: 2000, heat_change: 10, dirty_gain: 30000, outcome: "Contrato fechado! Enorme influxo de fundos.", success_chance: 0.80, fail_outcome: "Era armadilha da PJ. Fundos congelados!", fail_heat_change: 45 },
        { id: "decline",    label: "Recusar",                                           heat_change: 0,                     outcome: "Recusaste. Segurança em primeiro lugar." },
      ],
    },
    {
      id: "pc_registry_leak", title: "Fuga no Registo", icon: "📰", severity: "warning", min_heat: 30, base_chance: 0.12, expires_hours: 16,
      description: "Os registos das tuas empresas vazaram para um jornalista de investigação.",
      choices: [
        { id: "suppress",   label: "Suprimir publicação ($8.000)", cash_cost: 8000, heat_change: -20, outcome: "O artigo foi travado. Os registos continuam secretos." },
        { id: "restructure",label: "Reestruturar empresas",                         heat_change: -15, outcome: "Dissolveste as empresas expostas. Operação parada 6 horas." },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// OFFSHORE BANK — Banco Offshore (tier-3 launder, 35 000/hr base)
// ─────────────────────────────────────────────────────────────────────────────
const OFFSHORE_BANK: BusinessTypeDef = {
  type: "offshore_bank",
  label: "Banco Offshore",
  icon: "🏦",
  tagline: "Movimenta fortunas através das fronteiras",
  description_short: "Banco privado em jurisdição offshore. Wire transfers internacionais instantâneas. O método mais discreto e eficiente para mover grandes fortunas.",
  risk_level: "medium",
  heat_per_hour: 6,
  income_type: "launder",
  unique_mechanic: "Wire transfers — cada banqueiro especializado aumenta o cap de lavagem horário em $3.000",
  launder_cap_per_worker: 3000,
  production_multipliers: { low: 0.35, normal: 1.0, overdrive: 1.75 },
  heat_multipliers:       { low: 0.30, normal: 1.0, overdrive: 2.50 },
  worker_pool: [
    { id: "ob_rodrigo",    name: "Rodrigo",       skill: "production", trait: "dedicated", salary: 250, production_bonus: 0.25, efficiency_bonus: 0.12, stealth_bonus: 0.08, description: "Gestor de fortunas. Especialista em jurisdições offshore de alto risco." },
    { id: "ob_isabel",     name: "Isabel",        skill: "efficiency", trait: "efficient", salary: 220, production_bonus: 0.08, efficiency_bonus: 0.32, stealth_bonus: 0.10, description: "Directora de compliance. Faz tudo parecer absolutamente legítimo." },
    { id: "ob_mikael",     name: "Mikael",        skill: "stealth",    trait: "paranoid",  salary: 240, production_bonus: -0.05, efficiency_bonus: 0,   stealth_bonus: 0.32, description: "Especialista em cripto anonimizado. Não confia em ninguém." },
    { id: "ob_goncalo",    name: "Gonçalo",       skill: "production", trait: "risky",     salary: 260, production_bonus: 0.38, efficiency_bonus: 0,   stealth_bonus: -0.18, description: "Trader agressivo. Multiplica o volume mas pode atrair atenção." },
    { id: "ob_dora",       name: "Dora",          skill: "stealth",    trait: "loyal",     salary: 230, production_bonus: 0.12, efficiency_bonus: 0.08, stealth_bonus: 0.22, description: "Directora bancária. Nunca revelou um cliente em 20 anos de carreira." },
    { id: "ob_ze",         name: "Zé",            skill: "efficiency", trait: "greedy",    salary: 200, production_bonus: 0.15, efficiency_bonus: 0.22, stealth_bonus: 0, description: "Courier de documentos. Bónus por cada transferência completada." },
  ],
  upgrades: [
    { id: "ob_correspondent", name: "Banco Correspondente",  description: "Rede de bancos parceiros: +35% capacidade de transferência", cost: 40000, icon: "🌐", income_bonus: 0.35, heat_reduction: 0,    capacity_bonus: 0 },
    { id: "ob_encryption",    name: "Encriptação Avançada",   description: "Comunicações militares: -40% rastreabilidade (calor)",       cost: 25000, icon: "🔐", income_bonus: 0,    heat_reduction: 0.40, capacity_bonus: 0 },
    { id: "ob_vip_desk",      name: "Balcão VIP",             description: "Serviço exclusivo: +30% eficiência, +2 gestores",            cost: 35000, icon: "💎", income_bonus: 0.30, heat_reduction: 0,    capacity_bonus: 2 },
    { id: "ob_crypto_desk",   name: "Mesa de Criptomoedas",   description: "Mixing avançado de cripto: +45% volume anónimo",             cost: 50000, icon: "₿",  income_bonus: 0.45, heat_reduction: 0,    capacity_bonus: 0 },
  ],
  events: [
    {
      id: "ob_wire_freeze", title: "Wire Transfer Congelada", icon: "🧊", severity: "danger", min_heat: 45, base_chance: 0.15, expires_hours: 8,
      description: "Um banco correspondente congelou uma transferência por actividade suspeita.",
      choices: [
        { id: "unfreeze",   label: "Pagar desbloqueio ($12.000)", cash_cost: 12000, heat_change: -20, outcome: "Transferência desbloqueada. Fundos chegaram sem rastos.", success_chance: 0.70, fail_outcome: "O banco recusou. Os fundos foram reportados às autoridades!", fail_heat_change: 45 },
        { id: "abandon",    label: "Abandonar a transferência",                      heat_change: -30, outcome: "Cancelaste a operação. Perdeste os fundos desta transferência." },
      ],
    },
    {
      id: "ob_regulatory", title: "Investigação Regulatória", icon: "🔎", severity: "warning", min_heat: 35, base_chance: 0.12, expires_hours: 24,
      description: "O Banco Central está a investigar movimentos irregulares nas tuas contas.",
      choices: [
        { id: "lawyer",     label: "Contratar advogados ($9.000)",  cash_cost: 9000, heat_change: -25, outcome: "Os advogados bloquearam a investigação. Por enquanto." },
        { id: "move_funds", label: "Mover fundos imediatamente",                     heat_change: -15, outcome: "Moveste tudo antes de serem localizados. Operação temporariamente mais lenta." },
      ],
    },
    {
      id: "ob_deposit", title: "Depósito Anónimo Enorme", icon: "💰", severity: "info", min_heat: 0, base_chance: 0.09, expires_hours: 10,
      description: "Um cliente anónimo quer depositar uma quantia enorme. Sem perguntas.",
      choices: [
        { id: "accept",     label: "Aceitar (taxa $3.000)", cash_cost: 3000, heat_change: 8, dirty_gain: 50000, outcome: "Depósito processado. Enorme comissão.", success_chance: 0.75, fail_outcome: "O depósito era operação de isco da Europol!", fail_heat_change: 55 },
        { id: "decline",    label: "Recusar",                heat_change: 0,                                    outcome: "Recusaste. Não vale o risco." },
      ],
    },
    {
      id: "ob_leak", title: "Fuga de Documentos Secretos", icon: "📁", severity: "danger", min_heat: 60, base_chance: 0.18, expires_hours: 6,
      description: "Registos secretos do banco foram partilhados com a imprensa internacional.",
      choices: [
        { id: "bribe",      label: "Subornar jornalista ($15.000)", cash_cost: 15000, heat_change: -35, outcome: "A história foi suprimida. Os documentos destruídos.", success_chance: 0.65, fail_outcome: "O jornalista recusou e publicou tudo!", fail_heat_change: 60 },
        { id: "relocate",   label: "Mudar operação para nova jurisdição",              heat_change: -40, outcome: "Banco relocalizado. Operação parada 1 dia mas quase invisível." },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// CLANDESTINE CASINO — Casino Clandestino (tier-4 launder, 50 000/hr base)
// ─────────────────────────────────────────────────────────────────────────────
const CLANDESTINE_CASINO: BusinessTypeDef = {
  type: "clandestine_casino",
  label: "Casino Clandestino",
  icon: "🎰",
  tagline: "O lugar onde o dinheiro sujo entra e sai limpo",
  description_short: "Casino ilegal de alto perfil. Chips trocam dinheiro sujo por fichas que voltam como ganhos legítimos. O método mais rápido — e arriscado.",
  risk_level: "high",
  heat_per_hour: 18,
  income_type: "launder",
  unique_mechanic: "Fichas de casino — mais croupiers = mais mesas = +$4.000/hr de cap de lavagem por trabalhador",
  launder_cap_per_worker: 4000,
  production_multipliers: { low: 0.35, normal: 1.0, overdrive: 1.75 },
  heat_multipliers:       { low: 0.30, normal: 1.0, overdrive: 2.50 },
  worker_pool: [
    { id: "cc_afonso",     name: "Afonso",        skill: "production", trait: "dedicated", salary: 180, production_bonus: 0.28, efficiency_bonus: 0.10, stealth_bonus: 0.05, description: "Croupier experiente. Sabe exactamente quando deixar ganhar." },
    { id: "cc_graca",      name: "Graça",         skill: "efficiency", trait: "efficient", salary: 200, production_bonus: 0.10, efficiency_bonus: 0.30, stealth_bonus: 0.10, description: "Chefe de sala. Gere 12 mesas em simultâneo sem perder o fio." },
    { id: "cc_renato",     name: "Renato",        skill: "stealth",    trait: "loyal",     salary: 220, production_bonus: 0.08, efficiency_bonus: 0.05, stealth_bonus: 0.28, description: "Pit boss. Viu tudo neste negócio e nunca disse nada a ninguém." },
    { id: "cc_liliana",    name: "Liliana",       skill: "stealth",    trait: "paranoid",  salary: 190, production_bonus: -0.05, efficiency_bonus: 0,   stealth_bonus: 0.35, description: "Caixa-forte humana. Nenhuma transacção é rastreável quando passa por ela." },
    { id: "cc_tomas",      name: "Tomás",         skill: "production", trait: "risky",     salary: 165, production_bonus: 0.35, efficiency_bonus: 0,   stealth_bonus: -0.20, description: "Dealer mais rápido da cidade. Também o mais descuidado." },
    { id: "cc_beatriz",    name: "Beatriz",       skill: "efficiency", trait: "greedy",    salary: 210, production_bonus: 0.18, efficiency_bonus: 0.25, stealth_bonus: 0, description: "Anfitriã VIP. Traz whales com dinheiro para lavar, quer 10% de comissão." },
    { id: "cc_monteiro",   name: "Monteiro",      skill: "stealth",    trait: "dedicated", salary: 175, production_bonus: 0.05, efficiency_bonus: 0.05, stealth_bonus: 0.22, description: "Segurança discreto. Resolve situações 'delicadas' silenciosamente." },
  ],
  upgrades: [
    { id: "cc_vip_room",   name: "Sala VIP Exclusiva",  description: "Mesas privadas para jogadores de alto valor: +35% volume de fichas", cost: 35000, icon: "🥂", income_bonus: 0.35, heat_reduction: 0,    capacity_bonus: 0 },
    { id: "cc_cameras",    name: "Sistema Anti-Rusga",   description: "Câmeras externas + alertas: -30% calor policial",                    cost: 20000, icon: "📹", income_bonus: 0,    heat_reduction: 0.30, capacity_bonus: 0 },
    { id: "cc_tables",     name: "Mesas Extra",           description: "Expansão do casino: +20% output, +3 croupiers adicionais",           cost: 28000, icon: "🃏", income_bonus: 0.20, heat_reduction: 0,    capacity_bonus: 3 },
    { id: "cc_crypto",     name: "Fichas Cripto",         description: "Fichas anónimas em blockchain: +40% volume, -10% calor",            cost: 45000, icon: "🔮", income_bonus: 0.40, heat_reduction: 0.10, capacity_bonus: 0 },
  ],
  events: [
    {
      id: "cc_high_roller", title: "High Roller Suspeito", icon: "🎲", severity: "info", min_heat: 0, base_chance: 0.11, expires_hours: 8,
      description: "Um jogador misterioso apareceu com uma mala cheia de dinheiro. Quer entrar.",
      choices: [
        { id: "allow",      label: "Deixar entrar",            heat_change: 12, dirty_gain: 40000, outcome: "Noite épica! Enormes somas passaram pelas tuas mesas.", success_chance: 0.75, fail_outcome: "Era agente encoberto. Operação comprometida!", fail_heat_change: 50 },
        { id: "refuse",     label: "Recusar entrada",           heat_change: 0,                    outcome: "Recusaste. Demasiado arriscado sem verificação." },
      ],
    },
    {
      id: "cc_police_raid", title: "Rusga Policial Iminente", icon: "🚔", severity: "danger", min_heat: 60, base_chance: 0.22, expires_hours: 4,
      description: "Informações de que a PSP vai fazer uma rusga esta noite. Tens poucas horas.",
      choices: [
        { id: "evacuate",   label: "Evacuar e fechar",          heat_change: -45, outcome: "Casino fechado a tempo. Quando chegaram estava vazio." },
        { id: "bribe",      label: "Subornar comandante ($12.000)", cash_cost: 12000, heat_change: -35, outcome: "A rusga foi cancelada.", success_chance: 0.60, fail_outcome: "Suborno recusado! Casino invadido esta noite.", fail_heat_change: 60 },
      ],
    },
    {
      id: "cc_rigged", title: "Mesa Viciada Descoberta", icon: "🃏", severity: "warning", min_heat: 20, base_chance: 0.13, expires_hours: 12,
      description: "Um jogador descobriu que as mesas estão viciadas e está a fazer escândalo.",
      choices: [
        { id: "pay_off",    label: "Pagar silêncio ($4.000)",  cash_cost: 4000, heat_change: -10, outcome: "O jogador foi compensado e calou-se." },
        { id: "remove",     label: "Remover o jogador",                         heat_change: 5,   outcome: "O segurança 'resolveu' a situação. Pode falar mais tarde.", success_chance: 0.65, fail_outcome: "A situação escalou e chegou à polícia!", fail_heat_change: 25 },
      ],
    },
    {
      id: "cc_seizure", title: "Confisco de Fichas", icon: "💸", severity: "danger", min_heat: 70, base_chance: 0.20, expires_hours: 6,
      description: "As autoridades têm mandado para confiscar as fichas e registos do casino.",
      choices: [
        { id: "hide",       label: "Esconder tudo ($5.000)",   cash_cost: 5000, heat_change: -30, outcome: "Tudo escondido antes de chegarem. Mandado executado a vazio.", success_chance: 0.65, fail_outcome: "Encontraram tudo. Enorme prejuízo!", fail_heat_change: 55 },
        { id: "surrender",  label: "Cooperar parcialmente",                     heat_change: -20, outcome: "Entregaste alguma coisa. Perda parcial mas evitaste o pior." },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRY
// ─────────────────────────────────────────────────────────────────────────────
const LSD_LAB: BusinessTypeDef = {
  type: "lsd_lab",
  label: "Laboratório de LSD",
  icon: "🔬",
  tagline: "Síntese ilegal de lisergida em escala industrial",
  description_short: "Laboratório de alta precisão. A qualidade dos químicos determina a potência. Risco extremo.",
  risk_level: "high",
  heat_per_hour: 18,
  income_type: "drugs",
  drug_output_item_slug: "Frasco de Gotas",
  unique_mechanic: "Síntese química — qualidade dos químicos aumenta a potência e volume do produto",
  production_multipliers: { low: 0.35, normal: 1.0, overdrive: 1.75 },
  heat_multipliers:       { low: 0.30, normal: 1.0, overdrive: 2.50 },
  worker_pool: [
    { id: "ll_marco",    name: "Marco",    skill: "production", trait: "dedicated", salary: 120, production_bonus: 0.28, efficiency_bonus: 0.10, stealth_bonus: 0.05, description: "Químico de elite, síntese impecável" },
    { id: "ll_vera",     name: "Vera",     skill: "efficiency", trait: "efficient", salary: 110, production_bonus: 0.10, efficiency_bonus: 0.30, stealth_bonus: 0.08, description: "Otimiza cada grama do processo" },
    { id: "ll_rafael",   name: "Rafael",   skill: "stealth",    trait: "paranoid",  salary: 115, production_bonus: -0.03, efficiency_bonus: 0,   stealth_bonus: 0.30, description: "Distribui sem deixar rasto algum" },
    { id: "ll_serena",   name: "Serena",   skill: "production", trait: "loyal",     salary: 105, production_bonus: 0.22, efficiency_bonus: 0.05, stealth_bonus: 0.08, description: "Confiável, zero erros em 3 anos" },
    { id: "ll_fabricio", name: "Fabrício", skill: "production", trait: "risky",     salary: 130, production_bonus: 0.38, efficiency_bonus: 0,    stealth_bonus: -0.18, description: "Produz muito mas trabalha no limite" },
    { id: "ll_odete",    name: "Odete",    skill: "efficiency", trait: "greedy",    salary: 90,  production_bonus: 0.12, efficiency_bonus: 0.20, stealth_bonus: -0.05, description: "Boa técnica mas quer percentagem em tudo" },
  ],
  upgrades: [
    { id: "ll_reactor",     name: "Reator de Síntese",     description: "Equipamento profissional: +35% output de produto",            cost: 18000, icon: "⚗️",  income_bonus: 0.35, heat_reduction: 0,    capacity_bonus: 0 },
    { id: "ll_ventilation", name: "Ventilação Industrial", description: "Elimina gases e odores: -35% calor gerado",                    cost: 14000, icon: "💨",  income_bonus: 0,    heat_reduction: 0.35, capacity_bonus: 0 },
    { id: "ll_isolamento",  name: "Câmaras de Isolamento", description: "Laboratório expandido: +3 químicos, +20% produção",            cost: 28000, icon: "🏗️", income_bonus: 0.20, heat_reduction: 0.15, capacity_bonus: 3 },
    { id: "ll_rede",        name: "Rede de Distribuição",  description: "Canal dedicado de distribuição: +40% output total",            cost: 22000, icon: "🌐",  income_bonus: 0.40, heat_reduction: 0,    capacity_bonus: 0 },
  ],
  events: [
    {
      id: "ll_precursors", title: "Precursores Escassos", icon: "⚠️", severity: "warning", min_heat: 0, base_chance: 0.12, expires_hours: 12,
      description: "Os precursores químicos estão escassos no mercado. Precisas de resolver o abastecimento.",
      choices: [
        { id: "buy",    label: "Mercado negro ($5.000)", cash_cost: 5000, heat_change: 6,  outcome: "Conseguiste precursores. Produção mantida mas calor subiu." },
        { id: "reduce", label: "Reduzir produção",        heat_change: -8,                  outcome: "Reduziste a síntese. Produto escasseia mas estás mais seguro." },
      ],
    },
    {
      id: "ll_fire", title: "Incêndio no Laboratório", icon: "🔥", severity: "danger", min_heat: 40, base_chance: 0.10, expires_hours: 6,
      description: "Uma reação instável causou um incêndio. Os danos podem ser graves.",
      choices: [
        { id: "extinguish", label: "Controlar ($3.000)", cash_cost: 3000, heat_change: 15, outcome: "Controlaste o incêndio. Lab funcional mas calor disparou.", success_chance: 0.80, fail_outcome: "O incêndio alastrou! Lab parcialmente destruído.", fail_heat_change: 40 },
        { id: "evacuate",   label: "Evacuar tudo",        heat_change: -5,                  outcome: "Evacuaste. Produção parada mas sem exposição." },
      ],
    },
    {
      id: "ll_bigorder", title: "Encomenda Grande", icon: "💼", severity: "info", min_heat: 0, base_chance: 0.09, expires_hours: 10,
      description: "Um distribuidor quer uma encomenda de grandes quantidades a preço premium.",
      choices: [
        { id: "accept", label: "Aceitar (calor +10)", heat_change: 10, outcome: "Encomenda processada! Grande produção esta coleta." },
        { id: "refuse", label: "Recusar",              heat_change: 0,  outcome: "Recusaste. Segurança em primeiro lugar." },
      ],
    },
    {
      id: "ll_raid", title: "Operação Anti-Droga", icon: "🚨", severity: "danger", min_heat: 65, base_chance: 0.22, expires_hours: 4,
      description: "A PJ tem um mandado de busca ao teu laboratório. Tens poucas horas.",
      choices: [
        { id: "evacuate", label: "Evacuar laboratório",               heat_change: -45, outcome: "Evacuaste tudo. Lab vazio quando chegaram." },
        { id: "bribe",    label: "Subornar investigador ($9.000)",    cash_cost: 9000,  heat_change: -28, outcome: "Investigação suspensa.", success_chance: 0.60, fail_outcome: "Investigador honesto! Lab invadido.", fail_heat_change: 55 },
      ],
    },
  ],
};

const CARTEL_EMPIRE: BusinessTypeDef = {
  type: "cartel_empire",
  label: "Cartel Empire",
  icon: "🏴",
  tagline: "A operação de cocaína mais sofisticada do país",
  description_short: "O nível máximo do tráfico. Rotas de importação, processamento e distribuição próprias. Risco máximo.",
  risk_level: "high",
  heat_per_hour: 25,
  income_type: "drugs",
  drug_output_item_slug: "KG de Coca",
  unique_mechanic: "Rotas de tráfico — cada trabalhador abre uma rota mais eficiente",
  production_multipliers: { low: 0.35, normal: 1.0, overdrive: 1.75 },
  heat_multipliers:       { low: 0.30, normal: 1.0, overdrive: 2.50 },
  worker_pool: [
    { id: "ce_boss",    name: "El Jefe",   skill: "production", trait: "dedicated", salary: 250, production_bonus: 0.30, efficiency_bonus: 0.10, stealth_bonus: 0.08, description: "O coordenador-chefe de toda a operação" },
    { id: "ce_pilot",   name: "Aviador",   skill: "stealth",    trait: "paranoid",  salary: 220, production_bonus: -0.02, efficiency_bonus: 0,   stealth_bonus: 0.32, description: "Piloto experiente, rotas indetectáveis" },
    { id: "ce_chemist", name: "Químico",   skill: "production", trait: "efficient", salary: 200, production_bonus: 0.25, efficiency_bonus: 0.15, stealth_bonus: 0.05, description: "Processa a coca com pureza máxima" },
    { id: "ce_guard",   name: "Guarda",    skill: "stealth",    trait: "loyal",     salary: 180, production_bonus: 0,    efficiency_bonus: 0.05, stealth_bonus: 0.28, description: "Protege a operação, fiel até ao fim" },
    { id: "ce_runner",  name: "Correio",   skill: "production", trait: "risky",     salary: 160, production_bonus: 0.35, efficiency_bonus: 0,    stealth_bonus: -0.15, description: "Distribui rápido mas arrisca demasiado" },
    { id: "ce_account", name: "Contadora", skill: "efficiency", trait: "greedy",    salary: 190, production_bonus: 0.08, efficiency_bonus: 0.28, stealth_bonus: -0.05, description: "Gere as finanças do cartel, sempre quer mais" },
  ],
  upgrades: [
    { id: "ce_labpro",   name: "Laboratório Avançado", description: "Processamento puro: +40% output de cocaína",                cost: 30000, icon: "🧪", income_bonus: 0.40, heat_reduction: 0,    capacity_bonus: 0 },
    { id: "ce_aircraft", name: "Aeronave Privada",      description: "Transporte aéreo próprio: -30% calor de distribuição",     cost: 50000, icon: "✈️", income_bonus: 0,    heat_reduction: 0.30, capacity_bonus: 0 },
    { id: "ce_couriers", name: "Rede de Correiros",     description: "Rede de distribuição: +4 operativos, +20% output",         cost: 40000, icon: "🌐", income_bonus: 0.20, heat_reduction: 0,    capacity_bonus: 4 },
    { id: "ce_bunker",   name: "Bunker de Produção",    description: "Instalação subterrânea: +45% produção, -20% calor",        cost: 60000, icon: "🏰", income_bonus: 0.45, heat_reduction: 0.20, capacity_bonus: 0 },
  ],
  events: [
    {
      id: "ce_seizure", title: "Apreensão na Fronteira", icon: "🛃", severity: "danger", min_heat: 30, base_chance: 0.12, expires_hours: 8,
      description: "Um dos teus carregamentos foi intercetado na fronteira. Precisas de uma solução.",
      choices: [
        { id: "abort",     label: "Abandonar a carga",          heat_change: -20, outcome: "Abandonaste. Perda de produto mas sem ligação a ti." },
        { id: "negotiate", label: "Negociar ($15.000)",         cash_cost: 15000, heat_change: -30, outcome: "Carga libertada.", success_chance: 0.65, fail_outcome: "Negociação falhou! Investigação aberta.", fail_heat_change: 40 },
      ],
    },
    {
      id: "ce_war", title: "Guerra de Cartel", icon: "⚔️", severity: "danger", min_heat: 50, base_chance: 0.10, expires_hours: 8,
      description: "Um cartel rival está a invadir o teu território. Exigem rendição ou represálias.",
      choices: [
        { id: "fight", label: "Defender território",       heat_change: 25,  outcome: "Defendeste! Mas atraiu muita atenção das autoridades.", success_chance: 0.65, fail_outcome: "Perdeste o confronto. Produção afetada.", fail_heat_change: 45 },
        { id: "pay",   label: "Pagar tributo ($20.000)",  cash_cost: 20000, heat_change: -10, outcome: "Pagaste. A paz tem um preço." },
      ],
    },
    {
      id: "ce_supplier", title: "Fornecedor Premium", icon: "🌿", severity: "info", min_heat: 0, base_chance: 0.09, expires_hours: 10,
      description: "Um fornecedor colombiano oferece coca de pureza extrema por preço especial.",
      choices: [
        { id: "buy",  label: "Comprar ($8.000)", cash_cost: 8000, heat_change: 4, outcome: "Matéria-prima de elite vai aumentar o output." },
        { id: "pass", label: "Passar",            heat_change: 0,                  outcome: "Passaste. Produto standard mantido." },
      ],
    },
    {
      id: "ce_dea", title: "Operação da DEA", icon: "🦅", severity: "danger", min_heat: 75, base_chance: 0.25, expires_hours: 4,
      description: "Informação classificada: a DEA tem uma operação contra o teu cartel em 4 horas.",
      choices: [
        { id: "scatter", label: "Dispersar toda a operação",             heat_change: -50, outcome: "Quando chegaram não havia nada." },
        { id: "bribe",   label: "Infiltrar e subornar ($25.000)", cash_cost: 25000, heat_change: -35, outcome: "Operação sabotada por dentro.", success_chance: 0.55, fail_outcome: "Infiltrado identificado! Operação comprometida.", fail_heat_change: 60 },
      ],
    },
  ],
};

// ── Shared events spawned by the system (not random) ─────────────────────────
export const SHARED_BUSINESS_EVENTS: EventDef[] = [
  {
    id: "police_investigation",
    title: "Investigação Policial",
    description: "O teu negócio está sob investigação após a rusga. Tens de resolver a situação para retomar as operações.",
    icon: "🔍",
    severity: "danger",
    min_heat: 0,
    base_chance: 0,
    expires_hours: 72,
    choices: [
      { id: "bribe",  label: "Subornar investigador ($15.000)", cash_cost: 15000, heat_change: 0, outcome: "Subornaste o investigador. O caso foi arquivado e o negócio reabriu." },
      { id: "lawyer", label: "Contratar advogado ($8.000)",     cash_cost:  8000, heat_change: 0, outcome: "O advogado arquivou o processo. O negócio está de volta.", success_chance: 0.70, fail_outcome: "O advogado não conseguiu ajudar desta vez. Tenta novamente.", fail_heat_change: 0 },
      { id: "wait",   label: "Aguardar investigação (grátis)",  cash_cost:     0, heat_change: 0, outcome: "A investigação encerrou por falta de provas. Operações retomadas com calor adicional.", dirty_cost: 500 },
    ],
  },
];

export const BUSINESS_DEFS: Record<string, BusinessTypeDef> = {
  weed_farm:           WEED_FARM,
  pill_factory:        PILL_FACTORY,
  lsd_lab:             LSD_LAB,
  cartel_empire:       CARTEL_EMPIRE,
  crypto_mining:       CRYPTO_MINING,
  scam_office:         SCAM_OFFICE,
  chop_shop:           CHOP_SHOP,
  counterfeit_lab:     COUNTERFEIT_LAB,
  nightclub:           NIGHTCLUB,
  phantom_corp:        PHANTOM_CORP,
  offshore_bank:       OFFSHORE_BANK,
  clandestine_casino:  CLANDESTINE_CASINO,
};

export function getBusinessDef(type: string): BusinessTypeDef | undefined {
  return BUSINESS_DEFS[type];
}

// Helper — compute drug output rate per hour (no salary deduction; output is in item units)
export function computeDrugOutputRate(params: {
  base_output_per_hour: number;
  production_level: ProductionLevel;
  workers: { production_bonus: number }[];
  upgrades: { income_bonus: number }[];
}): number {
  const { base_output_per_hour, production_level, workers, upgrades } = params;
  const prodMult    = PRODUCTION_META[production_level].income;
  const workerBonus = workers.reduce((s, w) => s + Math.max(0, w.production_bonus), 0);
  const upgBonus    = upgrades.reduce((s, u) => s + u.income_bonus, 0);
  return Math.max(0, base_output_per_hour * prodMult * (1 + workerBonus + upgBonus));
}

// Helper — compute effective income rate per hour
export function computeIncomeRate(params: {
  base_income_per_hour: number;
  production_level: ProductionLevel;
  workers: { production_bonus: number; salary: number }[];
  upgrades: { income_bonus: number }[];
}): number {
  const { base_income_per_hour, production_level, workers, upgrades } = params;
  const prodMult = PRODUCTION_META[production_level].income;
  const workerIncome = workers.reduce((s, w) => s + Math.max(0, w.production_bonus), 0);
  const upgIncome    = upgrades.reduce((s, u) => s + u.income_bonus, 0);
  const grossRate    = base_income_per_hour * prodMult * (1 + workerIncome + upgIncome);
  const salaryCost   = workers.reduce((s, w) => s + w.salary, 0);
  return Math.max(0, grossRate - salaryCost);
}

// Helper — compute effective heat rate per hour
export function computeHeatRate(params: {
  base_heat_per_hour: number;
  production_level: ProductionLevel;
  workers: { stealth_bonus: number }[];
  upgrades: { heat_reduction: number }[];
}): number {
  const { base_heat_per_hour, production_level, workers, upgrades } = params;
  const heatMult    = PRODUCTION_META[production_level].heat;
  const stealthRed  = Math.min(0.65, workers.reduce((s, w) => s + Math.max(0, w.stealth_bonus), 0));
  const upgradeRed  = Math.min(0.75, upgrades.reduce((s, u) => s + u.heat_reduction, 0));
  return base_heat_per_hour * heatMult * (1 - stealthRed) * (1 - upgradeRed);
}
