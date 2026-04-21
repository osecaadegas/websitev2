import type { Metadata } from "next";
import { Suspense } from "react";
import DailySessionContent from "@/components/DailySession";

export const metadata: Metadata = {
  title: "Sessão do Dia",
  description: "Acompanha a sessão de hoje em direto — depósitos, levantamentos, resultado líquido e o casino em destaque.",
  openGraph: {
    title: "Sessão do Dia | Secahub",
    description: "Sessão de streaming ao vivo — estatísticas, casino ativo e playlist.",
  },
};

export default function DailySessionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-arena-gold/30 border-t-arena-gold rounded-full animate-spin" />
      </div>
    }>
      <DailySessionContent />
    </Suspense>
  );
}
