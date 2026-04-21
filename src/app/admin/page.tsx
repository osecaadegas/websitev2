"use client";

import type { Metadata } from "next";
import Link from "next/link";
import { motion } from "framer-motion";

const ADMIN_CATEGORIES = [
  {
    href: "/admin/analitics",
    title: "Analitics",
    description: "Análises e estatísticas detalhadas da plataforma",
    icon: "📊",
    color: "from-blue-600/20 to-blue-500/10",
    borderColor: "border-blue-500/30",
    hoverColor: "hover:border-blue-500/50",
  },
  {
    href: "/admin/utilizadores",
    title: "Utilizadores",
    description: "Gestão de utilizadores, roles e permissões",
    icon: "👥",
    color: "from-purple-600/20 to-purple-500/10",
    borderColor: "border-purple-500/30",
    hoverColor: "hover:border-purple-500/50",
  },
  {
    href: "/admin/settings",
    title: "Settings",
    description: "Configurações de páginas, imagens e efeitos",
    icon: "⚙️",
    color: "from-gray-600/20 to-gray-500/10",
    borderColor: "border-gray-500/30",
    hoverColor: "hover:border-gray-500/50",
  },
  {
    href: "/admin/parcerias",
    title: "Parcerias",
    description: "Gestão de ofertas e parcerias de casinos",
    icon: "🤝",
    color: "from-green-600/20 to-green-500/10",
    borderColor: "border-green-500/30",
    hoverColor: "hover:border-green-500/50",
  },
  {
    href: "/admin/loja",
    title: "Armaria",
    description: "Gestão de produtos e recompensas da loja",
    icon: "🛡️",
    color: "from-yellow-600/20 to-yellow-500/10",
    borderColor: "border-arena-gold/30",
    hoverColor: "hover:border-arena-gold/50",
  },
  {
    href: "/admin/outros",
    title: "Outros",
    description: "Calendário, bonus hunts, liga e outras configs",
    icon: "🔧",
    color: "from-red-600/20 to-red-500/10",
    borderColor: "border-red-500/30",
    hoverColor: "hover:border-red-500/50",
  },
] as const;

export default function AdminPage() {
  return (
    <div className="pt-24 pb-16 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl text-arena-gold tracking-wide mb-4">
            Admin Area
          </h1>
          <p className="text-arena-smoke/70 text-lg max-w-2xl mx-auto">
            Painel de administração da Secahub
          </p>
        </div>

        {/* Admin Category Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ADMIN_CATEGORIES.map((category, index) => (
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
      </div>
    </div>
  );
}
