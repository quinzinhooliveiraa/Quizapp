import crypto from "node:crypto";

const ABACATEPAY_BASE_URL = "https://api.abacatepay.com/v2";

type CreateCheckoutParams = {
  sessionId: string;
  productId: string;
  buyerName: string;
  buyerEmail?: string;
};

type AbacateCheckoutResponse = {
  success?: boolean;
  data?: {
    id?: string;
    url?: string;
  };
};

export async function createAbacateCheckout({
  sessionId,
  productId,
  buyerName,
  buyerEmail,
}: CreateCheckoutParams): Promise<{ checkoutUrl: string; billId: string }> {
  const apiKey = process.env.ABACATEPAY_API_KEY;
  if (!apiKey) {
    throw new Error("ABACATEPAY_API_KEY não configurada");
  }

  const publicUrl = process.env.PUBLIC_APP_URL?.replace(/\/+$/, "") || "";
  const response = await fetch(`${ABACATEPAY_BASE_URL}/checkouts/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      items: [{ id: productId, quantity: 1 }],
      methods: ["PIX"],
      externalId: sessionId,
      metadata: { sessionId, buyerName, buyerEmail },
      returnUrl: `${publicUrl}/?checkout=cancelado`,
      completionUrl: `${publicUrl}/?session=${sessionId}`,
    }),
  });

  const json = (await response.json()) as AbacateCheckoutResponse;
  if (
    !response.ok
    || !json.success
    || typeof json.data?.url !== "string"
    || typeof json.data.id !== "string"
  ) {
    throw new Error(`Falha ao criar checkout na Abacate Pay: ${JSON.stringify(json)}`);
  }

  return { checkoutUrl: json.data.url, billId: json.data.id };
}

export function verifyAbacateSignature(
  rawBody: Buffer,
  signatureFromHeader: string | undefined,
): boolean {
  const secret = process.env.ABACATEPAY_WEBHOOK_SECRET;
  if (!secret || !signatureFromHeader) return false;

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("base64");
  const expectedBuffer = Buffer.from(expectedSignature);
  const actualBuffer = Buffer.from(signatureFromHeader);

  return (
    expectedBuffer.length === actualBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

type BillingStatus = "PENDING" | "PAID" | "CANCELLED" | "EXPIRED" | "REFUNDED" | string;

type BillingStatusResult = {
  status: BillingStatus;
  metadata?: Record<string, unknown>;
};

type AbacateBillingResponse = {
  success?: boolean;
  data?: {
    status?: unknown;
    metadata?: Record<string, unknown>;
  };
};

const BILLING_STATUS_CACHE_TTL_MS = 5_000;
const billingStatusCache = new Map<string, { checkedAt: number; result: BillingStatusResult | null }>();

export async function fetchAbacateBillingStatus(
  billId: string,
): Promise<BillingStatusResult | null> {
  const apiKey = process.env.ABACATEPAY_API_KEY;
  if (!apiKey || !billId) return null;

  const cached = billingStatusCache.get(billId);
  if (cached && Date.now() - cached.checkedAt < BILLING_STATUS_CACHE_TTL_MS) {
    return cached.result;
  }

  try {
    const response = await fetch(`${ABACATEPAY_BASE_URL}/billings/${encodeURIComponent(billId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const json = await response.json() as AbacateBillingResponse;
    const result = response.ok
      && json.success
      && typeof json.data?.status === "string"
      ? { status: json.data.status, metadata: json.data.metadata }
      : null;
    billingStatusCache.set(billId, { checkedAt: Date.now(), result });
    return result;
  } catch {
    billingStatusCache.set(billId, { checkedAt: Date.now(), result: null });
    return null;
  }
}