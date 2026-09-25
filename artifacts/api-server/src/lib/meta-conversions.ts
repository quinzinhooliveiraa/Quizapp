import { createHash } from "node:crypto";
import { logger } from "./logger";

export type MetaEventName =
  | "InitiateCheckout"
  | "AddPaymentInfo"
  | "Purchase";

export type MetaEventData = {
  eventId: string;
  value: number;
  currency: string;
  sourceUrl?: string | null;
  paymentType?: "pix" | "card" | null;
  userData: {
    email?: string | null;
    firstName?: string | null;
    visitorKey?: string | null;
    clientIpAddress?: string | null;
    clientUserAgent?: string | null;
    fbp?: string | null;
    fbc?: string | null;
  };
};

let missingConfigurationWarningLogged = false;

function normalizedForHash(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function hashUserValue(value: string | null | undefined): string[] | undefined {
  if (!value?.trim()) return undefined;
  return [
    createHash("sha256")
      .update(normalizedForHash(value))
      .digest("hex"),
  ];
}

function usableSourceUrl(value: string | null | undefined): string {
  const fallback =
    process.env.PUBLIC_BASE_URL?.trim() ||
    "https://www.perguntasdeconexao.com.br";
  try {
    const url = new URL(value || fallback);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString().slice(0, 2048)
      : fallback;
  } catch {
    return fallback;
  }
}

export async function sendMetaEvent(
  eventName: MetaEventName,
  event: MetaEventData,
): Promise<void> {
  const pixelId = process.env.META_PIXEL_ID?.trim();
  const accessToken = process.env.META_CAPI_TOKEN?.trim();
  if (!pixelId || !accessToken) {
    if (!missingConfigurationWarningLogged) {
      missingConfigurationWarningLogged = true;
      logger.warn(
        {
          pixelIdConfigured: Boolean(pixelId),
          capiTokenConfigured: Boolean(accessToken),
        },
        "Meta Conversions API is not configured; events are skipped",
      );
    }
    return;
  }

  if (
    !event.eventId.trim() ||
    !Number.isFinite(event.value) ||
    event.value <= 0 ||
    (event.currency !== "BRL" && event.currency !== "EUR")
  ) {
    logger.warn({ eventName }, "Invalid Meta event data; event is skipped");
    return;
  }

  const userData: Record<string, string | string[]> = {};
  const email = hashUserValue(event.userData.email);
  const firstName = hashUserValue(event.userData.firstName);
  const externalId = hashUserValue(event.userData.visitorKey);
  if (email) userData.em = email;
  if (firstName) userData.fn = firstName;
  if (externalId) userData.external_id = externalId;
  if (event.userData.clientIpAddress) {
    userData.client_ip_address = event.userData.clientIpAddress.slice(0, 200);
  }
  if (event.userData.clientUserAgent) {
    userData.client_user_agent = event.userData.clientUserAgent.slice(0, 1000);
  }
  if (event.userData.fbp) userData.fbp = event.userData.fbp.slice(0, 500);
  if (event.userData.fbc) userData.fbc = event.userData.fbc.slice(0, 500);

  const customData: Record<string, string | number> = {
    value: Number(event.value.toFixed(2)),
    currency: event.currency,
    content_name: "Perguntas de Conexão",
  };
  if (event.paymentType) customData.payment_type = event.paymentType;

  const payload = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: event.eventId.slice(0, 255),
        action_source: "website",
        event_source_url: usableSourceUrl(event.sourceUrl),
        user_data: userData,
        custom_data: customData,
      },
    ],
    ...(process.env.META_TEST_EVENT_CODE?.trim()
      ? { test_event_code: process.env.META_TEST_EVENT_CODE.trim() }
      : {}),
  };
  const graphVersion =
    process.env.META_GRAPH_API_VERSION?.trim() || "v26.0";
  const endpoint = new URL(
    `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(pixelId)}/events`,
  );
  endpoint.searchParams.set("access_token", accessToken);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      logger.warn(
        { eventName, status: response.status },
        "Meta Conversions API rejected an event",
      );
    }
  } catch (error) {
    logger.warn(
      {
        eventName,
        errorType: error instanceof Error ? error.name : typeof error,
      },
      "Meta Conversions API request failed",
    );
  }
}