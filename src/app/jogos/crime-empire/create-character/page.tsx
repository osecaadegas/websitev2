"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

const CLASSES = [
  {
    id: "thief",
    name: "Ladrão",
    image: "/images/crime_empire/characters/thief.png",
    description: "Especialista em roubos e furtos",
    bonuses: ["+15% sucesso em crimes pequenos", "+10% ganho de dinheiro sujo"],
    color: "from-purple-600 to-purple-800",
  },
  {
    id: "hooligan",
    name: "Hooligan",
    image: "/images/crime_empire/characters/hooligan.png",
    description: "Violento e respeitado nas ruas",
    bonuses: ["+20% ganho de Respeito", "+15% boost em todos os itens equipados"],
    color: "from-red-600 to-red-800",
  },
  {
    id: "businessman",
    name: "Empresário",
    image: "/images/crime_empire/characters/businessman.png",
    description: "Mestre dos negócios ilegais",
    bonuses: ["+20% lucro em negócios regulares", "+30% capacidade de empregados"],
    color: "from-blue-600 to-blue-800",
  },
  {
    id: "hitman",
    name: "Assassino",
    image: "/images/crime_empire/characters/hitman.png",
    description: "Profissional em contratos mortais",
    bonuses: ["+15% sucesso em contratos", "-50% risco de prisão em contratos"],
    color: "from-gray-700 to-gray-900",
  },
  {
    id: "scammer",
    name: "Burlão",
    image: "/images/crime_empire/characters/scammer.png",
    description: "Especialista em fraudes e esquemas",
    bonuses: ["+15% sucesso em scams", "+10% taxa de lavagem de dinheiro"],
    color: "from-yellow-600 to-yellow-800",
  },
  {
    id: "brute",
    name: "Bruto",
    image: "/images/crime_empire/characters/brute.png",
    description: "Dominância física total",
    bonuses: ["+50% poder em PvP", "Esmaga qualquer oponente em combate"],
    color: "from-orange-600 to-orange-800",
  },
  {
    id: "dealer",
    name: "Traficante",
    image: "/images/crime_empire/characters/dealer.png",
    description: "Rei do mercado negro",
    bonuses: ["Vende drogas nas ruas (em breve)", "Menor risco e maiores quantidades"],
    color: "from-green-600 to-green-800",
  },
  {
    id: "pimp",
    name: "Chulo",
    image: "/images/crime_empire/characters/pimp.png",
    description: "Controla o negócio do prazer",
    bonuses: ["+20% income de brothel", "2x capacidade de workers"],
    color: "from-pink-600 to-pink-800",
  },
];

export default function CreateCharacter() {
  const router = useRouter();
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!selectedClass || creating) return;

    setCreating(true);

    try {
      const res = await fetch("/api/crime-empire/player", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ class: selectedClass }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error);
        setCreating(false);
        return;
      }

      // Redirect to dashboard
      router.push("/jogos/crime-empire/dashboard");
    } catch (error) {
      console.error("Error creating character:", error);
      alert("Erro ao criar personagem");
      setCreating(false);
    }
  };

  return (
    <div className="flex-1 text-white py-12 px-6">
      <div className="max-w-7xl mx-auto">
        <Link href="/jogos" className="inline-flex items-center gap-2 text-[#ff6a00] hover:text-[#ff8533] transition-colors text-sm mb-6">
          ← Voltar aos Jogos
        </Link>

        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-5xl md:text-6xl font-black mb-2 bg-gradient-to-r from-[#ff6a00] to-[#ff8533] bg-clip-text text-transparent">
            CRIAR PERSONAGEM
          </h1>
          <p className="text-lg text-[#888888] mb-8">
            Escolhe a tua classe e começa a tua jornada criminal
          </p>
        </motion.div>

        {/* New Player Info */}
        <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-green-900/20 to-emerald-900/20 border-2 border-green-500">
          <h3 className="text-xl font-bold text-green-400 mb-3">⚡ Bónus de Novo Jogador (2 horas)</h3>
          <ul className="space-y-1 text-green-300">
            <li>✓ +30% taxa de sucesso em crimes</li>
            <li>✓ +20% ganho de XP</li>
            <li>✓ Risco reduzido de prisão</li>
          </ul>
        </div>

        {/* Class Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {CLASSES.map((classData) => {
            const isSelected = selectedClass === classData.id;

            return (
              <motion.div
                key={classData.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.05 }}
                onClick={() => setSelectedClass(classData.id)}
                className={`p-6 rounded-2xl cursor-pointer transition-all ${
                  isSelected
                    ? `bg-gradient-to-br ${classData.color} border-4 border-white shadow-2xl`
                    : "bg-[#121212] border-2 border-[#222222] hover:border-[#ff6a00]"
                }`}
              >
                <div className="w-20 h-20 rounded-full overflow-hidden mb-4 flex items-center justify-center">
                  <Image
                    src={classData.image}
                    alt={classData.name}
                    width={80}
                    height={80}
                    className="w-full h-full object-contain"
                  />
                </div>
                <h3 className="text-2xl font-black mb-2">{classData.name}</h3>
                <p className="text-sm text-[#cccccc] mb-4">{classData.description}</p>

                <div className="space-y-2">
                  <p className="text-xs font-bold text-[#ff6a00] uppercase">Bónus:</p>
                  {classData.bonuses.map((bonus, idx) => (
                    <p key={idx} className="text-xs text-[#aaaaaa]">
                      • {bonus}
                    </p>
                  ))}
                </div>

                {isSelected && (
                  <div className="mt-4 text-center">
                    <span className="text-sm font-bold text-white">✓ SELECIONADO</span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Create Button */}
        {selectedClass && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-12 text-center"
          >
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-12 py-4 rounded-2xl bg-gradient-to-r from-[#ff6a00] to-[#ff8533] text-white font-black text-xl hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? "A CRIAR..." : "COMEÇAR JORNADA CRIMINAL"}
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
