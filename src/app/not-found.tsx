import Image from "next/image";
import Link from "next/link";
import { ArenaButton } from "@/components/ui/ArenaButton";

export default function NotFound() {
  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">

      <div className="relative text-center z-10">
        {/* Gladiator portrait */}
        <div className="mx-auto w-32 h-32 sm:w-40 sm:h-40 mb-8 relative">
          <Image
            src="/images/pages/helmet-bronze.jpg"
            alt="Fallen gladiator helmet"
            fill
            className="object-cover rounded-full border-2 border-arena-gold/30 opacity-80"
          />
          <div className="absolute inset-0 rounded-full bg-gradient-to-t from-arena-black/60 to-transparent" />
        </div>

        <h1 className="gladiator-title text-8xl mb-4">
          404
        </h1>
        <h2 className="gladiator-subtitle text-2xl mb-2">
          FALLEN IN BATTLE
        </h2>
        <p className="text-arena-ash mb-8 max-w-md mx-auto">
          This gladiator has left the arena. The page you seek does not exist.
        </p>
        <Link href="/">
          <ArenaButton variant="primary" size="lg">
            ⚔️ Return to Arena
          </ArenaButton>
        </Link>
      </div>
    </div>
  );
}
