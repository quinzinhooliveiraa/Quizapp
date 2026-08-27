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
  GetAdminExperimentAnalyticsParams,
  GetAdminExperimentAnalyticsQueryParams,
  GetAdminExperimentAnalyticsResponse,
  ListAdminExperimentsQueryParams,
  ListAdminExperimentsResponse,
  UpdateAdminExperimentStatusBody,
  UpdateAdminExperimentStatusParams,
  UpdateAdminExperimentStatusQueryParams,
  UpdateAdminExperimentStatusResponse,
} from "@workspace/api-zod";
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
  const now = new Date();
  const [experiment] = await db
    .insert(experimentsTable)
    .values({
      id: experimentId,
      name,
      description: parsed.data.description?.trim() || null,
      objective,
      status: "draft",
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
