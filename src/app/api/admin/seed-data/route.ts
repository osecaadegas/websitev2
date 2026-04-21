import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * POST /api/admin/seed-data — Populate empty tables with seed data
 */
export async function POST() {
  const results: Record<string, { inserted: number; error?: string }> = {};

  try {
    // 1. Seed page_settings
    const { data: existingPages } = await supabase.from("page_settings").select("page_slug");
    if (!existingPages || existingPages.length === 0) {
      const pages = [
        { page_slug: "home", page_name: "Home" },
        { page_slug: "jogos", page_name: "Jogos" },
        { page_slug: "comunidade", page_name: "Comunidade" },
        { page_slug: "daily-session", page_name: "Sessão do Dia" },
        { page_slug: "adivinha-o-resultado", page_name: "Adivinha o Resultado" },
        { page_slug: "moderador", page_name: "Moderador" },
        { page_slug: "hall-of-victories", page_name: "Bruta do Mês" },
        { page_slug: "perfil", page_name: "Perfil" },
        { page_slug: "politica-de-privacidade", page_name: "Política de Privacidade" },
        { page_slug: "politica-de-cookies", page_name: "Política de Cookies" },
        { page_slug: "termos-e-condicoes", page_name: "Termos e Condições" },
        { page_slug: "sobre", page_name: "Sobre" },
        { page_slug: "ofertas", page_name: "Ofertas" },
        { page_slug: "live", page_name: "Live" },
        { page_slug: "stream", page_name: "Stream" },
        { page_slug: "loja", page_name: "Loja" },
        { page_slug: "calendario", page_name: "Calendário" },
        { page_slug: "bonus-hunt", page_name: "Bonus Hunt" },
        { page_slug: "giveaways", page_name: "Giveaways" },
        { page_slug: "destaques", page_name: "Destaques" },
        { page_slug: "roda-diaria", page_name: "Roda Diária" },
        { page_slug: "liga-dos-secas", page_name: "Liga dos Secas" },
        { page_slug: "admin", page_name: "Admin" },
      ];
      const { error } = await supabase.from("page_settings").insert(pages);
      results.page_settings = error ? { inserted: 0, error: error.message } : { inserted: pages.length };
    } else {
      results.page_settings = { inserted: 0, error: "Already populated" };
    }

    // 2. Seed crimes
    const { data: existingCrimes } = await supabase.from("crimes").select("name");
    if (!existingCrimes || existingCrimes.length === 0) {
      const crimes = [
        {
          name: "Roubar Carteira",
          description: "Rouba a carteira de um turista distraído",
          difficulty: "petty",
          required_level: 1,
          base_success_rate: 0.85,
          jail_risk: 0.05,
          stamina_cost: 5,
          min_dirty_cash: 50,
          max_dirty_cash: 150,
          xp_reward: 10,
          respect_reward: 1,
        },
        {
          name: "Assaltar Loja",
          description: "Assalta uma loja de conveniência",
          difficulty: "small",
          required_level: 2,
          base_success_rate: 0.7,
          jail_risk: 0.15,
          stamina_cost: 10,
          min_dirty_cash: 200,
          max_dirty_cash: 500,
          xp_reward: 25,
          respect_reward: 3,
        },
        {
          name: "Roubar Carro",
          description: "Rouba um carro estacionado",
          difficulty: "small",
          required_level: 3,
          base_success_rate: 0.65,
          jail_risk: 0.2,
          stamina_cost: 15,
          min_dirty_cash: 500,
          max_dirty_cash: 1200,
          xp_reward: 40,
          respect_reward: 5,
        },
        {
          name: "Assaltar Casa",
          description: "Invade uma casa e rouba objetos de valor",
          difficulty: "medium",
          required_level: 5,
          base_success_rate: 0.55,
          jail_risk: 0.25,
          stamina_cost: 20,
          min_dirty_cash: 1000,
          max_dirty_cash: 2500,
          xp_reward: 75,
          respect_reward: 8,
        },
        {
          name: "Assaltar Banco",
          description: "Rouba um banco com uma equipa",
          difficulty: "big",
          required_level: 10,
          base_success_rate: 0.4,
          jail_risk: 0.4,
          stamina_cost: 30,
          min_dirty_cash: 5000,
          max_dirty_cash: 15000,
          xp_reward: 200,
          respect_reward: 20,
        },
        {
          name: "Roubar Joalharia",
          description: "Assalta uma joalharia de luxo",
          difficulty: "big",
          required_level: 15,
          base_success_rate: 0.35,
          jail_risk: 0.45,
          stamina_cost: 35,
          min_dirty_cash: 10000,
          max_dirty_cash: 25000,
          xp_reward: 350,
          respect_reward: 30,
        },
        {
          name: "Heist do Casino",
          description: "O maior assalto - rouba um casino",
          difficulty: "legendary",
          required_level: 25,
          base_success_rate: 0.25,
          jail_risk: 0.55,
          stamina_cost: 50,
          min_dirty_cash: 50000,
          max_dirty_cash: 150000,
          xp_reward: 1000,
          respect_reward: 100,
        },
      ];
      const { error } = await supabase.from("crimes").insert(crimes);
      results.crimes = error ? { inserted: 0, error: error.message } : { inserted: crimes.length };
    } else {
      results.crimes = { inserted: 0, error: "Already populated" };
    }

    // 3. Seed businesses
    const { data: existingBusinesses } = await supabase.from("businesses").select("name");
    if (!existingBusinesses || existingBusinesses.length === 0) {
      const businesses = [
        {
          name: "Quinta de Cannabis",
          type: "weed_farm",
          description: "Produz e vende cannabis",
          purchase_price: 10000,
          base_income_per_hour: 500,
          max_employees: 5,
          employee_cost_per_hour: 50,
          required_level: 5,
        },
        {
          name: "Fábrica de Pílulas",
          type: "pill_factory",
          description: "Produz pílulas ilegais",
          purchase_price: 25000,
          base_income_per_hour: 1200,
          max_employees: 8,
          employee_cost_per_hour: 100,
          required_level: 10,
        },
        {
          name: "Mining de Crypto",
          type: "crypto_mining",
          description: "Minera criptomoedas",
          purchase_price: 50000,
          base_income_per_hour: 2000,
          max_employees: 3,
          employee_cost_per_hour: 150,
          required_level: 15,
        },
        {
          name: "Escritório de Scams",
          type: "scam_office",
          description: "Executa esquemas de fraude online",
          purchase_price: 35000,
          base_income_per_hour: 1500,
          max_employees: 10,
          employee_cost_per_hour: 80,
          required_level: 12,
        },
        {
          name: "Nightclub",
          type: "nightclub",
          description: "Club noturno para lavagem de dinheiro",
          purchase_price: 100000,
          base_income_per_hour: 5000,
          max_employees: 15,
          employee_cost_per_hour: 200,
          required_level: 20,
        },
      ];
      const { error } = await supabase.from("businesses").insert(businesses);
      results.businesses = error ? { inserted: 0, error: error.message } : { inserted: businesses.length };
    } else {
      results.businesses = { inserted: 0, error: "Already populated" };
    }

    // 4. Seed items
    const { data: existingItems } = await supabase.from("items").select("name");
    if (!existingItems || existingItems.length === 0) {
      const items = [
        {
          name: "Pistola",
          description: "Arma básica",
          category: "weapon",
          power_bonus: 5,
          base_price: 1000,
        },
        {
          name: "Colete à Prova de Bala",
          description: "Proteção básica",
          category: "armor",
          power_bonus: 0,
          base_price: 2000,
        },
        {
          name: "Laptop Hackeado",
          description: "Aumenta inteligência",
          category: "special",
          power_bonus: 0,
          intelligence_bonus: 10,
          base_price: 3000,
        },
        {
          name: "Fato de Luxo",
          description: "Aumenta carisma",
          category: "special",
          power_bonus: 0,
          charisma_bonus: 10,
          base_price: 5000,
        },
      ];
      const { error } = await supabase.from("items").insert(items);
      results.items = error ? { inserted: 0, error: error.message } : { inserted: items.length };
    } else {
      results.items = { inserted: 0, error: "Already populated" };
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
