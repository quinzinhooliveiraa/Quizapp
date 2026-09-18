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

export async function createStripePaymentIntent({
  sessionId,
  buyerEmail,
  pricing,
}: {
  sessionId: string;
  buyerEmail?: string | null;
  pricing: Pricing;
}): Promise<{ id: string; clientSecret: string }> {
  const paymentIntent = await getStripeClient().paymentIntents.create({
    amount: pricing.amountCents,
    currency: pricing.currency,
    automatic_payment_methods: { enabled: true },
    metadata: { sessionId, region: pricing.region },
    ...(buyerEmail ? { receipt_email: buyerEmail } : {}),
  });

  if (!paymentIntent.client_secret) {
    throw new Error("Stripe não retornou o client secret do pagamento");
  }

  return {
    id: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
  };
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