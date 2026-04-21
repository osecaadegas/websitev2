import type { Metadata } from "next";
import { StreamerHub } from "@/components/StreamerHub";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live Stream",
  description: "Watch the gladiator battle live on Twitch. Real-time casino streaming, bonus hunts, and slot battles.",
  openGraph: {
    title: "Live Stream | Secahub",
    description: "Watch the gladiator battle live on Twitch.",
  },
};

export default function LivePage() {
  return (
    <div className="pt-16">
      <StreamerHub />
    </div>
  );
}
