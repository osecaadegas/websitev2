import type { Metadata } from "next";
import { CookiePolicy } from "@/components/CookiePolicy";

export const metadata: Metadata = {
  title: "Política de Cookies | SECAADEGAS",
  description: "Política de cookies do website SECAADEGAS.",
};

export default function CookiePolicyPage() {
  return <CookiePolicy hideTitle />;
}
