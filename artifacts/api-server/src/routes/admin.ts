import { Router, type IRouter } from "express";
import crypto from "node:crypto";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import {
  db,
  pageEventsTable,
  pushSubscriptionsTable,
  sessionsTable,
} from "@workspace/db";
import { isAdminSession } from "./feedback";

const router: IRouter = Router();

function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

router.get("/admin/check", async (req, res): Promise<void> => {
  const sessionId =
    typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
  if (!sessionId) {
    res.json({ isAdmin: false });
    return;
  }

  const [row] = await db
    .select({ buyerEmail: sessionsTable.buyerEmail })
    .from(sessionsTable)
    .where(eq(sessionsTable.id, sessionId))
    .limit(1);

  const email = row?.buyerEmail?.trim().toLowerCase();
  res.json({ isAdmin: Boolean(email && getAdminEmails().includes(email)) });
});

router.get("/push/vapid-public-key", (_req, res): void => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    res.status(503).json({ error: "Push notifications are not configured" });
    return;
  }
  res.json({ publicKey });
});

router.post("/admin/push-subscribe", async (req, res): Promise<void> => {
  const { sessionId, subscription } = req.body as {
    sessionId?: string;
    subscription?: {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
  };
  if (!(await isAdminSession(sessionId))) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }
  if (
    !subscription?.endpoint ||
    !subscription.keys?.p256dh ||
    !subscription.keys.auth
  ) {
    res.status(400).json({ error: "Inscrição de push inválida" });
    return;
  }
  await db
    .insert(pushSubscriptionsTable)
    .values({
      id: crypto.randomUUID(),
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    })
    .onConflictDoNothing({ target: pushSubscriptionsTable.endpoint });
  res.status(201).json({ ok: true });
});

router.post("/admin/push-unsubscribe", async (req, res): Promise<void> => {
  const { sessionId, endpoint } = req.body as {
    sessionId?: string;
    endpoint?: string;
  };
  if (!(await isAdminSession(sessionId))) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }
  if (!endpoint?.trim()) {
    res.status(400).json({ error: "Endpoint inválido" });
    return;
  }
  await db
    .delete(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.endpoint, endpoint));
  res.json({ ok: true });
});

router.get("/admin/session-recording", async (req, res): Promise<void> => {
  const sessionId =
    typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
  const buyerId =
    typeof req.query.buyerId === "string" ? req.query.buyerId : undefined;
  if (!(await isAdminSession(sessionId))) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }
  if (!buyerId?.trim()) {
    res.status(400).json({ error: "Comprador inválido" });
    return;
  }

  const [buyer] = await db
    .select({ visitorKey: sessionsTable.visitorKey })
    .from(sessionsTable)
    .where(eq(sessionsTable.id, buyerId))
    .limit(1);
  const visitorKey = buyer?.visitorKey?.trim();
  if (!visitorKey) {
    res.json({ available: false, reason: "sem-rastreio" });
    return;
  }

  const [event] = await db
    .select({
      clarityUserId: pageEventsTable.clarityUserId,
      claritySessionId: pageEventsTable.claritySessionId,
    })
    .from(pageEventsTable)
    .where(
      and(
        eq(pageEventsTable.visitorKey, visitorKey),
        eq(pageEventsTable.eventType, "view"),
        isNotNull(pageEventsTable.clarityUserId),
        isNotNull(pageEventsTable.claritySessionId),
      ),
    )
    .orderBy(desc(pageEventsTable.createdAt))
    .limit(1);

  if (!event?.clarityUserId || !event.claritySessionId) {
    res.json({ available: false, reason: "sem-gravacao", visitorKey });
    return;
  }

  res.json({
    available: true,
    url: `https://clarity.microsoft.com/player/y7zh9f1ygk/${encodeURIComponent(event.clarityUserId)}/${encodeURIComponent(event.claritySessionId)}`,
    visitorKey,
  });
});

export default router;
