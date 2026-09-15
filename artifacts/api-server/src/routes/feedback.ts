import { Router, type IRouter } from "express";
import crypto from "node:crypto";
import { and, count, desc, eq, gte } from "drizzle-orm";
import {
  db,
  reviewsTable,
  sessionsTable,
  suggestionsTable,
} from "@workspace/db";
import { sendSupportNotification } from "../lib/push";

const router: IRouter = Router();

function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export async function isAdminSession(sessionId?: string): Promise<boolean> {
  if (!sessionId) return false;
  const [row] = await db
    .select({ buyerEmail: sessionsTable.buyerEmail })
    .from(sessionsTable)
    .where(eq(sessionsTable.id, sessionId))
    .limit(1);
  const email = row?.buyerEmail?.trim().toLowerCase();
  return Boolean(email && getAdminEmails().includes(email));
}

router.post("/suggestions", async (req, res): Promise<void> => {
  const body = req.body as {
    email?: string;
    message?: string;
    topic?: string;
    purchaseEmail?: string;
    paymentMethod?: string;
    inviteLink?: string;
    accessStatus?: string;
    page?: string;
    userAgent?: string;
    screen?: string;
  };
  const email = body.email?.trim().slice(0, 200) || "";
  const message = body.message?.trim().slice(0, 2000) || "";
  const topic = body.topic?.trim().slice(0, 80) || "";
  if (!message && !["compra", "pagamento", "convite"].includes(topic)) {
    res.status(400).json({ error: "Escreva sua sugestão antes de enviar." });
    return;
  }
  const [suggestion] = await db
    .insert(suggestionsTable)
    .values({
      id: crypto.randomUUID(),
      email: email || null,
      message,
      topic: topic || null,
      purchaseEmail: body.purchaseEmail?.trim().toLowerCase().slice(0, 200) || null,
      paymentMethod: body.paymentMethod?.trim().slice(0, 40) || null,
      inviteLink: body.inviteLink?.trim().slice(0, 500) || null,
      accessStatus: body.accessStatus?.trim().slice(0, 40) || null,
      page: body.page?.trim().slice(0, 300) || null,
      userAgent: body.userAgent?.trim().slice(0, 500) || null,
      screen: body.screen?.trim().slice(0, 80) || null,
      status: "aberto",
    })
    .returning();
  void sendSupportNotification({
    email,
    topic: topic || "suporte",
    accessStatus: body.accessStatus?.trim().slice(0, 40) || "não verificado",
  }).catch((error) =>
    req.log.error({ err: error }, "Support push notification failed"),
  );
  res.status(201).json(suggestion);
});

router.get("/admin/suggestions", async (req, res): Promise<void> => {
  const sessionId =
    typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
  if (!(await isAdminSession(sessionId))) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }
  const rows = await db
    .select()
    .from(suggestionsTable)
    .orderBy(desc(suggestionsTable.createdAt))
    .limit(300);
  res.json({ suggestions: rows });
});

router.patch("/admin/suggestions/:suggestionId", async (req, res): Promise<void> => {
  const sessionId =
    typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
  if (!(await isAdminSession(sessionId))) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }
  const suggestionId = req.params.suggestionId?.trim();
  if (!suggestionId) {
    res.status(400).json({ error: "Feedback inválido" });
    return;
  }
  const [current] = await db
    .select({ status: suggestionsTable.status })
    .from(suggestionsTable)
    .where(eq(suggestionsTable.id, suggestionId))
    .limit(1);
  if (!current) {
    res.status(404).json({ error: "Feedback não encontrado" });
    return;
  }
  const requestedStatus =
    req.body && typeof req.body.status === "string"
      ? req.body.status.trim()
      : undefined;
  const nextStatus =
    requestedStatus === "aberto" || requestedStatus === "resolvido"
      ? requestedStatus
      : current.status === "resolvido"
        ? "aberto"
        : "resolvido";
  const [suggestion] = await db
    .update(suggestionsTable)
    .set({ status: nextStatus })
    .where(eq(suggestionsTable.id, suggestionId))
    .returning();
  res.json(suggestion);
});

router.post("/reviews", async (req, res): Promise<void> => {
  const body = req.body as {
    displayName?: string;
    email?: string;
    rating?: number;
    message?: string;
  };
  const rating = Number(body.rating);
  const message = body.message?.trim().slice(0, 2000) || "";
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    res.status(400).json({ error: "Escolha uma nota de 1 a 5." });
    return;
  }
  if (!message) {
    res.status(400).json({ error: "Escreva sua avaliação antes de enviar." });
    return;
  }
  const [review] = await db
    .insert(reviewsTable)
    .values({
      id: crypto.randomUUID(),
      displayName: body.displayName?.trim().slice(0, 80) || null,
      email: body.email?.trim().slice(0, 200) || null,
      rating,
      message,
    })
    .returning();
  res.status(201).json(review);
});

router.get("/reviews", async (_req, res): Promise<void> => {
  const reviews = await db
    .select({
      id: reviewsTable.id,
      displayName: reviewsTable.displayName,
      rating: reviewsTable.rating,
      message: reviewsTable.message,
      createdAt: reviewsTable.createdAt,
    })
    .from(reviewsTable)
    .orderBy(desc(reviewsTable.createdAt))
    .limit(2);
  res.json({ reviews });
});

router.get("/admin/reviews", async (req, res): Promise<void> => {
  const sessionId =
    typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
  if (!(await isAdminSession(sessionId))) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }
  const rows = await db
    .select()
    .from(reviewsTable)
    .orderBy(desc(reviewsTable.createdAt))
    .limit(300);
  res.json({ reviews: rows });
});

router.get("/admin/buyers", async (req, res): Promise<void> => {
  const sessionId =
    typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
  if (!(await isAdminSession(sessionId))) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [totalResult, accessResult, pendingResult] = await Promise.all([
    db
      .select({ value: count() })
      .from(sessionsTable)
      .where(eq(sessionsTable.accessGranted, true)),
    db
      .select({ value: count() })
      .from(sessionsTable)
      .where(eq(sessionsTable.accessGranted, true)),
    db
      .select({
        id: sessionsTable.id,
        buyerName: sessionsTable.buyerName,
        buyerEmail: sessionsTable.buyerEmail,
        paymentMethod: sessionsTable.paymentMethod,
        packageName: sessionsTable.packageName,
        createdAt: sessionsTable.createdAt,
      })
      .from(sessionsTable)
      .where(
        and(
          eq(sessionsTable.accessGranted, false),
          gte(sessionsTable.createdAt, since),
        ),
      )
      .orderBy(desc(sessionsTable.createdAt))
      .limit(500),
  ]);
  const buyers = await db
    .select({
      id: sessionsTable.id,
      buyerName: sessionsTable.buyerName,
      buyerEmail: sessionsTable.buyerEmail,
      packageName: sessionsTable.packageName,
      accessGranted: sessionsTable.accessGranted,
      invitesUsed: sessionsTable.invitesUsed,
      inviteLimit: sessionsTable.inviteLimit,
      createdAt: sessionsTable.createdAt,
    })
    .from(sessionsTable)
    .where(eq(sessionsTable.accessGranted, true))
    .orderBy(desc(sessionsTable.createdAt))
    .limit(500);
  res.json({
    buyers,
    pendingAccess: pendingResult,
    total: Number(totalResult[0]?.value || 0),
    totalWithAccess: Number(accessResult[0]?.value || 0),
  });
});

router.delete("/admin/buyers/:buyerId", async (req, res): Promise<void> => {
  const sessionId =
    typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
  if (!(await isAdminSession(sessionId))) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  const buyerId = req.params.buyerId?.trim();
  if (!buyerId) {
    res.status(400).json({ error: "Comprador inválido" });
    return;
  }

  const deleted = await db
    .delete(sessionsTable)
    .where(eq(sessionsTable.id, buyerId))
    .returning({ id: sessionsTable.id });

  if (deleted.length === 0) {
    res.status(404).json({ error: "Comprador não encontrado" });
    return;
  }

  res.status(204).end();
});

export default router;
