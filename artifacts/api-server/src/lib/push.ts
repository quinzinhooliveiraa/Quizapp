import webpush from "web-push";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { getSupportDiagnosis } from "./support-diagnosis";

type PurchaseNotification = {
  buyerName: string;
  packageName: string;
};

type SupportNotification = {
  email: string;
  topic?: string;
  accessStatus?: string;
};

const SUPPORT_TOPIC_LABELS: Record<string, string> = {
  sem_acesso: "comprei e não consigo entrar",
  email_nao_chegou: "paguei e não recebi o e-mail",
  convite: "recebi um convite e não abre",
  pagamento: "problema no pagamento",
  outro: "outro assunto / sugestão",
  compra: "compra e acesso",
};

const ACCESS_STATUS_LABELS: Record<string, string> = {
  tem_acesso: "tem acesso",
  so_convite: "só convite",
  sem_acesso: "sem acesso",
  desconhecido: "não verificado",
  "dono com acesso": "tem acesso",
  "convidado com acesso": "só convite",
  "sem acesso confirmado": "sem acesso",
  "não verificado": "não verificado",
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

export async function sendSupportNotification({
  email,
  topic,
  accessStatus,
}: SupportNotification): Promise<void> {
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
  const diagnosis = getSupportDiagnosis(topic, accessStatus);
  const topicLabel =
    SUPPORT_TOPIC_LABELS[topic || ""] || topic || "suporte";
  const accessLabel =
    ACCESS_STATUS_LABELS[accessStatus || ""] ||
    accessStatus ||
    "não verificado";
  const payload = JSON.stringify({
    title: diagnosis?.translation || "Nova mensagem de suporte",
    body: `Suporte: ${topicLabel} — ${accessLabel} (${email || "sem e-mail"})`,
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
          "Support notification delivery failed",
        );
      }
    }),
  );
}
