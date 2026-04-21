import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sobre",
  description: "Conhece a história por trás da SecaHub. Quem somos, a nossa missão e o que nos move no mundo do iGaming.",
  openGraph: {
    title: "Sobre | SecaHub",
    description: "Conhece a história por trás da SecaHub.",
  },
};

export default function SobrePage() {
  return (
    <div className="pt-24 pb-16 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mt-4 space-y-6 text-arena-smoke text-lg leading-relaxed">
          <p>
            Bem-vindo à SecaHub — a comunidade definitiva de iGaming em português. 
            Nascemos da paixão pelo entretenimento e pela adrenalina dos jogos de casino online.
          </p>
          <p>
            A nossa missão é criar uma experiência única para a comunidade, com streams ao vivo, 
            torneios exclusivos, e as melhores ofertas do mercado.
          </p>
        </div>
      </div>
    </div>
  );
}
