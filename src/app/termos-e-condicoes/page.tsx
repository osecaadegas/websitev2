import type { Metadata } from "next";
import { TermsAndConditions } from "@/components/TermsAndConditions";

export const metadata: Metadata = {
  title: "Termos & Condições | SECAADEGAS",
  description: "Termos e condições de utilização do website SECAADEGAS.",
};

export default function TermsPage() {
  return <TermsAndConditions hideTitle />;
}
