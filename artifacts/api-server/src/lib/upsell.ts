import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  ne,
  sql,
} from "drizzle-orm";
import {
  db,
  sessionsTable,
  upsellOffersTable,
  upsellOrdersTable,
} from "@workspace/db";
import { randomUUID } from "node:crypto";
import {
  buildNoitesEmail,
  sendEmailViaBrevo,
} from "./brevo";
import {
  createAbacatePixCharge,
  fetchAbacatePixStatus,
} from "./abacatepay";
import {
  cancelStripePaymentIntent,
  createUpsellCardPaymentIntent,
  fetchStripePaymentIntentStatus,
  isStripeConfigured,
  retrieveStripePaymentIntent,
  retrieveStripePaymentMethod,
} from "./stripe";
import { sendPurchaseNotification } from "./push";
import { logger } from "./logger";
import { NOITES } from "./noites-content";
import {
  isUpsellEligibleSession,
  getUpsellLaunchAt,
} from "./upsell-eligibility";
import { releaseAccessEmail } from "./access-email-queue";

export type UpsellStage = "upsell" | "downsell";
export type UpsellProductId = "noites30" | "noites7";

export const UPSELL_PRODUCTS: Record<
  UpsellProductId,
  { cents: number; nights: number; name: string }
> = {
  noites30: {
    cents: 4000,
    nights: 30,
    name: "30 Noites de Conexão",
  },
  noites7: {
    cents: 1500,
    nights: 7,
    name: "7 Noites de Conexão",
  },
};

function releaseSessionAccessEmail(sessionId: string) {
  void releaseAccessEmail(sessionId).catch((error) =>
    logger.error(
      { err: error, sessionId },
      "Failed to release access email after upsell decision",
    ),
  );
}

function isProductId(value: string): value is UpsellProductId {
  return value === "noites30" || value === "noites7";
}

function productForStage(stage: UpsellStage): UpsellProductId {
  return stage === "upsell" ? "noites30" : "noites7";
}

function sessionIdFromStripeCustomer(
  value: string | { id: string } | null,
): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}

async function getSavedCard(session: {
  paymentMethod: string | null;
  stripePaymentIntentId: string | null;
}) {
  if (
    session.paymentMethod !== "card" ||
    !session.stripePaymentIntentId ||
    !isStripeConfigured()
  ) {
    return null;
  }

  try {
    const paymentIntent = await retrieveStripePaymentIntent(
      session.stripePaymentIntentId,
    );
    const customer = sessionIdFromStripeCustomer(paymentIntent.customer);
    const paymentMethodId = sessionIdFromStripeCustomer(
      paymentIntent.payment_method,
    );
    if (
      paymentIntent.status !== "succeeded" ||
      !customer ||
      !paymentMethodId
    ) {
      return null;
    }
    const paymentMethod = await retrieveStripePaymentMethod(paymentMethodId);
    if (paymentMethod.type !== "card" || !paymentMethod.card) return null;
    return {
      available: true,
      brand: paymentMethod.card.brand,
      last4: paymentMethod.card.last4,
      customer,
      paymentMethodId,
    };
  } catch (error) {
    logger.warn(
      { err: error, paymentIntentId: session.stripePaymentIntentId },
      "Could not retrieve the saved Stripe card",
    );
    return null;
  }
}

function fireAndForget<T>(
  promise: Promise<T>,
  message: string,
  context: Record<string, unknown>,
) {
  void promise.catch((error) => logger.error({ err: error, ...context }, message));
}

export async function getUpsellState(sessionId: string) {
  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, sessionId))
    .limit(1);
  const eligible = Boolean(
    session &&
      isUpsellEligibleSession(session, await getUpsellLaunchAt()),
  );
  const pixAvailable = Boolean(process.env.ABACATEPAY_API_KEY?.trim());
  if (!eligible || !session) {
    return {
      eligible: false,
      stage: "done" as const,
      product: null,
      pixAvailable,
      card: null,
    };
  }

  await db
    .insert(upsellOffersTable)
    .values({ sessionId, stage: "upsell" })
    .onConflictDoNothing();

  let [offer] = await db
    .select()
    .from(upsellOffersTable)
    .where(eq(upsellOffersTable.sessionId, sessionId))
    .limit(1);
  if (!offer) {
    throw new Error("Could not create the upsell offer state");
  }

  const [paidOrder] = await db
    .select({ id: upsellOrdersTable.id })
    .from(upsellOrdersTable)
    .where(
      and(
        eq(upsellOrdersTable.sessionId, sessionId),
        eq(upsellOrdersTable.status, "paid"),
      ),
    )
    .limit(1);

  let expiredUnansweredStage = false;
  if (!paidOrder && offer.stage !== "done") {
    const seenAt =
      offer.stage === "downsell"
        ? offer.downsellSeenAt
        : offer.upsellSeenAt;
    const declinedAt =
      offer.stage === "downsell"
        ? offer.downsellDeclinedAt
        : offer.upsellDeclinedAt;
    expiredUnansweredStage = Boolean(
      seenAt &&
        !declinedAt &&
        Date.now() - seenAt.getTime() > 24 * 60 * 60 * 1000,
    );
  }

  if (paidOrder || expiredUnansweredStage) {
    await db
      .update(upsellOffersTable)
      .set({ stage: "done" })
      .where(eq(upsellOffersTable.sessionId, sessionId));
    offer = { ...offer, stage: "done" };
    releaseSessionAccessEmail(sessionId);
  }

  const cardInfo = await getSavedCard(session);
  const currentStage =
    offer.stage === "upsell" || offer.stage === "downsell"
      ? offer.stage
      : "done";
  const productId =
    currentStage === "done" ? null : productForStage(currentStage);
  return {
    eligible: true,
    stage: currentStage,
    product: productId
      ? {
          id: productId,
          name: UPSELL_PRODUCTS[productId].name,
          priceCents: UPSELL_PRODUCTS[productId].cents,
          priceLabel: productId === "noites30" ? "R$ 40,00" : "R$ 15,00",
        }
      : null,
    pixAvailable,
    card: cardInfo
      ? {
          available: true,
          brand: cardInfo.brand,
          last4: cardInfo.last4,
        }
      : null,
  };
}

export async function markUpsellStageSeen(
  sessionId: string,
  stage: UpsellStage,
): Promise<boolean> {
  const state = await getUpsellState(sessionId);
  if (!state.eligible || state.stage !== stage) return false;

  await db
    .update(upsellOffersTable)
    .set(
      stage === "upsell"
        ? { upsellSeenAt: new Date() }
        : { downsellSeenAt: new Date() },
    )
    .where(
      and(
        eq(upsellOffersTable.sessionId, sessionId),
        eq(upsellOffersTable.stage, stage),
        stage === "upsell"
          ? isNull(upsellOffersTable.upsellSeenAt)
          : isNull(upsellOffersTable.downsellSeenAt),
      ),
    );
  return true;
}

export async function declineUpsellStage(
  sessionId: string,
  stage: UpsellStage,
): Promise<boolean> {
  const state = await getUpsellState(sessionId);
  if (!state.eligible || state.stage !== stage) return false;

  const [updated] = await db
    .update(upsellOffersTable)
    .set(
      stage === "upsell"
        ? {
            upsellDeclinedAt: new Date(),
            stage: "downsell",
          }
        : {
            downsellDeclinedAt: new Date(),
            stage: "done",
          },
    )
    .where(
      and(
        eq(upsellOffersTable.sessionId, sessionId),
        eq(upsellOffersTable.stage, stage),
      ),
    )
    .returning({ sessionId: upsellOffersTable.sessionId });
  if (!updated) return false;

  if (stage === "downsell") releaseSessionAccessEmail(sessionId);
  return true;
}

export async function createUpsellPixOrder(
  sessionId: string,
  productId: UpsellProductId,
) {
  if (!process.env.ABACATEPAY_API_KEY?.trim()) {
    return { ok: false as const, reason: "unavailable" as const };
  }
  const launchAt = await getUpsellLaunchAt();
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext('upsell:' || ${sessionId}))`,
    );
    const [session] = await tx
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, sessionId))
      .limit(1);
    const [offer] = await tx
      .select()
      .from(upsellOffersTable)
      .where(eq(upsellOffersTable.sessionId, sessionId))
      .limit(1);
    if (
      !session ||
      !offer ||
      !isUpsellEligibleSession(session, launchAt) ||
      offer.stage !== (productId === "noites30" ? "upsell" : "downsell")
    ) {
      return { ok: false as const, reason: "not_eligible" as const };
    }

    const [paidOrder] = await tx
      .select({ id: upsellOrdersTable.id })
      .from(upsellOrdersTable)
      .where(
        and(
          eq(upsellOrdersTable.sessionId, sessionId),
          eq(upsellOrdersTable.status, "paid"),
        ),
      )
      .limit(1);
    if (paidOrder) {
      return { ok: false as const, reason: "not_eligible" as const };
    }

    const now = new Date();
    const [existing] = await tx
      .select()
      .from(upsellOrdersTable)
      .where(
        and(
          eq(upsellOrdersTable.sessionId, sessionId),
          eq(upsellOrdersTable.product, productId),
          eq(upsellOrdersTable.method, "pix"),
          eq(upsellOrdersTable.status, "pending"),
        ),
      )
      .orderBy(desc(upsellOrdersTable.createdAt))
      .limit(1);
    if (existing?.pixExpiresAt && existing.pixExpiresAt > now) {
      return {
        ok: true as const,
        orderId: existing.id,
        brCode: existing.pixBrcode,
        brCodeBase64: existing.pixBrcodeBase64,
        expiresAt: existing.pixExpiresAt.toISOString(),
      };
    }
    if (existing) {
      await tx
        .update(upsellOrdersTable)
        .set({ status: "failed" })
        .where(
          and(
            eq(upsellOrdersTable.id, existing.id),
            eq(upsellOrdersTable.status, "pending"),
          ),
        );
    }

    const orderId = randomUUID();
    const product = UPSELL_PRODUCTS[productId];
    await tx.insert(upsellOrdersTable).values({
      id: orderId,
      sessionId,
      product: productId,
      amountCents: product.cents,
      method: "pix",
      status: "pending",
    });

    try {
      const charge = await createAbacatePixCharge({
        sessionId: `upsell_${orderId}`,
        amount: product.cents,
        description:
          productId === "noites30"
            ? "Perguntas de Conexao - 30 Noites"
            : "Perguntas de Conexao - 7 Noites",
      });
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await tx
        .update(upsellOrdersTable)
        .set({
          abacateChargeId: charge.id,
          pixBrcode: charge.brCode,
          pixBrcodeBase64: charge.brCodeBase64,
          pixExpiresAt: expiresAt,
        })
        .where(eq(upsellOrdersTable.id, orderId));
      return {
        ok: true as const,
        orderId,
        brCode: charge.brCode,
        brCodeBase64: charge.brCodeBase64,
        expiresAt: expiresAt.toISOString(),
      };
    } catch (error) {
      await tx
        .update(upsellOrdersTable)
        .set({ status: "failed" })
        .where(eq(upsellOrdersTable.id, orderId));
      throw error;
    }
  });
}

export async function createUpsellCardOrder(
  sessionId: string,
  productId: UpsellProductId,
) {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext('upsell:' || ${sessionId}))`,
    );

    const [session] = await tx
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, sessionId))
      .limit(1);
    const [offer] = await tx
      .select()
      .from(upsellOffersTable)
      .where(eq(upsellOffersTable.sessionId, sessionId))
      .limit(1);
    if (
      !session ||
      !offer ||
      !isUpsellEligibleSession(session, await getUpsellLaunchAt()) ||
      offer.stage !== (productId === "noites30" ? "upsell" : "downsell")
    ) {
      return { ok: false as const, reason: "not_eligible" as const };
    }

    const [paidOrder] = await tx
      .select({ id: upsellOrdersTable.id })
      .from(upsellOrdersTable)
      .where(
        and(
          eq(upsellOrdersTable.sessionId, sessionId),
          eq(upsellOrdersTable.status, "paid"),
        ),
      )
      .limit(1);
    if (paidOrder) {
      return { ok: true as const, status: "paid" as const };
    }

    if (session.paymentMethod !== "card" || !session.stripePaymentIntentId) {
      return { ok: false as const, reason: "card_unavailable" as const };
    }

    const originalIntent = await retrieveStripePaymentIntent(
      session.stripePaymentIntentId,
    );
    const customer = sessionIdFromStripeCustomer(originalIntent.customer);
    const paymentMethodId = sessionIdFromStripeCustomer(
      originalIntent.payment_method,
    );
    if (
      originalIntent.status !== "succeeded" ||
      !customer ||
      !paymentMethodId
    ) {
      return { ok: false as const, reason: "card_unavailable" as const };
    }

    const pendingCards = await tx
      .select()
      .from(upsellOrdersTable)
      .where(
        and(
          eq(upsellOrdersTable.sessionId, sessionId),
          eq(upsellOrdersTable.method, "card"),
          eq(upsellOrdersTable.status, "pending"),
        ),
      )
      .orderBy(desc(upsellOrdersTable.createdAt));

    for (const pending of pendingCards) {
      if (pending.stripePaymentIntentId) {
        const status = await fetchStripePaymentIntentStatus(
          pending.stripePaymentIntentId,
        );
        if (status === "succeeded") {
          await markOrderPaid(pending.id);
          return { ok: true as const, status: "paid" as const };
        }
        if (status === "requires_action") {
          await cancelStripePaymentIntent(pending.stripePaymentIntentId);
          await tx
            .update(upsellOrdersTable)
            .set({ status: "failed" })
            .where(eq(upsellOrdersTable.id, pending.id));
          continue;
        }
      }
      if (
        pending.product === productId &&
        Date.now() - pending.createdAt.getTime() < 2 * 60 * 1000
      ) {
        return { ok: false as const, reason: "processing" as const };
      }
    }

    const orderId = randomUUID();
    const product = UPSELL_PRODUCTS[productId];
    await tx.insert(upsellOrdersTable).values({
      id: orderId,
      sessionId,
      product: productId,
      amountCents: product.cents,
      method: "card",
      status: "pending",
    });

    try {
      const paymentIntent = await createUpsellCardPaymentIntent({
        amountCents: product.cents,
        customer,
        paymentMethod: paymentMethodId,
        receiptEmail: session.buyerEmail,
        orderId,
        product: productId,
      });
      await tx
        .update(upsellOrdersTable)
        .set({ stripePaymentIntentId: paymentIntent.id })
        .where(eq(upsellOrdersTable.id, orderId));

      if (paymentIntent.status === "succeeded") {
        return { ok: true as const, status: "paid" as const, orderId };
      }
      if (paymentIntent.status === "requires_action" && paymentIntent.client_secret) {
        return {
          ok: true as const,
          status: "requires_action" as const,
          clientSecret: paymentIntent.client_secret,
          orderId,
        };
      }

      await tx
        .update(upsellOrdersTable)
        .set({ status: "failed" })
        .where(eq(upsellOrdersTable.id, orderId));
      return { ok: false as const, reason: "declined" as const };
    } catch (error) {
      await tx
        .update(upsellOrdersTable)
        .set({ status: "failed" })
        .where(eq(upsellOrdersTable.id, orderId));
      logger.warn({ err: error, sessionId, productId }, "Upsell card declined");
      return { ok: false as const, reason: "declined" as const };
    }
  });
}

export async function markOrderPaid(orderId: string) {
  const [order] = await db
    .update(upsellOrdersTable)
    .set({ status: "paid", paidAt: new Date() })
    .where(
      and(
        eq(upsellOrdersTable.id, orderId),
        ne(upsellOrdersTable.status, "paid"),
        ne(upsellOrdersTable.status, "refunded"),
      ),
    )
    .returning();
  if (!order) return null;

  await db
    .update(upsellOffersTable)
    .set({ stage: "done" })
    .where(eq(upsellOffersTable.sessionId, order.sessionId));
  releaseSessionAccessEmail(order.sessionId);

  const [session] = await db
    .select({
      buyerName: sessionsTable.buyerName,
      buyerEmail: sessionsTable.buyerEmail,
    })
    .from(sessionsTable)
    .where(eq(sessionsTable.id, order.sessionId))
    .limit(1);
  if (!session) return order;

  if (!isProductId(order.product)) return order;
  const productId = order.product;

  fireAndForget(
    sendPurchaseNotification({
      buyerName: session.buyerName,
      packageName:
        productId === "noites30"
          ? "30 Noites (upsell R$ 40)"
          : "7 Noites (downsell R$ 15)",
    }),
    "Upsell purchase push failed",
    { sessionId: order.sessionId, orderId },
  );

  if (session.buyerEmail) {
    const baseUrl = (
      process.env.PUBLIC_BASE_URL || "https://www.perguntasdeconexao.com.br"
    ).replace(/\/+$/, "");
    const email = buildNoitesEmail({
      buyerName: session.buyerName,
      product: productId,
      noitesUrl: `${baseUrl}/noites/${encodeURIComponent(order.sessionId)}`,
    });
    fireAndForget(
      sendEmailViaBrevo({
        to: session.buyerEmail,
        toName: session.buyerName,
        subject: email.subject,
        htmlContent: email.htmlContent,
        textContent: email.textContent,
      }),
      "Upsell confirmation email failed",
      { sessionId: order.sessionId, orderId },
    );
  }

  return order;
}

export async function verifyUpsellOrder(orderId: string): Promise<string | null> {
  const [order] = await db
    .select()
    .from(upsellOrdersTable)
    .where(eq(upsellOrdersTable.id, orderId))
    .limit(1);
  if (!order) return null;
  if (order.status === "paid" || order.status === "refunded") {
    return order.status;
  }
  if (order.status !== "pending") return order.status;

  if (order.method === "card" && order.stripePaymentIntentId) {
    const status = await fetchStripePaymentIntentStatus(
      order.stripePaymentIntentId,
    );
    if (status === "succeeded") {
      await markOrderPaid(order.id);
      return "paid";
    }
  } else if (order.method === "pix" && order.abacateChargeId) {
    const result = await fetchAbacatePixStatus(order.abacateChargeId);
    if (result?.status === "PAID") {
      await markOrderPaid(order.id);
      return "paid";
    }
    if (order.pixExpiresAt && order.pixExpiresAt <= new Date()) {
      await db
        .update(upsellOrdersTable)
        .set({ status: "failed" })
        .where(
          and(
            eq(upsellOrdersTable.id, order.id),
            eq(upsellOrdersTable.status, "pending"),
          ),
        );
      return "failed";
    }
  }
  return "pending";
}

function saoPauloDateKey(date: Date): string {
  const values = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const parts = Object.fromEntries(
    values.map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function dayNumber(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function unlockedNights(paidAt: Date, total: number, today = new Date()): number {
  const elapsedDays =
    dayNumber(saoPauloDateKey(today)) - dayNumber(saoPauloDateKey(paidAt));
  return Math.min(total, Math.max(1, elapsedDays + 1));
}

function midnightSaoPauloIso(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const localAsUtc = Date.UTC(year, month - 1, day);
  const guess = new Date(localAsUtc);
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(guess);
  const values = Object.fromEntries(
    formatted.map(({ type, value }) => [type, value]),
  );
  const asIfUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  return new Date(localAsUtc - (asIfUtc - localAsUtc)).toISOString();
}

function addDaysToDateKey(dateKey: string, count: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1, day + count));
  return [
    target.getUTCFullYear(),
    String(target.getUTCMonth() + 1).padStart(2, "0"),
    String(target.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

async function getProgramOrder(sessionId: string) {
  const [order] = await db
    .select()
    .from(upsellOrdersTable)
    .where(
      and(
        eq(upsellOrdersTable.sessionId, sessionId),
        eq(upsellOrdersTable.status, "paid"),
        inArray(upsellOrdersTable.product, ["noites30", "noites7"]),
      ),
    )
    .orderBy(desc(upsellOrdersTable.amountCents), desc(upsellOrdersTable.paidAt))
    .limit(1);
  return order ?? null;
}

export async function getNoitesProgram(sessionId: string) {
  const order = await getProgramOrder(sessionId);
  if (!order || !isProductId(order.product)) return { hasProgram: false as const };
  const product = UPSELL_PRODUCTS[order.product];
  const paidAt = order.paidAt ?? order.createdAt;
  const unlocked = unlockedNights(paidAt, product.nights);
  const done = order.doneNights
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= product.nights);
  const doneSet = new Set(done);
  const nights = NOITES.slice(0, product.nights).map((night) => {
    const isUnlocked = night.n <= unlocked;
    return {
      n: night.n,
      semana: night.semana,
      semanaTitulo: night.semanaTitulo,
      titulo: night.titulo,
      minutos: night.minutos,
      state: doneSet.has(night.n)
        ? ("done" as const)
        : isUnlocked
          ? ("open" as const)
          : ("locked" as const),
      ...(isUnlocked
        ? {
            ritual: night.ritual,
            perguntas: night.perguntas,
            acao: night.acao,
            adulto: night.adulto,
          }
        : {}),
    };
  });
  const nextNight = unlocked < product.nights ? unlocked + 1 : null;
  const unlocksAt = nextNight
    ? midnightSaoPauloIso(
        addDaysToDateKey(saoPauloDateKey(paidAt), nextNight - 1),
      )
    : null;
  return {
    hasProgram: true as const,
    product: order.product,
    total: product.nights,
    unlocked,
    done,
    nights,
    unlocksAt,
  };
}

export async function setNoiteDone(
  sessionId: string,
  nightNumber: number,
  isDone: boolean,
) {
  const order = await getProgramOrder(sessionId);
  if (!order || !isProductId(order.product)) {
    return { ok: false as const, reason: "no_program" as const };
  }
  const total = UPSELL_PRODUCTS[order.product].nights;
  const unlocked = unlockedNights(order.paidAt ?? order.createdAt, total);
  if (
    !Number.isInteger(nightNumber) ||
    nightNumber < 1 ||
    nightNumber > unlocked
  ) {
    return { ok: false as const, reason: "locked" as const };
  }

  const done = new Set(
    order.doneNights
      .split(",")
      .map(Number)
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= total),
  );
  if (isDone) done.add(nightNumber);
  else done.delete(nightNumber);
  const doneNights = [...done].sort((a, b) => a - b).join(",");
  await db
    .update(upsellOrdersTable)
    .set({ doneNights })
    .where(
      and(
        eq(upsellOrdersTable.id, order.id),
        eq(upsellOrdersTable.status, "paid"),
      ),
    );
  return { ok: true as const, done: [...done].sort((a, b) => a - b) };
}

export async function reconcilePendingUpsellOrders(): Promise<number> {
  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const cutoff30m = new Date(Date.now() - 30 * 60 * 1000);
  const pending = await db
    .select()
    .from(upsellOrdersTable)
    .where(
      and(
        eq(upsellOrdersTable.status, "pending"),
        gte(upsellOrdersTable.createdAt, cutoff24h),
      ),
    )
    .orderBy(upsellOrdersTable.createdAt)
    .limit(100);

  let paidCount = 0;
  for (const order of pending) {
    try {
      if (
        order.method === "pix" &&
        order.createdAt < cutoff30m
      ) {
        await db
          .update(upsellOrdersTable)
          .set({ status: "failed" })
          .where(
            and(
              eq(upsellOrdersTable.id, order.id),
              eq(upsellOrdersTable.status, "pending"),
            ),
          );
        continue;
      }

      let isPaid = false;
      if (order.method === "pix" && order.abacateChargeId) {
        const status = await fetchAbacatePixStatus(order.abacateChargeId);
        isPaid = status?.status === "PAID";
        if (order.pixExpiresAt && order.pixExpiresAt <= new Date() && !isPaid) {
          await db
            .update(upsellOrdersTable)
            .set({ status: "failed" })
            .where(
              and(
                eq(upsellOrdersTable.id, order.id),
                eq(upsellOrdersTable.status, "pending"),
              ),
            );
          continue;
        }
      } else if (order.method === "card" && order.stripePaymentIntentId) {
        isPaid =
          (await fetchStripePaymentIntentStatus(
            order.stripePaymentIntentId,
          )) === "succeeded";
      }
      if (isPaid && (await markOrderPaid(order.id))) paidCount += 1;
    } catch (error) {
      logger.error(
        { err: error, orderId: order.id },
        "Upsell order reconciliation failed",
      );
    }
  }
  return paidCount;
}
