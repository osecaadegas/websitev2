import type { Metadata } from "next";
import { PrivacyPolicy } from "@/components/PrivacyPolicy";

export const metadata: Metadata = {
  title: "Política de Privacidade | SECAADEGAS",
  description: "Política de privacidade do website SECAADEGAS.",
};

export default function PrivacyPage() {
  return <PrivacyPolicy hideTitle />;
}
