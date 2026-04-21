/**
 * JSON-LD schema generators for SEO structured data.
 * Used on casino review pages and the main site.
 */

import { SITE_NAME, SITE_URL } from "@/lib/constants";

export function generateWebsiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: "The ultimate iGaming casino streamer arena. Live streams, bonus hunts, and gladiator rankings.",
  };
}

export function generateCasinoReviewSchema(casino: {
  name: string;
  slug: string;
  rating: number;
  bonus: string;
  reviewBody: string;
  faq: { question: string; answer: string }[];
}) {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Review",
      itemReviewed: {
        "@type": "Product",
        name: casino.name,
        description: `${casino.name} casino review — bonuses, games, and ratings.`,
      },
      reviewRating: {
        "@type": "Rating",
        ratingValue: casino.rating,
        bestRating: 5,
        worstRating: 1,
      },
      author: {
        "@type": "Organization",
        name: SITE_NAME,
      },
      reviewBody: casino.reviewBody,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: casino.faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: casino.name,
      description: `Play at ${casino.name} with exclusive bonuses: ${casino.bonus}`,
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: casino.rating,
        reviewCount: 150,
        bestRating: 5,
        worstRating: 1,
      },
    },
  ];
}
