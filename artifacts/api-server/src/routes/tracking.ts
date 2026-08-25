import { Router, type IRouter } from "express";
import crypto from "node:crypto";
import { and, asc, count, desc, eq, gte, sql } from "drizzle-orm";
import { db, pageEventsTable, sessionsTable } from "@workspace/db";
import { isAdminSession } from "./feedback";

const router: IRouter = Router();
const LP_IDS = ["v1", "v2"] as const;
const EVENT_TYPES = ["view", "cta_click", "exit"] as const;

router.post("/track/page-event", async (req, res): Promise<void> => {
  const body = req.body as {
    lpId?: string;
    visitorKey?: string;
    eventType?: string;
    timeOnPageMs?: number;
    lastSection?: string;
  };
  if (
    !LP_IDS.includes(body.lpId as (typeof LP_IDS)[number]) ||
    !EVENT_TYPES.includes(body.eventType as (typeof EVENT_TYPES)[number]) ||
    !body.visitorKey?.trim()
  ) {
    res.status(400).json({ error: "Evento de página inválido" });
    return;
  }
  const lpId = body.lpId as (typeof LP_IDS)[number];
  const eventType = body.eventType as (typeof EVENT_TYPES)[number];
  await db.insert(pageEventsTable).values({
    id: crypto.randomUUID(),
    lpId,
    visitorKey: body.visitorKey.trim().slice(0, 120),
    eventType,
    timeOnPageMs:
      typeof body.timeOnPageMs === "number" &&
      Number.isFinite(body.timeOnPageMs)
        ? Math.max(0, Math.min(Math.round(body.timeOnPageMs), 86400000))
        : null,
    lastSection: body.lastSection?.trim().slice(0, 80) || null,
  });
  res.status(204).end();
});

router.get("/admin/analytics", async (req, res): Promise<void> => {
  const sessionId =
    typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
  if (!(await isAdminSession(sessionId))) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const analytics = await Promise.all(
    LP_IDS.map(async (lpId) => {
      const [views, ctaClicks, avgTime, checkouts, purchases, exits] =
        await Promise.all([
          db
            .select({ value: count() })
            .from(pageEventsTable)
            .where(
              and(
                eq(pageEventsTable.lpId, lpId),
                eq(pageEventsTable.eventType, "view"),
                gte(pageEventsTable.createdAt, since),
              ),
            ),
          db
            .select({ value: count() })
            .from(pageEventsTable)
            .where(
              and(
                eq(pageEventsTable.lpId, lpId),
                eq(pageEventsTable.eventType, "cta_click"),
                gte(pageEventsTable.createdAt, since),
              ),
            ),
          db
            .select({
              value: sql<string>`avg(${pageEventsTable.timeOnPageMs})`,
            })
            .from(pageEventsTable)
            .where(
              and(
                eq(pageEventsTable.lpId, lpId),
                eq(pageEventsTable.eventType, "exit"),
                gte(pageEventsTable.createdAt, since),
              ),
            ),
          db
            .select({ value: count() })
            .from(sessionsTable)
            .where(eq(sessionsTable.sourceLp, lpId)),
          db
            .select({ value: count() })
            .from(sessionsTable)
            .where(
              and(
                eq(sessionsTable.sourceLp, lpId),
                eq(sessionsTable.accessGranted, true),
              ),
            ),
          db
            .select({
              section: pageEventsTable.lastSection,
              value: count(),
            })
            .from(pageEventsTable)
            .where(
              and(
                eq(pageEventsTable.lpId, lpId),
                eq(pageEventsTable.eventType, "exit"),
                gte(pageEventsTable.createdAt, since),
              ),
            )
            .groupBy(pageEventsTable.lastSection)
            .orderBy(desc(count()))
            .limit(5),
        ]);
      return {
        lpId,
        views: Number(views[0]?.value || 0),
        ctaClicks: Number(ctaClicks[0]?.value || 0),
        checkoutsStarted: Number(checkouts[0]?.value || 0),
        purchasesConfirmed: Number(purchases[0]?.value || 0),
        avgTimeOnPageSeconds:
          avgTime[0]?.value == null
            ? null
            : Math.round(Number(avgTime[0].value) / 1000),
        topExitSections: exits
          .filter((item) => item.section)
          .map((item) => ({
            section: item.section as string,
            count: Number(item.value),
          })),
      };
    }),
  );
  res.json({ analytics });
});

export default router;
