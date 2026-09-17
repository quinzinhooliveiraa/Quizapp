export type PricingRegion = "BR" | "PT";

export type Pricing = {
  region: PricingRegion;
  currency: "brl" | "eur";
  amountCents: number;
  display: string;
  symbol: string;
  amount: string;
  symbolPosition: "before" | "after";
  unitNote: string;
  pixAvailable: boolean;
};

const DEFAULT_PRICING: Record<PricingRegion, Pricing> = {
  BR: {
    region: "BR",
    currency: "brl",
    amountCents: 4790,
    display: "R$ 47,90",
    symbol: "R$",
    amount: "47,90",
    symbolPosition: "before",
    unitNote: "dá 11 centavos por noite",
    pixAvailable: true,
  },
  PT: {
    region: "PT",
    currency: "eur",
    amountCents: 1500,
    display: "15 €",
    symbol: "€",
    amount: "15",
    symbolPosition: "after",
    unitNote: "dá 3 cêntimos por noite",
    pixAvailable: false,
  },
};

export async function getPricing(
  region: PricingRegion,
  _visitorKey?: string | null,
): Promise<Pricing> {
  // Public pricing is canonical. Experiments may report historical variants,
  // but they must never change the amount shown or sent to checkout.
  return DEFAULT_PRICING[region];
}

/**
 * Resolve a região SEMPRE a partir do request, nunca do corpo enviado
 * pelo cliente. Retorna "BR" em caso de dúvida.
 */
export function resolveRegion(req: {
  headers: Record<string, unknown>;
  query?: Record<string, unknown>;
}): PricingRegion {
  const forced = String(req.query?.regiao ?? "").toUpperCase();
  if (forced === "PT" || forced === "BR") return forced;

  const country = String(
    req.headers["cf-ipcountry"] ??
      req.headers["x-vercel-ip-country"] ??
      req.headers["x-country"] ??
      "",
  ).toUpperCase();
  if (country === "PT") return "PT";
  if (country === "BR") return "BR";

  // The local/proxied API does not expose a country header reliably, so
  // Accept-Language is the primary automatic signal until deployment provides one.
  const lang = String(req.headers["accept-language"] ?? "").toLowerCase();
  if (lang.includes("pt-pt")) return "PT";

  return "BR";
}