import type { Metadata } from "next";
import { SpinWheel } from "@/components/SpinWheel";

export const metadata: Metadata = {
  title: "Roda Diária",
  description: "Roda da sorte diária da SecaHub. Gira e ganha prémios todos os dias!",
};

export default function RodaDiariaPage() {
  return (
    <div className="min-h-screen relative pt-16 flex flex-col">
      {/* SpinWheel — fills remaining area */}
      <div className="relative flex-1 pt-24">
        <SpinWheel />
      </div>
    </div>
  );
}
