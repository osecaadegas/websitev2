"use client";

import Link from "next/link";

export default function GamblingPage() {
  return (
    <div className="flex-1 text-white py-12 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Link
            href="/jogos/crime-empire/dashboard"
            className="text-sm text-[#888888] hover:text-[#ff6a00] mb-2 inline-block"
          >
            ← Voltar ao Dashboard
          </Link>
          <h1 className="text-5xl md:text-6xl font-black bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-400 bg-clip-text text-transparent">
            🎰 CASINO
          </h1>
          <p className="text-lg text-[#888888] mt-2">
            Arrisca a tua fortuna nos jogos do casino
          </p>
        </div>

        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center p-12 rounded-2xl bg-[#1a1a1a] border-2 border-yellow-500/30">
            <div className="text-8xl mb-6">🚧</div>
            <h2 className="text-3xl font-bold text-yellow-400 mb-3">Em Construção</h2>
            <p className="text-[#888888] text-lg">
              O casino está a ser preparado. Volta em breve!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
