export type Lp3Answers = Record<string, string>;

export type Lp3NarrativeType =
  | "routine"
  | "discovery"
  | "waiting-conversation"
  | "reconnection"
  | "beginning"
  | "distance"
  | "intimacy"
  | "healthy";

export type Lp3Narrative = {
  narrativeType: Lp3NarrativeType;
  title: string;
  insight: string;
  story: string;
  themeId: string;
  personalizations: string[];
};

const lowDiscoveryAnswers = new Set([
  "Nas últimas semanas",
  "Há alguns meses",
  "Nem lembro",
]);

const narrativeDefinitions: Record<
  Lp3NarrativeType,
  Omit<Lp3Narrative, "personalizations">
> = {
  routine: {
    narrativeType: "routine",
    title: "A ROTINA ENGOLIU VOCÊS",
    insight:
      "Ninguém decidiu se afastar. A rotina foi ocupando os espaços que antes eram de vocês.",
    story: `Ninguém decidiu se afastar.

Não teve um dia em que vocês acordaram e pensaram: "vamos parar de conversar."

Foi acontecendo.

Um dia mais corrido.
Uma semana cheia.
Uma noite em que cada um ficou no próprio celular.

E, aos poucos, as conversas que faziam vocês descobrirem um ao outro foram sendo substituídas por:

"Chegou?"

"Vai comer?"

"Que horas você volta?"

Vocês continuam juntos.

Só que estar perto e estar conectado começaram a ser coisas diferentes.

E talvez seja por isso que uma pergunta simples consiga fazer tanto.`,
    themeId: "porto-seguro",
  },
  discovery: {
    narrativeType: "discovery",
    title: "VOCÊS CONVERSAM, MAS PARARAM DE SE DESCOBRIR",
    insight:
      "Vocês ainda conversam. Talvez o que tenha diminuído seja a curiosidade.",
    story: `É estranho quando você percebe que conversa todos os dias com alguém...

mas não lembra da última vez que descobriu alguma coisa realmente nova sobre essa pessoa.

Vocês sabem como foi o trabalho.
O que aconteceu no trânsito.
O que precisam resolver amanhã.

Sabem da rotina.

Mas e da pessoa?

O que ela anda pensando?
O que mudou dentro dela?
O que ela nunca contou porque nunca surgiu uma pergunta que abrisse espaço?

Às vezes, a distância entre duas pessoas não aparece no silêncio.

Aparece quando todas as conversas começam a parecer iguais.`,
    themeId: "livro-aberto",
  },
  "waiting-conversation": {
    narrativeType: "waiting-conversation",
    title: "EXISTE UMA CONVERSA ESPERANDO",
    insight:
      "Existe coisa que você gostaria de dizer. Talvez o problema não seja falta de vontade — é não saber por onde começar.",
    story: `Tem conversa que não acontece porque falta amor.

Acontece porque ninguém sabe como começar.

Você pensa em falar.
Espera um momento melhor.
O momento não vem.

Então deixa para amanhã.

Amanhã vira outra semana.

E aquilo continua ali — não necessariamente como uma briga, mas como uma coisa que vocês dois sabem que existe.

Talvez o problema nunca tenha sido encontrar coragem para conversar.

Talvez tenha sido encontrar a primeira pergunta.`,
    themeId: "depois-da-tempestade",
  },
  reconnection: {
    narrativeType: "reconnection",
    title: "VOCÊS AINDA QUEREM SE REENCONTRAR",
    insight:
      "Você não parece estar procurando uma relação diferente. Parece estar procurando uma versão mais próxima da relação que vocês já têm.",
    story: `Talvez vocês não estejam tentando salvar alguma coisa.

Talvez estejam tentando reencontrar uma coisa que já existiu.

Aquele jeito de conversar sem perceber a hora passar.

A curiosidade de querer saber o que o outro estava pensando.

A sensação de olhar para aquela pessoa e ainda existir alguma coisa nova para descobrir.

Porque relacionamento não costuma esfriar de uma vez.

Às vezes ele só vai ficando familiar demais.

E, quando tudo parece conhecido, a curiosidade vai embora primeiro.

Talvez vocês não precisem de uma grande mudança.

Talvez precisem voltar a fazer perguntas que não cabem na rotina.`,
    themeId: "porto-seguro",
  },
  beginning: {
    narrativeType: "beginning",
    title: "VOCÊS ESTÃO NO COMEÇO",
    insight:
      "Vocês ainda estão na fase em que uma pergunta pode abrir uma parte inteira daquela pessoa que você ainda não conhece.",
    story: `O começo de uma relação tem uma coisa que o tempo costuma roubar:

curiosidade.

Você quer saber tudo.

A história que ninguém conhece.
A coisa estranha que a pessoa gosta.
O medo que ela quase nunca conta.
O que faz ela rir de verdade.

Cada conversa parece abrir uma porta.

E talvez seja exatamente isso que vocês não deveriam perder quando a relação começar a ficar mais confortável:

a vontade de continuar descobrindo quem está do outro lado.`,
    themeId: "voce-nao-sabia",
  },
  distance: {
    narrativeType: "distance",
    title: "MESMO LONGE, AINDA DÁ PARA CHEGAR PERTO",
    insight:
      "Quando a presença física não ajuda a conversa, a pergunta precisa carregar um pouco mais de presença.",
    story: `À distância, o silêncio parece maior.

Não porque existe menos carinho.

Mas porque vocês não têm as pequenas coisas que normalmente criam assunto.

O olhar.
O abraço.
O comentário no meio do caminho.
A história que acontece durante o dia.

Então a conversa precisa carregar mais peso.

E é aí que "como foi seu dia?" começa a ficar pequeno demais.

Porque vocês não precisam de mais mensagens.

Precisam de mensagens que façam vocês se sentirem presentes na vida um do outro.`,
    themeId: "mesmo-longe",
  },
  intimacy: {
    narrativeType: "intimacy",
    title: "A INTIMIDADE QUE FICOU PARA DEPOIS",
    insight:
      "Talvez a intimidade que você procura comece antes do toque: começa quando existe espaço para dizer o que normalmente fica para depois.",
    story: `Intimidade não começa necessariamente quando vocês se tocam.

Muitas vezes começa muito antes.

Quando alguém pergunta alguma coisa que o outro não esperava.

Quando vocês conseguem falar sem precisar parecer fortes.

Quando existe espaço para dizer o que deseja, o que sente e até o que tem vergonha de admitir.

Com o tempo, algumas dessas conversas ficam para depois.

E "depois" vira rotina.

Talvez reacender a intimidade não seja voltar a ser quem vocês eram.

Talvez seja descobrir quem vocês são agora.`,
    themeId: "faisca",
  },
  healthy: {
    narrativeType: "healthy",
    title: "VOCÊS NÃO ESTÃO MAL — E JUSTAMENTE POR ISSO",
    insight:
      "Vocês não parecem estar procurando consertar alguma coisa. Parece que querem continuar descobrindo um ao outro.",
    story: `Nem toda relação precisa estar passando por uma crise para merecer uma boa conversa.

Na verdade, talvez as melhores conversas aconteçam justamente quando está tudo bem.

Quando vocês ainda têm curiosidade.

Quando ainda existe vontade de conhecer melhor aquela pessoa que você já conhece há tanto tempo.

Porque amar alguém não significa chegar a um ponto em que você finalmente sabe tudo sobre ela.

Significa continuar descobrindo.`,
    themeId: "voce-nao-sabia",
  },
};

function getPersonalizations(answers: Lp3Answers): string[] {
  const personalizations: string[] = [];

  if (answers.routine === "Cada um acaba no celular") {
    personalizations.push(
      "Mesmo quando finalmente existe tempo, parte desse tempo parece escapar para as telas.",
    );
  }
  if (answers.routine === "A gente fala principalmente da rotina") {
    personalizations.push(
      "As conversas continuam acontecendo, mas muitas delas parecem precisar resolver alguma coisa.",
    );
  }
  if (answers.curiosity === "Nem lembro") {
    personalizations.push(
      "E talvez seja significativo que você nem consiga lembrar da última vez.",
    );
  }
  if (answers.curiosity === "Hoje") {
    personalizations.push(
      "E isso muda bastante a história: ainda existe curiosidade acontecendo entre vocês.",
    );
  }
  if (answers.vulnerability === "Sim") {
    personalizations.push(
      "E existe pelo menos uma coisa que você ainda está carregando sozinho.",
    );
  }
  if (answers.vulnerability === "Algumas coisas") {
    personalizations.push(
      "Talvez não seja uma única conversa. Talvez sejam pequenas coisas acumuladas.",
    );
  }

  return personalizations;
}

function getNarrativeKey(answers: Lp3Answers): Lp3NarrativeType {
  const lowDiscovery = lowDiscoveryAnswers.has(answers.curiosity);

  if (answers.desire === "Ter mais assunto mesmo à distância") {
    return "distance";
  }
  if (answers.time === "Ainda estamos nos conhecendo") {
    return "beginning";
  }
  if (answers.desire === "Reacender a intimidade") {
    return "intimacy";
  }
  if (
    lowDiscovery
    && (
      answers.routine === "Cada um acaba no celular"
      || answers.routine === "A gente fala principalmente da rotina"
    )
    && answers.desire === "Voltar a sentir mais proximidade"
  ) {
    return "routine";
  }
  if (answers.vulnerability === "Sim") {
    return "waiting-conversation";
  }
  if (
    answers.vulnerability === "Algumas coisas"
    && (
      answers.desire === "Voltar a sentir mais proximidade"
      || answers.desire === "Conversar sobre coisas difíceis"
    )
  ) {
    return "waiting-conversation";
  }
  if (answers.desire === "Conversar sobre coisas difíceis") {
    return "waiting-conversation";
  }
  if (answers.desire === "Voltar a sentir mais proximidade") {
    return "reconnection";
  }
  if (
    lowDiscovery
    && (
      answers.routine === "Cada um acaba no celular"
      || answers.routine === "A gente fala principalmente da rotina"
    )
  ) {
    return "routine";
  }
  if (
    lowDiscovery
    && (
      answers.routine === "Conversamos bastante"
      || answers.routine === "Tentamos fazer algo diferente"
    )
  ) {
    return "discovery";
  }
  if (
    answers.vulnerability === "Acho que não"
    && (answers.curiosity === "Hoje" || answers.curiosity === "Nos últimos dias")
    && (
      answers.routine === "Conversamos bastante"
      || answers.routine === "Tentamos fazer algo diferente"
    )
  ) {
    return "healthy";
  }

  return "discovery";
}

export function selectLp3Narrative(answers: Lp3Answers): Lp3Narrative {
  const narrative = narrativeDefinitions[getNarrativeKey(answers)];

  return {
    ...narrative,
    personalizations: getPersonalizations(answers),
  };
}