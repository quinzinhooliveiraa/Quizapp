import { and, eq, isNull, lte, lt, or, sql } from "drizzle-orm";
import {
  accessEmailQueueTable,
  db,
  sessionsTable,
} from "@workspace/db";
import { logger } from "./logger";
import { shouldDelayAccessEmail } from "./upsell-eligibility";

export const ACCESS_EMAIL_DELAY_MS = 10 * 60 * 1000;

export async function enqueueAccessEmail(
  sessionId: string,
  delayMs = ACCESS_EMAIL_DELAY_MS,
): Promise<void> {
  await db
    .insert(accessEmailQueueTable)
    .values({
      sessionId,
      sendAt: new Date(Date.now() + delayMs),
    })
    .onConflictDoNothing();
}

export { shouldDelayAccessEmail };

export async function releaseAccessEmail(sessionId: string): Promise<void> {
  const now = new Date();
  const [claim] = await db
    .update(accessEmailQueueTable)
    .set({
      claimedAt: now,
      attempts: sql`${accessEmailQueueTable.attempts} + 1`,
    })
    .where(
      and(
        eq(accessEmailQueueTable.sessionId, sessionId),
        isNull(accessEmailQueueTable.sentAt),
        lt(accessEmailQueueTable.attempts, 3),
        or(
          isNull(accessEmailQueueTable.claimedAt),
          sql`${accessEmailQueueTable.claimedAt} < now() - interval '3 minutes'`,
        ),
        sql`EXISTS (
          SELECT 1
          FROM sessions
          WHERE sessions.id = ${sessionId}
            AND sessions.access_granted = true
        )`,
      ),
    )
    .returning({
      sessionId: accessEmailQueueTable.sessionId,
      attempts: accessEmailQueueTable.attempts,
    });
  if (!claim) return;

  try {
    const [session] = await db
      .select({
        buyerName: sessionsTable.buyerName,
        buyerEmail: sessionsTable.buyerEmail,
      })
      .from(sessionsTable)
      .where(eq(sessionsTable.id, sessionId))
      .limit(1);

    if (!session?.buyerEmail) {
      await db
        .update(accessEmailQueueTable)
        .set({ claimedAt: null })
        .where(eq(accessEmailQueueTable.sessionId, sessionId));
      return;
    }

    const { resendGrantedAccessEmail } = await import("./payment-access");
    const result = await resendGrantedAccessEmail({
      buyerName: session.buyerName,
      buyerEmail: session.buyerEmail,
      sessionId,
    });

    if (result.ok) {
      await db
        .update(accessEmailQueueTable)
        .set({ sentAt: new Date() })
        .where(
          and(
            eq(accessEmailQueueTable.sessionId, sessionId),
            isNull(accessEmailQueueTable.sentAt),
          ),
        );
      return;
    }

    logger.error(
      {
        sessionId,
        attempts: claim.attempts,
        error: result.error,
      },
      "Delayed access email delivery failed",
    );
    await db
      .update(accessEmailQueueTable)
      .set({
        claimedAt: null,
        ...(claim.attempts < 3
          ? { sendAt: new Date(Date.now() + 2 * 60 * 1000) }
          : {}),
      })
      .where(eq(accessEmailQueueTable.sessionId, sessionId));
  } catch (error) {
    logger.error({ err: error, sessionId }, "Delayed access email failed");
    await db
      .update(accessEmailQueueTable)
      .set({
        claimedAt: null,
        ...(claim.attempts < 3
          ? { sendAt: new Date(Date.now() + 2 * 60 * 1000) }
          : {}),
      })
      .where(eq(accessEmailQueueTable.sessionId, sessionId));
  }
}

export async function listDueAccessEmails(
  limit = 20,
): Promise<string[]> {
  const rows = await db
    .select({ sessionId: accessEmailQueueTable.sessionId })
    .from(accessEmailQueueTable)
    .where(
      and(
        isNull(accessEmailQueueTable.sentAt),
        lt(accessEmailQueueTable.attempts, 3),
        lte(accessEmailQueueTable.sendAt, new Date()),
      ),
    )
    .orderBy(accessEmailQueueTable.sendAt)
    .limit(limit);
  return rows.map((row) => row.sessionId);
}
