import type { Metadata } from "next";
import { OfferCards } from "@/components/OfferCard";

export const metadata: Metadata = {
  title: "Ofertas",
  description: "As melhores ofertas e bónus exclusivos dos casinos online. Promoções verificadas e atualizadas.",
  openGraph: {
    title: "Ofertas | SecaHub",
    description: "As melhores ofertas e bónus exclusivos dos casinos online.",
  },
};

export default function OfertasPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Content */}
      <div className="relative z-10 pt-16 pb-16">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-6">
          <OfferCards />
        </div>
      </div>
    </div>
  );
}
