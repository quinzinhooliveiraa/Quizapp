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

export const BR_PRICE_VARIANTS = {
  a: {
    amountCents: 3000,
    display: "R$ 30",
    symbol: "R$",
    amount: "30",
    unitNote: "dá 7 centavos por noite",
  },
  b: {
    amountCents: 5000,
    display: "R$ 50",
    symbol: "R$",
    amount: "50",
    unitNote: "dá 11 centavos por noite",
  },
  c: {
    amountCents: 7000,
    display: "R$ 70",
    symbol: "R$",
    amount: "70",
    unitNote: "dá 15 centavos por noite",
  },
} as const;

const DEFAULT_PRICING: Record<PricingRegion, Pricing> = {
  BR: {
    region: "BR",
    currency: "brl",
    amountCents: 5000,
    display: "R$ 50",
    symbol: "R$",
    amount: "50",
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

type PriceVariantKey = keyof typeof BR_PRICE_VARIANTS;

function priceVariantKeyFromAssignment(assignment: {
  experimentVariantName?: string | null;
  experimentVariantPath?: string | null;
}): PriceVariantKey | null {
  const candidates = [
    assignment.experimentVariantName,
    assignment.experimentVariantPath?.split("/").filter(Boolean).pop(),
  ];
  for (const candidate of candidates) {
    const normalized = candidate?.trim().toLowerCase();
    if (normalized === "a" || normalized === "b" || normalized === "c") {
      return normalized;
    }
  }
  return null;
}

export async function getPricing(
  region: PricingRegion,
  visitorKey?: string | null,
): Promise<Pricing> {
  const basePricing = DEFAULT_PRICING[region];
  if (region !== "BR" || !visitorKey) return basePricing;

  const { getActivePriceAssignmentForVisitor } = await import("./experiments");
  const assignment = await getActivePriceAssignmentForVisitor(visitorKey);
  const variantKey = assignment
    ? priceVariantKeyFromAssignment(assignment)
    : null;
  const variant = variantKey ? BR_PRICE_VARIANTS[variantKey] : null;
  if (!variant) return basePricing;

  return {
    ...basePricing,
    amountCents: variant.amountCents,
    display: variant.display,
    symbol: variant.symbol,
    amount: variant.amount,
    unitNote: variant.unitNote,
  };
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