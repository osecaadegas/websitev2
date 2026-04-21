import type { Metadata } from "next";
import { Suspense } from "react";
import LigaDosSecasContent from "@/components/LigaDosSecas";

export const metadata: Metadata = {
  title: "Liga dos Secas",
  description: "Liga dos Secas — vencedores mensais da comunidade.",
  openGraph: {
    title: "Liga dos Secas | Arena Gladiator",
    description: "Liga dos Secas — os vencedores mensais da comunidade.",
  },
};

export default function LigaDoSecaPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-arena-gold/30 border-t-arena-gold rounded-full animate-spin" />
      </div>
    }>
      <LigaDosSecasContent />
    </Suspense>
  );
}
