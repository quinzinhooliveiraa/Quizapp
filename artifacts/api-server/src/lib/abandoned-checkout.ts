import {
  and,
  eq,
  gte,
  gt,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import {
  db,
  emailOptOutsTable,
  quizLeadsTable,
  sessionsTable,
} from "@workspace/db";
import {
  buildAbandonedCheckoutEmail,
  sendEmailViaBrevo,
} from "./brevo";
import { logger } from "./logger";
import { ABANDONED_CHECKOUT_DISCOUNT_MS } from "./abandoned-checkout-constants";

const FIRST_EMAIL_AFTER_MS = 20 * 60 * 1000;
const EMAIL_GAP_MS = 24 * 60 * 60 * 1000;
const FIRST_EMAIL_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
const SEQUENCE_MAX_AGE_MS = ABANDONED_CHECKOUT_DISCOUNT_MS;
const EMAIL_FIVE_EARLY_MS = 10 * 60 * 60 * 1000;
const EMAIL_FIVE_MINIMUM_LEAD_MS = 12 * 60 * 60 * 1000;
const EMAIL_FIVE_CLOSEOUT_MS = 60 * 60 * 1000;
const EMAIL_ONE_DEDUP_MS = 7 * 24 * 60 * 60 * 1000;
const RESEND_BATCH_SIZE = 100;
const SCHEDULER_INTERVAL_MS = 5 * 60 * 1000;

type EmailSequence = 1 | 2 | 3 | 4 | 5;
type RecipientCandidate = {
  kind: "session" | "lead";
  id: string;
  email: string;
  visitorKey: string | null;
  sessionId?: string | null;
  createdAt: Date;
  offerSeenAt: Date | null;
  abandonEmail1At: Date | null;
  abandonEmail2At: Date | null;
  abandonEmail3At: Date | null;
  abandonEmail4At: Date | null;
  abandonEmail5At: Date | null;
};

let abandonedCheckoutJobRunning = false;

function eligibleSequence(
  candidate: RecipientCandidate,
  now: number,
): EmailSequence | null {
  const createdAt = candidate.createdAt.getTime();
  if (now - createdAt > SEQUENCE_MAX_AGE_MS) return null;

  const discountEndsAt = createdAt + ABANDONED_CHECKOUT_DISCOUNT_MS;
  const emailFiveReadyAt = discountEndsAt - EMAIL_FIVE_EARLY_MS;
  const emailFiveCloseAt = discountEndsAt - EMAIL_FIVE_CLOSEOUT_MS;
  if (
    !candidate.abandonEmail5At &&
    candidate.abandonEmail4At &&
    now >= emailFiveReadyAt &&
    now < emailFiveCloseAt &&
    now - candidate.abandonEmail4At.getTime() >= EMAIL_FIVE_MINIMUM_LEAD_MS
  ) {
    return 5;
  }

  const firstEmailAt =
    candidate.kind === "lead" && candidate.offerSeenAt
      ? candidate.offerSeenAt.getTime()
      : createdAt;
  if (!candidate.abandonEmail1At) {
    const firstEmailAge = now - firstEmailAt;
    return firstEmailAge >= FIRST_EMAIL_AFTER_MS &&
      firstEmailAge <= FIRST_EMAIL_MAX_AGE_MS
      ? 1
      : null;
  }
  if (
    !candidate.abandonEmail2At &&
    now - candidate.abandonEmail1At.getTime() >= EMAIL_GAP_MS
  ) {
    return 2;
  }
  if (
    !candidate.abandonEmail3At &&
    candidate.abandonEmail2At &&
    now - candidate.abandonEmail2At.getTime() >= EMAIL_GAP_MS
  ) {
    return 3;
  }
  if (
    !candidate.abandonEmail4At &&
    candidate.abandonEmail3At &&
    now - candidate.abandonEmail3At.getTime() >= EMAIL_GAP_MS
  ) {
    return 4;
  }
  return null;
}

function sessionSequenceEligibility(now: number) {
  const sequenceMaximumCreatedAt = new Date(now - SEQUENCE_MAX_AGE_MS);
  const firstMinimumCreatedAt = new Date(now - FIRST_EMAIL_MAX_AGE_MS);
  const firstCutoff = new Date(now - FIRST_EMAIL_AFTER_MS);
  const emailGapCutoff = new Date(now - EMAIL_GAP_MS);
  const emailFiveSendStart = new Date(
    now - (ABANDONED_CHECKOUT_DISCOUNT_MS - EMAIL_FIVE_EARLY_MS),
  );
  const emailFiveCloseout = new Date(
    now - (ABANDONED_CHECKOUT_DISCOUNT_MS - EMAIL_FIVE_CLOSEOUT_MS),
  );
  const emailFivePreviousSendCutoff = new Date(
    now - EMAIL_FIVE_MINIMUM_LEAD_MS,
  );

  return and(
    gte(sessionsTable.createdAt, sequenceMaximumCreatedAt),
    or(
      and(
        gte(sessionsTable.createdAt, firstMinimumCreatedAt),
        lte(sessionsTable.createdAt, firstCutoff),
        isNull(sessionsTable.abandonEmail1At),
      ),
      and(
        isNotNull(sessionsTable.abandonEmail1At),
        lte(sessionsTable.abandonEmail1At, emailGapCutoff),
        isNull(sessionsTable.abandonEmail2At),
      ),
      and(
        isNotNull(sessionsTable.abandonEmail2At),
        lte(sessionsTable.abandonEmail2At, emailGapCutoff),
        isNull(sessionsTable.abandonEmail3At),
      ),
      and(
        isNotNull(sessionsTable.abandonEmail3At),
        lte(sessionsTable.abandonEmail3At, emailGapCutoff),
        isNull(sessionsTable.abandonEmail4At),
      ),
      and(
        isNotNull(sessionsTable.abandonEmail4At),
        lte(sessionsTable.abandonEmail4At, emailFivePreviousSendCutoff),
        lte(sessionsTable.createdAt, emailFiveSendStart),
        gt(sessionsTable.createdAt, emailFiveCloseout),
        isNull(sessionsTable.abandonEmail5At),
      ),
    ),
  );
}

function leadSequenceEligibility(now: number) {
  const sequenceMaximumCreatedAt = new Date(now - SEQUENCE_MAX_AGE_MS);
  const firstMinimumOfferSeenAt = new Date(now - FIRST_EMAIL_MAX_AGE_MS);
  const firstCutoff = new Date(now - FIRST_EMAIL_AFTER_MS);
  const emailGapCutoff = new Date(now - EMAIL_GAP_MS);
  const emailFiveSendStart = new Date(
    now - (ABANDONED_CHECKOUT_DISCOUNT_MS - EMAIL_FIVE_EARLY_MS),
  );
  const emailFiveCloseout = new Date(
    now - (ABANDONED_CHECKOUT_DISCOUNT_MS - EMAIL_FIVE_CLOSEOUT_MS),
  );
  const emailFivePreviousSendCutoff = new Date(
    now - EMAIL_FIVE_MINIMUM_LEAD_MS,
  );

  return and(
    gte(quizLeadsTable.createdAt, sequenceMaximumCreatedAt),
    or(
      and(
        gte(quizLeadsTable.offerSeenAt, firstMinimumOfferSeenAt),
        lte(quizLeadsTable.offerSeenAt, firstCutoff),
        isNull(quizLeadsTable.abandonEmail1At),
      ),
      and(
        isNotNull(quizLeadsTable.abandonEmail1At),
        lte(quizLeadsTable.abandonEmail1At, emailGapCutoff),
        isNull(quizLeadsTable.abandonEmail2At),
      ),
      and(
        isNotNull(quizLeadsTable.abandonEmail2At),
        lte(quizLeadsTable.abandonEmail2At, emailGapCutoff),
        isNull(quizLeadsTable.abandonEmail3At),
      ),
      and(
        isNotNull(quizLeadsTable.abandonEmail3At),
        lte(quizLeadsTable.abandonEmail3At, emailGapCutoff),
        isNull(quizLeadsTable.abandonEmail4At),
      ),
      and(
        isNotNull(quizLeadsTable.abandonEmail4At),
        lte(quizLeadsTable.abandonEmail4At, emailFivePreviousSendCutoff),
        lte(quizLeadsTable.createdAt, emailFiveSendStart),
        gt(quizLeadsTable.createdAt, emailFiveCloseout),
        isNull(quizLeadsTable.abandonEmail5At),
      ),
    ),
  );
}

async function suppressCandidate(candidate: RecipientCandidate, at: Date) {
  if (candidate.kind === "lead") {
    await db
      .update(quizLeadsTable)
      .set({ suppressedAt: at })
      .where(and(eq(quizLeadsTable.id, candidate.id), isNull(quizLeadsTable.suppressedAt)));
    return;
  }
  await db
    .update(sessionsTable)
    .set({ abandonSuppressedAt: at })
    .where(
      and(
        eq(sessionsTable.id, candidate.id),
        isNull(sessionsTable.abandonSuppressedAt),
      ),
    );
}

async function hasOptedOut(email: string) {
  const [row] = await db
    .select({ email: emailOptOutsTable.email })
    .from(emailOptOutsTable)
    .where(eq(emailOptOutsTable.email, email))
    .limit(1);
  return Boolean(row);
}

async function hasPaidForCandidate(candidate: RecipientCandidate) {
  const paidSessionConditions = [
    sql`lower(${sessionsTable.buyerEmail}) = ${candidate.email}`,
    ...(candidate.visitorKey?.trim()
      ? [eq(sessionsTable.visitorKey, candidate.visitorKey)]
      : []),
    ...(candidate.kind === "lead" && candidate.sessionId
      ? [eq(sessionsTable.id, candidate.sessionId)]
      : []),
  ];
  const [row] = await db
    .select({ id: sessionsTable.id })
    .from(sessionsTable)
    .where(
      and(
        eq(sessionsTable.accessGranted, true),
        or(...paidSessionConditions),
      ),
    )
    .limit(1);
  return Boolean(row);
}

async function hasRecentEmailOne(email: string, since: Date) {
  const [session] = await db
    .select({ id: sessionsTable.id })
    .from(sessionsTable)
    .where(
      and(
        sql`lower(${sessionsTable.buyerEmail}) = ${email}`,
        gte(sessionsTable.abandonEmail1At, since),
      ),
    )
    .limit(1);
  if (session) return true;

  const [lead] = await db
    .select({ id: quizLeadsTable.id })
    .from(quizLeadsTable)
    .where(
      and(
        sql`lower(${quizLeadsTable.email}) = ${email}`,
        gte(quizLeadsTable.abandonEmail1At, since),
      ),
    )
    .limit(1);
  return Boolean(lead);
}

async function hasRecentSession(email: string, since: Date) {
  const [session] = await db
    .select({ id: sessionsTable.id })
    .from(sessionsTable)
    .where(
      and(
        sql`lower(${sessionsTable.buyerEmail}) = ${email}`,
        gte(sessionsTable.createdAt, since),
      ),
    )
    .limit(1);
  return Boolean(session);
}

async function markEmailSent(
  candidate: RecipientCandidate,
  sequence: EmailSequence,
  sentAt: Date,
) {
  const fields = [
    "abandonEmail1At",
    "abandonEmail2At",
    "abandonEmail3At",
    "abandonEmail4At",
    "abandonEmail5At",
  ] as const;
  const field = fields[sequence - 1];
  if (candidate.kind === "lead") {
    const setters = [
      { abandonEmail1At: sentAt },
      { abandonEmail2At: sentAt },
      { abandonEmail3At: sentAt },
      { abandonEmail4At: sentAt },
      { abandonEmail5At: sentAt },
    ] as const;
    await db
      .update(quizLeadsTable)
      .set(setters[sequence - 1])
      .where(
        and(
          eq(quizLeadsTable.id, candidate.id),
          isNull(quizLeadsTable[field]),
          isNull(quizLeadsTable.suppressedAt),
        ),
      );
    return;
  }
  const setters = [
    { abandonEmail1At: sentAt },
    { abandonEmail2At: sentAt },
    { abandonEmail3At: sentAt },
    { abandonEmail4At: sentAt },
    { abandonEmail5At: sentAt },
  ] as const;
  await db
    .update(sessionsTable)
    .set(setters[sequence - 1])
    .where(
      and(
        eq(sessionsTable.id, candidate.id),
        eq(sessionsTable.accessGranted, false),
        isNull(sessionsTable[field]),
        isNull(sessionsTable.abandonSuppressedAt),
      ),
    );
}

async function markExpiredEmailFive(at: Date, createdBefore: Date) {
  await db
    .update(sessionsTable)
    .set({ abandonEmail5At: at })
    .where(
      and(
        eq(sessionsTable.accessGranted, false),
        eq(sessionsTable.internal, false),
        isNotNull(sessionsTable.abandonEmail4At),
        isNull(sessionsTable.abandonEmail5At),
        lte(sessionsTable.createdAt, createdBefore),
      ),
    );
  await db
    .update(quizLeadsTable)
    .set({ abandonEmail5At: at })
    .where(
      and(
        eq(quizLeadsTable.region, "BR"),
        isNotNull(quizLeadsTable.abandonEmail4At),
        isNull(quizLeadsTable.abandonEmail5At),
        isNull(quizLeadsTable.suppressedAt),
        lte(quizLeadsTable.createdAt, createdBefore),
      ),
    );
}

export async function sendAbandonedCheckoutEmails(): Promise<number> {
  if (abandonedCheckoutJobRunning) return 0;
  abandonedCheckoutJobRunning = true;

  try {
    const now = Date.now();
    const nowDate = new Date(now);
    const firstCutoff = new Date(now - FIRST_EMAIL_AFTER_MS);
    const firstMinimumOfferSeenAt = new Date(now - FIRST_EMAIL_MAX_AGE_MS);
    const sequenceMaximumCreatedAt = new Date(now - SEQUENCE_MAX_AGE_MS);
    const emailFiveCloseoutCutoff = new Date(
      now - (ABANDONED_CHECKOUT_DISCOUNT_MS - EMAIL_FIVE_CLOSEOUT_MS),
    );
    const emailOneDedupCutoff = new Date(now - EMAIL_ONE_DEDUP_MS);
    const recentCheckoutCutoff = new Date(now - FIRST_EMAIL_MAX_AGE_MS);

    await markExpiredEmailFive(nowDate, emailFiveCloseoutCutoff);

    const [sessionRows, leadRows] = await Promise.all([
      db
        .select({
          id: sessionsTable.id,
          email: sessionsTable.buyerEmail,
          visitorKey: sessionsTable.visitorKey,
          createdAt: sessionsTable.createdAt,
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
            isNull(sessionsTable.abandonSuppressedAt),
            isNotNull(sessionsTable.buyerEmail),
            sessionSequenceEligibility(now),
          ),
        )
        .orderBy(sessionsTable.createdAt)
        .limit(RESEND_BATCH_SIZE),
      (() => {
        const adminEmails = (process.env.ADMIN_EMAILS || "")
          .split(",")
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean);
        const internalFilter = adminEmails.length
          ? or(
              eq(quizLeadsTable.internal, false),
              inArray(sql<string>`lower(${quizLeadsTable.email})`, adminEmails),
            )
          : eq(quizLeadsTable.internal, false);
        return db
          .select({
            id: quizLeadsTable.id,
            email: quizLeadsTable.email,
            visitorKey: quizLeadsTable.visitorKey,
            sessionId: quizLeadsTable.sessionId,
            createdAt: quizLeadsTable.createdAt,
            offerSeenAt: quizLeadsTable.offerSeenAt,
            abandonEmail1At: quizLeadsTable.abandonEmail1At,
            abandonEmail2At: quizLeadsTable.abandonEmail2At,
            abandonEmail3At: quizLeadsTable.abandonEmail3At,
            abandonEmail4At: quizLeadsTable.abandonEmail4At,
            abandonEmail5At: quizLeadsTable.abandonEmail5At,
          })
          .from(quizLeadsTable)
          .where(
            and(
              eq(quizLeadsTable.region, "BR"),
              isNotNull(quizLeadsTable.offerSeenAt),
              isNull(quizLeadsTable.suppressedAt),
              internalFilter,
              leadSequenceEligibility(now),
            ),
          )
          .orderBy(quizLeadsTable.createdAt)
          .limit(RESEND_BATCH_SIZE);
      })(),
    ]);

    const candidates: RecipientCandidate[] = [
      ...sessionRows
        .filter((row): row is typeof row & { email: string } => Boolean(row.email))
        .map((row) => ({
          kind: "session" as const,
          ...row,
          email: row.email.trim().toLowerCase(),
          offerSeenAt: null,
        })),
      ...leadRows.map((row) => ({
        kind: "lead" as const,
        ...row,
        email: row.email.trim().toLowerCase(),
      })),
    ]
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .slice(0, RESEND_BATCH_SIZE);

    let sent = 0;
    for (const candidate of candidates) {
      const sequence = eligibleSequence(candidate, now);
      if (!sequence) continue;

      if (sequence === 5) {
        const currentTime = Date.now();
        const discountEndsAt =
          candidate.createdAt.getTime() + ABANDONED_CHECKOUT_DISCOUNT_MS;
        if (
          currentTime >= discountEndsAt - EMAIL_FIVE_CLOSEOUT_MS ||
          !candidate.abandonEmail4At ||
          currentTime - candidate.abandonEmail4At.getTime() <
            EMAIL_FIVE_MINIMUM_LEAD_MS
        ) {
          if (currentTime >= discountEndsAt - EMAIL_FIVE_CLOSEOUT_MS) {
            await markEmailSent(candidate, 5, new Date(currentTime));
          }
          continue;
        }
      }

      if (
        sequence === 1 &&
        ((candidate.kind === "lead" &&
          (await hasRecentSession(candidate.email, recentCheckoutCutoff))) ||
          (await hasRecentEmailOne(candidate.email, emailOneDedupCutoff)))
      ) {
        await suppressCandidate(candidate, new Date());
        continue;
      }

      const suppressedAt = new Date();
      if (await hasOptedOut(candidate.email)) {
        await suppressCandidate(candidate, suppressedAt);
        continue;
      }

      let hasPaid: boolean;
      try {
        hasPaid = await hasPaidForCandidate(candidate);
      } catch (error) {
        logger.warn(
          { err: error, candidateId: candidate.id },
          "Could not verify whether abandoned checkout candidate has paid",
        );
        continue;
      }
      if (hasPaid) {
        await suppressCandidate(candidate, suppressedAt);
        continue;
      }

      const sentAt = new Date();
      const email = buildAbandonedCheckoutEmail({
        sequence,
        id: candidate.id,
        createdAt: candidate.createdAt,
        sentAt,
      });
      const baseUrl = (
        process.env.PUBLIC_BASE_URL ||
        "https://www.perguntasdeconexao.com.br"
      ).replace(/\/+$/, "");
      const optOutUrl = `${baseUrl}/sair/${encodeURIComponent(candidate.id)}`;
      const result = await sendEmailViaBrevo({
        to: candidate.email,
        subject: email.subject,
        htmlContent: `${email.htmlContent}<p style="font-size:12px;line-height:1.5;color:#8b8290;text-align:center;">Não quer mais receber? <a href="${optOutUrl}" style="color:#8a2f4d;">Sair da lista</a>.</p>`,
        textContent: `${email.textContent}\n\nNão quer mais receber? Sair da lista: ${optOutUrl}`,
      });
      if (!result.ok) {
        logger.warn(
          { recipientId: candidate.id, sequence, error: result.error },
          "Abandoned checkout email was not sent",
        );
        continue;
      }

      await markEmailSent(candidate, sequence, new Date());
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

export async function backfillLeadPurchases(): Promise<void> {
  try {
    const wouldUpdate = await db.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM quiz_leads AS lead
      WHERE lead.visitor_key IS NOT NULL
        AND btrim(lead.visitor_key) <> ''
        AND (lead.suppressed_at IS NULL OR lead.session_id IS NULL)
        AND EXISTS (
          SELECT 1
          FROM sessions AS paid_session
          WHERE paid_session.access_granted = TRUE
            AND paid_session.visitor_key IS NOT NULL
            AND btrim(paid_session.visitor_key) <> ''
            AND paid_session.visitor_key = lead.visitor_key
        )
    `);
    const affectedCount = Number(wouldUpdate.rows[0]?.count ?? 0);
    logger.info(
      { affectedCount },
      "Quiz lead purchase backfill rows eligible for update",
    );

    const updated = await db.execute(sql`
      WITH oldest_paid_session AS (
        SELECT DISTINCT ON (paid_session.visitor_key)
          paid_session.visitor_key,
          paid_session.id
        FROM sessions AS paid_session
        WHERE paid_session.access_granted = TRUE
          AND paid_session.visitor_key IS NOT NULL
          AND btrim(paid_session.visitor_key) <> ''
        ORDER BY paid_session.visitor_key, paid_session.created_at ASC, paid_session.id ASC
      )
      UPDATE quiz_leads AS lead
      SET
        suppressed_at = COALESCE(lead.suppressed_at, NOW()),
        session_id = COALESCE(lead.session_id, oldest_paid_session.id)
      FROM oldest_paid_session
      WHERE lead.visitor_key = oldest_paid_session.visitor_key
        AND lead.visitor_key IS NOT NULL
        AND btrim(lead.visitor_key) <> ''
        AND (lead.suppressed_at IS NULL OR lead.session_id IS NULL)
      RETURNING lead.id
    `);
    logger.info(
      { changedCount: updated.rows.length },
      "Quiz lead purchase backfill rows updated",
    );
  } catch (error) {
    logger.warn({ err: error }, "Quiz lead purchase backfill failed");
  }
}

export function startAbandonedCheckoutScheduler() {
  const interval = setInterval(() => {
    void sendAbandonedCheckoutEmails();
  }, SCHEDULER_INTERVAL_MS);
  interval.unref();
  void backfillLeadPurchases().finally(() => sendAbandonedCheckoutEmails());
}
