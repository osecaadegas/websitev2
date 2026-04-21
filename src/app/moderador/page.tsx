import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Moderador Area",
  description: "Painel de moderação da SecaHub.",
};

export default function ModeradorPage() {
  return (
    <div className="pt-24 pb-16 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mt-4 space-y-6 text-arena-smoke text-lg leading-relaxed">
          <p>Área restrita para moderadores da SecaHub.</p>
        </div>
      </div>
    </div>
  );
}
