import { Router, type IRouter } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  sessionsTable,
  upsellOffersTable,
  upsellOrdersTable,
} from "@workspace/db";
import { isAdminSession } from "./feedback";
import {
  createUpsellCardOrder,
  createUpsellPixOrder,
  declineUpsellStage,
  getNoitesProgram,
  getUpsellState,
  markOrderPaid,
  markUpsellStageSeen,
  setNoiteDone,
  verifyUpsellOrder,
} from "../lib/upsell";
import { releaseAccessEmail } from "../lib/access-email-queue";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const sessionQuerySchema = z.object({
  sessionId: z.string().trim().min(1).max(200),
});
const stageSchema = z.enum(["upsell", "downsell"]);
const productSchema = z.enum(["noites30", "noites7"]);
const sessionStageSchema = z
  .object({
    sessionId: z.string().trim().min(1).max(200),
    stage: stageSchema,
  })
  .strict();
const sessionProductSchema = z
  .object({
    sessionId: z.string().trim().min(1).max(200),
    product: productSchema,
  })
  .strict();

function getSessionIdFromQuery(value: unknown): string | null {
  const parsed = sessionQuerySchema.safeParse({ sessionId: value });
  return parsed.success ? parsed.data.sessionId : null;
}

function parseOrderId(value: unknown): string | null {
  const parsed = z.string().uuid().safeParse(value);
  return parsed.success ? parsed.data : null;
}

function fireAndForgetRelease(sessionId: string) {
  void releaseAccessEmail(sessionId).catch((error) =>
    logger.error(
      { err: error, sessionId },
      "Failed to release access email after downsell decline",
    ),
  );
}

router.get("/upsell/state", async (req, res): Promise<void> => {
  const sessionId = getSessionIdFromQuery(req.query.sessionId);
  if (!sessionId) {
    res.status(400).json({ error: "Sessão inválida" });
    return;
  }
  try {
    res.json(await getUpsellState(sessionId));
  } catch (error) {
    req.log.error({ err: error, sessionId }, "Could not load upsell state");
    res.status(500).json({ error: "Não foi possível carregar a oferta" });
  }
});

router.post("/upsell/seen", async (req, res): Promise<void> => {
  const parsed = sessionStageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados da oferta inválidos" });
    return;
  }
  try {
    const updated = await markUpsellStageSeen(
      parsed.data.sessionId,
      parsed.data.stage,
    );
    if (!updated) {
      res.status(409).json({ error: "Esta etapa da oferta não está disponível" });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    req.log.error(
      { err: error, sessionId: parsed.data.sessionId },
      "Could not mark upsell stage as seen",
    );
    res.status(500).json({ error: "Não foi possível registrar a oferta" });
  }
});

router.post("/upsell/decline", async (req, res): Promise<void> => {
  const parsed = sessionStageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados da oferta inválidos" });
    return;
  }
  try {
    const updated = await declineUpsellStage(
      parsed.data.sessionId,
      parsed.data.stage,
    );
    if (!updated) {
      res.status(409).json({ error: "Esta etapa da oferta não está disponível" });
      return;
    }
    if (parsed.data.stage === "downsell") {
      fireAndForgetRelease(parsed.data.sessionId);
    }
    res.json({ ok: true });
  } catch (error) {
    req.log.error(
      { err: error, sessionId: parsed.data.sessionId },
      "Could not decline upsell stage",
    );
    res.status(500).json({ error: "Não foi possível continuar" });
  }
});

router.post("/upsell/pix", async (req, res): Promise<void> => {
  const parsed = sessionProductSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados de pagamento inválidos" });
    return;
  }
  try {
    const result = await createUpsellPixOrder(
      parsed.data.sessionId,
      parsed.data.product,
    );
    if (!result.ok) {
      res.status(409).json({ error: "Esta oferta não está disponível" });
      return;
    }
    res.json({
      orderId: result.orderId,
      brCode: result.brCode,
      brCodeBase64: result.brCodeBase64,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    req.log.error(
      { err: error, sessionId: parsed.data.sessionId },
      "Could not create upsell Pix charge",
    );
    res.status(502).json({ error: "Não foi possível gerar o Pix" });
  }
});

router.post("/upsell/card", async (req, res): Promise<void> => {
  const parsed = sessionProductSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados de pagamento inválidos" });
    return;
  }
  try {
    const result = await createUpsellCardOrder(
      parsed.data.sessionId,
      parsed.data.product,
    );
    if (
      result.ok &&
      result.status === "paid" &&
      "orderId" in result &&
      result.orderId
    ) {
      await markOrderPaid(result.orderId);
    }
    const statusCode =
      result.ok || result.reason === "declined" ? 200 : 409;
    res.status(statusCode).json(result);
  } catch (error) {
    req.log.error(
      { err: error, sessionId: parsed.data.sessionId },
      "Could not charge upsell card",
    );
    res.status(502).json({ ok: false, reason: "declined" });
  }
});

router.post(
  "/upsell/orders/:orderId/verify",
  async (req, res): Promise<void> => {
    const orderId = parseOrderId(req.params.orderId);
    if (!orderId) {
      res.status(400).json({ error: "Pedido inválido" });
      return;
    }
    try {
      const status = await verifyUpsellOrder(orderId);
      if (!status) {
        res.status(404).json({ error: "Pedido não encontrado" });
        return;
      }
      res.json({ status });
    } catch (error) {
      req.log.error({ err: error, orderId }, "Could not verify upsell order");
      res.status(502).json({ error: "Não foi possível verificar o pagamento" });
    }
  },
);

router.get("/noites", async (req, res): Promise<void> => {
  const sessionId = getSessionIdFromQuery(req.query.sessionId);
  if (!sessionId) {
    res.status(400).json({ error: "Sessão inválida" });
    return;
  }
  try {
    res.json(await getNoitesProgram(sessionId));
  } catch (error) {
    req.log.error({ err: error, sessionId }, "Could not load Noites program");
    res.status(500).json({ error: "Não foi possível abrir as Noites" });
  }
});

router.post("/noites/done", async (req, res): Promise<void> => {
  const parsed = z
    .object({
      sessionId: z.string().trim().min(1).max(200),
      night: z.number().int().min(1).max(30),
      done: z.boolean(),
    })
    .strict()
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados da noite inválidos" });
    return;
  }
  try {
    const result = await setNoiteDone(
      parsed.data.sessionId,
      parsed.data.night,
      parsed.data.done,
    );
    if (!result.ok) {
      res.status(result.reason === "locked" ? 409 : 404).json(result);
      return;
    }
    res.json(result);
  } catch (error) {
    req.log.error(
      { err: error, sessionId: parsed.data.sessionId },
      "Could not update Noites completion",
    );
    res.status(500).json({ error: "Não foi possível atualizar a noite" });
  }
});

router.get("/admin/upsell/summary", async (req, res): Promise<void> => {
  const sessionId = getSessionIdFromQuery(req.query.sessionId);
  if (!(await isAdminSession(sessionId ?? undefined))) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  const [offerRows, orderRows] = await Promise.all([
    db
      .select({
        sessionId: upsellOffersTable.sessionId,
        upsellSeenAt: upsellOffersTable.upsellSeenAt,
        upsellDeclinedAt: upsellOffersTable.upsellDeclinedAt,
        downsellSeenAt: upsellOffersTable.downsellSeenAt,
        downsellDeclinedAt: upsellOffersTable.downsellDeclinedAt,
      })
      .from(upsellOffersTable)
      .innerJoin(
        sessionsTable,
        eq(sessionsTable.id, upsellOffersTable.sessionId),
      )
      .where(eq(sessionsTable.internal, false)),
    db
      .select({
        id: upsellOrdersTable.id,
        sessionId: upsellOrdersTable.sessionId,
        createdAt: upsellOrdersTable.createdAt,
        product: upsellOrdersTable.product,
        amountCents: upsellOrdersTable.amountCents,
        method: upsellOrdersTable.method,
        status: upsellOrdersTable.status,
        paidAt: upsellOrdersTable.paidAt,
        buyerEmail: sessionsTable.buyerEmail,
      })
      .from(upsellOrdersTable)
      .innerJoin(
        sessionsTable,
        eq(sessionsTable.id, upsellOrdersTable.sessionId),
      )
      .where(eq(sessionsTable.internal, false))
      .orderBy(desc(upsellOrdersTable.createdAt)),
  ]);

  const decisionDurations: number[] = [];
  const ordersBySession = new Map<string, typeof orderRows>();
  for (const order of orderRows) {
    const rows = ordersBySession.get(order.sessionId) ?? [];
    rows.push(order);
    ordersBySession.set(order.sessionId, rows);
  }
  const addDecisionDuration = (seenAt: Date | null, decisionAt: Date | null) => {
    if (seenAt && decisionAt && decisionAt >= seenAt) {
      decisionDurations.push(decisionAt.getTime() - seenAt.getTime());
    }
  };
  for (const offer of offerRows) {
    const sessionOrders = ordersBySession.get(offer.sessionId) ?? [];
    const paid30 = sessionOrders.find(
      (order) =>
        order.product === "noites30" &&
        (order.status === "paid" || order.status === "refunded"),
    );
    const paid7 = sessionOrders.find(
      (order) =>
        order.product === "noites7" &&
        (order.status === "paid" || order.status === "refunded"),
    );
    const upsellDecision = [
      offer.upsellDeclinedAt,
      paid30?.paidAt ?? null,
    ]
      .filter((value): value is Date => value !== null)
      .sort((a, b) => a.getTime() - b.getTime())[0];
    const downsellDecision = [
      offer.downsellDeclinedAt,
      paid7?.paidAt ?? null,
    ]
      .filter((value): value is Date => value !== null)
      .sort((a, b) => a.getTime() - b.getTime())[0];
    addDecisionDuration(offer.upsellSeenAt, upsellDecision ?? null);
    addDecisionDuration(offer.downsellSeenAt, downsellDecision ?? null);
  }
  decisionDurations.sort((a, b) => a - b);
  const middle = Math.floor(decisionDurations.length / 2);
  const medianDecisionMs =
    decisionDurations.length === 0
      ? null
      : decisionDurations.length % 2 === 0
        ? Math.round(
            (decisionDurations[middle - 1] + decisionDurations[middle]) / 2,
          )
        : decisionDurations[middle];

  const successfulOrders = orderRows.filter(
    (order) => order.status === "paid" || order.status === "refunded",
  );
  const metric = (
    product: string,
    method: string,
  ) =>
    successfulOrders.filter(
      (order) => order.product === product && order.method === method,
    ).length;
  const summary = {
    upsellSeen: offerRows.filter((row) => row.upsellSeenAt).length,
    upsellDeclined: offerRows.filter((row) => row.upsellDeclinedAt).length,
    downsellSeen: offerRows.filter((row) => row.downsellSeenAt).length,
    downsellDeclined: offerRows.filter((row) => row.downsellDeclinedAt).length,
    noites30PixPaid: metric("noites30", "pix"),
    noites30CardPaid: metric("noites30", "card"),
    noites7PixPaid: metric("noites7", "pix"),
    noites7CardPaid: metric("noites7", "card"),
    pixGenerated: orderRows.filter(
      (order) => order.method === "pix" && order.status !== "failed",
    ).length,
    pixPaid: successfulOrders.filter((order) => order.method === "pix").length,
    refunded: orderRows.filter((order) => order.status === "refunded").length,
    grossRevenueCents: successfulOrders.reduce(
      (sum, order) => sum + order.amountCents,
      0,
    ),
    medianDecisionMs,
  };

  res.json({
    summary,
    latestOrders: orderRows.slice(0, 30).map((order) => ({
      id: order.id,
      createdAt: order.createdAt.toISOString(),
      product: order.product,
      amountCents: order.amountCents,
      method: order.method,
      status: order.status,
      buyerEmail: order.buyerEmail,
    })),
  });
});

router.patch(
  "/admin/upsell/orders/:orderId",
  async (req, res): Promise<void> => {
    const orderId = parseOrderId(req.params.orderId);
    const sessionId = getSessionIdFromQuery(req.query.sessionId);
    if (!(await isAdminSession(sessionId ?? undefined))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
    const parsed = z
      .object({ refunded: z.literal(true) })
      .strict()
      .safeParse(req.body);
    if (!orderId || !parsed.success) {
      res.status(400).json({ error: "Pedido inválido" });
      return;
    }
    const [updated] = await db
      .update(upsellOrdersTable)
      .set({ status: "refunded", refundedAt: new Date() })
      .where(
        and(
          eq(upsellOrdersTable.id, orderId),
          eq(upsellOrdersTable.status, "paid"),
        ),
      )
      .returning({ id: upsellOrdersTable.id });
    if (!updated) {
      res.status(404).json({ error: "Pedido pago não encontrado" });
      return;
    }
    res.json({ ok: true, id: updated.id, status: "refunded" });
  },
);

export default router;
