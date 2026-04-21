"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ArenaCard } from "@/components/ui/ArenaCard";
import { ArenaButton } from "@/components/ui/ArenaButton";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { STAGGER_CONTAINER, STAGGER_ITEM } from "@/lib/animations";

/**
 * AFFILIATE / CASINO SECTION — SEO-optimized casino cards.
 *
 * Each casino has a dedicated landing page (/casinos/[slug]).
 * This component shows the overview grid with:
 * - Rating, bonus info, pros/cons
 * - Structured data (schema markup) is on the page-level
 */

// Demo casinos — in production, fetched from Supabase
const CASINOS = [
  {
    slug: "stake-casino",
    name: "Stake Casino",
    rating: 4.8,
    bonus: "200% up to $2,000",
    pros: ["Crypto-friendly", "Fast payouts", "Huge game library"],
    cons: ["No UKGC license"],
    countries: ["Worldwide"],
  },
  {
    slug: "roobet",
    name: "Roobet",
    rating: 4.5,
    bonus: "Instant Rakeback",
    pros: ["Clean UI", "Original games", "Provably fair"],
    cons: ["Limited to crypto"],
    countries: ["Most countries"],
  },
  {
    slug: "duelbits",
    name: "DuelBits",
    rating: 4.3,
    bonus: "Up to $500 bonus",
    pros: ["eSports betting", "Low min deposit", "VIP program"],
    cons: ["Newer platform"],
    countries: ["Worldwide"],
  },
  {
    slug: "rollbit",
    name: "Rollbit",
    rating: 4.6,
    bonus: "NFT Rewards + Bonus",
    pros: ["Unique NFT features", "Sports betting", "High RTP slots"],
    cons: ["Complex UI"],
    countries: ["Most countries"],
  },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          className={`w-4 h-4 ${i < Math.floor(rating) ? "text-arena-gold" : "text-arena-steel"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="ml-1 text-sm text-arena-gold font-bold">{rating}</span>
    </div>
  );
}

export function CasinoSection({ hideTitle = false }: { hideTitle?: boolean } = {}) {
  return (
    <section id="casinos" className="relative py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div className="relative max-w-6xl mx-auto">
        {!hideTitle && (
          <ScrollReveal>
            <SectionHeading
              title="Battle Arenas"
              subtitle="Handpicked casinos for gladiators. Honest reviews, verified bonuses."
            />
          </ScrollReveal>
        )}

        <motion.div
          variants={STAGGER_CONTAINER}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {CASINOS.map((casino) => (
            <motion.div key={casino.slug} variants={STAGGER_ITEM}>
              <ArenaCard variant="gold" className="p-6 h-full flex flex-col arena-shine">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="gladiator-title text-xl">
                      {casino.name}
                    </h3>
                    <StarRating rating={casino.rating} />
                  </div>
                  <div className="bg-arena-crimson/20 border border-arena-crimson/30 px-3 py-1.5">
                    <p className="gladiator-label text-xs text-arena-gold">
                      BONUS
                    </p>
                    <p className="text-sm font-bold text-arena-white">{casino.bonus}</p>
                  </div>
                </div>

                {/* Pros / Cons */}
                <div className="grid grid-cols-2 gap-4 mb-4 flex-1">
                  <div>
                    <p className="gladiator-label text-xs text-arena-ash mb-2">
                      Pros
                    </p>
                    <ul className="space-y-1">
                      {casino.pros.map((pro) => (
                        <li key={pro} className="text-sm text-green-400 flex items-start gap-1.5">
                          <span className="text-green-500 mt-0.5">✓</span>
                          {pro}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="gladiator-label text-xs text-arena-ash mb-2">
                      Cons
                    </p>
                    <ul className="space-y-1">
                      {casino.cons.map((con) => (
                        <li key={con} className="text-sm text-arena-red flex items-start gap-1.5">
                          <span className="text-arena-red mt-0.5">✗</span>
                          {con}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Countries */}
                <div className="mb-4">
                  <p className="text-xs text-arena-ash mb-1">Available: {casino.countries.join(", ")}</p>
                </div>

                {/* CTA */}
                <div className="flex gap-3 mt-auto">
                  <div className="flex-1">
                    <ArenaButton variant="secondary" size="sm" className="w-full">
                      Full Review
                    </ArenaButton>
                  </div>
                  <ArenaButton variant="primary" size="sm" className="flex-1">
                    Claim Bonus
                  </ArenaButton>
                </div>
              </ArenaCard>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
