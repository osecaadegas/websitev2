import Link from "next/link";
import Image from "next/image";
import { NAV_LINKS, SITE_NAME } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="bg-arena-black border-t border-arena-neon/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        {/* Single row: logo + nav + legal */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <Image
            src="/images/logo.svg"
            alt={SITE_NAME}
            width={110}
            height={28}
            className="h-5 w-auto"
          />

          <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[11px] text-arena-ash hover:text-arena-neon transition-colors duration-200 whitespace-nowrap"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex gap-3">
            <Link href="/termos-e-condicoes" className="text-[10px] text-arena-ash hover:text-arena-neon transition-colors duration-200 whitespace-nowrap">
              Termos &amp; Condições
            </Link>
            <Link href="/politica-de-privacidade" className="text-[10px] text-arena-ash hover:text-arena-neon transition-colors duration-200 whitespace-nowrap">
              Política de Privacidade
            </Link>
            <Link href="/politica-de-cookies" className="text-[10px] text-arena-ash hover:text-arena-neon transition-colors duration-200 whitespace-nowrap">
              Política de Cookies
            </Link>
          </div>
        </div>

        {/* Bottom: copyright + disclaimer in one line */}
        <div className="mt-2 pt-2 border-t border-arena-steel/20 flex flex-col sm:flex-row items-center justify-between gap-1">
          <p className="text-[10px] text-arena-ash">
            &copy; {new Date().getFullYear()} SECAADEGAS, Todos os direitos reservados
          </p>
          <p className="text-[9px] text-arena-ash/50 text-center">
            O jogo envolve risco. Joga apenas com dinheiro que podes perder. 18+ para participar. Joga com responsabilidade.
          </p>
        </div>
      </div>
    </footer>
  );
}
