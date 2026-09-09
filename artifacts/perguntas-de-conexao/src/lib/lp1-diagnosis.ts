import {
  selectLp3Narrative,
  type Lp3Answers,
  type Lp3Narrative,
  type Lp3NarrativeType,
} from "@/lib/lp3-narrative";

export type Lp1QuizAnswers = {
  intensity?: string;
  stage?: string;
  theme?: string;
};

const diagnosisTitles: Record<Lp3NarrativeType, string> = {
  routine: "Vocês não brigaram. Só pararam de perguntar.",
  discovery: "Você sabe a rotina dele(a) de cor. E o resto?",
  "waiting-conversation":
    "Tem uma conversa que vocês vêm adiando. Ela não começa sozinha.",
  reconnection: 'Ainda dá. Mas não vai ser um "vamos conversar" que resolve.',
  beginning:
    "Vocês estão no começo. É agora que dá pra não virar mais um casal de logística.",
  distance: "A distância não separa. O silêncio separa.",
  intimacy:
    "Vocês se tocam. Mas quando foi a última vez que se contaram alguma coisa?",
  healthy:
    "Está tudo bem. É exatamente por isso que ninguém percebe quando esfria.",
};

function toLp3Answers(answers: Lp1QuizAnswers): Lp3Answers {
  const time =
    answers.stage === "novo"
      ? "Ainda estamos nos conhecendo"
      : answers.stage === "muitos-anos"
        ? "Mais de 3 anos"
        : "1–3 anos";
  const routine =
    answers.intensity === "deep"
      ? "Conversamos bastante"
      : "A gente fala principalmente da rotina";
  const curiosity =
    answers.theme === "faisca"
      ? "Hoje"
      : answers.theme === "livro-aberto"
        ? "Há alguns meses"
        : "Nas últimas semanas";
  const vulnerability =
    answers.intensity === "gentle" ? "Algumas coisas" : "Acho que não";
  const desire =
    answers.theme === "faisca"
      ? "Reacender a intimidade"
      : answers.theme === "porto-seguro"
        ? "Voltar a sentir mais proximidade"
        : "Ter conversas mais profundas";

  return { time, routine, curiosity, vulnerability, desire };
}

export type Lp1Diagnosis = Lp3Narrative & {
  title: string;
};

export function selectLp1Diagnosis(answers: Lp1QuizAnswers): Lp1Diagnosis {
  const narrative = selectLp3Narrative(toLp3Answers(answers));

  return {
    ...narrative,
    title: diagnosisTitles[narrative.narrativeType],
  };
}