import type { Metadata } from "next";
import GiveawayArena from "@/components/GiveawayArena";

export const metadata: Metadata = {
  title: "Giveaways — SecaHub",
  description: "Participa nos giveaways da SecaHub e ganha prémios incríveis.",
};

export default function GiveawaysPage() {
  return (
    <div className="pt-24 pb-16 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <GiveawayArena />
      </div>
    </div>
  );
}
