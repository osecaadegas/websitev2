import type { Metadata } from "next";
import { BonusHuntTracker } from "@/components/BonusHuntTracker";

export const metadata: Metadata = {
  title: "Bonus Hunt Tracker",
  description: "Track every bonus in real-time. Watch the gladiator conquer each slot in the bonus hunt.",
  openGraph: {
    title: "Bonus Hunt Tracker | SecaHub",
    description: "Real-time bonus hunt tracking with live results.",
  },
};

export default function BonusHuntPage() {
  return (
    <div className="pt-16">
      <BonusHuntTracker hideTitle />
    </div>
  );
}
