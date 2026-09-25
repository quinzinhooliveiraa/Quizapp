import { Router, type IRouter, type Request } from "express";
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
  ne,
  sql,
} from "drizzle-orm";
import {
  db,
  invitesTable,
  pageEventsTable,
  quizAnswersTable,
  sessionsTable,
} from "@workspace/db";
import {
  DeleteAdminAnalyticsDataQueryParams,
  DeleteAdminAnalyticsDataResponse,
} from "@workspace/api-zod";
import { isAdminSession } from "./feedback";
import { getActiveAssignmentForVisitor } from "../lib/experiments";
import { detectDevice, type DeviceType } from "../lib/device";
import { reconcilePendingPayments } from "../lib/payment-reconciliation";
import { sendMetaEvent } from "../lib/meta-conversions";

const router: IRouter = Router();
const LP_IDS = ["v1", "v2", "lp3"] as const;
const EVENT_TYPES = [
  "view",
  "cta_click",
  "exit",
  "quiz_start",
  "theme_peek",
  "buy_click",
  "checkout_open",
] as const;
const CTA_SOURCES = [
  "hero_quiz",
  "hero_comprar",
  "oferta_principal",
  "preco",
  "rodape",
  "sticky",
  "pos_quiz",
  "baralho_modal",
  "lp3_offer",
] as const;

function trackedText(value: unknown, maxLength: number): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : null;
}

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

router.post("/track/meta-event", (req, res): void => {
  const body = req.body as {
    eventName?: string;
    eventId?: string;
    visitorKey?: string;
    value?: number;
    currency?: string;
    consent?: boolean;
    internal?: boolean;
    fbp?: string;
    fbc?: string;
    sourceUrl?: string;
  };
  const value = body.value;
  let sourceUrl: string | null = null;
  try {
    const parsedUrl = new URL(body.sourceUrl || "");
    if (parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:") {
      sourceUrl = parsedUrl.toString().slice(0, 2048);
    }
  } catch {
    sourceUrl = null;
  }

  if (
    body.eventName !== "InitiateCheckout" ||
    !body.eventId?.trim() ||
    body.eventId.length > 255 ||
    !body.visitorKey?.trim() ||
    body.visitorKey.length > 120 ||
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0 ||
    (body.currency !== "BRL" && body.currency !== "EUR") ||
    !sourceUrl
  ) {
    res.status(400).json({ error: "Evento Meta inválido" });
    return;
  }

  if (body.consent === true && body.internal !== true) {
    const forwardedFor = req.header("x-forwarded-for");
    const clientIpAddress =
      forwardedFor?.split(",")[0]?.trim() || req.ip || undefined;
    void sendMetaEvent("InitiateCheckout", {
      eventId: body.eventId.trim(),
      value,
      currency: body.currency,
      sourceUrl,
      userData: {
        visitorKey: body.visitorKey.trim().slice(0, 120),
        clientIpAddress,
        clientUserAgent: req.header("user-agent") || undefined,
        fbp: body.fbp?.trim().slice(0, 500),
        fbc: body.fbc?.trim().slice(0, 500),
      },
    });
  }

  res.status(204).end();
});

router.post("/track/quiz-answer", async (req, res): Promise<void> => {
  const body = req.body as {
    lpId?: string;
    quizId?: string;
    visitorKey?: string;
    screenId?: string;
    answerKey?: string;
    answerValue?: string;
    step?: number;
    experimentId?: string;
    experimentVariantId?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    utmTerm?: string;
    internal?: boolean;
  };
  const lpId = trackedText(body.lpId, 40);
  const quizId = trackedText(body.quizId, 80);
  const visitorKey = trackedText(body.visitorKey, 120);
  const screenId = trackedText(body.screenId, 120);
  const answerKey = trackedText(body.answerKey, 80);
  const answerValue = trackedText(body.answerValue, 2000);
  const step =
    typeof body.step === "number" && Number.isInteger(body.step)
      ? Math.max(0, Math.min(body.step, 999))
      : null;

  if (
    lpId !== "v1" &&
    lpId !== "v2" &&
    lpId !== "lp3"
  ) {
    res.status(400).json({ error: "Landing page inválida" });
    return;
  }
  if (
    !quizId ||
    !visitorKey ||
    !screenId ||
    !answerKey ||
    !answerValue ||
    step === null
  ) {
    res.status(400).json({ error: "Resposta de quiz inválida" });
    return;
  }
  if (Boolean(body.experimentId) !== Boolean(body.experimentVariantId)) {
    res.status(400).json({ error: "Associação de experimento inválida" });
    return;
  }

  const assignment =
    body.experimentId && body.experimentVariantId
      ? undefined
      : await getActiveAssignmentForVisitor(visitorKey);

  if (screenId === "quiz-complete") {
    const existingCompletion = await db
      .select({ id: quizAnswersTable.id })
      .from(quizAnswersTable)
      .where(
        and(
          eq(quizAnswersTable.visitorKey, visitorKey),
          eq(quizAnswersTable.quizId, quizId),
          eq(quizAnswersTable.lpId, lpId),
          eq(quizAnswersTable.screenId, "quiz-complete"),
          eq(quizAnswersTable.answerKey, answerKey),
          eq(quizAnswersTable.answerValue, "true"),
          eq(quizAnswersTable.internal, body.internal === true),
        ),
      )
      .limit(1);
    if (existingCompletion.length > 0) {
      res.status(204).end();
      return;
    }
  }

  await db.insert(quizAnswersTable).values({
    id: crypto.randomUUID(),
    visitorKey,
    quizId,
    lpId,
    screenId,
    answerKey,
    answerValue,
    step,
    experimentId:
      trackedText(body.experimentId, 120) || assignment?.experimentId || null,
    experimentVariantId:
      trackedText(body.experimentVariantId, 120) ||
      assignment?.experimentVariantId ||
      null,
    utmSource: trackedText(body.utmSource, 160),
    utmMedium: trackedText(body.utmMedium, 160),
    utmCampaign: trackedText(body.utmCampaign, 200),
    utmContent: trackedText(body.utmContent, 200),
    utmTerm: trackedText(body.utmTerm, 200),
    internal: body.internal === true,
  });
  res.status(204).end();
});

async function computeFunnel(since: Date) {
  return Promise.all(
    LP_IDS.map(async (lpId) => {
      const distinctVisitors = sql<number>`count(distinct ${pageEventsTable.visitorKey})`;
      const distinctSessionVisitors = sql<number>`count(distinct ${sessionsTable.visitorKey})`;
      const [
        views,
        buyClicks,
        checkoutOpens,
        avgTime,
        paymentsGenerated,
        purchases,
        exits,
        quizStarts,
        themePeeks,
      ] =
        await Promise.all([
          db
            .select({ value: distinctVisitors })
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
            .select({ value: distinctVisitors })
            .from(pageEventsTable)
            .where(
              and(
                eq(pageEventsTable.lpId, lpId),
                eq(pageEventsTable.eventType, "buy_click"),
                eq(pageEventsTable.internal, false),
                gte(pageEventsTable.createdAt, since),
              ),
            ),
          db
            .select({ value: distinctVisitors })
            .from(pageEventsTable)
            .where(
              and(
                eq(pageEventsTable.lpId, lpId),
                eq(pageEventsTable.eventType, "checkout_open"),
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
            .select({ value: distinctSessionVisitors })
            .from(sessionsTable)
            .where(
              and(
                eq(sessionsTable.sourceLp, lpId),
                eq(sessionsTable.internal, false),
                gte(sessionsTable.createdAt, since),
              ),
            ),
          db
            .select({ value: distinctSessionVisitors })
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
          db
            .select({ value: distinctVisitors })
            .from(pageEventsTable)
            .where(
              and(
                eq(pageEventsTable.lpId, lpId),
                eq(pageEventsTable.eventType, "quiz_start"),
                eq(pageEventsTable.internal, false),
                gte(pageEventsTable.createdAt, since),
              ),
            ),
          db
            .select({ value: distinctVisitors })
            .from(pageEventsTable)
            .where(
              and(
                eq(pageEventsTable.lpId, lpId),
                eq(pageEventsTable.eventType, "theme_peek"),
                eq(pageEventsTable.internal, false),
                gte(pageEventsTable.createdAt, since),
              ),
            ),
        ]);
      return {
        lpId,
        views: Number(views[0]?.value || 0),
        buyClicks: Number(buyClicks[0]?.value || 0),
        checkoutOpens: Number(checkoutOpens[0]?.value || 0),
        paymentsGenerated: Number(paymentsGenerated[0]?.value || 0),
        purchasesConfirmed: Number(purchases[0]?.value || 0),
        navigationSignals: {
          quizStarts: Number(quizStarts[0]?.value || 0),
          themePeeks: Number(themePeeks[0]?.value || 0),
        },
        // Keep the legacy report shape readable for existing consumers.
        ctaClicks: Number(buyClicks[0]?.value || 0),
        checkoutsStarted: Number(paymentsGenerated[0]?.value || 0),
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
  const distinctEventVisitors = sql<number>`count(distinct ${pageEventsTable.visitorKey})`;
  const distinctSessionVisitors = sql<number>`count(distinct ${sessionsTable.visitorKey})`;

  const [
    views,
    buyClicks,
    checkoutOpens,
    quizStarts,
    themePeeks,
    paymentsGenerated,
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
      .select({ value: distinctEventVisitors })
      .from(pageEventsTable)
      .where(and(...eventWindow, eq(pageEventsTable.eventType, "view"))),
    db
      .select({ value: distinctEventVisitors })
      .from(pageEventsTable)
      .where(and(...eventWindow, eq(pageEventsTable.eventType, "buy_click"))),
    db
      .select({ value: distinctEventVisitors })
      .from(pageEventsTable)
      .where(and(...eventWindow, eq(pageEventsTable.eventType, "checkout_open"))),
    db
      .select({ value: distinctEventVisitors })
      .from(pageEventsTable)
      .where(and(...eventWindow, eq(pageEventsTable.eventType, "quiz_start"))),
    db
      .select({ value: distinctEventVisitors })
      .from(pageEventsTable)
      .where(and(...eventWindow, eq(pageEventsTable.eventType, "theme_peek"))),
    db
      .select({ value: distinctSessionVisitors })
      .from(sessionsTable)
      .where(and(...sessionWindow)),
    db
      .select({ value: distinctSessionVisitors })
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
        value: distinctEventVisitors,
      })
      .from(pageEventsTable)
      .where(and(...eventWindow))
      .groupBy(pageEventsTable.eventType, pageEventsTable.device),
    db
      .select({ device: sessionsTable.device, value: distinctSessionVisitors })
      .from(sessionsTable)
      .where(and(...sessionWindow))
      .groupBy(sessionsTable.device),
    db
      .select({ device: sessionsTable.device, value: distinctSessionVisitors })
      .from(sessionsTable)
      .where(and(...sessionWindow, eq(sessionsTable.accessGranted, true)))
      .groupBy(sessionsTable.device),
    db
      .select({ source: sessionsTable.ctaSource, value: distinctSessionVisitors })
      .from(sessionsTable)
      .where(and(...sessionWindow, isNotNull(sessionsTable.ctaSource)))
      .groupBy(sessionsTable.ctaSource)
      .orderBy(desc(distinctSessionVisitors)),
    db
      .select({
        visitorKey: pageEventsTable.visitorKey,
        value: count(),
      })
      .from(pageEventsTable)
      .where(and(...eventWindow))
      .groupBy(pageEventsTable.visitorKey),
    db
      .select({ value: sql<string>`avg(${pageEventsTable.lcpMs})` })
      .from(pageEventsTable)
      .where(and(...eventWindow, isNotNull(pageEventsTable.lcpMs))),
  ]);

  const deviceBreakdown = {
    views: emptyDeviceCounts(),
    buyClicks: emptyDeviceCounts(),
    checkoutOpens: emptyDeviceCounts(),
    paymentsGenerated: emptyDeviceCounts(),
    purchasesConfirmed: emptyDeviceCounts(),
  };
  for (const row of eventDevices) {
    if (
      row.eventType === "view" ||
      row.eventType === "buy_click" ||
      row.eventType === "checkout_open"
    ) {
      const deviceKey =
        row.eventType === "view"
          ? "views"
          : row.eventType === "buy_click"
            ? "buyClicks"
            : "checkoutOpens";
      addDeviceCount(
        deviceBreakdown[deviceKey],
        row.device,
        Number(row.value),
      );
    }
  }
  for (const row of checkoutDevices) {
    addDeviceCount(
      deviceBreakdown.paymentsGenerated,
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
    buyClicks: Number(buyClicks[0]?.value || 0),
    checkoutOpens: Number(checkoutOpens[0]?.value || 0),
    paymentsGenerated: Number(paymentsGenerated[0]?.value || 0),
    purchasesConfirmed: Number(purchases[0]?.value || 0),
    navigationSignals: {
      quizStarts: Number(quizStarts[0]?.value || 0),
      themePeeks: Number(themePeeks[0]?.value || 0),
    },
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

async function computeQuizAnalytics({
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
  const answerWindow = [
    eq(quizAnswersTable.quizId, "lp1"),
    inArray(quizAnswersTable.lpId, lpIds),
    eq(quizAnswersTable.internal, false),
    gte(quizAnswersTable.createdAt, from),
    lt(quizAnswersTable.createdAt, to),
  ];
  const distinctVisitors = sql<number>`count(distinct ${quizAnswersTable.visitorKey})`;

  const [totals, completed, questions, answerBreakdown, campaigns, variants] =
    await Promise.all([
      db
        .select({
          answers: count(),
          visitors: distinctVisitors,
        })
        .from(quizAnswersTable)
        .where(and(...answerWindow)),
      db
        .select({ visitors: distinctVisitors })
        .from(quizAnswersTable)
        .where(
          and(
            ...answerWindow,
            eq(quizAnswersTable.screenId, "quiz-complete"),
            eq(quizAnswersTable.answerValue, "true"),
          ),
        ),
      db
        .select({
          screenId: quizAnswersTable.screenId,
          answerKey: quizAnswersTable.answerKey,
          step: sql<number>`min(${quizAnswersTable.step})`,
          answers: count(),
          visitors: distinctVisitors,
        })
        .from(quizAnswersTable)
        .where(
          and(...answerWindow, ne(quizAnswersTable.screenId, "quiz-complete")),
        )
        .groupBy(quizAnswersTable.screenId, quizAnswersTable.answerKey)
        .orderBy(asc(sql<number>`min(${quizAnswersTable.step})`)),
      db
        .select({
          screenId: quizAnswersTable.screenId,
          answerKey: quizAnswersTable.answerKey,
          value: quizAnswersTable.answerValue,
          answers: count(),
          visitors: distinctVisitors,
        })
        .from(quizAnswersTable)
        .where(
          and(...answerWindow, ne(quizAnswersTable.screenId, "quiz-complete")),
        )
        .groupBy(
          quizAnswersTable.screenId,
          quizAnswersTable.answerKey,
          quizAnswersTable.answerValue,
        )
        .orderBy(desc(distinctVisitors))
        .limit(120),
      db
        .select({
          source: quizAnswersTable.utmSource,
          campaign: quizAnswersTable.utmCampaign,
          answers: count(),
          visitors: distinctVisitors,
        })
        .from(quizAnswersTable)
        .where(and(...answerWindow))
        .groupBy(quizAnswersTable.utmSource, quizAnswersTable.utmCampaign)
        .orderBy(desc(distinctVisitors))
        .limit(40),
      db
        .select({
          variantId: quizAnswersTable.experimentVariantId,
          answers: count(),
          visitors: distinctVisitors,
        })
        .from(quizAnswersTable)
        .where(and(...answerWindow, isNotNull(quizAnswersTable.experimentVariantId)))
        .groupBy(quizAnswersTable.experimentVariantId)
        .orderBy(desc(distinctVisitors)),
    ]);

  const visitorCount = Number(totals[0]?.visitors || 0);
  const completedCount = Number(completed[0]?.visitors || 0);

  return {
    quizId: "lp1",
    lpId,
    from: fromLabel,
    to: toLabel,
    visitors: visitorCount,
    answers: Number(totals[0]?.answers || 0),
    completedVisitors: completedCount,
    completionRate:
      visitorCount > 0 ? Number(((completedCount / visitorCount) * 100).toFixed(1)) : 0,
    questions: questions.map((row) => ({
      screenId: row.screenId,
      answerKey: row.answerKey,
      step: Number(row.step),
      answers: Number(row.answers),
      visitors: Number(row.visitors),
    })),
    answerBreakdown: answerBreakdown.map((row) => ({
      screenId: row.screenId,
      answerKey: row.answerKey,
      value: row.value,
      answers: Number(row.answers),
      visitors: Number(row.visitors),
    })),
    campaigns: campaigns.map((row) => ({
      source: row.source,
      campaign: row.campaign,
      answers: Number(row.answers),
      visitors: Number(row.visitors),
    })),
    variants: variants.map((row) => ({
      variantId: row.variantId,
      answers: Number(row.answers),
      visitors: Number(row.visitors),
    })),
  };
}

router.get("/admin/analytics", async (req, res): Promise<void> => {
  const sessionId =
    typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
  if (!(await isAdminSession(sessionId))) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }
  await reconcilePendingPayments();
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

  await reconcilePendingPayments();
  const window = resolveAnalyticsWindow(req.query);
  if ("error" in window) {
    res.status(400).json({ error: window.error });
    return;
  }

  const analytics = await computeFunnelAnalytics(window);
  res.json(analytics);
});

function hasValidAnalyticsExportToken(req: Request): boolean {
  const configuredToken = process.env.ANALYTICS_EXPORT_TOKEN?.trim();
  const authorization = req.header("authorization")?.trim();
  if (!configuredToken || !authorization?.startsWith("Bearer ")) return false;

  const providedToken = authorization.slice("Bearer ".length).trim();
  const expectedBuffer = Buffer.from(configuredToken);
  const providedBuffer = Buffer.from(providedToken);
  return (
    expectedBuffer.length === providedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, providedBuffer)
  );
}

router.get("/admin/analytics-export", async (req, res): Promise<void> => {
  if (!hasValidAnalyticsExportToken(req)) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const window = resolveAnalyticsWindow(req.query);
  if ("error" in window) {
    res.status(400).json({ error: window.error });
    return;
  }

  await reconcilePendingPayments();
  const [funnel, quiz] = await Promise.all([
    computeFunnelAnalytics(window),
    computeQuizAnalytics(window),
  ]);

  res.json({
    generatedAt: new Date().toISOString(),
    window: {
      lpId: window.lpId,
      from: window.fromLabel,
      to: window.toLabel,
    },
    funnel,
    completion: {
      visitors: quiz.visitors,
      completedVisitors: quiz.completedVisitors,
      completionRate: quiz.completionRate,
    },
    utmBreakdown: quiz.campaigns,
  });
});

router.get("/admin/quiz-analytics", async (req, res): Promise<void> => {
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

  const analytics = await computeQuizAnalytics(window);
  res.json(analytics);
});

router.delete("/admin/analytics-data", async (req, res): Promise<void> => {
  const parsed = DeleteAdminAnalyticsDataQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Filtros de limpeza inválidos" });
    return;
  }
  if (!(await isAdminSession(parsed.data.sessionId))) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  const window = resolveAnalyticsWindow(parsed.data);
  if ("error" in window) {
    res.status(400).json({ error: window.error });
    return;
  }

  const lpIds = window.lpId === "all" ? [...LP_IDS] : [window.lpId];
  const scope = parsed.data.scope ?? "landing";
  const eventFilters = [
    inArray(pageEventsTable.lpId, lpIds),
    gte(pageEventsTable.createdAt, window.from),
    lt(pageEventsTable.createdAt, window.to),
  ];
  const sessionFilters = [
    inArray(sessionsTable.sourceLp, lpIds),
    gte(sessionsTable.createdAt, window.from),
    lt(sessionsTable.createdAt, window.to),
    ne(sessionsTable.id, parsed.data.sessionId),
  ];

  const deleted = await db.transaction(async (tx) => {
    if (scope === "quiz") {
      const deletedQuizAnswers = await tx
        .delete(quizAnswersTable)
        .where(
          and(
            inArray(quizAnswersTable.lpId, lpIds),
            gte(quizAnswersTable.createdAt, window.from),
            lt(quizAnswersTable.createdAt, window.to),
          ),
        )
        .returning({ id: quizAnswersTable.id });

      return {
        deletedEvents: 0,
        deletedSessions: 0,
        deletedInvites: 0,
        deletedQuizAnswers: deletedQuizAnswers.length,
      };
    }

    const sessions = await tx
      .select({ id: sessionsTable.id })
      .from(sessionsTable)
      .where(and(...sessionFilters));
    const sessionIds = sessions.map((session) => session.id);
    const invites =
      sessionIds.length > 0
        ? await tx
            .select({ token: invitesTable.token })
            .from(invitesTable)
            .where(inArray(invitesTable.sessionId, sessionIds))
        : [];

    const events = await tx
      .delete(pageEventsTable)
      .where(and(...eventFilters))
      .returning({ id: pageEventsTable.id });
    const deletedSessions =
      sessionIds.length > 0
        ? await tx
            .delete(sessionsTable)
            .where(inArray(sessionsTable.id, sessionIds))
            .returning({ id: sessionsTable.id })
        : [];
    return {
      deletedEvents: events.length,
      deletedSessions: deletedSessions.length,
      deletedInvites: invites.length,
      deletedQuizAnswers: 0,
    };
  });

  res.json(DeleteAdminAnalyticsDataResponse.parse(deleted));
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
