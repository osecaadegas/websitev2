import type { Metadata } from "next";
import AdminLigaConfig from "@/components/AdminLigaConfig";

export const metadata: Metadata = {
  title: "Admin — Liga dos Secas",
};

export default function AdminLigaPage() {
  return <AdminLigaConfig />;
}
