import { and, eq, isNull, ne, or, sql } from "drizzle-orm";
import { db, quizLeadsTable, sessionsTable } from "@workspace/db";
import { logger } from "./logger";

type PurchaseSession = {
  id: string;
  visitorKey: string | null;
  buyerEmail: string | null;
};

export async function linkPurchaseToQuizLead(session: PurchaseSession) {
  const visitorKey = session.visitorKey?.trim() ? session.visitorKey : null;
  const leadMatchConditions = [eq(quizLeadsTable.sessionId, session.id)];
  if (visitorKey) {
    leadMatchConditions.push(eq(quizLeadsTable.visitorKey, visitorKey));
  }
  if (session.buyerEmail) {
    leadMatchConditions.push(
      sql`lower(${quizLeadsTable.email}) = lower(${session.buyerEmail})`,
    );
  }

  try {
    await db
      .update(quizLeadsTable)
      .set({
        suppressedAt: sql`COALESCE(${quizLeadsTable.suppressedAt}, NOW())`,
        sessionId: sql`COALESCE(${quizLeadsTable.sessionId}, ${session.id})`,
      })
      .where(
        and(
          or(...leadMatchConditions),
          or(isNull(quizLeadsTable.suppressedAt), isNull(quizLeadsTable.sessionId)),
        ),
      );
  } catch (error) {
    logger.warn(
      { err: error, sessionId: session.id },
      "Could not link purchase to quiz leads",
    );
  }

  if (!visitorKey) return;

  try {
    await db
      .update(sessionsTable)
      .set({
        abandonSuppressedAt: sql`COALESCE(${sessionsTable.abandonSuppressedAt}, NOW())`,
      })
      .where(
        and(
          eq(sessionsTable.visitorKey, visitorKey),
          eq(sessionsTable.accessGranted, false),
          ne(sessionsTable.id, session.id),
          isNull(sessionsTable.abandonSuppressedAt),
        ),
      );
  } catch (error) {
    logger.warn(
      { err: error, sessionId: session.id },
      "Could not suppress abandoned sessions for purchased visitor",
    );
  }
}
