import { useEffect, useState } from "react";
import { apiBaseUrl } from "@/config";

export type PricingRegion = "BR" | "PT";

export type Pricing = {
  region: PricingRegion;
  currency: "brl" | "eur";
  amountCents: number;
  display: string;
  unitNote: string;
  pixAvailable: boolean;
};

export const FALLBACK_PRICING: Pricing = {
  region: "BR",
  currency: "brl",
  amountCents: 4790,
  display: "R$ 47,90",
  unitNote: "dá 10 centavos por noite",
  pixAvailable: true,
};

let pricingRequest: Promise<Pricing> | null = null;

function isPricing(value: unknown): value is Pricing {
  if (!value || typeof value !== "object") return false;
  const pricing = value as Partial<Pricing>;
  return (
    (pricing.region === "BR" || pricing.region === "PT") &&
    (pricing.currency === "brl" || pricing.currency === "eur") &&
    typeof pricing.amountCents === "number" &&
    typeof pricing.display === "string" &&
    typeof pricing.unitNote === "string" &&
    typeof pricing.pixAvailable === "boolean"
  );
}

function loadPricing(): Promise<Pricing> {
  if (!pricingRequest) {
    pricingRequest = fetch(`${apiBaseUrl}/api/pricing`)
      .then(async (response) => {
        if (!response.ok) throw new Error("pricing request failed");
        const data: unknown = await response.json();
        if (!isPricing(data)) throw new Error("invalid pricing response");
        return data;
      })
      .catch(() => FALLBACK_PRICING);
  }
  return pricingRequest;
}

export function usePricing(): Pricing {
  const [pricing, setPricing] = useState(FALLBACK_PRICING);

  useEffect(() => {
    let mounted = true;
    void loadPricing().then((resolved) => {
      if (mounted) setPricing(resolved);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return pricing;
}