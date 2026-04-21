import type { Metadata } from "next";
import AdminWheelConfig from "@/components/AdminWheelConfig";

export const metadata: Metadata = {
  title: "Daily Wheel — Admin",
  description: "Gestão da roda diária.",
};

export default function AdminDailyWheelPage() {
  return (
    <div className="pt-24 pb-16 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mt-4">
          <AdminWheelConfig />
        </div>
      </div>
    </div>
  );
}
