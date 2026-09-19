import { and, eq, gte } from "drizzle-orm";
import { db, sessionsTable } from "@workspace/db";
import {
  fetchAbacatePixStatus,
} from "./abacatepay";
import { fetchStripePaymentIntentStatus } from "./stripe";
import {
  grantSessionAccess,
  notifyGrantedAccess,
} from "./payment-access";
import { logger } from "./logger";

const PENDING_PAYMENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_PENDING_PAYMENTS_PER_PASS = 100;

let reconciliationRunning = false;

export async function reconcilePendingPayments(): Promise<number> {
  if (reconciliationRunning) return 0;
  reconciliationRunning = true;

  try {
    const since = new Date(Date.now() - PENDING_PAYMENT_WINDOW_MS);
    const pending = await db
      .select({
        id: sessionsTable.id,
        abacateChargeId: sessionsTable.abacateChargeId,
        stripePaymentIntentId: sessionsTable.stripePaymentIntentId,
      })
      .from(sessionsTable)
      .where(
        and(
          eq(sessionsTable.accessGranted, false),
          eq(sessionsTable.internal, false),
          gte(sessionsTable.createdAt, since),
        ),
      )
      .orderBy(sessionsTable.createdAt)
      .limit(MAX_PENDING_PAYMENTS_PER_PASS);

    let granted = 0;
    for (const session of pending) {
      const paymentStatus = session.abacateChargeId
        ? await fetchAbacatePixStatus(session.abacateChargeId)
        : session.stripePaymentIntentId
          ? await fetchStripePaymentIntentStatus(session.stripePaymentIntentId)
          : null;

      const isPaid =
        typeof paymentStatus === "string"
          ? paymentStatus === "succeeded"
          : paymentStatus?.status === "PAID";
      if (!isPaid) continue;

      const updated = await grantSessionAccess(db, session.id);
      if (!updated) continue;

      granted += 1;
      notifyGrantedAccess(updated, (error, message) =>
        logger.error({ err: error, sessionId: session.id }, message),
      );
      logger.info(
        { sessionId: session.id },
        "Pending payment reconciled and access granted",
      );
    }

    return granted;
  } catch (error) {
    logger.error({ err: error }, "Pending payment reconciliation failed");
    return 0;
  } finally {
    reconciliationRunning = false;
  }
}

export function startPaymentReconciliationScheduler() {
  const interval = setInterval(() => {
    void reconcilePendingPayments();
  }, 15_000);
  interval.unref();
  void reconcilePendingPayments();
}