import type { Metadata } from "next";
import AdminBrutaDoMesConfig from "@/components/AdminBrutaDoMesConfig";

export const metadata: Metadata = {
  title: "Admin — Bruta do Mês",
};

export default function AdminBrutaDoMesPage() {
  return <AdminBrutaDoMesConfig />;
}
