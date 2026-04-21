"use client";

import Link from "next/link";

export default function CrimesPage() {
  return (
    <div className="flex-1 text-white py-12 px-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-black mb-4 bg-gradient-to-r from-[#ff6a00] to-[#ff8533] bg-clip-text text-transparent">
          💰 Crimes
        </h1>
        <p className="text-[#888888] mb-8">
          Lista completa de crimes disponíveis e histórico de atividade criminal.
        </p>
        <div className="p-8 rounded-xl bg-[#121212] border border-[#222222] text-center">
          <p className="text-[#888888] mb-4">Esta secção está em desenvolvimento.</p>
          <Link
            href="/jogos/crime-empire/dashboard"
            className="inline-block px-6 py-3 rounded-lg bg-[#ff6a00] text-white font-medium hover:bg-[#ff8533] transition-all"
          >
            Voltar ao Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
