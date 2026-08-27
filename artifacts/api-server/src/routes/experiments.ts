import crypto from "node:crypto";
import { Router, type IRouter } from "express";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import {
  db,
  experimentVariantsTable,
  experimentsTable,
  pageEventsTable,
  sessionsTable,
} from "@workspace/db";
import {
  CreateAdminExperimentBody,
  CreateAdminExperimentResponse,
  GetExperimentAssignmentParams,
  GetExperimentAssignmentQueryParams,
  GetExperimentAssignmentResponse,
  GetActiveExperimentAssignmentQueryParams,
  GetActiveExperimentAssignmentResponse,
  GetExperimentLinkAssignmentParams,
  GetExperimentLinkAssignmentQueryParams,
  GetExperimentLinkAssignmentResponse,
  GetAdminExperimentAnalyticsParams,
  GetAdminExperimentAnalyticsQueryParams,
  GetAdminExperimentAnalyticsResponse,
  GetAdminExperimentOptimizationParams,
  GetAdminExperimentOptimizationQueryParams,
  GetAdminExperimentOptimizationResponse,
  ListAdminExperimentsQueryParams,
  ListAdminExperimentsResponse,
  RunAdminExperimentOptimizationParams,
  RunAdminExperimentOptimizationQueryParams,
  RunAdminExperimentOptimizationResponse,
  UpdateAdminExperimentOptimizationBody,
  UpdateAdminExperimentOptimizationParams,
  UpdateAdminExperimentOptimizationQueryParams,
  UpdateAdminExperimentOptimizationResponse,
  UpdateAdminExperimentStatusBody,
  UpdateAdminExperimentStatusParams,
  UpdateAdminExperimentStatusQueryParams,
  UpdateAdminExperimentStatusResponse,
} from "@workspace/api-zod";
import {
  calculateRestoredWeights,
  getExperimentOptimizationSummary,
  runExperimentOptimization,
} from "../lib/experiment-optimization";
import {
  getOrCreateExperimentAssignment,
  resolveActiveExperimentAssignment,
} from "../lib/experiments";
import { isAdminSession } from "./feedback";

const router: IRouter = Router();

async function getExperimentWithVariants(id: string) {
  const [experiment] = await db
    .select()
    .from(experimentsTable)
    .where(eq(experimentsTable.id, id))
    .limit(1);
  if (!experiment) return undefined;

  const variants = await db
    .select()
    .from(experimentVariantsTable)
    .where(eq(experimentVariantsTable.experimentId, id))
    .orderBy(asc(experimentVariantsTable.createdAt));
  return { ...experiment, variants };
}

async function getExperimentBySlug(slug: string) {
  const [experiment] = await db
    .select()
    .from(experimentsTable)
    .where(eq(experimentsTable.slug, slug))
    .limit(1);
  if (!experiment) return undefined;

  const variants = await db
    .select()
    .from(experimentVariantsTable)
    .where(eq(experimentVariantsTable.experimentId, experiment.id))
    .orderBy(asc(experimentVariantsTable.createdAt));
  return { ...experiment, variants };
}

function slugifyExperimentName(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 150) || "experimento"
  );
}

async function createUniqueExperimentSlug(name: string) {
  const base = slugifyExperimentName(name);
  let candidate = base;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const [existing] = await db
      .select({ id: experimentsTable.id })
      .from(experimentsTable)
      .where(eq(experimentsTable.slug, candidate))
      .limit(1);
    if (!existing) return candidate;
    const suffix = crypto.randomBytes(3).toString("hex");
    candidate = `${base.slice(0, 141)}-${suffix}`;
  }
  throw new Error("Não foi possível gerar um link único para o experimento.");
}

async function getExperimentsWithVariants() {
  const [experiments, variants] = await Promise.all([
    db
      .select()
      .from(experimentsTable)
      .orderBy(desc(experimentsTable.createdAt)),
    db
      .select()
      .from(experimentVariantsTable)
      .orderBy(asc(experimentVariantsTable.createdAt)),
  ]);
  const variantsByExperiment = new Map<string, typeof variants>();
  for (const variant of variants) {
    const current = variantsByExperiment.get(variant.experimentId) || [];
    current.push(variant);
    variantsByExperiment.set(variant.experimentId, current);
  }
  return experiments.map((experiment) => ({
    ...experiment,
    variants: variantsByExperiment.get(experiment.id) || [],
  }));
}

router.get("/admin/experiments", async (req, res): Promise<void> => {
  const parsed = ListAdminExperimentsQueryParams.safeParse(req.query);
  if (!parsed.success || !(await isAdminSession(parsed.data.sessionId))) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  res.json(
    ListAdminExperimentsResponse.parse({
      experiments: await getExperimentsWithVariants(),
    }),
  );
});

router.post("/admin/experiments", async (req, res): Promise<void> => {
  const sessionId =
    typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
  if (!(await isAdminSession(sessionId))) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  const parsed = CreateAdminExperimentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const name = parsed.data.name.trim();
  const objective = parsed.data.objective.trim();
  const variants = parsed.data.variants.map((variant) => ({
    name: variant.name.trim(),
    path: variant.path.trim(),
    weight: variant.weight,
    status: variant.status || "active",
  }));
  if (
    parsed.data.minimumSampleSizeMode === "custom" &&
    (typeof parsed.data.minimumSampleSize !== "number" ||
      !Number.isInteger(parsed.data.minimumSampleSize) ||
      parsed.data.minimumSampleSize < 2 ||
      parsed.data.minimumSampleSize > 100_000)
  ) {
    res.status(400).json({
      error:
        "Informe uma amostra mínima inteira entre 2 e 100000 para o modo personalizado.",
    });
    return;
  }
  if (
    !name ||
    !objective ||
    variants.some(
      (variant) =>
        !variant.name ||
        !variant.path.startsWith("/") ||
        variant.path.startsWith("//") ||
        !Number.isInteger(variant.weight) ||
        variant.weight < 0 ||
        variant.weight > 100,
    ) ||
    variants.reduce((total, variant) => total + variant.weight, 0) !== 100
  ) {
    res.status(400).json({
      error:
        "Preencha as variantes e garanta que os pesos sejam inteiros e somem exatamente 100%.",
    });
    return;
  }

  const experimentId = crypto.randomUUID();
  const slug = await createUniqueExperimentSlug(name);
  const now = new Date();
  const [experiment] = await db
    .insert(experimentsTable)
    .values({
      id: experimentId,
      name,
      slug,
      description: parsed.data.description?.trim() || null,
      objective,
      status: "draft",
      optimizationMode: parsed.data.optimizationMode,
      minimumSampleSizeMode: parsed.data.minimumSampleSizeMode,
      minimumSampleSize:
        parsed.data.minimumSampleSizeMode === "custom"
          ? parsed.data.minimumSampleSize ?? null
          : null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  const insertedVariants = await db
    .insert(experimentVariantsTable)
    .values(
      variants.map((variant) => ({
        id: crypto.randomUUID(),
        experimentId,
        ...variant,
      })),
    )
    .returning();

  res.status(201).json(
    CreateAdminExperimentResponse.parse({
      ...experiment,
      variants: insertedVariants,
    }),
  );
});

router.patch(
  "/admin/experiments/:experimentId",
  async (req, res): Promise<void> => {
    const params = UpdateAdminExperimentStatusParams.safeParse(req.params);
    const query = UpdateAdminExperimentStatusQueryParams.safeParse(req.query);
    if (
      !params.success ||
      !query.success ||
      !(await isAdminSession(query.data.sessionId))
    ) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
    const parsed = UpdateAdminExperimentStatusBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    if (parsed.data.status === "active") {
      const variants = await db
        .select()
        .from(experimentVariantsTable)
        .where(
          eq(experimentVariantsTable.experimentId, params.data.experimentId),
        );
      const activeWeight = variants
        .filter((variant) => variant.status === "active")
        .reduce((total, variant) => total + variant.weight, 0);
      if (activeWeight !== 100) {
        res.status(400).json({
          error:
            "Ative o experimento somente quando as variantes ativas somarem exatamente 100%.",
        });
        return;
      }
    }

    const [experiment] = await db
      .update(experimentsTable)
      .set({ status: parsed.data.status, updatedAt: new Date() })
      .where(eq(experimentsTable.id, params.data.experimentId))
      .returning();
    if (!experiment) {
      res.status(404).json({ error: "Experimento não encontrado" });
      return;
    }
    const updated = await getExperimentWithVariants(experiment.id);
    res.json(UpdateAdminExperimentStatusResponse.parse(updated));
  },
);

router.get(
  "/experiments/:experimentId/assignment",
  async (req, res): Promise<void> => {
    const params = GetExperimentAssignmentParams.safeParse(req.params);
    const query = GetExperimentAssignmentQueryParams.safeParse(req.query);
    if (!params.success || !query.success) {
      res.status(400).json({ error: "Identificação do experimento inválida" });
      return;
    }

    const assignment = await getOrCreateExperimentAssignment(
      params.data.experimentId,
      query.data.visitorKey,
    );
    if (!assignment) {
      res.status(404).json({ error: "Experimento ativo não encontrado" });
      return;
    }
    res.json(GetExperimentAssignmentResponse.parse(assignment));
  },
);

router.get("/experiments/assignment", async (req, res): Promise<void> => {
  const query = GetActiveExperimentAssignmentQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Identificação do visitante inválida" });
    return;
  }

  const assignment = await resolveActiveExperimentAssignment(
    query.data.visitorKey,
  );
  if (!assignment) {
    res.status(404).json({ error: "Nenhum experimento ativo encontrado" });
    return;
  }
  res.json(GetActiveExperimentAssignmentResponse.parse(assignment));
});

router.get(
  "/experiments/link/:experimentSlug",
  async (req, res): Promise<void> => {
    const params = GetExperimentLinkAssignmentParams.safeParse(req.params);
    const query = GetExperimentLinkAssignmentQueryParams.safeParse(req.query);
    if (!params.success || !query.success) {
      res.status(400).json({ error: "Link de experimento inválido" });
      return;
    }

    const experiment = await getExperimentBySlug(params.data.experimentSlug);
    if (!experiment || experiment.status !== "active") {
      res.status(404).json({ error: "Este experimento não está disponível." });
      return;
    }

    const assignment = await getOrCreateExperimentAssignment(
      experiment.id,
      query.data.visitorKey,
    );
    if (!assignment) {
      res.status(404).json({ error: "Este experimento não está disponível." });
      return;
    }
    res.json(GetExperimentLinkAssignmentResponse.parse(assignment));
  },
);

router.get(
  "/admin/experiments/:experimentId/optimization",
  async (req, res): Promise<void> => {
    const params = GetAdminExperimentOptimizationParams.safeParse(req.params);
    const query = GetAdminExperimentOptimizationQueryParams.safeParse(req.query);
    if (
      !params.success ||
      !query.success ||
      !(await isAdminSession(query.data.sessionId))
    ) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }

    const summary = await getExperimentOptimizationSummary(
      params.data.experimentId,
    );
    if (!summary) {
      res.status(404).json({ error: "Experimento não encontrado" });
      return;
    }
    res.json(GetAdminExperimentOptimizationResponse.parse(summary));
  },
);

router.patch(
  "/admin/experiments/:experimentId/optimization",
  async (req, res): Promise<void> => {
    const params = UpdateAdminExperimentOptimizationParams.safeParse(req.params);
    const query = UpdateAdminExperimentOptimizationQueryParams.safeParse(
      req.query,
    );
    if (
      !params.success ||
      !query.success ||
      !(await isAdminSession(query.data.sessionId))
    ) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }

    const parsed = UpdateAdminExperimentOptimizationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [experiment] = await db
      .select()
      .from(experimentsTable)
      .where(eq(experimentsTable.id, params.data.experimentId))
      .limit(1);
    if (!experiment) {
      res.status(404).json({ error: "Experimento não encontrado" });
      return;
    }

    const nextMode = parsed.data.optimizationMode ?? experiment.optimizationMode;
    const nextSampleMode =
      parsed.data.minimumSampleSizeMode ?? experiment.minimumSampleSizeMode;
    const nextSampleSize =
      parsed.data.minimumSampleSize === undefined
        ? experiment.minimumSampleSize
        : parsed.data.minimumSampleSize;
    if (
      nextSampleMode === "custom" &&
      (typeof nextSampleSize !== "number" ||
        !Number.isInteger(nextSampleSize) ||
        nextSampleSize < 2 ||
        nextSampleSize > 100_000)
    ) {
      res.status(400).json({
        error:
          "Informe uma amostra mínima inteira entre 2 e 100000 para o modo personalizado.",
      });
      return;
    }

    const shouldRestore = parsed.data.restoreWeights === true;
    const variants = shouldRestore
      ? await db
          .select()
          .from(experimentVariantsTable)
          .where(eq(experimentVariantsTable.experimentId, experiment.id))
          .orderBy(asc(experimentVariantsTable.createdAt))
      : [];
    const restoredWeights = shouldRestore
      ? calculateRestoredWeights(variants)
      : null;
    if (shouldRestore && !restoredWeights) {
      res.status(400).json({
        error: "São necessárias pelo menos duas variantes ativas para restaurar a distribuição.",
      });
      return;
    }

    const now = new Date();
    await db.transaction(async (tx) => {
      const experimentPatch: Partial<typeof experimentsTable.$inferInsert> = {
        updatedAt: now,
      };
      if (parsed.data.optimizationMode !== undefined) {
        experimentPatch.optimizationMode = nextMode;
        experimentPatch.nextOptimizationAt =
          nextMode === "automatic" ? now : null;
      }
      if (parsed.data.minimumSampleSizeMode !== undefined) {
        experimentPatch.minimumSampleSizeMode = nextSampleMode;
      }
      if (parsed.data.minimumSampleSize !== undefined) {
        experimentPatch.minimumSampleSize = parsed.data.minimumSampleSize;
      } else if (nextSampleMode === "automatic") {
        experimentPatch.minimumSampleSize = null;
      }
      await tx
        .update(experimentsTable)
        .set(experimentPatch)
        .where(eq(experimentsTable.id, experiment.id));

      if (restoredWeights) {
        for (const variant of restoredWeights) {
          await tx
            .update(experimentVariantsTable)
            .set({ weight: variant.weight })
            .where(eq(experimentVariantsTable.id, variant.id));
        }
      }
    });

    const summary = await getExperimentOptimizationSummary(experiment.id);
    res.json(UpdateAdminExperimentOptimizationResponse.parse(summary));
  },
);

router.post(
  "/admin/experiments/:experimentId/optimization/run",
  async (req, res): Promise<void> => {
    const params = RunAdminExperimentOptimizationParams.safeParse(req.params);
    const query = RunAdminExperimentOptimizationQueryParams.safeParse(req.query);
    if (
      !params.success ||
      !query.success ||
      !(await isAdminSession(query.data.sessionId))
    ) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }

    const result = await runExperimentOptimization(params.data.experimentId, {
      force: true,
    });
    if (!result) {
      res.status(404).json({ error: "Experimento não encontrado" });
      return;
    }
    res.json(RunAdminExperimentOptimizationResponse.parse(result));
  },
);

router.get(
  "/admin/experiments/:experimentId/analytics",
  async (req, res): Promise<void> => {
    const params = GetAdminExperimentAnalyticsParams.safeParse(req.params);
    const query = GetAdminExperimentAnalyticsQueryParams.safeParse(req.query);
    if (
      !params.success ||
      !query.success ||
      !(await isAdminSession(query.data.sessionId))
    ) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }

    const experiment = await getExperimentWithVariants(
      params.data.experimentId,
    );
    if (!experiment) {
      res.status(404).json({ error: "Experimento não encontrado" });
      return;
    }

    const variants = await Promise.all(
      experiment.variants.map(async (variant) => {
        const [visitors, ctaClicks, checkouts, purchases] = await Promise.all([
          db
            .select({
              value: sql<number>`count(distinct ${pageEventsTable.visitorKey})`,
            })
            .from(pageEventsTable)
            .where(
              and(
                eq(pageEventsTable.experimentId, experiment.id),
                eq(pageEventsTable.experimentVariantId, variant.id),
                eq(pageEventsTable.eventType, "view"),
              ),
            ),
          db
            .select({ value: count() })
            .from(pageEventsTable)
            .where(
              and(
                eq(pageEventsTable.experimentId, experiment.id),
                eq(pageEventsTable.experimentVariantId, variant.id),
                eq(pageEventsTable.eventType, "cta_click"),
              ),
            ),
          db
            .select({ value: count() })
            .from(sessionsTable)
            .where(
              and(
                eq(sessionsTable.experimentId, experiment.id),
                eq(sessionsTable.experimentVariantId, variant.id),
              ),
            ),
          db
            .select({ value: count() })
            .from(sessionsTable)
            .where(
              and(
                eq(sessionsTable.experimentId, experiment.id),
                eq(sessionsTable.experimentVariantId, variant.id),
                eq(sessionsTable.accessGranted, true),
              ),
            ),
        ]);

        return {
          variantId: variant.id,
          name: variant.name,
          path: variant.path,
          weight: variant.weight,
          visitors: Number(visitors[0]?.value || 0),
          ctaClicks: Number(ctaClicks[0]?.value || 0),
          checkoutsStarted: Number(checkouts[0]?.value || 0),
          purchasesConfirmed: Number(purchases[0]?.value || 0),
        };
      }),
    );

    res.json(
      GetAdminExperimentAnalyticsResponse.parse({
        experimentId: experiment.id,
        variants,
      }),
    );
  },
);

export default router;
