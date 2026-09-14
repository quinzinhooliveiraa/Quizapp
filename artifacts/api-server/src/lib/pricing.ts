export type PricingRegion = "BR" | "PT";

export type Pricing = {
  region: PricingRegion;
  currency: "brl" | "eur";
  amountCents: number;
  display: string;
  unitNote: string;
  pixAvailable: boolean;
};

const PRICING: Record<PricingRegion, Pricing> = {
  BR: {
    region: "BR",
    currency: "brl",
    amountCents: 4790,
    display: "R$ 47,90",
    unitNote: "dá 10 centavos por noite",
    pixAvailable: true,
  },
  PT: {
    region: "PT",
    currency: "eur",
    amountCents: 1490,
    display: "14,90 €",
    unitNote: "dá 3 cêntimos por noite",
    pixAvailable: false,
  },
};

export function getPricing(region: PricingRegion): Pricing {
  return PRICING[region];
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