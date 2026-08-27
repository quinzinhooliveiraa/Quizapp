import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
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
