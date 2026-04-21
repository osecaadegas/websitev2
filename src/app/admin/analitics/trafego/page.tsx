import type { Metadata } from "next";
import TrafficSources from "@/components/analytics/TrafficSources";

export const metadata: Metadata = {
  title: "Tráfego — Analitics",
  description: "Fontes de tráfego da Secahub.",
};

export default function TrafficPage() {
  return <TrafficSources />;
}
