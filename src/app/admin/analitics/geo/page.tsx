import type { Metadata } from "next";
import GeoAnalytics from "@/components/analytics/GeoAnalytics";

export const metadata: Metadata = {
  title: "Geo — Analitics",
  description: "Análise geográfica de visitantes da SecaHub.",
};

export default function GeoPage() {
  return <GeoAnalytics />;
}
