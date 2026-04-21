import type { Metadata } from "next";
import AnalyticsOverview from "@/components/analytics/AnalyticsOverview";

export const metadata: Metadata = {
  title: "Analitics — Admin",
  description: "Visão geral de análises e estatísticas da SecaHub.",
};

export default function AnaliticsPage() {
  return <AnalyticsOverview />;
}
