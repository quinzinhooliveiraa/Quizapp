import webpush from "web-push";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

type PurchaseNotification = {
  buyerName: string;
  packageName: string;
};

function isConfigured() {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT,
  );
}

export async function sendPurchaseNotification({
  buyerName,
  packageName,
}: PurchaseNotification): Promise<void> {
  if (!isConfigured()) {
    logger.warn("Push notification skipped: VAPID keys are not configured");
    return;
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );

  const subscriptions = await db.select().from(pushSubscriptionsTable);
  const payload = JSON.stringify({
    title: "Nova venda! 🎉",
    body: `${buyerName} comprou ${packageName}`,
  });

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload,
        );
      } catch (error) {
        const statusCode =
          typeof error === "object" && error !== null && "statusCode" in error
            ? Number(error.statusCode)
            : undefined;
        if (statusCode === 404 || statusCode === 410) {
          await db
            .delete(pushSubscriptionsTable)
            .where(eq(pushSubscriptionsTable.id, subscription.id));
          return;
        }
        logger.error(
          { err: error, endpoint: subscription.endpoint },
          "Push notification delivery failed",
        );
      }
    }),
  );
}
