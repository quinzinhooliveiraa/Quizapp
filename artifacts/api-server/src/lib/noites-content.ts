export type Noite = {
  n: number;
  semana: number;
  semanaTitulo: string;
  titulo: string;
  minutos: number;
  ritual: string;
  perguntas: string[];
  acao: string;
  adulto: boolean;
};

export const NOITES: Noite[] = [
  {
    n: 1,
    semana: 1,
    semanaTitulo: "Reaproximar",
    titulo: "Os 3 minutos sem celular",
    minutos: 5,
    ritual:
      "Celulares em outro cômodo. Sentem de frente, ponham 3 minutos no timer e só fiquem ali: olhando, respirando, sem resolver nada. Quando o timer tocar, façam as perguntas.",
    perguntas: [
      "Qual foi o melhor e o pior momento do seu dia, e eu estava em algum deles?",
      "O que você queria ter me contado hoje e não deu tempo?",
    ],
    acao: "Amanhã, às 15h, mande uma mensagem curta dizendo uma coisa que lembrou do outro.",
    adulto: false,
  },
  {
    n: 2,
    semana: 1,
    semanaTitulo: "Reaproximar",
    titulo: "Como você está de verdade",
    minutos: 10,
    ritual:
      "Cada um dá uma nota de 0 a 10 para energia e outra para humor, e explica a nota. Regra da noite: quem escuta não dá conselho, só diz 'entendi'.",
    perguntas: [
      "O que está pesando em você essa semana que eu ainda não sei?",
      "O que eu poderia fazer amanhã para deixar seu dia 10% mais leve?",
    ],
    acao: "Faça amanhã a coisa que o outro disse que ajudaria.",
    adulto: false,
  },
  {
    n: 3,
    semana: 1,
    semanaTitulo: "Reaproximar",
    titulo: "Agradecimento em voz alta",
    minutos: 10,
    ritual:
      "Cada um agradece 3 coisas específicas que o outro fez nos últimos dias. Específico vale: 'obrigado por ter buscado meu remédio', não 'obrigado por tudo'.",
    perguntas: [
      "Qual coisa pequena que eu faço você nunca agradeceu, mas percebe todo dia?",
      "Quando você se sentiu mais cuidado(a) por mim neste mês?",
    ],
    acao: "Deixe um bilhete escondido onde o outro vai achar amanhã (bolsa, espelho, carteira).",
    adulto: false,
  },
  {
    n: 4,
    semana: 1,
    semanaTitulo: "Reaproximar",
    titulo: "O abraço de 20 segundos",
    minutos: 10,
    ritual:
      "Antes de qualquer pergunta, abracem por 20 segundos, contados. Parece pouco; é mais do que a maioria dos casais abraça no dia. Depois conversem.",
    perguntas: [
      "Que tipo de toque seu corpo mais pede de mim ultimamente?",
      "Em que horário do dia a gente mais se desencontra?",
    ],
    acao: "Amanhã, abrace 20 segundos quando se despedir ou se reencontrar.",
    adulto: false,
  },
  {
    n: 5,
    semana: 1,
    semanaTitulo: "Reaproximar",
    titulo: "Jantar sem tela",
    minutos: 30,
    ritual:
      "Jantem à mesa, sem TV e sem celular (nem para música). Uma pergunta por prato: entrada, principal, sobremesa. Pode ser pedido, não precisa cozinhar.",
    perguntas: [
      "Qual jantar nosso você nunca esqueceu?",
      "Se hoje fosse a nossa noite ideal em casa, como ela seria do começo ao fim?",
    ],
    acao: "Escolham juntos qual ritual das noites 1 a 4 vai virar fixo na semana.",
    adulto: false,
  },
  {
    n: 6,
    semana: 1,
    semanaTitulo: "Reaproximar",
    titulo: "Três fotos, três histórias",
    minutos: 15,
    ritual:
      "Cada um escolhe 3 fotos nossas no celular e conta a história por trás de cada uma, como se o outro não estivesse lá.",
    perguntas: [
      "Qual foto nossa faz você sorrir sozinho(a)?",
      "O que você sentiu quando percebeu que estava gostando de mim?",
    ],
    acao: "Mande para o outro a sua foto favorita com uma frase só.",
    adulto: false,
  },
  {
    n: 7,
    semana: 1,
    semanaTitulo: "Reaproximar",
    titulo: "Carta da semana 1",
    minutos: 15,
    ritual:
      "Cada um escreve 5 linhas para o outro sobre o que mudou nesta semana e lê em voz alta. Sem corrigir, sem responder: só ouvir até o fim.",
    perguntas: [
      "O que essa semana mostrou que a gente tinha esquecido?",
      "Qual noite foi a sua favorita até aqui, e por quê?",
    ],
    acao: "Combinem um horário fixo para as próximas noites (a mesma hora todo dia ajuda).",
    adulto: false,
  },
  {
    n: 8,
    semana: 2,
    semanaTitulo: "Se conhecer de novo",
    titulo: "Quiz do outro",
    minutos: 15,
    ritual:
      "Cada um escreve 5 palpites sobre o outro (comida de conforto, maior medo, sonho antigo, o que faria com um dia livre, música da vida). Depois conferem.",
    perguntas: [
      "Qual resposta minha te surpreendeu?",
      "O que você acha que eu ainda não sei sobre você?",
    ],
    acao: "Amanhã, conte uma coisa pequena sobre você que o outro nunca ouviu.",
    adulto: false,
  },
  {
    n: 9,
    semana: 2,
    semanaTitulo: "Se conhecer de novo",
    titulo: "Você aos 12 anos",
    minutos: 20,
    ritual:
      "Cada um conta quem era aos 12: o que gostava, do que tinha medo, o que queria ser. Se tiver foto antiga, mostre.",
    perguntas: [
      "O que aquela criança diria sobre a gente hoje?",
      "Que medo antigo ainda mora em você?",
    ],
    acao: "Procure uma foto da infância e mostre ao outro amanhã.",
    adulto: false,
  },
  {
    n: 10,
    semana: 2,
    semanaTitulo: "Se conhecer de novo",
    titulo: "Manual de instruções",
    minutos: 20,
    ritual:
      "Cada um escreve 3 frases: 'Quando estou mal, me ajuda…', 'Me irrita quando…', 'Me sinto amado(a) quando…'. Troquem os papéis e leiam.",
    perguntas: [
      "Qual frase do seu manual eu nunca tinha entendido de verdade?",
      "O que você gostaria que eu fizesse sem precisar pedir?",
    ],
    acao: "Fotografem os dois manuais e deixem salvos no celular. Releiam antes da próxima briga.",
    adulto: false,
  },
  {
    n: 11,
    semana: 2,
    semanaTitulo: "Se conhecer de novo",
    titulo: "Como cada um recebe carinho",
    minutos: 15,
    ritual:
      "Cada um ordena do que mais pesa ao que menos pesa: palavras, tempo juntos, toque, gestos práticos, presentes. Comparem as listas.",
    perguntas: [
      "Quando eu fiz algo que você sentiu como amor sem eu perceber?",
      "O que eu faço de carinho que talvez não esteja chegando do jeito que eu penso?",
    ],
    acao: "Amanhã, faça um gesto na linguagem do outro, não na sua.",
    adulto: false,
  },
  {
    n: 12,
    semana: 2,
    semanaTitulo: "Se conhecer de novo",
    titulo: "Sonhos na gaveta",
    minutos: 20,
    ritual:
      "Cada um conta um sonho que parou no caminho (curso, viagem, projeto, mudança) e por que parou. O outro só pergunta 'e como seria se desse certo?'.",
    perguntas: [
      "Qual sonho seu ficou na gaveta e o que faltou?",
      "Como eu poderia te empurrar nele sem virar cobrança?",
    ],
    acao: "Dê 10 minutos ao sonho do outro amanhã: pesquise, ligue, anote o primeiro passo.",
    adulto: false,
  },
  {
    n: 13,
    semana: 2,
    semanaTitulo: "Se conhecer de novo",
    titulo: "A noite dos primeiros",
    minutos: 20,
    ritual:
      "Relembrem os primeiros: primeiro beijo, primeira viagem, primeira briga, primeira vez que disseram 'eu te amo'. Cada um conta a sua versão.",
    perguntas: [
      "Qual foi a nossa primeira briga e o que ela nos ensinou?",
      "O que da gente no começo você quer de volta?",
    ],
    acao: "Repitam algo do começo esta semana: o mesmo lugar, a mesma comida ou a mesma música.",
    adulto: false,
  },
  {
    n: 14,
    semana: 2,
    semanaTitulo: "Se conhecer de novo",
    titulo: "Trilha sonora de nós",
    minutos: 20,
    ritual:
      "Cada um escolhe 3 músicas que contam a história do casal. Ouçam juntos e digam por que escolheram.",
    perguntas: [
      "Qual música me lembra de você, e que cena ela traz?",
      "O que você descobriu de mim nesta semana?",
    ],
    acao: "Montem uma playlist compartilhada e cada um adiciona uma por dia.",
    adulto: false,
  },
  {
    n: 15,
    semana: 3,
    semanaTitulo: "Conversas difíceis",
    titulo: "As regras da conversa difícil",
    minutos: 15,
    ritual:
      "Antes de qualquer assunto pesado, escrevam 3 regras e assinem: ninguém interrompe; falo de mim ('eu sinto'), não de você ('você sempre'); pausa de 20 minutos é permitida e a gente volta.",
    perguntas: [
      "O que faz você fechar a cara ou se calar numa discussão?",
      "O que ajudaria você a continuar na conversa sem explodir?",
    ],
    acao: "Escolham uma palavra-código para pedir pausa. Anotem juntos.",
    adulto: false,
  },
  {
    n: 16,
    semana: 3,
    semanaTitulo: "Conversas difíceis",
    titulo: "O assunto que a gente contorna",
    minutos: 25,
    ritual:
      "Cada um escreve num papel um assunto que evita. Troquem os papéis. Hoje ninguém resolve nada: só perguntam 'o que você sente quando pensa nisso?' e escutam.",
    perguntas: [
      "Que assunto você evita comigo e o que teme que aconteça se falarmos?",
      "O que você precisa ouvir de mim antes de tocar nele?",
    ],
    acao: "Marquem um dia e hora (não hoje) para conversar sobre um dos dois assuntos.",
    adulto: false,
  },
  {
    n: 17,
    semana: 3,
    semanaTitulo: "Conversas difíceis",
    titulo: "Dinheiro sem briga",
    minutos: 20,
    ritual:
      "Cada um conta, sem defender nada, como era dinheiro na casa em que cresceu e o que isso fez com o jeito de gastar e guardar hoje.",
    perguntas: [
      "Qual foi sua primeira lição sobre dinheiro em casa?",
      "Qual gasto seu você sente que eu julgo, mesmo sem dizer?",
    ],
    acao: "Combinem 1 número: quanto cada um pode gastar no mês sem precisar dar satisfação.",
    adulto: false,
  },
  {
    n: 18,
    semana: 3,
    semanaTitulo: "Conversas difíceis",
    titulo: "As tarefas invisíveis",
    minutos: 20,
    ritual:
      "Cada um lista tudo o que faz pela casa e pela relação que acha que o outro não vê (agenda, lembrar aniversário, comprar o que acaba). Leiam as listas em voz alta.",
    perguntas: [
      "Qual tarefa que você faz sente que ninguém vê?",
      "O que eu poderia assumir sem você precisar pedir?",
    ],
    acao: "Escolha 1 tarefa da lista do outro e assuma por uma semana.",
    adulto: false,
  },
  {
    n: 19,
    semana: 3,
    semanaTitulo: "Conversas difíceis",
    titulo: "Ciúme, redes e limites",
    minutos: 20,
    ritual:
      "Falem de redes sociais, amizades e ex sem acusar. O objetivo é descobrir o que cada um considera ok e o que incomoda.",
    perguntas: [
      "O que nas redes ou nas amizades te incomoda e você nunca falou?",
      "O que te deixa inseguro(a), em mim ou em nós?",
    ],
    acao: "Façam 1 combinado simples (ex.: celular longe no jantar, avisar quando sair) e escrevam.",
    adulto: false,
  },
  {
    n: 20,
    semana: 3,
    semanaTitulo: "Conversas difíceis",
    titulo: "A carta que eu nunca mandei",
    minutos: 25,
    ritual:
      "Cada um escreve uma carta sobre algo que ainda dói. O outro lê (ou escuta) e responde só com 'obrigado(a) por me contar' e depois com 'o que eu posso fazer?'. Sem defesa.",
    perguntas: [
      "Tem algo que eu disse ou fiz que ainda dói em você?",
      "Como seria um pedido de desculpa que chegasse de verdade?",
    ],
    acao: "Peça desculpa, de forma específica, por uma coisa que apareceu hoje.",
    adulto: false,
  },
  {
    n: 21,
    semana: 3,
    semanaTitulo: "Conversas difíceis",
    titulo: "Carta da semana 3",
    minutos: 20,
    ritual:
      "Cada um escreve o que aprendeu nesta semana sobre como conversar com o outro. Leiam em voz alta, devagar.",
    perguntas: [
      "Qual conversa desta semana foi a mais difícil e a que mais valeu?",
      "O que você admirou em como eu lidei?",
    ],
    acao: "Agradeça ao outro, hoje ou amanhã, por ter tido coragem na semana mais difícil.",
    adulto: false,
  },
  {
    n: 22,
    semana: 4,
    semanaTitulo: "Desejo e futuro",
    titulo: "O desejo começa no dia",
    minutos: 15,
    ritual:
      "Passem o dia mandando mensagens leves de flerte (nada pesado). À noite, cada um diz 3 coisas que ainda o(a) enlouquecem no outro, olhando nos olhos.",
    perguntas: [
      "O que em mim você ainda acha irresistível?",
      "Quando foi a última vez que você se sentiu desejado(a) por mim?",
    ],
    acao: "Amanhã, faça um elogio que vá além do 'você está bonito(a)'.",
    adulto: false,
  },
  {
    n: 23,
    semana: 4,
    semanaTitulo: "Desejo e futuro",
    titulo: "Mapa do toque",
    minutos: 30,
    ritual:
      "Dez minutos de massagem para cada um, sem expectativa de que acabe em sexo. Quem recebe diz só 'mais', 'menos' ou 'assim'. Sem pressa e sem pressão.",
    perguntas: [
      "Onde você gosta de ser tocado(a) e eu nunca perguntei?",
      "O que faz você relaxar a ponto de querer mais?",
    ],
    acao: "Sem obrigação nenhuma: combinem se amanhã haverá outra noite assim.",
    adulto: true,
  },
  {
    n: 24,
    semana: 4,
    semanaTitulo: "Desejo e futuro",
    titulo: "Sim, talvez, não",
    minutos: 25,
    ritual:
      "Cada um escreve em segredo uma lista de curiosidades e desejos em 3 colunas: sim, talvez, não. Só comparam o que está em 'sim' nas duas listas. O 'não' de cada um é sagrado e não se discute.",
    perguntas: [
      "Qual curiosidade sua você tem vergonha de contar?",
      "O que faria você se sentir seguro(a) para experimentar algo novo?",
    ],
    acao: "Escolham um item que está em 'sim' para os dois e marquem a data.",
    adulto: true,
  },
  {
    n: 25,
    semana: 4,
    semanaTitulo: "Desejo e futuro",
    titulo: "A noite que a gente imagina",
    minutos: 20,
    ritual:
      "Hoje não acontece nada: cada um descreve com detalhes a noite perfeita (lugar, roupa, música, ritmo). A expectativa faz parte.",
    perguntas: [
      "Qual cena nossa você revisita quando está longe de mim?",
      "Que palavra você quer ouvir de mim hoje à noite?",
    ],
    acao: "Deixe um bilhete-convite para o fim de semana, sem dizer o que vai acontecer.",
    adulto: true,
  },
  {
    n: 26,
    semana: 4,
    semanaTitulo: "Desejo e futuro",
    titulo: "Daqui a 5 anos",
    minutos: 25,
    ritual:
      "Descrevam um dia comum daqui a 5 anos: onde acordam, quem está na casa, o que fazem de manhã. Cada um escreve o seu e depois comparam.",
    perguntas: [
      "O que é diferente nesse dia comum?",
      "O que a gente precisa começar a fazer agora para chegar lá?",
    ],
    acao: "Anotem 3 metas do casal para os próximos 12 meses.",
    adulto: false,
  },
  {
    n: 27,
    semana: 4,
    semanaTitulo: "Desejo e futuro",
    titulo: "Encontro que cabe no bolso",
    minutos: 20,
    ritual:
      "Planejem juntos um encontro diferente que custe pouco ou nada (nascer do sol, piquenique, bairro novo, filme antigo, cozinhar algo que nunca fizeram). Cada um escolhe uma parte.",
    perguntas: [
      "Qual lugar ou experiência você quer viver comigo antes de um ano?",
      "O que eu poderia fazer para o nosso encontro ser a sua cara?",
    ],
    acao: "Marquem a data do encontro na agenda dos dois. Agora.",
    adulto: false,
  },
  {
    n: 28,
    semana: 4,
    semanaTitulo: "Desejo e futuro",
    titulo: "Carta para daqui a um ano",
    minutos: 25,
    ritual:
      "Cada um escreve uma carta para o casal de daqui a 12 meses: o que quer que continue, o que promete cuidar, o que espera ter vivido. Leiam em voz alta.",
    perguntas: [
      "O que você quer que a gente nunca perca?",
      "O que você promete cuidar mais, a partir de hoje?",
    ],
    acao: "Fotografem as cartas e agendem um lembrete para relê-las no ano que vem.",
    adulto: false,
  },
  {
    n: 29,
    semana: 5,
    semanaTitulo: "Fechamento",
    titulo: "O balanço dos 28 dias",
    minutos: 20,
    ritual:
      "Cada um dá uma nota de 0 a 10 para a conexão do casal hoje e outra para como era no dia 1. Conversem sobre a diferença.",
    perguntas: [
      "Qual noite mudou mais coisa em você, e por quê?",
      "O que você descobriu sobre a gente que não sabia?",
    ],
    acao: "Escolham 3 rituais das 30 noites para manter toda semana.",
    adulto: false,
  },
  {
    n: 30,
    semana: 5,
    semanaTitulo: "Fechamento",
    titulo: "As três promessas",
    minutos: 30,
    ritual:
      "Acendam uma vela ou sirvam algo para brindar. Cada um faz 3 promessas pequenas e concretas para o outro (ex.: 'vou largar o celular no jantar'). Trocam as promessas escritas.",
    perguntas: [
      "Qual promessa sua você quer que eu cobre com carinho?",
      "Como vamos nos lembrar de cumprir quando o programa acabar?",
    ],
    acao: "Marquem 1 noite fixa por semana a partir de agora e voltem aos baralhos para continuar de onde pararam.",
    adulto: false,
  },
];
