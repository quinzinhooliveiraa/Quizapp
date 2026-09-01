import Stripe from "stripe";

const PAYMENT_AMOUNT_CENTS = 4790;
const PAYMENT_CURRENCY = "brl";

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
}: {
  sessionId: string;
  buyerEmail?: string | null;
}): Promise<{ id: string; clientSecret: string }> {
  const paymentIntent = await getStripeClient().paymentIntents.create({
    amount: PAYMENT_AMOUNT_CENTS,
    currency: PAYMENT_CURRENCY,
    automatic_payment_methods: { enabled: true },
    metadata: { sessionId },
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