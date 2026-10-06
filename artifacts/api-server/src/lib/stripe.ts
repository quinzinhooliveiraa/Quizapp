import Stripe from "stripe";
import type { Pricing } from "./pricing";

export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY?.trim() &&
      process.env.STRIPE_WEBHOOK_SECRET?.trim(),
  );
}

function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY não configurada");
  }
  return new Stripe(secretKey);
}

async function findOrCreateStripeCustomer({
  email,
  sessionId,
  name,
}: {
  email: string;
  sessionId: string;
  name?: string;
}): Promise<string> {
  const stripe = getStripeClient();
  const existing = await stripe.customers.list({ email, limit: 1 });
  if (existing.data[0]) return existing.data[0].id;

  const customer = await stripe.customers.create({
    email,
    ...(name ? { name } : {}),
    metadata: { sessionId },
  });
  return customer.id;
}

export async function createStripePaymentIntent({
  sessionId,
  buyerEmail,
  pricing,
}: {
  sessionId: string;
  buyerEmail?: string | null;
  pricing: Pricing;
}): Promise<{ id: string; clientSecret: string }> {
  const stripe = getStripeClient();
  const customer =
    buyerEmail && pricing.currency.toLowerCase() === "brl"
      ? await findOrCreateStripeCustomer({
          email: buyerEmail,
          sessionId,
        })
      : undefined;
  const paymentIntent = await stripe.paymentIntents.create({
    amount: pricing.amountCents,
    currency: pricing.currency,
    automatic_payment_methods: { enabled: true },
    metadata: { sessionId, region: pricing.region },
    ...(buyerEmail ? { receipt_email: buyerEmail } : {}),
    ...(customer
      ? { customer, setup_future_usage: "on_session" as const }
      : {}),
  });

  if (!paymentIntent.client_secret) {
    throw new Error("Stripe não retornou o client secret do pagamento");
  }

  return {
    id: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
  };
}

export async function attachCustomerToPaymentIntent(
  paymentIntentId: string,
  email: string,
  name?: string,
): Promise<void> {
  const stripe = getStripeClient();
  const paymentIntent =
    await stripe.paymentIntents.retrieve(paymentIntentId);
  if (
    paymentIntent.currency.toLowerCase() !== "brl" ||
    paymentIntent.customer ||
    !["requires_payment_method", "requires_confirmation"].includes(
      paymentIntent.status,
    )
  ) {
    return;
  }

  const customer = await findOrCreateStripeCustomer({
    email,
    sessionId: paymentIntent.metadata.sessionId || paymentIntentId,
    name,
  });
  await stripe.paymentIntents.update(paymentIntent.id, {
    customer,
    setup_future_usage: "on_session",
  });
}

export function verifyStripeWebhook(
  rawBody: Buffer,
  signature: string | undefined,
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET não configurada");
  }
  if (!signature) {
    throw new Error("Assinatura stripe-signature ausente");
  }

  return getStripeClient().webhooks.constructEvent(
    rawBody,
    signature,
    webhookSecret,
  );
}

export async function fetchStripePaymentIntentStatus(
  paymentIntentId: string,
): Promise<string | null> {
  if (!paymentIntentId || !isStripeConfigured()) return null;

  try {
    const paymentIntent =
      await getStripeClient().paymentIntents.retrieve(paymentIntentId);
    return paymentIntent.status;
  } catch {
    return null;
  }
}

export async function fetchStripePaymentIntentClientSecret(
  paymentIntentId: string,
): Promise<string | null> {
  if (!paymentIntentId || !isStripeConfigured()) return null;

  try {
    const paymentIntent =
      await getStripeClient().paymentIntents.retrieve(paymentIntentId);
    return paymentIntent.client_secret ?? null;
  } catch {
    return null;
  }
}

export async function retrieveStripePaymentIntent(
  paymentIntentId: string,
): Promise<Stripe.PaymentIntent> {
  return getStripeClient().paymentIntents.retrieve(paymentIntentId);
}

export async function retrieveStripePaymentMethod(
  paymentMethodId: string,
): Promise<Stripe.PaymentMethod> {
  return getStripeClient().paymentMethods.retrieve(paymentMethodId);
}

export async function createUpsellCardPaymentIntent({
  amountCents,
  customer,
  paymentMethod,
  receiptEmail,
  orderId,
  product,
}: {
  amountCents: number;
  customer: string;
  paymentMethod: string;
  receiptEmail?: string | null;
  orderId: string;
  product: "noites30" | "noites7";
}): Promise<Stripe.PaymentIntent> {
  return getStripeClient().paymentIntents.create(
    {
      amount: amountCents,
      currency: "brl",
      customer,
      payment_method: paymentMethod,
      payment_method_types: ["card"],
      confirm: true,
      off_session: false,
      ...(receiptEmail ? { receipt_email: receiptEmail } : {}),
      metadata: {
        upsellOrderId: orderId,
        product,
        kind: "upsell",
      },
    },
    { idempotencyKey: `upsell-card-${orderId}` },
  );
}

export async function cancelStripePaymentIntent(
  paymentIntentId: string,
): Promise<void> {
  await getStripeClient().paymentIntents.cancel(paymentIntentId);
}