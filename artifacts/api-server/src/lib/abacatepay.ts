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