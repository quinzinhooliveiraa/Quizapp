import { Router, type IRouter } from "express";
import crypto from "node:crypto";
import { and, desc, eq, or } from "drizzle-orm";
import { db, savedMomentsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/moments", async (req, res): Promise<void> => {
  const sessionId = String(req.query.sessionId || "").trim();
  const guestToken = String(req.query.guestToken || "").trim();
  if (!sessionId && !guestToken) {
    res.status(400).json({ error: "Precisa passar sessionId ou guestToken" });
    return;
  }
  const rows = await db.select()
    .from(savedMomentsTable)
    .where(sessionId
      ? eq(savedMomentsTable.ownerSessionId, sessionId)
      : eq(savedMomentsTable.ownerGuestToken, guestToken))
    .orderBy(desc(savedMomentsTable.createdAt))
    .limit(200);
  res.json({ moments: rows });
});

router.post("/moments", async (req, res): Promise<void> => {
  const body = req.body as {
    sessionId?: string;
    guestToken?: string;
    questionId?: string;
    themeId?: string;
    fromPlayerName?: string;
    answerText?: string;
    roomCode?: string;
  };
  const sessionId = body.sessionId?.trim() || "";
  const guestToken = body.guestToken?.trim() || "";
  if (!sessionId && !guestToken) {
    res.status(400).json({ error: "sessionId ou guestToken" });
    return;
  }
  if (!body.questionId || !body.themeId || !body.fromPlayerName || !body.answerText) {
    res.status(400).json({ error: "campos obrigatórios faltando" });
    return;
  }
  const id = crypto.randomUUID();
  await db.insert(savedMomentsTable).values({
    id,
    ownerSessionId: sessionId || null,
    ownerGuestToken: guestToken || null,
    questionId: body.questionId,
    themeId: body.themeId,
    fromPlayerName: body.fromPlayerName.trim().slice(0, 60),
    answerText: body.answerText.trim().slice(0, 2000),
    roomCode: body.roomCode?.trim().slice(0, 5) || null,
  });
  res.status(201).json({ id, ok: true });
});

router.delete("/moments/:id", async (req, res): Promise<void> => {
  const id = String(req.params.id || "").trim();
  const sessionId = String(req.query.sessionId || "").trim();
  const guestToken = String(req.query.guestToken || "").trim();
  const ownerFilters = [
    sessionId ? eq(savedMomentsTable.ownerSessionId, sessionId) : undefined,
    guestToken ? eq(savedMomentsTable.ownerGuestToken, guestToken) : undefined,
  ].filter((filter): filter is NonNullable<typeof filter> => Boolean(filter));
  if (!id || ownerFilters.length === 0) {
    res.status(400).json({ error: "id e sessionId ou guestToken são obrigatórios" });
    return;
  }
  await db.delete(savedMomentsTable).where(and(
    eq(savedMomentsTable.id, id),
    or(...ownerFilters),
  ));
  res.json({ ok: true });
});

export default router;