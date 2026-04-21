import type { Metadata } from "next";
import UserAnalytics from "@/components/analytics/UserAnalytics";

export const metadata: Metadata = {
  title: "Utilizadores — Analitics",
  description: "Análise de utilizadores da SecaHub.",
};

export default function UserAnalyticsPage() {
  return <UserAnalytics />;
}
