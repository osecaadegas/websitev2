import Link from "next/link";
import Image from "next/image";
import { NAV_LINKS, SITE_NAME } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="bg-arena-dark border-t border-arena-gold/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Top row: logo + nav links */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <Image
            src="/images/logo.png"
            alt={SITE_NAME}
            width={140}
            height={35}
            className="h-7 w-auto"
          />

          <nav className="flex flex-wrap justify-center gap-x-5 gap-y-1.5">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs text-arena-ash hover:text-arena-gold transition-colors duration-200 whitespace-nowrap"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Middle row: copyright + legal links */}
        <div className="mt-4 pt-3 border-t border-arena-steel/30 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-[10px] text-arena-ash">
            &copy; {new Date().getFullYear()} SECAADEGAS, Todos os direitos reservados
          </p>
          <div className="flex gap-4">
            <Link
              href="/termos-e-condicoes"
              className="text-[10px] text-arena-ash hover:text-arena-gold transition-colors duration-200"
            >
              Termos &amp; Condições
            </Link>
            <Link
              href="/politica-de-privacidade"
              className="text-[10px] text-arena-ash hover:text-arena-gold transition-colors duration-200"
            >
              Política de Privacidade
            </Link>
            <Link
              href="/politica-de-cookies"
              className="text-[10px] text-arena-ash hover:text-arena-gold transition-colors duration-200"
            >
              Política de Cookies
            </Link>
          </div>
        </div>

        {/* Bottom: disclaimer */}
        <div className="mt-3 pt-3 border-t border-arena-steel/30">
          <p className="text-[9px] text-arena-ash/60 text-center leading-relaxed">
            O jogo envolve risco. Joga apenas com dinheiro que podes perder. 18+ para participar. Joga com responsabilidade.
          </p>
        </div>
      </div>
    </footer>
  );
}
