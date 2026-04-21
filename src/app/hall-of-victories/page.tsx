import type { Metadata } from "next";
import HallOfVictoriesContent from "@/components/HallOfVictoriesContent";

export const metadata: Metadata = {
  title: "Bruta do Mês | SecaAdegas",
  description: "A melhor vitória do mês escolhida pela comunidade SecaAdegas. Partilha os teus melhores momentos e recebe honra dos guerreiros.",
  openGraph: {
    title: "Bruta do Mês | SecaAdegas",
    description: "A melhor vitória do mês escolhida pela comunidade SecaAdegas.",
  },
};

export default function HallOfVictoriesPage() {
  return (
    <main className="pt-20 pb-16 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <HallOfVictoriesContent />
      </div>
    </main>
  );
}
