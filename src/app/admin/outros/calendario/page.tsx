import type { Metadata } from "next";
import AdminCalendarioConfig from "@/components/AdminCalendarioConfig";

export const metadata: Metadata = {
  title: "Calendário — Admin",
  description: "Gestão do calendário de streams.",
};

export default function AdminCalendarioPage() {
  return (
    <div className="pt-24 pb-16 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mt-4">
          <AdminCalendarioConfig />
        </div>
      </div>
    </div>
  );
}
