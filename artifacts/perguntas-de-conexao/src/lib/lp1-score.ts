export type Lp1Score = {
  value: number;
  band: "perto" | "morno" | "distante";
};

/*
 * The score is deliberately local and additive. Answers that describe more
 * distance or more friction carry more weight; unanswered screens contribute
 * zero instead of inventing a diagnosis.
 */
const ANSWER_WEIGHTS: Record<string, number> = {
  "stage:muitos-anos": 8,
  "stage:anos": 4,
  "theme:livro-aberto": 8,
  "theme:faisca": 5,
  "pain:afastamento": 18,
  "pain:medo": 15,
  "pain:eu-travo": 12,
  "pain:como-comecar": 8,
  "pain:sei-la": 4,
  "s04-rotina:tudo": 12,
  "s04-rotina:muito": 9,
  "s04-rotina:metade": 6,
  "s04-rotina:alguma": 3,
  "s05-silencio:pesado": 10,
  "s05-silencio:neutro": 5,
  "s07-perguntas:raramente": 8,
  "s07-perguntas:as-vezes": 4,
  "s10-mudanca:tempo": 2,
  "s10-mudanca:escuta": 4,
  "s10-mudanca:toque": 5,
  "s10-mudanca:leveza": 1,
  "objecao:ele-nao-topa": 7,
  "objecao:nao-vai-mudar": 6,
  "objecao:sem-tempo": 4,
  "objecao:nao-sei-comecar": 3,
  "s14-falta:atenção": 3,
  "s14-falta:curiosidade": 5,
  "s14-falta:iniciativa": 4,
  "s16-proximidade:1": 8,
  "s16-proximidade:2": 5,
  "s16-proximidade:3": 3,
  "s17-conversa:conflitos": 2,
  "s17-conversa:sentimentos": 3,
  "s17-conversa:futuro": 2,
  "s17-conversa:desejo": 1,
  "s17-conversa:sonhos": 1,
};

const MAX_SCORE = 101;

export function computeLp1Score(answers: Record<string, string>): Lp1Score {
  const total = Object.entries(answers).reduce((sum, [key, rawValue]) => {
    const values = rawValue.split(",").filter(Boolean);
    return (
      sum +
      values.reduce(
        (valueSum, value) => valueSum + (ANSWER_WEIGHTS[`${key}:${value}`] ?? 0),
        0,
      )
    );
  }, 0);
  const normalized = Math.max(0, Math.round((total / MAX_SCORE) * 100));

  return {
    value: normalized,
    band:
      normalized <= 30
        ? "perto"
        : normalized <= 60
          ? "morno"
          : "distante",
  };
}