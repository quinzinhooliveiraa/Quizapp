import { and, eq } from "drizzle-orm";
import { db, sessionsTable } from "@workspace/db";
import { buildPurchaseAccessEmail, sendEmailViaBrevo } from "./brevo";
import { sendPurchaseNotification } from "./push";
import { sendMetaEvent } from "./meta-conversions";

type AccessUpdateExecutor = Pick<typeof db, "update">;

export async function grantSessionAccess(
  executor: AccessUpdateExecutor,
  sessionId: string,
) {
  const [updated] = await executor
    .update(sessionsTable)
    .set({ accessGranted: true })
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

export function notifyGrantedAccess(
  session: GrantedSession | undefined,
  onError: (error: unknown, message: string) => void,
) {
  if (!session?.accessGranted) return;

  if (
    session.metaConsent &&
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

  const baseUrl =
    process.env.PUBLIC_BASE_URL || "https://www.perguntasdeconexao.com.br";
  const payload = buildPurchaseAccessEmail({
    buyerName: session.buyerName,
    accessUrl: `${baseUrl}/acesso/${encodeURIComponent(session.id)}`,
    loginUrl: `${baseUrl}/login`,
  });

  void sendEmailViaBrevo({
    to: session.buyerEmail,
    toName: session.buyerName,
    subject: payload.subject,
    htmlContent: payload.htmlContent,
    textContent: payload.textContent,
  })
    .then((result) => {
      if (!result.ok) onError(result.error, "Purchase access email failed");
    })
    .catch((error) => onError(error, "Purchase access email threw"));
}