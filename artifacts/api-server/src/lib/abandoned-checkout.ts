import {
  and,
  eq,
  isNotNull,
  isNull,
  lte,
  or,
} from "drizzle-orm";
import { db, sessionsTable } from "@workspace/db";
import {
  buildAbandonedCheckoutEmail,
  sendEmailViaBrevo,
} from "./brevo";
import { logger } from "./logger";

const FIRST_EMAIL_AFTER_MS = 20 * 60 * 1000;
const SECOND_EMAIL_AFTER_MS = 24 * 60 * 60 * 1000;
const THIRD_EMAIL_AFTER_MS = 2 * 24 * 60 * 60 * 1000;
const FOURTH_EMAIL_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
const FIFTH_EMAIL_AFTER_MS = 4 * 24 * 60 * 60 * 1000;
const RESEND_BATCH_SIZE = 100;
const SCHEDULER_INTERVAL_MS = 5 * 60 * 1000;
const PIX_LIFETIME_MS = 15 * 60 * 1000;

let abandonedCheckoutJobRunning = false;

export async function sendAbandonedCheckoutEmails(): Promise<number> {
  if (abandonedCheckoutJobRunning) return 0;
  abandonedCheckoutJobRunning = true;

  try {
    const now = Date.now();
    const firstCutoff = new Date(now - FIRST_EMAIL_AFTER_MS);
    const secondCutoff = new Date(now - SECOND_EMAIL_AFTER_MS);
    const thirdCutoff = new Date(now - THIRD_EMAIL_AFTER_MS);
    const fourthCutoff = new Date(now - FOURTH_EMAIL_AFTER_MS);
    const fifthCutoff = new Date(now - FIFTH_EMAIL_AFTER_MS);
    const candidates = await db
      .select({
        id: sessionsTable.id,
        buyerName: sessionsTable.buyerName,
        buyerEmail: sessionsTable.buyerEmail,
        createdAt: sessionsTable.createdAt,
        pixBrcode: sessionsTable.pixBrcode,
        pixExpiresAt: sessionsTable.pixExpiresAt,
        abandonEmail1At: sessionsTable.abandonEmail1At,
        abandonEmail2At: sessionsTable.abandonEmail2At,
        abandonEmail3At: sessionsTable.abandonEmail3At,
        abandonEmail4At: sessionsTable.abandonEmail4At,
        abandonEmail5At: sessionsTable.abandonEmail5At,
      })
      .from(sessionsTable)
      .where(
        and(
          eq(sessionsTable.accessGranted, false),
          eq(sessionsTable.internal, false),
          isNotNull(sessionsTable.buyerEmail),
          or(
            and(
              lte(sessionsTable.createdAt, firstCutoff),
              isNull(sessionsTable.abandonEmail1At),
            ),
            and(
              lte(sessionsTable.createdAt, secondCutoff),
              isNotNull(sessionsTable.abandonEmail1At),
              isNull(sessionsTable.abandonEmail2At),
            ),
            and(
              lte(sessionsTable.createdAt, thirdCutoff),
              isNotNull(sessionsTable.abandonEmail2At),
              isNull(sessionsTable.abandonEmail3At),
            ),
            and(
              lte(sessionsTable.createdAt, fourthCutoff),
              isNotNull(sessionsTable.abandonEmail3At),
              isNull(sessionsTable.abandonEmail4At),
            ),
            and(
              lte(sessionsTable.createdAt, fifthCutoff),
              isNotNull(sessionsTable.abandonEmail4At),
              isNull(sessionsTable.abandonEmail5At),
            ),
          ),
        ),
      )
      .orderBy(sessionsTable.createdAt)
      .limit(RESEND_BATCH_SIZE);

    let sent = 0;
    for (const session of candidates) {
      if (!session.buyerEmail) continue;

      const sequence: 1 | 2 | 3 | 4 | 5 = !session.abandonEmail1At
        ? 1
        : !session.abandonEmail2At
          ? 2
          : !session.abandonEmail3At
            ? 3
            : !session.abandonEmail4At
              ? 4
              : 5;
      const pixIsStillValid =
        !!session.pixBrcode &&
        !!session.pixExpiresAt &&
        session.pixExpiresAt.getTime() > now;
      const email = buildAbandonedCheckoutEmail({
        sequence,
        sessionId: session.id,
        buyerName: session.buyerName,
        buyerEmail: session.buyerEmail,
        pixBrCode: pixIsStillValid ? session.pixBrcode : null,
      });
      const result = await sendEmailViaBrevo({
        to: session.buyerEmail,
        toName: session.buyerName,
        subject: email.subject,
        htmlContent: email.htmlContent,
        textContent: email.textContent,
      });
      if (!result.ok) {
        logger.warn(
          { sessionId: session.id, sequence, error: result.error },
          "Abandoned checkout email was not sent",
        );
        continue;
      }

      const sentAt = new Date();
      switch (sequence) {
        case 1:
          await db
            .update(sessionsTable)
            .set({ abandonEmail1At: sentAt })
            .where(
              and(
                eq(sessionsTable.id, session.id),
                eq(sessionsTable.accessGranted, false),
                isNull(sessionsTable.abandonEmail1At),
              ),
            );
          break;
        case 2:
          await db
            .update(sessionsTable)
            .set({ abandonEmail2At: sentAt })
            .where(
              and(
                eq(sessionsTable.id, session.id),
                eq(sessionsTable.accessGranted, false),
                isNull(sessionsTable.abandonEmail2At),
              ),
            );
          break;
        case 3:
          await db
            .update(sessionsTable)
            .set({ abandonEmail3At: sentAt })
            .where(
              and(
                eq(sessionsTable.id, session.id),
                eq(sessionsTable.accessGranted, false),
                isNull(sessionsTable.abandonEmail3At),
              ),
            );
          break;
        case 4:
          await db
            .update(sessionsTable)
            .set({ abandonEmail4At: sentAt })
            .where(
              and(
                eq(sessionsTable.id, session.id),
                eq(sessionsTable.accessGranted, false),
                isNull(sessionsTable.abandonEmail4At),
              ),
            );
          break;
        case 5:
          await db
            .update(sessionsTable)
            .set({ abandonEmail5At: sentAt })
            .where(
              and(
                eq(sessionsTable.id, session.id),
                eq(sessionsTable.accessGranted, false),
                isNull(sessionsTable.abandonEmail5At),
              ),
            );
          break;
      }
      sent += 1;
    }

    return sent;
  } catch (error) {
    logger.error({ err: error }, "Abandoned checkout email job failed");
    return 0;
  } finally {
    abandonedCheckoutJobRunning = false;
  }
}

export function startAbandonedCheckoutScheduler() {
  const interval = setInterval(() => {
    void sendAbandonedCheckoutEmails();
  }, SCHEDULER_INTERVAL_MS);
  interval.unref();
  void sendAbandonedCheckoutEmails();
}