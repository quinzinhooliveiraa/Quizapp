export type Lp1Score = {
  value: number;
  band: "perto" | "morno" | "distante";
};

export type Lp1DistanceResult = {
  score: number;
  meterPosition: number;
  label: "Morno" | "Distante";
  routineValue: "alta" | "média" | "baixa";
  spaceValue: "alto" | "médio";
};

/*
 * The score is deliberately local and additive. Answers that describe more
 * distance or more friction carry more weight; unanswered screens contribute
 * zero instead of inventing a diagnosis.
 */
const ANSWER_WEIGHTS: Record<string, number> = {
  "fase:historia": 4,
  "fase:muitos-anos": 8,
  "fase:perdidos": 18,
  "stage:muitos-anos": 8,
  "stage:anos": 4,
  "theme:livro-aberto": 8,
  "theme:faisca": 5,
  "pain:afastamento": 18,
  "pain:medo": 15,
  "pain:eu-travo": 12,
  "pain:como-comecar": 8,
  "pain:sei-la": 4,
  "dor:afastamento": 18,
  "dor:medo": 15,
  "dor:eu-travo": 12,
  "dor:como-comecar": 8,
  "dor:sei-la": 4,
  "rotina:tudo": 12,
  "rotina:muito": 9,
  "rotina:metade": 6,
  "rotina:alguma": 3,
  "s04-rotina:tudo": 12,
  "s04-rotina:muito": 9,
  "s04-rotina:metade": 6,
  "s04-rotina:alguma": 3,
  "s05-silencio:pesado": 10,
  "s05-silencio:neutro": 5,
  "clima:honesto": 10,
  "clima:normal": 5,
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
  "objecao:intenso-demais": 5,
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

export function computeLp1Score(answers: Record<string, unknown>): Lp1Score {
  const canonicalAliases: Record<string, string[]> = {
    fase: ["stage"],
    dor: ["pain"],
    rotina: ["s04-rotina"],
    clima: ["s05-silencio"],
  };
  const skippedAliases = new Set(
    Object.entries(canonicalAliases).flatMap(([canonical, aliases]) =>
      typeof answers[canonical] === "string" && answers[canonical]
        ? aliases
        : [],
    ),
  );
  const total = Object.entries(answers).reduce((sum, [key, rawValue]) => {
    if (skippedAliases.has(key)) return sum;
    if (typeof rawValue !== "string") return sum;
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

const LP1_ROUTINE_POINTS: Record<string, number> = {
  pouco: 0,
  alguma: 5,
  metade: 10,
  muito: 15,
  tudo: 20,
};

export function computeLp1DistanceResult(
  answers: Record<string, unknown>,
): Lp1DistanceResult {
  const read = (key: string) => {
    const value = answers[key];
    return typeof value === "string" ? value : "";
  };
  const split = (key: string) => read(key).split(",").filter(Boolean);
  const routinePoints = LP1_ROUTINE_POINTS[read("rotina")] ?? 0;
  const travaValues = split("travas");
  const topicValues = split("conversas");
  const travaCount = travaValues.length || topicValues.length;
  const obstacleValues = split("atrapalha");
  const iniciaPoints =
    read("inicia") === "ele-nao-entra"
      ? 14
      : read("inicia") === "nao-sei-perguntar"
        ? 10
        : read("inicia") === "clima"
          ? 12
          : read("inicia") === "nao-senta"
            ? 5
            : 0;
  const painPoints =
    Math.min(travaCount, 5) * 8 +
    iniciaPoints +
    (read("celular") === "sempre"
      ? 14
      : read("celular") === "as-vezes"
        ? 7
        : 0) +
    (read("conhece") === "sei-tudo"
      ? 10
      : read("conhece") === "as-vezes-nao"
        ? 8
        : 0) +
    (read("sei-la-mapeado") === "sei-la"
      ? 14
      : read("sei-la-mapeado") === "nao-sei"
        ? 10
        : 0) +
    (obstacleValues.includes("medo-resposta") ? 12 : 0) +
    (obstacleValues.includes("medo") ? 10 : 0) +
    (obstacleValues.includes("comecar") ? 8 : 0) +
    (routinePoints >= 15 ? 8 : routinePoints >= 10 ? 4 : 0);
  const score = Math.round(
    40 + (Math.min(100, Math.max(0, painPoints)) / 100) * 52,
  );
  const meterPosition = Math.round(
    Math.min(72, Math.max(30, 30 + ((score - 40) / 52) * 42)),
  );
  const label = meterPosition < 50 ? "Morno" : "Distante";
  const routineValue =
    routinePoints <= 5 ? "alta" : routinePoints <= 10 ? "média" : "baixa";
  const spaceValue =
    (read("clima") === "leve" || read("clima") === "normal") &&
    (read("quando") === "hoje" || read("quando") === "dias")
      ? "alto"
      : "médio";
  return { score, meterPosition, label, routineValue, spaceValue };
}