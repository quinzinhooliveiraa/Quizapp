import { and, eq, sql } from "drizzle-orm";
import { db, sessionsTable } from "@workspace/db";
import { buildPurchaseAccessEmail, sendEmailViaBrevo } from "./brevo";
import { sendPurchaseNotification } from "./push";
import { sendMetaEvent } from "./meta-conversions";
import { linkPurchaseToQuizLead } from "./link-purchase-to-lead";

type AccessUpdateExecutor = Pick<typeof db, "update">;

export async function grantSessionAccess(
  executor: AccessUpdateExecutor,
  sessionId: string,
) {
  const [updated] = await executor
    .update(sessionsTable)
    .set({
      accessGranted: true,
      metaPurchaseSent: sql`CASE
        WHEN ${sessionsTable.metaConsent}
          AND NOT ${sessionsTable.internal}
          AND ${sessionsTable.lockedPriceCents} IS NOT NULL
          AND ${sessionsTable.currency} IS NOT NULL
        THEN TRUE
        ELSE ${sessionsTable.metaPurchaseSent}
      END`,
    })
    .where(
      and(
        eq(sessionsTable.id, sessionId),
        eq(sessionsTable.accessGranted, false),
      ),
    )
    .returning({
      id: sessionsTable.id,
      buyerName: sessionsTable.buyerName,
      buyerEmail: sessionsTable.buyerEmail,
      packageName: sessionsTable.packageName,
      accessGranted: sessionsTable.accessGranted,
      visitorKey: sessionsTable.visitorKey,
      lockedPriceCents: sessionsTable.lockedPriceCents,
      currency: sessionsTable.currency,
      internal: sessionsTable.internal,
      metaConsent: sessionsTable.metaConsent,
      metaPurchaseSent: sessionsTable.metaPurchaseSent,
      metaFbp: sessionsTable.metaFbp,
      metaFbc: sessionsTable.metaFbc,
      metaClientIp: sessionsTable.metaClientIp,
      metaClientUserAgent: sessionsTable.metaClientUserAgent,
      metaSourceUrl: sessionsTable.metaSourceUrl,
    });
  return updated;
}

export type GrantedSession = NonNullable<
  Awaited<ReturnType<typeof grantSessionAccess>>
>;

export async function resendGrantedAccessEmail(params: {
  buyerName: string;
  buyerEmail: string;
  sessionId: string;
}) {
  const baseUrl =
    process.env.PUBLIC_BASE_URL || "https://www.perguntasdeconexao.com.br";
  const payload = buildPurchaseAccessEmail({
    buyerName: params.buyerName,
    accessUrl: `${baseUrl}/acesso/${encodeURIComponent(params.sessionId)}`,
    loginUrl: `${baseUrl}/login`,
  });
  return sendEmailViaBrevo({
    to: params.buyerEmail,
    toName: params.buyerName,
    subject: payload.subject,
    htmlContent: payload.htmlContent,
    textContent: payload.textContent,
  });
}

export function notifyGrantedAccess(
  session: GrantedSession | undefined,
  onError: (error: unknown, message: string) => void,
) {
  if (!session?.accessGranted) return;
  void linkPurchaseToQuizLead(session);

  if (
    session.metaConsent &&
    session.metaPurchaseSent &&
    !session.internal &&
    session.lockedPriceCents != null &&
    session.currency
  ) {
    void sendMetaEvent("Purchase", {
      eventId: `purchase_${session.id}`,
      value: session.lockedPriceCents / 100,
      currency: session.currency,
      sourceUrl: session.metaSourceUrl,
      userData: {
        email: session.buyerEmail,
        firstName: session.buyerName.split(/\s+/)[0],
        visitorKey: session.visitorKey,
        clientIpAddress: session.metaClientIp,
        clientUserAgent: session.metaClientUserAgent,
        fbp: session.metaFbp,
        fbc: session.metaFbc,
      },
    });
  }

  void sendPurchaseNotification({
    buyerName: session.buyerName,
    packageName: session.packageName,
  }).catch((error) => onError(error, "Purchase push notification failed"));

  if (!session.buyerEmail) return;

  void resendGrantedAccessEmail({
    buyerName: session.buyerName,
    buyerEmail: session.buyerEmail,
    sessionId: session.id,
  })
    .then((result) => {
      if (!result.ok) onError(result.error, "Purchase access email failed");
    })
    .catch((error) => onError(error, "Purchase access email threw"));
}