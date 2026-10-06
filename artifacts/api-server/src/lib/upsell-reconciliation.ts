import { logger } from "./logger";
import {
  listDueAccessEmails,
  releaseAccessEmail,
} from "./access-email-queue";
import { ensureUpsellLaunchAt } from "./upsell-eligibility";
import { reconcilePendingUpsellOrders } from "./upsell";

let orderReconciliationRunning = false;

async function reconcileAccessEmails(): Promise<void> {
  try {
    const sessionIds = await listDueAccessEmails(20);
    for (const sessionId of sessionIds) {
      try {
        await releaseAccessEmail(sessionId);
      } catch (error) {
        logger.error(
          { err: error, sessionId },
          "Access email queue item failed",
        );
      }
    }
  } catch (error) {
    logger.error({ err: error }, "Access email queue scan failed");
  }
}

async function reconcileOrders(): Promise<void> {
  if (orderReconciliationRunning) return;
  orderReconciliationRunning = true;
  try {
    await reconcilePendingUpsellOrders();
  } catch (error) {
    logger.error({ err: error }, "Upsell order reconciliation failed");
  } finally {
    orderReconciliationRunning = false;
  }
}

export function startUpsellReconciliationScheduler(): void {
  void ensureUpsellLaunchAt().catch((error) =>
    logger.error({ err: error }, "Failed to initialize upsell launch date"),
  );

  const tick = () => {
    void (async () => {
      await reconcileAccessEmails();
      void reconcileOrders();
    })().catch((error) =>
      logger.error({ err: error }, "Upsell scheduler tick failed"),
    );
  };
  const interval = setInterval(tick, 30_000);
  interval.unref();
  tick();
}
