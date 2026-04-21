import type { Metadata } from "next";
import FraudMonitoring from "@/components/analytics/FraudMonitoring";

export const metadata: Metadata = {
  title: "Fraude — Analitics",
  description: "Monitorização de fraude da Secahub.",
};

export default function FraudPage() {
  return <FraudMonitoring />;
}
