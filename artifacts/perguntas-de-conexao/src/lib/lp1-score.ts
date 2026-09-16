export type Lp1Score = {
  value: number;
  band: "perto" | "morno" | "distante";
};

export type Lp1DistanceResult = {
  score: number;
  meterPosition: number;
  label: "Atenção" | "Risco médio" | "Risco alto";
  routineValue: "alta" | "média" | "baixa";
  spaceValue: "alto" | "médio" | "baixo";
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

const LP1_ROUTINE_RISK: Record<string, number> = {
  pouco: -10,
  alguma: -4,
  metade: 4,
  muito: 12,
  tudo: 18,
};

export function computeLp1DistanceResult(
  answers: Record<string, unknown>,
): Lp1DistanceResult {
  const read = (key: string) => {
    const value = answers[key];
    return typeof value === "string" ? value : "";
  };
  const split = (key: string) => read(key).split(",").filter(Boolean);
  const phase = read("fase") || read("momento");
  const routinePoints = LP1_ROUTINE_RISK[read("rotina")] ?? 0;
  const travaValues = split("travas");
  const topicValues = split("conversas");
  const travaCount = travaValues.length;
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
  const routineTopicRisk = topicValues.reduce(
    (total, topic) =>
      total +
      ({
        rotina: 6,
        trabalho: 2,
        besteira: -3,
        "nos-dois": -6,
        intimidade: -6,
        pessoal: -4,
      }[topic] ?? 0),
    0,
  );
  const phaseRisk =
    phase === "perdidos" || phase === "reconexao"
      ? 12
      : phase === "novo" || phase === "comecando"
        ? -4
        : 2;
  const conversationRisk =
    Math.min(travaCount, 5) * 8 +
    routineTopicRisk +
    phaseRisk +
    iniciaPoints +
    (read("celular") === "sempre"
      ? 12
      : read("celular") === "as-vezes"
        ? 3
        : -6) +
    (read("conhece") === "sim"
      ? -6
      : read("conhece") === "sei-tudo"
        ? 6
      : read("conhece") === "as-vezes-nao"
        ? 8
        : read("conhece") === "mais-ou-menos"
          ? 2
          : 0) +
    (read("sei-la-mapeado") === "sei-la"
      ? 10
      : read("sei-la-mapeado") === "nao-sei"
        ? 8
        : read("sei-la-mapeado") === "superficial"
          ? 3
          : read("sei-la-mapeado") === "rende" ||
              read("sei-la-mapeado") === "vai-longe"
            ? -8
            : read("sei-la-mapeado") === "muda-assunto"
              ? 7
              : 0) +
    (obstacleValues.includes("medo-resposta") ? 12 : 0) +
    (obstacleValues.includes("medo") ? 10 : 0) +
    (obstacleValues.includes("comecar") ? 8 : 0) +
    (obstacleValues.includes("nao-para") ? 6 : 0) +
    (read("clima") === "honesto" ? 6 : 0);
  const score = Math.round(
    Math.min(100, Math.max(0, 50 + conversationRisk * 0.65)),
  );
  /*
   * The quiz is intentionally a reflection prompt, not a clinical scale.
   * Keep the marker out of the low zone to preserve urgency, while still
   * allowing answers to move it through attention, medium, and high.
   */
  const meterPosition = Math.round(42 + score * 0.48);
  const label =
    meterPosition >= 82
      ? "Risco alto"
      : meterPosition >= 58
        ? "Risco médio"
        : "Atenção";
  const routineValue =
    (LP1_ROUTINE_RISK[read("rotina")] ?? 0) <= -4
      ? "alta"
      : (LP1_ROUTINE_RISK[read("rotina")] ?? 0) <= 4
        ? "média"
        : "baixa";
  const urgency = read("urgencia");
  const when = read("quando");
  const spaceValue =
    urgency === "hoje" ||
    urgency === "proximos-dias" ||
    when === "hoje" ||
    when === "dias"
      ? "alto"
      : urgency === "oportunidade" || when === "quando"
        ? "baixo"
        : "médio";
  return { score, meterPosition, label, routineValue, spaceValue };
}