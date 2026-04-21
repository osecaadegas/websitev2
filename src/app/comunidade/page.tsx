"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const CATEGORIES = [
  {
    href: "/roda-diaria",
    title: "Roda Diária",
    description: "Gira a roda todos os dias e ganha prémios exclusivos",
    icon: "🎡",
    color: "from-purple-600/20 to-purple-500/10",
    borderColor: "border-purple-500/30",
    hoverColor: "hover:border-purple-500/50",
  },
  {
    href: "/giveaways",
    title: "Giveaways",
    description: "Participa em sorteios e ganha prémios incríveis",
    icon: "🎁",
    color: "from-green-600/20 to-green-500/10",
    borderColor: "border-green-500/30",
    hoverColor: "hover:border-green-500/50",
  },
  {
    href: "/liga-dos-secas",
    title: "Liga dos Secas",
    description: "Compete no ranking e torna-te o melhor gladiador",
    icon: "🏆",
    color: "from-yellow-600/20 to-yellow-500/10",
    borderColor: "border-arena-gold/30",
    hoverColor: "hover:border-arena-gold/50",
  },
  {
    href: "/hall-of-victories",
    title: "Bruta do Mês",
    description: "Celebra as maiores vitórias da comunidade",
    icon: "👑",
    color: "from-red-600/20 to-red-500/10",
    borderColor: "border-red-500/30",
    hoverColor: "hover:border-red-500/50",
  },
  {
    href: "/adivinha-o-resultado",
    title: "Adivinha o Resultado",
    description: "Prevê os resultados dos bonus hunts e ganha pontos",
    icon: "🎯",
    color: "from-blue-600/20 to-blue-500/10",
    borderColor: "border-blue-500/30",
    hoverColor: "hover:border-blue-500/50",
  },
  {
    href: "/jogos",
    title: "Jogos da Comunidade",
    description: "Diverte-te com mini-jogos e compete com outros membros",
    icon: "🎮",
    color: "from-orange-600/20 to-orange-500/10",
    borderColor: "border-[#ff6a00]/30",
    hoverColor: "hover:border-[#ff6a00]/50",
  },
] as const;

export default function ComunidadePage() {
  return (
    <div className="pt-24 pb-16 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl text-arena-gold tracking-wide mb-4">
            Comunidade
          </h1>
          <p className="text-arena-smoke/70 text-lg max-w-2xl mx-auto">
            Participa nas atividades da comunidade e ganha prémios exclusivos
          </p>
        </div>

        {/* Category Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {CATEGORIES.map((category, index) => (
            <Link
              key={category.href}
              href={category.href}
              className="group block"
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`relative rounded-xl border ${category.borderColor} ${category.hoverColor} bg-gradient-to-br ${category.color} backdrop-blur-sm p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-arena-gold/5`}
              >
                {/* Icon */}
                <div className="text-5xl mb-4">{category.icon}</div>

                {/* Title */}
                <h3 className="font-[family-name:var(--font-display)] text-arena-gold text-xl tracking-wide mb-2 group-hover:text-white transition-colors">
                  {category.title}
                </h3>

                {/* Description */}
                <p className="text-arena-smoke/60 text-sm leading-relaxed mb-4">
                  {category.description}
                </p>

                {/* Arrow */}
                <div className="flex items-center text-arena-gold/60 text-sm font-medium group-hover:text-arena-gold transition-colors">
                  <span>Explorar</span>
                  <svg
                    className="w-4 h-4 ml-2 transform group-hover:translate-x-1 transition-transform"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>

                {/* Glow effect on hover */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-arena-gold/0 to-arena-gold/0 group-hover:from-arena-gold/5 group-hover:to-transparent transition-all duration-300 pointer-events-none" />
              </motion.div>
            </Link>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 text-center">
          <div className="inline-block rounded-lg bg-arena-charcoal/60 border border-arena-steel/20 p-6 max-w-2xl">
            <p className="text-arena-smoke/70 text-sm leading-relaxed">
              💡 <span className="text-arena-gold font-medium">Dica:</span> Participa em todas as atividades para ganhares mais pontos e subires no ranking da Liga dos Secas!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
