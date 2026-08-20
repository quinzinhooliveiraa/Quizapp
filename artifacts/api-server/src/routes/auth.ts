import crypto from "node:crypto";
import { Router, type IRouter } from "express";
import { and, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { authCodesTable, db, invitesTable, sessionsTable } from "@workspace/db";
import { buildLoginCodeEmail, sendEmailViaBrevo } from "../lib/brevo";

const router: IRouter = Router();

const CODE_TTL_MINUTES = 15;
const REQUEST_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function generateCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

router.post("/auth/request-code", async (req, res): Promise<void> => {
  const email = normalizeEmail(String(req.body?.email || ""));
  if (!EMAIL_PATTERN.test(email)) {
    res.status(400).json({ error: "Email inválido" });
    return;
  }

  const cooldownAgo = new Date(Date.now() - REQUEST_COOLDOWN_SECONDS * 1000);
  const [recent] = await db.select({ createdAt: authCodesTable.createdAt })
    .from(authCodesTable)
    .where(and(eq(authCodesTable.email, email), gt(authCodesTable.createdAt, cooldownAgo)))
    .orderBy(desc(authCodesTable.createdAt))
    .limit(1);

  if (recent) {
    res.status(429).json({ error: "Aguarde um instante antes de pedir outro código" });
    return;
  }

  await db.delete(authCodesTable).where(and(
    eq(authCodesTable.email, email),
    lt(authCodesTable.expiresAt, new Date()),
  ));

  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const isAdmin = adminEmails.includes(email);

  let [existingSession] = await db.select({ id: sessionsTable.id })
    .from(sessionsTable)
    .where(and(eq(sessionsTable.buyerEmail, email), eq(sessionsTable.accessGranted, true)))
    .limit(1);

  const existingInvites = await db.select({ token: invitesTable.token })
    .from(invitesTable)
    .where(eq(invitesTable.guestEmail, email))
    .limit(1);
  const hasInvite = existingInvites.length > 0;

  if (!existingSession && isAdmin) {
    const newSessionId = crypto.randomUUID();
    await db.insert(sessionsTable).values({
      id: newSessionId,
      buyerName: "Admin",
      buyerEmail: email,
      packageId: "family",
      packageName: "Pacote Família",
      inviteLimit: 5,
      invitesUsed: 0,
      accessGranted: true,
    });
    existingSession = { id: newSessionId };
    req.log.info({ email }, "Admin session auto-created");
  }

  // Admin bypass: an admin session is returned directly without sending a code.
  if (isAdmin && existingSession) {
    res.json({ ok: true, adminBypass: true, sessionId: existingSession.id });
    return;
  }

  // Non-admin accounts that do not exist receive a clear error.
  if (!existingSession && !hasInvite) {
    res.status(404).json({ error: "Nenhuma conta encontrada com este email. Verifique se digitou certo ou compre um baralho." });
    return;
  }

  const code = generateCode();
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);
  await db.insert(authCodesTable).values({ id, email, code, expiresAt });

  const emailPayload = buildLoginCodeEmail(code);
  const result = await sendEmailViaBrevo({
    to: email,
    subject: emailPayload.subject,
    htmlContent: emailPayload.htmlContent,
    textContent: emailPayload.textContent,
  });

  if (!result.ok) {
    req.log.error({ error: result.error }, "Failed to send email login code");
    res.status(500).json({ error: "Não conseguimos enviar o código agora. Tente novamente." });
    return;
  }

  res.json({ ok: true });
});

router.post("/auth/verify-code", async (req, res): Promise<void> => {
  const email = normalizeEmail(String(req.body?.email || ""));
  const code = String(req.body?.code || "").trim();

  if (!EMAIL_PATTERN.test(email) || !/^\d{6}$/.test(code)) {
    res.status(400).json({ error: "Email e código de 6 dígitos são obrigatórios" });
    return;
  }

  const now = new Date();
  const [authCode] = await db.select()
    .from(authCodesTable)
    .where(and(
      eq(authCodesTable.email, email),
      eq(authCodesTable.code, code),
      isNull(authCodesTable.usedAt),
      gt(authCodesTable.expiresAt, now),
    ))
    .orderBy(desc(authCodesTable.createdAt))
    .limit(1);

  if (!authCode) {
    await db.update(authCodesTable)
      .set({ attempts: sql`${authCodesTable.attempts} + 1` })
      .where(and(
        eq(authCodesTable.email, email),
        isNull(authCodesTable.usedAt),
        gt(authCodesTable.expiresAt, now),
      ));
    res.status(401).json({ error: "Código inválido ou expirado" });
    return;
  }

  if (authCode.attempts >= MAX_ATTEMPTS) {
    res.status(429).json({ error: "Muitas tentativas. Peça um novo código." });
    return;
  }

  const [usedCode] = await db.update(authCodesTable)
    .set({ usedAt: now })
    .where(and(
      eq(authCodesTable.id, authCode.id),
      isNull(authCodesTable.usedAt),
    ))
    .returning({ id: authCodesTable.id });

  if (!usedCode) {
    res.status(401).json({ error: "Este código já foi usado" });
    return;
  }

  const sessions = await db.select({
    id: sessionsTable.id,
    buyerName: sessionsTable.buyerName,
    packageName: sessionsTable.packageName,
    createdAt: sessionsTable.createdAt,
    onboardingComplete: sessionsTable.onboardingComplete,
  })
    .from(sessionsTable)
    .where(and(eq(sessionsTable.buyerEmail, email), eq(sessionsTable.accessGranted, true)))
    .orderBy(desc(sessionsTable.createdAt));

  const invites = await db.select({
    token: invitesTable.token,
    guestName: invitesTable.guestName,
    sessionId: invitesTable.sessionId,
    createdAt: invitesTable.createdAt,
    onboardingComplete: invitesTable.onboardingComplete,
  })
    .from(invitesTable)
    .where(eq(invitesTable.guestEmail, email))
    .orderBy(desc(invitesTable.createdAt));

  const inviteEntries = await Promise.all(invites.map(async (invite) => {
    const [owner] = await db.select({ buyerName: sessionsTable.buyerName })
      .from(sessionsTable)
      .where(eq(sessionsTable.id, invite.sessionId))
      .limit(1);
    return {
      token: invite.token,
      guestName: invite.guestName,
      ownerName: owner?.buyerName || "alguém",
      createdAt: invite.createdAt,
      onboardingComplete: invite.onboardingComplete,
    };
  }));

  if (sessions.length === 0 && inviteEntries.length === 0) {
    res.status(404).json({ error: "Nenhum acesso encontrado para este email" });
    return;
  }

  res.json({ sessions, invites: inviteEntries });
});

export default router;