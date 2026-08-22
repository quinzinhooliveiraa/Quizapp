import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, invitesTable, sessionsTable } from "@workspace/db";

const router: IRouter = Router();

const patchSchema = z.object({
  sessionId: z.string().trim().min(1).optional(),
  guestToken: z.string().trim().min(1).optional(),
  relationshipType: z.string().trim().max(80).optional(),
  partnerPronoun: z.string().trim().max(40).optional(),
}).refine(value => Boolean(value.sessionId || value.guestToken), {
  message: "sessionId or guestToken required",
});

router.get("/preferences", async (req, res): Promise<void> => {
  const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId.trim() : "";
  const guestToken = typeof req.query.guestToken === "string" ? req.query.guestToken.trim() : "";

  if (!sessionId && !guestToken) {
    res.status(400).json({ error: "sessionId or guestToken required" });
    return;
  }

  if (sessionId) {
    const [row] = await db
      .select({
        relationshipType: sessionsTable.relationshipType,
        partnerPronoun: sessionsTable.partnerPronoun,
      })
      .from(sessionsTable)
      .where(eq(sessionsTable.id, sessionId))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "session not found" });
      return;
    }
    res.json({
      relationshipType: row.relationshipType || null,
      partnerPronoun: row.partnerPronoun || null,
    });
    return;
  }

  const [row] = await db
    .select({
      relationshipType: invitesTable.relationshipType,
      partnerPronoun: invitesTable.partnerPronoun,
    })
    .from(invitesTable)
    .where(eq(invitesTable.token, guestToken))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "invite not found" });
    return;
  }
  res.json({
    relationshipType: row.relationshipType || null,
    partnerPronoun: row.partnerPronoun || null,
  });
});

router.patch("/preferences", async (req, res): Promise<void> => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid body", details: parsed.error.flatten() });
    return;
  }

  const { sessionId, guestToken, relationshipType, partnerPronoun } = parsed.data;
  const patch: { relationshipType?: string | null; partnerPronoun?: string | null } = {};
  if (relationshipType !== undefined) patch.relationshipType = relationshipType || null;
  if (partnerPronoun !== undefined) patch.partnerPronoun = partnerPronoun || null;

  if (Object.keys(patch).length === 0) {
    res.json({ ok: true });
    return;
  }

  if (sessionId) {
    await db.update(sessionsTable).set(patch).where(eq(sessionsTable.id, sessionId));
  } else {
    await db.update(invitesTable).set(patch).where(eq(invitesTable.token, guestToken!));
  }

  res.json({ ok: true });
});

export default router;