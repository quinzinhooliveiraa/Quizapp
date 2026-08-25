import { Router, type IRouter } from "express";
import crypto from "node:crypto";
import { count, desc, eq } from "drizzle-orm";
import {
  db,
  reviewsTable,
  sessionsTable,
  suggestionsTable,
} from "@workspace/db";

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
  const body = req.body as { email?: string; message?: string };
  const message = body.message?.trim().slice(0, 2000) || "";
  if (!message) {
    res.status(400).json({ error: "Escreva sua sugestão antes de enviar." });
    return;
  }
  const [suggestion] = await db
    .insert(suggestionsTable)
    .values({
      id: crypto.randomUUID(),
      email: body.email?.trim().slice(0, 200) || null,
      message,
    })
    .returning();
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
  const [totalResult, accessResult] = await Promise.all([
    db
      .select({ value: count() })
      .from(sessionsTable)
      .where(eq(sessionsTable.accessGranted, true)),
    db
      .select({ value: count() })
      .from(sessionsTable)
      .where(eq(sessionsTable.accessGranted, true)),
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
    total: Number(totalResult[0]?.value || 0),
    totalWithAccess: Number(accessResult[0]?.value || 0),
  });
});

export default router;
