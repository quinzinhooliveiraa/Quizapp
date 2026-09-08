export type PerguntaViral = {
  id: string;
  text: string;
  /** Salvamentos do post onde esta pergunta era o título. Só quem tem, tem. */
  saves?: string;
};

// A ordem importa: abre morno, aperta no meio, fecha pesado. Não embaralhe.
export const PERGUNTAS_VIRAIS: PerguntaViral[] = [
  {
    id: "viral-conectado",
    text: "Em que momento você se sentiu verdadeiramente conectado a mim?",
    saves: "25 mil",
  },
  {
    id: "viral-nunca-mude",
    text: "Qual é a única coisa em você que espera que nunca mude?",
    saves: "51 mil",
  },
  {
    id: "viral-diferente",
    text: "O que me torna diferente de qualquer pessoa que você conheceu?",
  },
  {
    id: "viral-nunca-cansa",
    text: "Qual é a coisa que eu digo e que você nunca se cansa de ouvir?",
  },
  {
    id: "viral-arrependimento-nossa-historia",
    text: "Você se arrepende de algo sobre a nossa história até agora?",
  },
  {
    id: "viral-amou-melhor",
    text: "Você acha que alguém já te amou melhor do que eu?",
    saves: "29 mil",
  },
  {
    id: "viral-vida-sem-mim",
    text: "Se você tivesse que imaginar sua vida sem mim, do que mais sentiria falta?",
  },
];