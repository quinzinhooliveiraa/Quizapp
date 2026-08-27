import crypto from "node:crypto";
import {
  and,
  asc,
  count,
  desc,
  eq,
  sql,
} from "drizzle-orm";
import {
  db,
  experimentAssignmentsTable,
  experimentOptimizationHistoryTable,
  experimentVariantsTable,
  experimentsTable,
  sessionsTable,
  type Experiment,
  type ExperimentVariant,
} from "@workspace/db";
import { logger } from "./logger";

export const OPTIMIZATION_INTERVAL_MS = 15 * 60 * 1000;
export const OPTIMIZATION_STEP = 10;
export const MINIMUM_ACTIVE_VARIANT_WEIGHT = 10;
export const EVIDENCE_Z_SCORE = 1.96;

type OptimizationMode = "manual" | "automatic";
type MinimumSampleSizeMode = "automatic" | "custom";

export type OptimizationVariantMetrics = {
  variantId: string;
  name: string;
  path: string;
  weight: number;
  visitors: number;
  purchases: number;
  conversionRate: number;
};

export type OptimizationHistoryEntry = {
  id: string;
  evaluatedAt: Date;
  previousWeights: Record<string, number>;
  newWeights: Record<string, number>;
  conversionsByVariant: Record<string, number>;
  visitorsByVariant: Record<string, number>;
  conversionRatesByVariant: Record<string, number>;
  winnerVariantId: string;
  sampleSize: number;
  reason: string;
  changeType: string;
};

export type ExperimentOptimizationSummary = {
  optimizationMode: OptimizationMode;
  minimumSampleSizeMode: MinimumSampleSizeMode;
  minimumSampleSize: number | null;
  minimumSampleSizeUsed: number;
  status: "off" | "learning" | "optimizing";
  totalVisitors: number;
  variants: OptimizationVariantMetrics[];
  lastOptimizationAt: Date | null;
  nextOptimizationAt: Date | null;
  history: OptimizationHistoryEntry[];
};

export type OptimizationRunResult = {
  changed: boolean;
  reason: string;
  winnerVariantId?: string;
  summary: ExperimentOptimizationSummary;
};

type WeightVariant = Pick<ExperimentVariant, "id" | "weight" | "status">;

function isAutomatic(experiment: Pick<Experiment, "optimizationMode">) {
  return experiment.optimizationMode === "automatic";
}

export function calculateMinimumSampleSize(
  variantCount: number,
  mode: MinimumSampleSizeMode,
  customValue: number | null | undefined,
) {
  if (mode === "custom" && Number.isInteger(customValue) && customValue >= 2) {
    return Math.min(customValue, 100_000);
  }
  return Math.max(200, variantCount * 100);
}

export function calculateConversionRate(purchases: number, visitors: number) {
  return visitors > 0 ? purchases / visitors : 0;
}

export function hasSufficientEvidence(
  winner: Pick<OptimizationVariantMetrics, "visitors" | "purchases" | "conversionRate">,
  runnerUp: Pick<OptimizationVariantMetrics, "visitors" | "purchases" | "conversionRate">,
) {
  if (
    winner.visitors < 30 ||
    runnerUp.visitors < 30 ||
    winner.conversionRate <= runnerUp.conversionRate
  ) {
    return false;
  }

  const pooledRate =
    (winner.purchases + runnerUp.purchases) /
    (winner.visitors + runnerUp.visitors);
  const standardError = Math.sqrt(
    pooledRate *
      (1 - pooledRate) *
      (1 / winner.visitors + 1 / runnerUp.visitors),
  );
  if (standardError === 0) return false;

  const zScore =
    (winner.conversionRate - runnerUp.conversionRate) / standardError;
  return zScore >= EVIDENCE_Z_SCORE;
}

function distributeDonorReduction(
  variants: WeightVariant[],
  winnerId: string,
  amount: number,
) {
  const donors = variants
    .filter((variant) => variant.id !== winnerId && variant.status === "active")
    .map((variant) => ({
      id: variant.id,
      available: Math.max(0, variant.weight - MINIMUM_ACTIVE_VARIANT_WEIGHT),
    }));
  let remaining = amount;

  for (const donor of donors) {
    if (remaining <= 0) break;
    const reduction = Math.min(donor.available, remaining);
    donor.available -= reduction;
    remaining -= reduction;
  }

  return {
    donors,
    remaining,
  };
}

/**
 * Moves at most ten percentage points toward the winner per evaluation.
 * Every active variant is kept at or above 10%, and the integer weights
 * always sum to 100.
 */
export function calculateGradualWeights(
  variants: WeightVariant[],
  winnerId: string,
) {
  const activeVariants = variants.filter(
    (variant) => variant.status === "active",
  );
  const currentTotal = activeVariants.reduce(
    (total, variant) => total + variant.weight,
    0,
  );
  if (
    activeVariants.length < 2 ||
    currentTotal !== 100 ||
    !activeVariants.some((variant) => variant.id === winnerId)
  ) {
    return null;
  }

  const winner = activeVariants.find((variant) => variant.id === winnerId);
  if (!winner) return null;

  const maximumWinnerWeight =
    100 -
    MINIMUM_ACTIVE_VARIANT_WEIGHT * (activeVariants.length - 1);
  const desiredIncrease = Math.min(
    OPTIMIZATION_STEP,
    Math.max(0, maximumWinnerWeight - winner.weight),
  );
  if (desiredIncrease === 0) return null;

  const { donors, remaining } = distributeDonorReduction(
    activeVariants,
    winnerId,
    desiredIncrease,
  );
  if (remaining > 0) return null;

  const changes = new Map<string, number>(
    activeVariants.map((variant) => [variant.id, variant.weight]),
  );
  changes.set(winnerId, winner.weight + desiredIncrease);
  for (const donor of donors) {
    const original = activeVariants.find((variant) => variant.id === donor.id);
    if (original) {
      changes.set(
        donor.id,
        Math.max(MINIMUM_ACTIVE_VARIANT_WEIGHT, original.weight - (original.weight - MINIMUM_ACTIVE_VARIANT_WEIGHT - donor.available)),
      );
    }
  }

  const result = variants.map((variant) => ({
    id: variant.id,
    weight: changes.get(variant.id) ?? variant.weight,
  }));
  const resultTotal = result.reduce((total, variant) => total + variant.weight, 0);
  if (
    resultTotal !== 100 ||
    result.some(
      (variant) =>
        variant.weight < 0 ||
        variant.weight > 100 ||
        (activeVariants.some((active) => active.id === variant.id) &&
          variant.weight < MINIMUM_ACTIVE_VARIANT_WEIGHT),
    )
  ) {
    return null;
  }
  return result;
}

async function getExperiment(experimentId: string) {
  const [experiment] = await db
    .select()
    .from(experimentsTable)
    .where(eq(experimentsTable.id, experimentId))
    .limit(1);
  return experiment;
}

async function getVariants(experimentId: string) {
  return db
    .select()
    .from(experimentVariantsTable)
    .where(eq(experimentVariantsTable.experimentId, experimentId))
    .orderBy(asc(experimentVariantsTable.createdAt));
}

async function getVariantMetrics(
  experimentId: string,
  variants: ExperimentVariant[],
) {
  return Promise.all(
    variants.map(async (variant): Promise<OptimizationVariantMetrics> => {
      const [visitorResult, purchaseResult] = await Promise.all([
        db
          .select({
            value: sql<number>`count(distinct ${experimentAssignmentsTable.visitorKey})`,
          })
          .from(experimentAssignmentsTable)
          .where(
            and(
              eq(experimentAssignmentsTable.experimentId, experimentId),
              eq(
                experimentAssignmentsTable.experimentVariantId,
                variant.id,
              ),
            ),
          ),
        db
          .select({ value: count() })
          .from(sessionsTable)
          .where(
            and(
              eq(sessionsTable.experimentId, experimentId),
              eq(sessionsTable.experimentVariantId, variant.id),
              eq(sessionsTable.accessGranted, true),
            ),
          ),
      ]);
      const visitors = Number(visitorResult[0]?.value || 0);
      const purchases = Number(purchaseResult[0]?.value || 0);
      return {
        variantId: variant.id,
        name: variant.name,
        path: variant.path,
        weight: variant.weight,
        visitors,
        purchases,
        conversionRate: calculateConversionRate(purchases, visitors),
      };
    }),
  );
}

async function getHistory(experimentId: string) {
  const rows = await db
    .select()
    .from(experimentOptimizationHistoryTable)
    .where(eq(experimentOptimizationHistoryTable.experimentId, experimentId))
    .orderBy(desc(experimentOptimizationHistoryTable.evaluatedAt))
    .limit(20);
  return rows as OptimizationHistoryEntry[];
}

export async function getExperimentOptimizationSummary(
  experimentId: string,
) {
  const experiment = await getExperiment(experimentId);
  if (!experiment) return undefined;
  const variants = await getVariants(experimentId);
  const metrics = await getVariantMetrics(experimentId, variants);
  const history = await getHistory(experimentId);
  const mode: OptimizationMode =
    experiment.optimizationMode === "automatic" ? "automatic" : "manual";
  const sampleMode: MinimumSampleSizeMode =
    experiment.minimumSampleSizeMode === "custom" ? "custom" : "automatic";
  const minimumSampleSizeUsed = calculateMinimumSampleSize(
    variants.length,
    sampleMode,
    experiment.minimumSampleSize,
  );
  const totalVisitors = metrics.reduce(
    (total, variant) => total + variant.visitors,
    0,
  );

  return {
    optimizationMode: mode,
    minimumSampleSizeMode: sampleMode,
    minimumSampleSize: experiment.minimumSampleSize,
    minimumSampleSizeUsed,
    status:
      mode === "manual"
        ? "off"
        : totalVisitors < minimumSampleSizeUsed
          ? "learning"
          : "optimizing",
    totalVisitors,
    variants: metrics,
    lastOptimizationAt: experiment.lastOptimizationAt,
    nextOptimizationAt: experiment.nextOptimizationAt,
    history,
  } satisfies ExperimentOptimizationSummary;
}

async function setNextEvaluation(experimentId: string, now: Date) {
  await db
    .update(experimentsTable)
    .set({
      lastOptimizationAt: now,
      nextOptimizationAt: new Date(now.getTime() + OPTIMIZATION_INTERVAL_MS),
      updatedAt: now,
    })
    .where(eq(experimentsTable.id, experimentId));
}

function findWinner(metrics: OptimizationVariantMetrics[]) {
  const active = metrics.filter((variant) => variant.weight > 0);
  return [...active].sort(
    (a, b) =>
      b.conversionRate - a.conversionRate ||
      b.purchases - a.purchases ||
      b.visitors - a.visitors,
  )[0];
}

export async function runExperimentOptimization(
  experimentId: string,
  options: { force?: boolean } = {},
): Promise<OptimizationRunResult | undefined> {
  const experiment = await getExperiment(experimentId);
  if (!experiment) return undefined;

  const summary = await getExperimentOptimizationSummary(experimentId);
  if (!summary) return undefined;

  if (experiment.status !== "active") {
    return {
      changed: false,
      reason: "O experimento não está ativo.",
      summary,
    };
  }
  if (!isAutomatic(experiment)) {
    return {
      changed: false,
      reason: "A otimização automática está desativada.",
      summary,
    };
  }

  const now = new Date();
  if (
    !options.force &&
    experiment.nextOptimizationAt &&
    experiment.nextOptimizationAt > now
  ) {
    return {
      changed: false,
      reason: "A próxima avaliação ainda não está disponível.",
      summary,
    };
  }

  const variants = await getVariants(experimentId);
  const activeVariants = variants.filter(
    (variant) => variant.status === "active",
  );
  if (activeVariants.length < 2) {
    await setNextEvaluation(experimentId, now);
    return {
      changed: false,
      reason: "São necessárias pelo menos duas variantes ativas.",
      summary: await getExperimentOptimizationSummary(experimentId),
    };
  }

  if (summary.totalVisitors < summary.minimumSampleSizeUsed) {
    await setNextEvaluation(experimentId, now);
    return {
      changed: false,
      reason: `Amostra insuficiente: ${summary.totalVisitors}/${summary.minimumSampleSizeUsed}.`,
      summary: await getExperimentOptimizationSummary(experimentId),
    };
  }

  const latestHistory = summary.history[0];
  const evaluationBlock = Math.max(
    25,
    Math.ceil(summary.minimumSampleSizeUsed / 4),
  );
  if (
    latestHistory &&
    summary.totalVisitors < latestHistory.sampleSize + evaluationBlock
  ) {
    await setNextEvaluation(experimentId, now);
    return {
      changed: false,
      reason: "Ainda não há um novo bloco de dados para avaliar.",
      summary: await getExperimentOptimizationSummary(experimentId),
    };
  }

  const metrics = await getVariantMetrics(experimentId, variants);
  const winner = findWinner(
    metrics.filter((variant) => variant.weight > 0),
  );
  if (!winner) {
    await setNextEvaluation(experimentId, now);
    return {
      changed: false,
      reason: "Não há variante ativa elegível para otimização.",
      summary: await getExperimentOptimizationSummary(experimentId),
    };
  }
  const runnerUp = metrics
    .filter((variant) => variant.variantId !== winner.variantId)
    .sort((a, b) => b.conversionRate - a.conversionRate)[0];
  if (!runnerUp || !hasSufficientEvidence(winner, runnerUp)) {
    await setNextEvaluation(experimentId, now);
    return {
      changed: false,
      reason: "A diferença observada ainda não tem evidência suficiente.",
      summary: await getExperimentOptimizationSummary(experimentId),
    };
  }

  const newWeights = calculateGradualWeights(variants, winner.variantId);
  if (!newWeights) {
    await setNextEvaluation(experimentId, now);
    return {
      changed: false,
      reason: "A distribuição já está no limite seguro de aprendizado.",
      summary: await getExperimentOptimizationSummary(experimentId),
    };
  }

  const previousWeights = Object.fromEntries(
    variants.map((variant) => [variant.id, variant.weight]),
  );
  const nextWeights = Object.fromEntries(
    newWeights.map((variant) => [variant.id, variant.weight]),
  );
  const conversionsByVariant = Object.fromEntries(
    metrics.map((variant) => [variant.variantId, variant.purchases]),
  );
  const visitorsByVariant = Object.fromEntries(
    metrics.map((variant) => [variant.variantId, variant.visitors]),
  );
  const conversionRatesByVariant = Object.fromEntries(
    metrics.map((variant) => [variant.variantId, variant.conversionRate]),
  );
  const reason =
    `${winner.name} apresentou maior conversão com evidência suficiente ` +
    `após atingir a amostra mínima; ajuste gradual de ${OPTIMIZATION_STEP} pontos.`;

  await db.transaction(async (tx) => {
    for (const variant of newWeights) {
      await tx
        .update(experimentVariantsTable)
        .set({ weight: variant.weight })
        .where(eq(experimentVariantsTable.id, variant.id));
    }
    await tx.insert(experimentOptimizationHistoryTable).values({
      id: crypto.randomUUID(),
      experimentId,
      evaluatedAt: now,
      previousWeights,
      newWeights: nextWeights,
      conversionsByVariant,
      visitorsByVariant,
      conversionRatesByVariant,
      winnerVariantId: winner.variantId,
      sampleSize: summary.totalVisitors,
      reason,
      changeType: "automatic",
    });
    await tx
      .update(experimentsTable)
      .set({
        lastOptimizationAt: now,
        nextOptimizationAt: new Date(now.getTime() + OPTIMIZATION_INTERVAL_MS),
        updatedAt: now,
      })
      .where(eq(experimentsTable.id, experimentId));
  });

  return {
    changed: true,
    reason,
    winnerVariantId: winner.variantId,
    summary: (await getExperimentOptimizationSummary(
      experimentId,
    )) as ExperimentOptimizationSummary,
  };
}

export function startExperimentOptimizationScheduler() {
  const run = async () => {
    const experiments = await db
      .select({ id: experimentsTable.id })
      .from(experimentsTable)
      .where(
        and(
          eq(experimentsTable.status, "active"),
          eq(experimentsTable.optimizationMode, "automatic"),
        ),
      );
    for (const experiment of experiments) {
      try {
        await runExperimentOptimization(experiment.id);
      } catch (error) {
        logger.error(
          { err: error, experimentId: experiment.id },
          "Experiment optimization failed",
        );
      }
    }
  };

  const interval = setInterval(() => {
    void run();
  }, OPTIMIZATION_INTERVAL_MS);
  interval.unref();
  return interval;
}