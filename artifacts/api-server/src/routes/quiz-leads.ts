import { Router, type IRouter } from "express";
import crypto from "node:crypto";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { CreateQuizLeadBody } from "@workspace/api-zod";
import {
  db,
  emailOptOutsTable,
  quizLeadsTable,
  sessionsTable,
} from "@workspace/db";
import { allowEmailRequest } from "../lib/email-rate-limit";
import {
  getQuizEmailConfig,
} from "../lib/quiz-email-config";
import { resolveRegion } from "../lib/pricing";
import { sendEmailViaBrevo } from "../lib/brevo";
import { buildQuizDiagnosisEmail } from "../lib/quiz-lead-email";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get("/quiz/email-config", async (_req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  res.json(await getQuizEmailConfig());
});

router.post("/quiz/lead", async (req, res): Promise<void> => {
  const clientIp = req.ip || req.socket.remoteAddress || "unknown";
  if (!allowEmailRequest(clientIp, Date.now())) {
    res.setHeader("Retry-After", "60");
    res.status(429).json({
      error: "Muitas tentativas. Tente novamente em alguns instantes.",
    });
    return;
  }

  const parsed = CreateQuizLeadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados do lead inválidos" });
    return;
  }

  const body = parsed.data;
  const email = body.email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    res.status(400).json({ error: "E-mail inválido" });
    return;
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [existingLead] = await db
    .select({ id: quizLeadsTable.id })
    .from(quizLeadsTable)
    .where(
      and(
        eq(quizLeadsTable.visitorKey, body.visitorKey),
        gte(quizLeadsTable.createdAt, sevenDaysAgo),
        isNull(quizLeadsTable.abandonEmail1At),
      ),
    )
    .orderBy(desc(quizLeadsTable.createdAt))
    .limit(1);

  const leadId = existingLead?.id ?? crypto.randomUUID();
  const leadValues = {
    visitorKey: body.visitorKey,
    lpId: body.lpId,
    diagnosisLabel: body.diagnosisLabel.trim(),
    email,
    region: resolveRegion({
      headers: req.headers,
      query: req.query as Record<string, unknown>,
    }),
    utmSource: body.utmSource?.trim() || null,
    utmMedium: body.utmMedium?.trim() || null,
    utmCampaign: body.utmCampaign?.trim() || null,
    utmContent: body.utmContent?.trim() || null,
    utmTerm: body.utmTerm?.trim() || null,
  };

  if (existingLead) {
    await db
      .update(quizLeadsTable)
      .set(leadValues)
      .where(eq(quizLeadsTable.id, leadId));
  } else {
    await db.insert(quizLeadsTable).values({ id: leadId, ...leadValues });
  }

  const [optOut] = await db
    .select({ email: emailOptOutsTable.email })
    .from(emailOptOutsTable)
    .where(eq(emailOptOutsTable.email, email))
    .limit(1);

  if (optOut) {
    await db
      .update(quizLeadsTable)
      .set({ suppressedAt: now })
      .where(eq(quizLeadsTable.id, leadId));
  } else if (!existingLead) {
    const emailContent = buildQuizDiagnosisEmail({
      leadId,
      diagnosisLabel: body.diagnosisLabel.trim(),
      diagnosisCopy: body.diagnosisCopy.trim(),
    });
    const result = await sendEmailViaBrevo({
      to: email,
      subject: emailContent.subject,
      htmlContent: emailContent.htmlContent,
      textContent: emailContent.textContent,
    });
    if (!result.ok) {
      logger.warn(
        { leadId, error: result.error },
        "Quiz diagnosis email was not sent",
      );
    }
  }

  res.status(201).json({ leadId });
});

router.post("/email/sair/:id", async (req, res): Promise<void> => {
  const id =
    typeof req.params.id === "string" ? req.params.id.trim().slice(0, 120) : "";
  if (!id) {
    res.json({ ok: true });
    return;
  }

  const [lead] = await db
    .select({ email: quizLeadsTable.email })
    .from(quizLeadsTable)
    .where(eq(quizLeadsTable.id, id))
    .limit(1);
  const [session] = await db
    .select({ email: sessionsTable.buyerEmail })
    .from(sessionsTable)
    .where(eq(sessionsTable.id, id))
    .limit(1);
  const email = lead?.email?.trim().toLowerCase() ||
    session?.email?.trim().toLowerCase();

  if (email) {
    const now = new Date();
    await db
      .insert(emailOptOutsTable)
      .values({ email, createdAt: now })
      .onConflictDoNothing({ target: emailOptOutsTable.email });
    await db
      .update(quizLeadsTable)
      .set({ suppressedAt: now })
      .where(eq(quizLeadsTable.email, email));
    await db
      .update(sessionsTable)
      .set({ abandonSuppressedAt: now })
      .where(sql`lower(${sessionsTable.buyerEmail}) = ${email}`);
  }

  res.json({ ok: true });
});

export default router;