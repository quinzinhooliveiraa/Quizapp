import {
  questions as connectionQuestions,
  themes as connectionThemes,
} from "@workspace/connection-content";

const PEEK_QUESTION_BY_THEME: Record<string, string> = {
  "porto-seguro": "ps6",
  "livro-aberto": "lv3",
  "voce-nao-sabia": "vns10",
  "em-voz-alta": "eva5",
  "la-atras": "laa7",
  "modo-leve": "ml4",
  viagens: "via7",
  "carreira-dinheiro": "cd3",
  "depois-da-tempestade": "dt1",
  faisca: "fa9",
  "mesmo-longe": "mlg2",
  "perto-de-novo": "pdn4",
};

export type ThemePeek = {
  id: string;
  title: string;
  count: number;
  description: string;
  backgroundUrl?: string;
  question?: string;
  adult: boolean;
};

export function getThemePeek(themeId: string): ThemePeek | undefined {
  const theme = connectionThemes.find((entry) => entry.id === themeId);
  if (!theme) return undefined;
  const adult = theme.audience === "18+";
  const questionId = PEEK_QUESTION_BY_THEME[themeId];
  const question = adult
    ? undefined
    : connectionQuestions.find((entry) => entry.id === questionId)?.text;

  return {
    id: theme.id,
    title: theme.title,
    count: theme.count,
    description: theme.description,
    backgroundUrl: theme.backgroundUrl,
    question,
    adult,
  };
}