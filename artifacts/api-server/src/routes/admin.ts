import { Router, type IRouter } from "express";
import crypto from "node:crypto";
import { and, desc, eq, gte, inArray, isNotNull } from "drizzle-orm";
import {
  db,
  appSettingsTable,
  pageEventsTable,
  pushSubscriptionsTable,
  sessionsTable,
} from "@workspace/db";
import { isAdminSession } from "./feedback";
import {
  getPrimaryLandingPageId,
  isPrimaryLandingPageId,
  setPrimaryLandingPageId,
} from "../lib/primary-landing-page";

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

router.get("/landing-pages/primary", async (_req, res): Promise<void> => {
  const primary = await getPrimaryLandingPageId();
  res.json({
    primaryLandingPage: primary.id,
    fallbackUsed: primary.usedFallback,
  });
});

router.get("/admin/landing-pages/primary", async (req, res): Promise<void> => {
  const sessionId =
    typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
  if (!(await isAdminSession(sessionId))) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  const primary = await getPrimaryLandingPageId();
  res.json({
    primaryLandingPage: primary.id,
    fallbackUsed: primary.usedFallback,
  });
});

router.patch("/admin/landing-pages/primary", async (req, res): Promise<void> => {
  const sessionId =
    typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
  if (!(await isAdminSession(sessionId))) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  const primaryLandingPage =
    typeof req.body?.primaryLandingPage === "string"
      ? req.body.primaryLandingPage.trim()
      : "";
  if (!isPrimaryLandingPageId(primaryLandingPage)) {
    res.status(400).json({ error: "Landing page principal inválida" });
    return;
  }

  const saved = await setPrimaryLandingPageId(primaryLandingPage);
  res.json({
    primaryLandingPage: saved,
    fallbackUsed: false,
  });
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
  const requestedVisitorKey =
    typeof req.query.visitorKey === "string"
      ? req.query.visitorKey.trim()
      : undefined;
  if (!(await isAdminSession(sessionId))) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }
  if (!buyerId?.trim() && !requestedVisitorKey) {
    res.status(400).json({ error: "Comprador ou visitante inválido" });
    return;
  }

  const [buyer] = buyerId?.trim()
    ? await db
        .select({ visitorKey: sessionsTable.visitorKey })
        .from(sessionsTable)
        .where(eq(sessionsTable.id, buyerId))
        .limit(1)
    : [];
  const visitorKey = buyer?.visitorKey?.trim() || requestedVisitorKey;
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

router.get("/admin/lp-sessions", async (req, res): Promise<void> => {
  const sessionId =
    typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
  const lpId = typeof req.query.lpId === "string" ? req.query.lpId : undefined;
  if (!(await isAdminSession(sessionId))) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }
  if (lpId !== "v1" && lpId !== "v2" && lpId !== "lp3") {
    res.status(400).json({ error: "Landing page inválida" });
    return;
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const events = await db
    .select({
      visitorKey: pageEventsTable.visitorKey,
      eventType: pageEventsTable.eventType,
      timeOnPageMs: pageEventsTable.timeOnPageMs,
      lastSection: pageEventsTable.lastSection,
      createdAt: pageEventsTable.createdAt,
      clarityUserId: pageEventsTable.clarityUserId,
      claritySessionId: pageEventsTable.claritySessionId,
    })
    .from(pageEventsTable)
    .where(
      and(
        eq(pageEventsTable.lpId, lpId),
        isNotNull(pageEventsTable.visitorKey),
        inArray(pageEventsTable.eventType, ["view", "exit"]),
        // Keep this query bounded to the same reporting window as analytics.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        gte(pageEventsTable.createdAt, since),
      ),
    )
    .orderBy(desc(pageEventsTable.createdAt))
    .limit(5000);

  const grouped = new Map<
    string,
    {
      firstSeenAt: Date;
      timeOnPageMs: number | null;
      lastSection: string | null;
      hasRecording: boolean;
    }
  >();
  for (const event of events) {
    const current = grouped.get(event.visitorKey) || {
      firstSeenAt: event.createdAt,
      timeOnPageMs: null,
      lastSection: null,
      hasRecording: false,
    };
    if (event.eventType === "view" && event.createdAt < current.firstSeenAt) {
      current.firstSeenAt = event.createdAt;
    }
    if (event.eventType === "exit" && current.timeOnPageMs === null) {
      current.timeOnPageMs = event.timeOnPageMs;
      current.lastSection = event.lastSection;
    }
    if (event.clarityUserId && event.claritySessionId) {
      current.hasRecording = true;
    }
    grouped.set(event.visitorKey, current);
  }

  const visitorKeys = [...grouped.keys()].slice(0, 200);
  const linkedSessions =
    visitorKeys.length > 0
      ? await db
          .select({
            visitorKey: sessionsTable.visitorKey,
            buyerName: sessionsTable.buyerName,
            packageName: sessionsTable.packageName,
            accessGranted: sessionsTable.accessGranted,
          })
          .from(sessionsTable)
          .where(inArray(sessionsTable.visitorKey, visitorKeys))
      : [];
  const sessionByVisitorKey = new Map(
    linkedSessions.map((session) => [session.visitorKey, session]),
  );

  res.json({
    sessions: visitorKeys.map((visitorKey) => {
      const groupedSession = grouped.get(visitorKey)!;
      const buyer = sessionByVisitorKey.get(visitorKey);
      return {
        visitorKey,
        firstSeenAt: groupedSession.firstSeenAt.toISOString(),
        timeOnPageSeconds:
          groupedSession.timeOnPageMs == null
            ? null
            : Math.round(groupedSession.timeOnPageMs / 1000),
        lastSection: groupedSession.lastSection,
        status: buyer
          ? buyer.accessGranted
            ? "comprou"
            : "aguardando_pagamento"
          : "so_visitou",
        buyerName: buyer?.buyerName || null,
        packageName: buyer?.packageName || null,
        hasRecording: groupedSession.hasRecording,
      };
    }),
  });
});

export default router;
