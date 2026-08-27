import crypto from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  experimentAssignmentsTable,
  experimentVariantsTable,
  experimentsTable,
} from "@workspace/db";

const ACTIVE_STATUS = "active";

export async function getOrCreateExperimentAssignment(
  experimentId: string,
  visitorKey: string,
) {
  const [experiment] = await db
    .select()
    .from(experimentsTable)
    .where(
      and(
        eq(experimentsTable.id, experimentId),
        eq(experimentsTable.status, ACTIVE_STATUS),
      ),
    )
    .limit(1);

  if (!experiment) return undefined;

  const [existing] = await db
    .select()
    .from(experimentAssignmentsTable)
    .where(
      and(
        eq(experimentAssignmentsTable.experimentId, experimentId),
        eq(experimentAssignmentsTable.visitorKey, visitorKey),
      ),
    )
    .limit(1);

  if (existing) return existing;

  const variants = await db
    .select()
    .from(experimentVariantsTable)
    .where(eq(experimentVariantsTable.experimentId, experimentId));
  const eligibleVariants = variants.filter(
    (variant) => variant.status === ACTIVE_STATUS && variant.weight > 0,
  );
  const totalWeight = eligibleVariants.reduce(
    (total, variant) => total + variant.weight,
    0,
  );
  if (totalWeight !== 100) {
    throw new Error("O experimento ativo precisa distribuir 100% do tráfego.");
  }

  const bucket =
    crypto
      .createHash("sha256")
      .update(`${experimentId}:${visitorKey}`)
      .digest()
      .readUInt32BE(0) % 100;
  let cumulativeWeight = 0;
  const selectedVariant =
    eligibleVariants.find((variant) => {
      cumulativeWeight += variant.weight;
      return bucket < cumulativeWeight;
    }) || eligibleVariants[eligibleVariants.length - 1];

  await db
    .insert(experimentAssignmentsTable)
    .values({
      id: crypto.randomUUID(),
      experimentId,
      experimentVariantId: selectedVariant.id,
      visitorKey,
      landingPage: selectedVariant.path,
    })
    .onConflictDoNothing({
      target: [
        experimentAssignmentsTable.experimentId,
        experimentAssignmentsTable.visitorKey,
      ],
    });

  const [assignment] = await db
    .select()
    .from(experimentAssignmentsTable)
    .where(
      and(
        eq(experimentAssignmentsTable.experimentId, experimentId),
        eq(experimentAssignmentsTable.visitorKey, visitorKey),
      ),
    )
    .limit(1);

  return assignment;
}

/**
 * Returns the most recently configured assignment for a visitor, but only
 * while its experiment is active. This is intentionally separate from the
 * router entry point: callers that are not part of the future router can
 * enrich tracking without creating a new assignment.
 */
export async function getActiveAssignmentForVisitor(visitorKey: string) {
  const [assignment] = await db
    .select({
      id: experimentAssignmentsTable.id,
      experimentId: experimentAssignmentsTable.experimentId,
      experimentVariantId: experimentAssignmentsTable.experimentVariantId,
      visitorKey: experimentAssignmentsTable.visitorKey,
      landingPage: experimentAssignmentsTable.landingPage,
      assignedAt: experimentAssignmentsTable.assignedAt,
    })
    .from(experimentAssignmentsTable)
    .innerJoin(
      experimentsTable,
      eq(experimentsTable.id, experimentAssignmentsTable.experimentId),
    )
    .where(
      and(
        eq(experimentAssignmentsTable.visitorKey, visitorKey),
        eq(experimentsTable.status, ACTIVE_STATUS),
      ),
    )
    .orderBy(desc(experimentAssignmentsTable.assignedAt))
    .limit(1);

  return assignment;
}

/**
 * Future router entry point. It chooses the newest active experiment and
 * creates (or reuses) one deterministic assignment for the visitor.
 *
 * No current landing page calls this function. Keeping the activation point
 * explicit prevents a draft or an accidental database row from changing `/`.
 */
export async function resolveActiveExperimentAssignment(visitorKey: string) {
  const [experiment] = await db
    .select({ id: experimentsTable.id })
    .from(experimentsTable)
    .where(eq(experimentsTable.status, ACTIVE_STATUS))
    .orderBy(desc(experimentsTable.createdAt))
    .limit(1);

  if (!experiment) return undefined;
  return getOrCreateExperimentAssignment(experiment.id, visitorKey);
}
