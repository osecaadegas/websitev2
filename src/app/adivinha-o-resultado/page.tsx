import type { Metadata } from "next";
import { GuessTheSpoils } from "@/components/GuessTheSpoils";

export const metadata: Metadata = {
  title: "Adivinha o Resultado | Guess the Spoils",
  description:
    "Adivinha o resultado do Bonus Hunt e ganha prémios na SecaHub. Survive the Arena and Claim Your Glory!",
};

export default function AdivinhaResultadoPage() {
  return (
    <div className="pt-16 min-h-screen">
      <GuessTheSpoils hideTitle />
    </div>
  );
}
