import { Router, type IRouter } from "express";
import crypto from "node:crypto";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lt,
  sql,
} from "drizzle-orm";
import { db, pageEventsTable, sessionsTable } from "@workspace/db";
import { isAdminSession } from "./feedback";
import { getActiveAssignmentForVisitor } from "../lib/experiments";
import { detectDevice, type DeviceType } from "../lib/device";

const router: IRouter = Router();
const LP_IDS = ["v1", "v2", "lp3"] as const;
const EVENT_TYPES = ["view", "cta_click", "exit"] as const;
const CTA_SOURCES = ["hero_quiz", "hero_comprar", "lp3_offer"] as const;

router.post("/track/page-event", async (req, res): Promise<void> => {
  const body = req.body as {
    lpId?: string;
    visitorKey?: string;
    experimentId?: string;
    experimentVariantId?: string;
    eventType?: string;
    timeOnPageMs?: number;
    lastSection?: string;
    clarityUserId?: string;
    claritySessionId?: string;
    ctaSource?: string;
    lcpMs?: number;
    internal?: boolean;
  };
  if (
    !LP_IDS.includes(body.lpId as (typeof LP_IDS)[number]) ||
    !EVENT_TYPES.includes(body.eventType as (typeof EVENT_TYPES)[number]) ||
    !body.visitorKey?.trim()
  ) {
    res.status(400).json({ error: "Evento de página inválido" });
    return;
  }
  if (
    body.ctaSource &&
    !CTA_SOURCES.includes(body.ctaSource as (typeof CTA_SOURCES)[number])
  ) {
    res.status(400).json({ error: "Origem de CTA inválida" });
    return;
  }
  if (Boolean(body.experimentId) !== Boolean(body.experimentVariantId)) {
    res.status(400).json({ error: "Associação de experimento inválida" });
    return;
  }
  const assignment =
    body.experimentId && body.experimentVariantId
      ? undefined
      : await getActiveAssignmentForVisitor(body.visitorKey.trim());
  const experimentId = body.experimentId?.trim() || assignment?.experimentId;
  const experimentVariantId =
    body.experimentVariantId?.trim() || assignment?.experimentVariantId;
  const lpId = body.lpId as (typeof LP_IDS)[number];
  const eventType = body.eventType as (typeof EVENT_TYPES)[number];
  await db.insert(pageEventsTable).values({
    id: crypto.randomUUID(),
    lpId,
    visitorKey: body.visitorKey.trim().slice(0, 120),
    experimentId: experimentId?.slice(0, 120) || null,
    experimentVariantId: experimentVariantId?.slice(0, 120) || null,
    eventType,
    timeOnPageMs:
      typeof body.timeOnPageMs === "number" &&
      Number.isFinite(body.timeOnPageMs)
        ? Math.max(0, Math.min(Math.round(body.timeOnPageMs), 86400000))
        : null,
    lastSection: body.lastSection?.trim().slice(0, 80) || null,
    clarityUserId: body.clarityUserId?.trim().slice(0, 200) || null,
    claritySessionId: body.claritySessionId?.trim().slice(0, 200) || null,
    ctaSource: body.ctaSource?.trim().slice(0, 40) || null,
    device: detectDevice(req.header("user-agent")),
    internal: body.internal === true,
    lcpMs:
      typeof body.lcpMs === "number" && Number.isFinite(body.lcpMs)
        ? Math.max(0, Math.min(Math.round(body.lcpMs), 120000))
        : null,
  });
  res.status(204).end();
});

async function computeFunnel(since: Date) {
  return Promise.all(
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
                eq(pageEventsTable.internal, false),
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
                eq(pageEventsTable.internal, false),
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
                eq(pageEventsTable.internal, false),
                gte(pageEventsTable.createdAt, since),
              ),
            ),
          db
            .select({ value: count() })
            .from(sessionsTable)
            .where(
              and(
                eq(sessionsTable.sourceLp, lpId),
                eq(sessionsTable.internal, false),
                gte(sessionsTable.createdAt, since),
              ),
            ),
          db
            .select({ value: count() })
            .from(sessionsTable)
            .where(
              and(
                eq(sessionsTable.sourceLp, lpId),
                eq(sessionsTable.accessGranted, true),
                eq(sessionsTable.internal, false),
                gte(sessionsTable.createdAt, since),
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
                eq(pageEventsTable.internal, false),
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
}

type AnalyticsLandingPageId = (typeof LP_IDS)[number] | "all";
type DeviceCounts = Record<DeviceType, number>;

function emptyDeviceCounts(): DeviceCounts {
  return { mobile: 0, desktop: 0, tablet: 0 };
}

function addDeviceCount(
  counts: DeviceCounts,
  device: string | null,
  value: number,
) {
  if (device === "mobile" || device === "desktop" || device === "tablet") {
    counts[device] += value;
  }
}

function queryString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function parseAnalyticsDate(
  value: string | undefined,
  label: string,
  endExclusive = false,
): Date | null {
  if (!value) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const parsed = new Date(dateOnly ? `${value}T00:00:00.000Z` : value);
  if (Number.isNaN(parsed.getTime())) return null;
  if (endExclusive && dateOnly) {
    parsed.setUTCDate(parsed.getUTCDate() + 1);
  }
  return parsed;
}

function resolveAnalyticsWindow(query: Record<string, unknown>) {
  const lp = queryString(query.lp) || "v2";
  if (lp !== "all" && !LP_IDS.includes(lp as (typeof LP_IDS)[number])) {
    return { error: "Landing page inválida" } as const;
  }

  const toRaw = queryString(query.to);
  const fromRaw = queryString(query.from);
  const daysRaw = queryString(query.days);
  const to = parseAnalyticsDate(toRaw, "to", true) || new Date();
  const days = daysRaw
    ? Math.min(Math.max(parseInt(daysRaw, 10) || 0, 1), 90)
    : 30;
  const from =
    parseAnalyticsDate(fromRaw, "from") ||
    new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  if (
    (fromRaw && !parseAnalyticsDate(fromRaw, "from")) ||
    (toRaw && !parseAnalyticsDate(toRaw, "to", true))
  ) {
    return { error: "Intervalo de datas inválido" } as const;
  }
  if (from >= to) {
    return { error: "O início deve ser anterior ao fim" } as const;
  }

  return {
    lpId: lp as AnalyticsLandingPageId,
    from,
    to,
    fromLabel: fromRaw || from.toISOString(),
    toLabel: toRaw || to.toISOString(),
  } as const;
}

async function computeFunnelAnalytics({
  lpId,
  from,
  to,
  fromLabel,
  toLabel,
}: {
  lpId: AnalyticsLandingPageId;
  from: Date;
  to: Date;
  fromLabel: string;
  toLabel: string;
}) {
  const lpIds = lpId === "all" ? [...LP_IDS] : [lpId];
  const eventWindow = [
    inArray(pageEventsTable.lpId, lpIds),
    eq(pageEventsTable.internal, false),
    gte(pageEventsTable.createdAt, from),
    lt(pageEventsTable.createdAt, to),
  ];
  const sessionWindow = [
    inArray(sessionsTable.sourceLp, lpIds),
    eq(sessionsTable.internal, false),
    gte(sessionsTable.createdAt, from),
    lt(sessionsTable.createdAt, to),
  ];

  const [
    views,
    ctaClicks,
    checkouts,
    purchases,
    avgTime,
    exits,
    heroExits,
    eventDevices,
    checkoutDevices,
    purchaseDevices,
    ctaSources,
    visitorRows,
    avgLcp,
  ] = await Promise.all([
    db
      .select({ value: count() })
      .from(pageEventsTable)
      .where(and(...eventWindow, eq(pageEventsTable.eventType, "view"))),
    db
      .select({ value: count() })
      .from(pageEventsTable)
      .where(and(...eventWindow, eq(pageEventsTable.eventType, "cta_click"))),
    db
      .select({ value: count() })
      .from(sessionsTable)
      .where(and(...sessionWindow)),
    db
      .select({ value: count() })
      .from(sessionsTable)
      .where(and(...sessionWindow, eq(sessionsTable.accessGranted, true))),
    db
      .select({ value: sql<string>`avg(${pageEventsTable.timeOnPageMs})` })
      .from(pageEventsTable)
      .where(and(...eventWindow, eq(pageEventsTable.eventType, "exit"))),
    db
      .select({ section: pageEventsTable.lastSection, value: count() })
      .from(pageEventsTable)
      .where(and(...eventWindow, eq(pageEventsTable.eventType, "exit")))
      .groupBy(pageEventsTable.lastSection)
      .orderBy(desc(count()))
      .limit(5),
    db
      .select({ value: count() })
      .from(pageEventsTable)
      .where(
        and(
          ...eventWindow,
          eq(pageEventsTable.eventType, "exit"),
          sql`lower(coalesce(${pageEventsTable.lastSection}, '')) like '%hero%'`,
        ),
      ),
    db
      .select({
        eventType: pageEventsTable.eventType,
        device: pageEventsTable.device,
        value: count(),
      })
      .from(pageEventsTable)
      .where(and(...eventWindow))
      .groupBy(pageEventsTable.eventType, pageEventsTable.device),
    db
      .select({ device: sessionsTable.device, value: count() })
      .from(sessionsTable)
      .where(and(...sessionWindow))
      .groupBy(sessionsTable.device),
    db
      .select({ device: sessionsTable.device, value: count() })
      .from(sessionsTable)
      .where(and(...sessionWindow, eq(sessionsTable.accessGranted, true)))
      .groupBy(sessionsTable.device),
    db
      .select({ source: sessionsTable.ctaSource, value: count() })
      .from(sessionsTable)
      .where(and(...sessionWindow, isNotNull(sessionsTable.ctaSource)))
      .groupBy(sessionsTable.ctaSource)
      .orderBy(desc(count())),
    db
      .select({
        visitorKey: sessionsTable.visitorKey,
        value: count(),
      })
      .from(sessionsTable)
      .where(and(...sessionWindow, isNotNull(sessionsTable.visitorKey)))
      .groupBy(sessionsTable.visitorKey),
    db
      .select({ value: sql<string>`avg(${pageEventsTable.lcpMs})` })
      .from(pageEventsTable)
      .where(and(...eventWindow, isNotNull(pageEventsTable.lcpMs))),
  ]);

  const deviceBreakdown = {
    views: emptyDeviceCounts(),
    ctaClicks: emptyDeviceCounts(),
    checkoutsStarted: emptyDeviceCounts(),
    purchasesConfirmed: emptyDeviceCounts(),
  };
  for (const row of eventDevices) {
    if (row.eventType === "view" || row.eventType === "cta_click") {
      addDeviceCount(
        deviceBreakdown[row.eventType === "view" ? "views" : "ctaClicks"],
        row.device,
        Number(row.value),
      );
    }
  }
  for (const row of checkoutDevices) {
    addDeviceCount(
      deviceBreakdown.checkoutsStarted,
      row.device,
      Number(row.value),
    );
  }
  for (const row of purchaseDevices) {
    addDeviceCount(
      deviceBreakdown.purchasesConfirmed,
      row.device,
      Number(row.value),
    );
  }

  const uniqueVisitors = visitorRows.length;
  const recurringVisitors = visitorRows.filter(
    (row) => Number(row.value) > 1,
  ).length;

  return {
    lpId,
    from: fromLabel,
    to: toLabel,
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
    heroExits: Number(heroExits[0]?.value || 0),
    deviceBreakdown,
    checkoutsByCtaSource: ctaSources
      .filter((item) => item.source)
      .map((item) => ({
        source: item.source as string,
        count: Number(item.value),
      })),
    visitors: {
      unique: uniqueVisitors,
      recurring: recurringVisitors,
      new: uniqueVisitors - recurringVisitors,
    },
    avgLcpMs:
      avgLcp[0]?.value == null ? null : Math.round(Number(avgLcp[0].value)),
  };
}

router.get("/admin/analytics", async (req, res): Promise<void> => {
  const sessionId =
    typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
  if (!(await isAdminSession(sessionId))) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const analytics = await computeFunnel(since);
  res.json({ analytics });
});

router.get("/admin/analytics-funnel", async (req, res): Promise<void> => {
  const sessionId =
    typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
  if (!(await isAdminSession(sessionId))) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  const window = resolveAnalyticsWindow(req.query);
  if ("error" in window) {
    res.status(400).json({ error: window.error });
    return;
  }

  const analytics = await computeFunnelAnalytics(window);
  res.json(analytics);
});

router.get("/report/funnel", async (req, res): Promise<void> => {
  const token =
    req.header("x-report-token") ??
    (typeof req.query.token === "string" ? req.query.token : undefined);
  if (!token || token !== process.env.ANALYTICS_REPORT_TOKEN) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const days = Math.min(
    Math.max(parseInt(String(req.query.days ?? "2"), 10) || 2, 1),
    90,
  );
  const now = Date.now();
  const since = new Date(now - days * 24 * 60 * 60 * 1000);
  const [windowData, baseline] = await Promise.all([
    computeFunnel(since),
    computeFunnel(new Date(now - 30 * 24 * 60 * 60 * 1000)),
  ]);

  res.json({
    generatedAt: new Date().toISOString(),
    windowDays: days,
    window: windowData,
    last30Days: baseline,
  });
});

export default router;
