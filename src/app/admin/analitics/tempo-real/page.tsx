import type { Metadata } from "next";
import RealTimeActivity from "@/components/analytics/RealTimeActivity";

export const metadata: Metadata = {
  title: "Tempo Real — Analitics",
  description: "Atividade em tempo real da SecaHub.",
};

export default function RealTimePage() {
  return <RealTimeActivity />;
}
