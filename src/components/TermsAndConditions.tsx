"use client";

import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeading } from "@/components/ui/SectionHeading";

const sections = [
  {
    title: "1. Introdu��o",
    content: `Bem-vindo ao SECAADEGAS! Antes de come�ar, pedimos que leia os Termos e Condi��es (T&C) antes de usar o nosso website. Leia atentamente para evitar confus�es e para que a sua experi�ncia de utilizador seja a melhor poss�vel! Se n�o concordar em aceitar e seguir todas as condi��es, n�o abra uma conta e/ou use o website. A continua��o do uso do website indicar� a aceita��o das condi��es. As condi��es foram promulgadas em 03.07.2024. Queremos que desfrute do tempo que passa aqui, e porque este � um website onde discutimos, mostramos v�deos e oferecemos ofertas relacionadas com casinos que envolvem jogo, existe um conjunto de leis e regulamentos que regulam as nossas atividades. Estes termos s�o explicados da forma mais clara poss�vel. Os termos do SECAADEGAS s�o a forma que temos de o informar sobre o que pode e n�o pode fazer no SECAADEGAS, como usaremos a sua informa��o pessoal e como gerimos o website. Se ainda tiver d�vidas ap�s ler os T&C, contacte a equipa de suporte atrav�s do seguinte formato: Envie um email para info@SECAADEGAS.com que se encontra no separador "Contacto" no fundo do website SECAADEGAS.`,
  },
  {
    title: "2. Os Princ�pios B�sicos",
    content: `Os Termos s�o um acordo vinculativo entre o SECAADEGAS e o utilizador, e ao usar o website, o utilizador concorda que leu e aceitou os termos e quaisquer altera��es aos mesmos. Se n�o concordar com os termos, n�o deve registar-se ou continuar a usar o website. Podemos alterar estes termos a qualquer momento. Quando o fizermos substancialmente, contactaremos o utilizador e inform�-lo-emos antecipadamente das novas condi��es.`,
  },
  {
    title: "3. Defini��es",
    content: `Os seguintes termos ser�o usados sob estas condi��es: "Oferta" cobre todas as ofertas promocionais que oferecem uma recompensa tang�vel, seja de natureza pecuni�ria ou n�o pecuni�ria, incluindo, mas n�o limitado a: pr�mios de sorteio, pr�mios de loja, ofertas de boas-vindas, neg�cios patrocinados pelo casino que s�o limitados a utilizadores do SECAADEGAS, rondas/b�nus gr�tis, recompensas pecuni�rias patrocinadas, etc. Para mais informa��es sobre as ofertas que promovemos no nosso site, contacte o suporte ao cliente de cada parceiro. "Termos" s�o estes termos, condi��es e regras com os quais concorda ao usar o website. "Website" https://www.SECAADEGAS.com, e incluindo, se aplic�vel, qualquer vers�o m�vel e aplica��o m�vel do mesmo. Palavras como "n�s", "nosso" referem-se ao SECAADEGAS, � equipa e ao website https://www.SECAADEGAS.com. "Utilizador" refere-se a qualquer pessoa f�sica ou jur�dica registada no nosso website, bem como visitantes que acedem ao website, sem registo pr�vio. Quando conveniente, as palavras "tu" e "teu" referem-se aos nossos utilizadores e/ou convidados. "A Sua Conta" � a sua conta de utilizador no website. "Pol�tica de Privacidade" refere-se � forma como tratamos os dados pessoais do utilizador no nosso website, de acordo com e em conformidade com as leis e regulamentos de prote��o de dados exigidos e relevantes. Sob a Lei de Prote��o de Dados, referimo-nos ao regulamento que rege esta mat�ria, conforme estipulado pelo RGPD (Regulamento Geral de Prote��o de Dados N� 679/2016/CE). Al�m disso, sob a lei de prote��o de dados, tamb�m nos referimos aos termos estabelecidos na Diretiva 58/2002/CE, alterada em 2006 e posteriormente alterada em 2009, que estipula a pol�tica de cookies do website. "Cookie" � um pequeno ficheiro de texto colocado no dispositivo do utilizador pelo nosso website. S�o usados para oferecer a melhor experi�ncia ao utilizador. "Dispositivo do Utilizador" � Um dispositivo port�til, computador, tablet ou qualquer dispositivo usado para aceder ao website.`,
  },
  {
    title: "4. Mini Jogos e Informa��o",
    content: `O website atua como um local de "jogo social" e n�o fornece servi�os de jogo online pagos. N�o somos um casino. Nenhum dinheiro real � movido no nosso website e nunca lhe pediremos para gastar fundos no nosso website. Para utilizadores que procuram ofertas de jogo real, fornecemos informa��es sobre websites que oferecem servi�os de jogo de casino, apenas para fins informativos e promocionais. Tamb�m fornecemos entretenimento atrav�s de conte�do em v�deo, an�lises de jogos e artigos apenas para fins informativos. O objetivo deste website � oferecer aos seguidores do SECAADEGAS uma experi�ncia divertida e informativa.\n\n4.1 Os pontos usados no website n�o podem ser obtidos ou trocados por dinheiro real de forma alguma. O saldo de pontos � reiniciado quando a loja fica sem stock e n�o tem valor monet�rio.\n\n4.2 O ganho m�ximo de cada aposta � de 100.000 pontos.`,
  },
  {
    title: "5. Pontos Virtuais",
    content: `Os pontos virtuais ganhos atrav�s do site n�o t�m valor monet�rio real e n�o podem ser trocados por dinheiro. S�o usados apenas dentro do site para comprar produtos ou servi�os oferecidos na "Loja".`,
  },
  {
    title: "6. Pol�tica de Reembolso",
    content: `N�o oferecemos reembolso para compras feitas na loja online, pois os produtos oferecidos s�o de natureza digital e servi�os.`,
  },
  {
    title: "7. Sec��es do Site",
    content: `Ao aceder ao site https://www.SECAADEGAS.com, o utilizador ter� acesso, na p�gina inicial ("Home"), �s ofertas de parceiros que temos dispon�veis no momento (atualizadas conforme necess�rio). Damos acesso a um Leaderboard, onde os utilizadores poder�o aceder mensalmente aos rankings de WAGER dos utilizadores afiliados nos casinos parceiros. Este ranking tamb�m � premiado mensalmente entre os primeiros utilizadores com maior Wager. A "Loja" � um conjunto de produtos virtuais oferecidos pelo SECAADEGAS que podem ser comprados atrav�s de pontos virtuais ao assistir streams e participar em atividades no site. A loja oferece produtos como dep�sitos de casino, torneios, produtos eletr�nicos, etc.`,
  },
  {
    title: "8. Dados de Fontes de Terceiros",
    content: `Podemos obter informa��es adicionais de fontes terceiras, como anunciantes, jogos ou servi�os que usa, ou redes sociais (como Discord, Twitch) aos quais o nosso acesso foi aprovado. Quando acede aos nossos servi�os atrav�s de redes sociais, ou quando conecta os nossos servi�os �s redes sociais, est� a autorizar o SECAADEGAS a recolher, armazenar e usar esta informa��o e conte�do adicional de acordo com a pol�tica de privacidade. Usamos esta informa��o para complementar a informa��o que recolhemos sobre o utilizador de forma a fornecer experi�ncias mais relevantes e seguras para o utilizador e melhorar os nossos servi�os, an�lises e publicidade.`,
  },
  {
    title: "9. Quem Pode Usar o Site",
    content: `Ao aceder ao website, o utilizador ou convidado, que � uma pessoa singular, confirma ter pelo menos 18 anos de idade e ter plena capacidade legal. O acesso ao website � proibido para pessoas menores de 18 anos ou menores da idade � qual o "jogo" � proibido no caso do utilizador. � da responsabilidade exclusiva do utilizador determinar se est� autorizado a "jogar" online na sua jurisdi��o, bem como verificar quaisquer outros requisitos legais em vigor.\n\nPara usar o site, o utilizador deve ser: maior de 18 anos ou maior que a idade legal para "jogar" no pa�s a partir do qual est� a jogar; uma pessoa real. N�o pode ser uma empresa ou outras entidades legais; Uma pessoa que utiliza um endere�o, um n�mero de telefone e/ou um endere�o IP.`,
  },
  {
    title: "10. Como Pode Usar o Website",
    content: `10.1.1 Clique no bot�o "Login".\n10.1.2 Inicie sess�o com os seus dados, por exemplo, Twitch.tv; Clique no bot�o "Iniciar Sess�o com a Conta Twitch".\n10.1.3 Ser� redirecionado para o Twitch.tv, onde ter� de iniciar sess�o com o seu nome de utilizador e password do Twitch.tv.\n10.1.4 Ap�s iniciar sess�o na sua conta Twitch.tv, clique em "Autorizar" para se conectar ao SECAADEGAS.\n10.1.5 Ser� ent�o redirecionado para o SECAADEGAS e iniciar� sess�o com as suas informa��es do Twitch.TV.\n\n10.2 Giveaways e Loja\n10.2.1 O SECAADEGAS facilitar� e promover� giveaways e pr�mios do SECAADEGAS e/ou patrocinados por casinos afiliados nas p�ginas "Loja" e "Home" do nosso website com o �nico prop�sito de mostrar gratid�o e recompensar os nossos utilizadores fi�is.\n10.2.2 Os termos e condi��es para giveaways podem ser encontrados aqui.\n10.2.3 Todos os itens/ofertas patrocinados na loja est�o sujeitos aos termos e condi��es do casino que patrocina o item/oferta.\n10.2.4 Itens patrocinados oferecidos na loja podem ser de natureza pecuni�ria ou n�o pecuni�ria.\n10.2.5 Qualquer entrada em giveaway est� dispon�vel apenas uma vez por pessoa, conta de utilizador, fam�lia, habita��o, endere�o, endere�o de email, computador/dispositivo e/ou endere�o IP.`,
  },
  {
    title: "11. Condi��es Gerais para o Utilizador",
    content: `11.1 O utilizador deve registar-se e usar este website apenas em seu nome e n�o em nome de qualquer outra pessoa.\n\n11.2 Deve manter os seus dados de in�cio de sess�o (nome, password ou outras credenciais) em seguran�a e n�o os partilhar com ningu�m. Se os partilhar, mesmo que n�o intencionalmente, ser� respons�vel por qualquer abuso indevido ou uso da sua conta. N�o aceitamos qualquer responsabilidade por qualquer perda e/ou informa��o perdida devido a uso n�o autorizado da sua conta resultante de uso incorreto dos seus dados de in�cio de sess�o. � da responsabilidade do utilizador garantir que mant�m os seus dados confidenciais e � sua responsabilidade proteger qualquer endere�o de e-mail, computador pessoal ou outro dispositivo no qual a sua conta de utilizador esteja acess�vel. O utilizador � totalmente respons�vel por qualquer uso indevido dos seus dados de in�cio de sess�o ou dispositivos. Se o utilizador estiver preocupado com o facto de as suas credenciais terem sido divulgadas a terceiros, deve notificar imediatamente o suporte para que possamos fornecer-lhe uma nova password. Salvo se causado por neglig�ncia da nossa parte, qualquer uso n�o autorizado dos seus dados de sess�o e qualquer uso n�o autorizado da sua conta s�o da exclusiva responsabilidade do utilizador e ser�o considerados como uso pr�prio.\n\n11.3 Se verificar que a informa��o fornecida no momento do registo ou da sua conta est� incorreta, deve informar-nos imediatamente ou alterar imediatamente as suas informa��es.\n\n11.4 � da responsabilidade do utilizador saber se a sua atividade no website � legal no pa�s ou territ�rio a partir do qual est� a aceder ao website.\n\n11.5 Apenas uma conta para os dados pessoais reais do utilizador � permitida. A abertura de conta s� � permitida para uma pessoa usando um endere�o e um endere�o IP. Quaisquer outras contas abertas no website ser�o consideradas como "contas duplicadas". Neste caso, o SECAADEGAS reserva-se o direito de fechar todas as contas duplicadas e aplicar as seguintes san��es: Cada a��o realizada usando uma conta duplicada � considerada nula, e reservamo-nos o direito de fechar todas as contas duplicadas, e/ou banir ou excluir a conta original do utilizador por mau uso deste website.\n\n11.6 Se, durante o per�odo de atividade de uma conta duplicada, produtos da loja foram obtidos a partir da conta duplicada, ser�o anulados e o SECAADEGAS reserva-se o direito de retirar o pr�mio e solicitar a devolu��o desses bens.\n\n11.7 O SECAADEGAS reserva-se o direito de cancelar a participa��o em qualquer promo��o, bem como de banir permanentemente qualquer utilizador do website. Tamb�m nos reservamos o direito de encerrar uma conta existente sem qualquer aviso por escrito ou qualquer explica��o.\n\n11.8 N�o � permitido transferir ou receber fundos de uma conta para outra e/ou transferir, vender ou comprar outras contas.\n\n11.9 N�o pode usar qualquer erro t�cnico ou vulnerabilidade para seu benef�cio. Teremos o direito de cancelar e reclamar todos os pr�mios obtidos desta forma.\n\n11.10 O utilizador n�o se envolver� em qualquer atividade fraudulenta, de conluio, fixa��o ou outra atividade ilegal em rela��o ao seu uso do website (ou terceiros). N�o usar� quaisquer m�todos ou t�cnicas assistidos por software ou dispositivos de hardware para auxiliar a sua participa��o em jogos, giveaways e/ou loja no website.\n\n11.11 O utilizador concorda que podemos tamb�m partilhar a sua informa��o com outras pessoas ou empresas, de acordo com a nossa pol�tica de privacidade, para realizar a nossa atividade e fornecer o website ao utilizador.`,
  },
  {
    title: "12. O Que Podemos Fazer",
    content: `12.1 Podemos recusar a abertura de uma conta por qualquer motivo.\n\n12.2 Podemos suspender ou terminar a conta do utilizador por qualquer viola��o ou suspeita de viola��o deste contrato ou qualquer outro motivo v�lido.\n\n12.3 Se tentar abrir uma conta diferente da sua primeira conta, bloquearemos ou fecharemos a conta. Tamb�m podemos bloquear ou encerrar a sua primeira conta.\n\n12.5 Podemos partilhar a sua informa��o pessoal com outras pessoas ou empresas, de acordo com a nossa Pol�tica de Privacidade e conforme acordado pelo seu uso do nosso website.\n\n12.6 Deve notar-se que, se o utilizador estiver a usar o website de uma forma que n�o se destine a ser informativa, divertida e recreativa, reservamo-nos o direito de banir ou eliminar a sua conta, remover quaisquer ganhos pecuni�rios ou n�o pecuni�rios obtidos com esta atividade, e a conta pode ser permanentemente encerrada.\n\n12.7 Declaramos a entrada numa atividade ou a sua transa��o na loja como totalmente nula (e/ou encerrar a sua conta) se acreditarmos que qualquer uma das seguintes situa��es se aplica: o utilizador ou pessoas associadas ao utilizador podem ter influenciado direta ou indiretamente o resultado de um evento; O utilizador ou pessoas associadas ao utilizador podem ter acesso a conhecimento privilegiado que pode influenciar o resultado de um evento; O utilizador ou pessoas associadas ao utilizador ignoram direta ou indiretamente os termos; O resultado de um evento foi direta ou indiretamente afetado por atividade criminosa; Houve uma mudan�a significativa nas probabilidades, por exemplo, devido a um an�ncio p�blico sobre um evento; Giveaway ou loja foi aceite que n�o ter�amos aceite, devido a um problema t�cnico que afetou o website nesse momento ou um erro, m� impress�o e/ou qualquer coisa fora do nosso controlo.\n\n12.8 Se suspeitarmos que o utilizador est� envolvido em atividades ilegais ou fraudulentas relacionadas com o seu uso do website (ou usando o website por terceiros) ou que est� envolvido em qualquer outro comportamento prejudicial ao website, podemos congelar ou encerrar a sua conta sem qualquer aviso.`,
  },
  {
    title: "13. Encerrar a Sua Conta",
    content: `13.1 Pode encerrar a sua conta a qualquer momento, contactando o suporte diretamente atrav�s do nosso "Contacto" no fundo do website SECAADEGAS.\n\n13.2 Quando encerrar a sua conta: o utilizador deve contactar o suporte e solicitar especificamente o encerramento da sua conta.\n\n13.3 Se estiver a encerrar a sua conta porque tem um problema de depend�ncia de jogo, veja a sec��o 15 destes termos.\n\n13.4 Se a sua conta foi encerrada por n�s devido a uma viola��o destes termos, reservamo-nos o direito de recusar a reativa��o da sua conta.\n\n13.5 Se a conta do utilizador for encerrada pelo utilizador ou por n�s, e o utilizador tiver ganhos pecuni�rios ou n�o pecuni�rios pendentes que n�o foram reclamados pelo utilizador, reservamo-nos o direito de remover esses ganhos e n�o os atribuir ao utilizador. Se a conta do utilizador foi encerrada devido a uma viola��o destes termos, reservamo-nos o direito de retirar todos e quaisquer ganhos e n�o os atribuir ao utilizador.`,
  },
  {
    title: "14. Links para os Websites dos Nossos Afiliados e Parceiros",
    content: `Fazemos todos os esfor�os para lhe fornecer liga��es para os melhores websites na internet; Os melhores em termos de oferta, qualidade e seguran�a. Como mencionado anteriormente, certifique-se de que l� as condi��es de uso de cada site, uma vez que a nossa pol�tica de privacidade n�o se estende aos nossos websites afiliados e parceiros. Tenha tamb�m em mente que o SECAADEGAS trabalha com casinos nacionais, pelo que � da responsabilidade do utilizador reconhecer se est� autorizado a aceder a tais sites.\n\n14.1 Direitos do Utilizador\nO utilizador reserva os seguintes direitos em rela��o aos seus dados: direito de acesso. Pode pedir-nos para lhe fornecer os seus dados pessoais que mantemos no nosso armazenamento seguro. Pode pedir-nos para apagar, modificar ou atualizar os dados. Se, por raz�es legais, formos obrigados a recusar o seu pedido, fornecer-lhe-emos uma refer�ncia e explica��o para o facto. Direito de corre��o � Se algum detalhe dos seus dados n�o estiver correto, pode pedir-nos para atualizar os dados. Direito de apagar � Com base no seu pedido, apagaremos os seus dados completa e irrevogavelmente; Ap�s isso, n�o poder� usar o nosso website. Contacte o suporte para solicitar a remo��o da sua conta e eliminar os seus dados. Os nossos representantes de suporte receber�o a ordem e apagar�o completamente a sua conta e todos os vest�gios que deixou no SECAADEGAS.`,
  },
  {
    title: "15. Jogo Respons�vel",
    content: `15.1 O jogo pode ser viciante. Se sentir que o jogo est� a afetar negativamente a sua vida, procure ajuda. Sem vergonha, sem julgamento, apenas apoio.\n\n15.2 Fa�a um teste de autoavalia��o. Se est� preocupado sobre se tem um problema de jogo ou se pensa que j� tem um problema de jogo, procure ajuda junto das entidades competentes em Portugal. Se estiver preocupado, considere a possibilidade de eliminar a sua conta contactando o suporte.\n\nOnde posso encontrar ajuda em Portugal?\n\n� Servi�o de Interven��o nos Comportamentos Aditivos e nas Depend�ncias (SICAD): https://www.sicad.pt\n� Linha Vida � SOS Jogo: 800 202 790 (chamada gratuita, dispon�vel 24h)\n� SRIJ � Servi�o de Regula��o e Inspe��o de Jogos: https://www.srij.turismodeportugal.pt\n� Instituto de Apoio ao Jogador (IAJ): (+351) 968 230 998\n� Jogadores An�nimos Portugal: https://www.jogadoresanonimos.pt\n� Em situa��es de emerg�ncia, contacte o 112.\n\n15.3 Se precisar de ajuda para superar a depend�ncia do jogo, n�o hesite em contactar qualquer uma das entidades acima. Todas oferecem apoio confidencial e gratuito.`,
  },
  {
    title: "16. Como Submeter uma Reclama��o",
    content: `16.1 Se tiver alguma reclama��o sobre o(s) servi�o(s) fornecido(s) neste website, contacte o departamento de suporte, enviando um email para expor a situa��o a ser tratada. Pode ter acesso ao email em "Contacto". O nosso objetivo � responder a todos os pedidos dentro de 10 dias �teis ap�s a rece��o da sua comunica��o. Se a natureza do pedido de informa��o requerer mais tempo para a sua conclus�o, este per�odo pode ser estendido por mais dez dias. O Utilizador ser� informado nos primeiros dez dias a partir da data de rece��o da reclama��o, se este per�odo tiver de ser estendido.\n\n16.2 De forma a tratar a sua reclama��o de forma r�pida e eficiente, forne�a-nos informa��o clara sobre a sua identidade, bem como todos os detalhes relevantes que deram origem ao problema. Faremos todos os esfor�os para resolver prontamente a quest�o comunicada e chegar a um acordo amig�vel.\n\n16.3 Qualquer reclama��o que o utilizador possa ter em rela��o a ofertas de parceiros deve ser apresentada dentro de 7 dias ap�s os resultados finais da oferta (por exemplo, se o utilizador tiver uma reclama��o sobre a entrada num giveaway ou uma reclama��o sobre os resultados de um minijogo). Caso contr�rio, n�o consideramos a reclama��o v�lida.`,
  },
  {
    title: "17. Pol�tica de Privacidade",
    content: `Pode ler a nossa Pol�tica de Privacidade aqui. O utilizador deve estar ciente de que a aceita��o dos termos inclui a aceita��o total dos termos da nossa pol�tica de privacidade. Portanto, pedimos-lhe que leia a Pol�tica de Privacidade cuidadosamente.`,
  },
  {
    title: "18. Responsabilidade do Utilizador para Connosco",
    content: `18.1 O utilizador acede ao website e participa por sua conta e risco. O website � fornecido "tal como est�". As �nicas promessas que fazemos sobre o website est�o descritas nestes termos. N�o garantimos (em linguagem simples, n�o prometemos legalmente) que: o software ou website � adequado para o objetivo e est� livre de erros; O website estar� acess�vel sem interrup��es.\n\n18.2 N�o seremos respons�veis por nada, o que inclui quaisquer perdas, custos, despesas ou danos, sejam diretos, indiretos, especiais, consequentes, incidentais ou de outra forma resultantes do seu uso do website.\n\n18.3 O Utilizador concorda em compensar-nos totalmente (em linguagem simples, compensar-nos por qualquer perda) e diretores, empregados, parceiros e prestadores de servi�os por qualquer custo, despesa, perda, danos, reclama��es e responsabilidades, independentemente da causa que possa surgir relativamente ao seu uso do site ou participa��o nos jogos. Se n�o concordar com isto, n�o deve usar o website.`,
  },
  {
    title: "19. Viola��es, Penalidades e Cessa��o",
    content: `19.1 Se suspeitarmos que o utilizador violou estes termos, podemos recusar a abertura, suspender ou encerrar a conta do utilizador.\n\n19.2 Tamb�m temos o direito de proibir ou encerrar a conta do utilizador se: suspeitarmos que o utilizador est� envolvido em atividades ilegais ou fraudulentas; Acreditarmos que o utilizador abusou do site; O utilizador estiver a violar qualquer um dos termos contidos aqui no nosso website.\n\n19.3 A nossa decis�o � definitiva.`,
  },
  {
    title: "20. Propriedade Intelectual",
    content: `20.1 https://www.SECAADEGAS.com ou qualquer outro subdom�nio � o nosso localizador uniforme de recursos e nenhum uso n�o autorizado deste URL pode ser feito em qualquer outro website ou plataforma digital sem o nosso consentimento pr�vio por escrito. Hiperliga��es para o website e quaisquer das suas p�ginas n�o podem ser inclu�das em qualquer outro website sem o nosso consentimento pr�vio por escrito.\n\n20.2 Somos o propriet�rio ou o leg�timo detentor dos direitos da tecnologia, software e sistemas usados no website.\n\n20.3 O utilizador concorda em n�o usar qualquer dispositivo autom�tico ou manual para monitorizar as nossas p�ginas web ou qualquer conte�do. Qualquer uso ou reprodu��o n�o autorizado pode ser objeto de a��o legal.`,
  },
  {
    title: "21. Divisibilidade",
    content: `Se qualquer disposi��o destas condi��es for considerada ilegal ou inaplic�vel, essa disposi��o ser� separada destas condi��es e todas as outras disposi��es permanecer�o em vigor sem serem afetadas por esta separa��o.`,
  },
  {
    title: "22. Acordo Integral e Admissibilidade",
    content: `22.1 As condi��es constituem o acordo completo entre n�s em rela��o a este website e, exceto em caso de fraude, anulam todas as comunica��es e propostas anteriores, sejam eletr�nicas, orais ou escritas, entre n�s.\n\n22.2 Uma vers�o impressa destas condi��es e qualquer notifica��o feita em formato eletr�nico ser� admiss�vel em procedimentos legais ou administrativos.`,
  },
  {
    title: "23. Cess�o",
    content: `Podemos ceder ou transferir este acordo. O utilizador n�o pode ceder ou transferir este acordo.`,
  },
  {
    title: "24. Contacto",
    content: `Para qualquer pedido ou d�vida: envolvendo o esclarecimento ou problema de qualquer quest�o relacionada com estes termos e condi��es e/ou o site, ou um problema com os sites de casino que promovemos, pode contactar-nos pelo seguinte email: info@SECAADEGAS.com. Para qualquer quest�o envolvendo marketing e/ou interesse em colabora��o, poder� usar o mesmo email.`,
  },
  {
    title: "25. Uso Proibido da Conta",
    content: `25.1.1 Proibi��o de Bot/Intelig�ncia Artificial. O utilizador n�o pode usar software de Bot ou intelig�ncia artificial, obtido comercialmente ou desenvolvido de forma privada, ao jogar ou usar o website. "Bots" s�o programas de software ou outros dispositivos que interferem com o software de jogo e/ou o nosso website. Bots podem usar termos ou intelig�ncia artificial para tomar decis�es de jogo ou alterar o nosso website sem o nosso consentimento. Procuraremos ativamente este tipo de software de acordo com estes termos. O consentimento para estes Termos tamb�m estabelece que o utilizador n�o interferir� com qualquer um dos mecanismos de dete��o. Esta cl�usula aplica-se independentemente de o bot ser efetivamente usado em conjunto com jogos ou n�o.\n\n25.1.2 Outros tipos de software proibido incluem, mas n�o se limitam a, software que: d� ao utilizador qualquer tipo de vantagem injusta; Partilha lacunas com utilizadores ou convidados, ou auxilia o conluio de qualquer forma; Usa uma base de dados de perfis de utilizador que � partilhada entre utilizadores; Reduz ou elimina a necessidade de um ser humano tomar decis�es; � projetado para Datamine (por exemplo: recolher informa��o sobre os perfis de utilizador do site al�m do que observou do seu perfil de utilizador) para qualquer prop�sito, seja pessoal ou comercial. Isto tamb�m se aplica a quaisquer dados obtidos por datamining. Al�m disso, � proibido partilhar quaisquer dados legitimamente recolhidos com outros utilizadores; Tenta bloquear qualquer um dos nossos mecanismos de dete��o de abuso.\n\n25.1.3 Proibi��o de Conluio. � proibido aos utilizadores agirem como equipa, com ou sem acordo expl�cito pr�vio, em detrimento real ou poss�vel de outros utilizadores do website. O utilizador deve: n�o trabalhar em conjunto com outro utilizador para obter uma vantagem; N�o partilhar informa��o pessoal com qualquer outro utilizador; N�o encorajar qualquer outro utilizador ao conluio.\n\n25.1.4 Proibi��o de Partilha de Conta. Os utilizadores n�o devem partilhar a sua conta sob quaisquer circunst�ncias com qualquer outra pessoa, uma vez que tal equivaleria a "abuso de m�ltiplas contas". Portanto, � proibido a qualquer utilizador obter uma vantagem ao partilhar uma conta com qualquer pessoa. Um utilizador n�o pode usar qualquer conta que n�o seja a sua e deve manter as suas credenciais (pseud�nimo, password e qualquer outra informa��o usada para aceder � conta de utilizador) e n�o as revelar a ningu�m.\n\n25.1.5 Proibi��o de Vantagens Injustas. Qualquer tentativa de obter uma vantagem injusta sobre outros utilizadores � estritamente proibida, seja especificamente proibida pelas condi��es ou n�o. Qualquer atividade destinada a dar a um utilizador uma vantagem injusta, mas que possa ser permitida sob uma interpreta��o estrita das condi��es, devido a uma lacuna ou a caracter�sticas de software n�o intencionais, continua a ser proibida.\n\n25.1.6 Proibi��o de Jogadores Problem�ticos. Qualquer pessoa com problemas de jogo est� proibida de registar uma conta sob quaisquer circunst�ncias. Se um utilizador descobrir que tem um problema de jogo, � obrigado a informar-nos e a parar de jogar imediatamente.\n\n25.1.7 A conta do utilizador pode ser bloqueada/encerrada sem aviso � temos o direito de bloquear e/ou encerrar permanentemente a conta do utilizador a nosso crit�rio e sem aviso. Isto � feito para parar o uso da conta enquanto o SECAADEGAS conduz investiga��es e por qualquer outro motivo que consideremos apropriado. O SECAADEGAS n�o � respons�vel por informa��o incorreta sobre b�nus, ofertas ou promo��es listadas no site. O SECAADEGAS recomenda que o utilizador reveja todos os termos e condi��es de todos os b�nus listados nos websites dos casinos parceiros.`,
  },
];

export function TermsAndConditions({ hideTitle = false }: { hideTitle?: boolean } = {}) {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {!hideTitle && (
          <ScrollReveal>
            <SectionHeading
              title="Termos & Condi��es"
              subtitle="Leia atentamente antes de utilizar o website"
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

