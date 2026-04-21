import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Outros — Admin",
  description: "Outras configurações de administração.",
};

export default function OutrosPage() {
  return (
    <div className="pt-24 pb-16 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mt-4 text-arena-smoke text-lg">
          <p>Configurações diversas — em breve.</p>
        </div>
      </div>
    </div>
  );
}
