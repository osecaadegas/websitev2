"use client";

import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeading } from "@/components/ui/SectionHeading";

const sections = [
  {
    title: "O que s�o cookies?",
    content: `Como � pr�tica comum em quase todos os websites profissionais, este site usa cookies, que s�o pequenos ficheiros descarregados para o seu computador, para melhorar a sua experi�ncia. Esta p�gina descreve que informa��o recolhem, como a usamos, e porque precisamos por vezes de armazenar estes cookies. Tamb�m partilharemos como pode impedir que estes cookies sejam armazenados, embora isso possa afetar a funcionalidade de certos elementos do site.`,
  },
  {
    title: "Como usamos cookies?",
    content: `Usamos cookies por v�rias raz�es, detalhadas abaixo. Infelizmente, na maioria dos casos, n�o existem op��es padr�o da ind�stria para desativar cookies sem desativar a funcionalidade e as caracter�sticas que adicionam a este site. � recomendado que deixe todos os cookies se n�o tiver a certeza se precisa deles ou n�o, pois s�o usados para fornecer um servi�o que utiliza.`,
  },
  {
    title: "Desativar cookies",
    content: `Pode impedir a defini��o de cookies ajustando as configura��es no seu browser (consulte a sec��o "Ajuda" do browser para instru��es sobre como faz�-lo). Esteja ciente de que desativar cookies afetar� a funcionalidade deste e de muitos outros websites que visita. Desativar cookies geralmente resulta na desativa��o de certas funcionalidades e caracter�sticas deste site. Portanto, � recomendado que n�o desative cookies.`,
  },
  {
    title: "Cookies relacionados com a conta",
    content: `Se criar uma conta connosco, usamos cookies para gerir o processo de registo e administra��o geral. Estes cookies ser�o geralmente removidos quando encerrar sess�o no sistema, mas em alguns casos, podem permanecer depois para lembrar prefer�ncias do site quando sai.`,
  },
  {
    title: "Cookies de login",
    content: `Usamos cookies para lembrar o seu estado de login para que n�o tenha de iniciar sess�o toda vez que visita uma nova p�gina. Estes cookies s�o tipicamente removidos ou limpos quando encerra sess�o para garantir que s� pode aceder a recursos e �reas restritas quando est� com sess�o iniciada.`,
  },
  {
    title: "Cookies relacionados com promo��es",
    content: `Este site oferece servi�os de subscri��o para informa��o promocional ou email, e cookies podem ser usados para lembrar se j� est� registado e se devem ser mostradas certas notifica��es v�lidas apenas para utilizadores registados/n�o registados.`,
  },
  {
    title: "Cookies relacionados com inqu�ritos",
    content: `Periodicamente, oferecemos inqu�ritos e question�rios para fornecer informa��es interessantes, ferramentas �teis, ou para compreender a nossa base de utilizadores com mais precis�o. Estes inqu�ritos podem usar cookies para lembrar quem j� participou num inqu�rito ou para fornecer resultados precisos ap�s mudan�as de p�gina.`,
  },
  {
    title: "Cookies relacionados com formul�rios",
    content: `Quando dados s�o submetidos atrav�s de um formul�rio como os encontrados em p�ginas de contacto ou formul�rios de coment�rios, cookies podem ser definidos para lembrar detalhes do utilizador para correspond�ncia futura.`,
  },
  {
    title: "Cookies de prefer�ncias do site",
    content: `Para fornecer uma �tima experi�ncia neste site, disponibilizamos a funcionalidade de definir prefer�ncias sobre como este site funciona quando � usado. Para lembrar estas prefer�ncias, precisamos de definir cookies para que esta informa��o possa ser chamada sempre que ocorre uma intera��o quando uma p�gina � afetada por estas prefer�ncias.`,
  },
  {
    title: "Compromisso do Utilizador",
    content: `O utilizador compromete-se a usar o conte�do e a informa��o fornecida pelo SECAADEGAS no site de forma apropriada e com os seguintes compromissos, mas n�o limitados a:\n\nA) N�o praticar atividades que sejam ilegais ou contr�rias � boa-f� e � ordem p�blica;\n\nB) N�o disseminar propaganda ou conte�do de natureza racista, xen�foba, ou relacionado com jogo ilegal, pornografia ilegal, apologia ao terrorismo, ou contra os direitos humanos;\n\nC) N�o causar danos aos sistemas f�sicos (hardware) e l�gicos (software) do SECAADEGAS, dos seus fornecedores, ou de terceiros, atrav�s da introdu��o ou dissemina��o de v�rus inform�ticos ou quaisquer outros sistemas de hardware ou software capazes de causar os danos supramencionados.`,
  },
  {
    title: "Bloquear cookies",
    content: `O utilizador pode bloquear e/ou desativar cookies de qualquer site, incluindo o nosso, a qualquer momento. Para tal, aceda �s defini��es do seu browser. Veja abaixo guias de ajuda para os principais browsers:\n\n� Google Chrome\n� Firefox\n� Microsoft Edge\n� Opera\n� Safari`,
  },
  {
    title: "Mais informa��es",
    content: `Esperamos que isto tenha esclarecido as coisas para si e, como mencionado anteriormente, se n�o tiver a certeza se precisa ou n�o de um cookie, � geralmente mais seguro deixar os cookies ativados caso interaja com uma das funcionalidades que usa no nosso site.`,
  },
];

export function CookiePolicy({ hideTitle = false }: { hideTitle?: boolean } = {}) {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {!hideTitle && (
          <ScrollReveal>
            <SectionHeading
              title="Pol�tica de Cookies"
              subtitle="Como usamos cookies para melhorar a sua experi�ncia"
            />
          </ScrollReveal>
        )}

        <div className="mt-10 space-y-8">
          {sections.map((section, i) => (
            <ScrollReveal key={i}>
              <div className="bg-arena-charcoal/60 rounded-xl border border-arena-steel/20 p-6 sm:p-8">
                <h2 className="gladiator-label text-arena-gold text-lg font-bold mb-4">
                  {section.title}
                </h2>
                <div className="text-arena-smoke text-sm leading-relaxed whitespace-pre-line">
                  {section.content}
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal>
          <div className="mt-12 text-center text-arena-ash text-xs">
            <p>�ltima atualiza��o: 03 de julho de 2024</p>
            <p className="mt-1">
              Para quest�es contacte{" "}
              <a
                href="mailto:info@SECAADEGAS.com"
                className="text-arena-gold hover:underline"
              >
                info@SECAADEGAS.com
              </a>
            </p>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

