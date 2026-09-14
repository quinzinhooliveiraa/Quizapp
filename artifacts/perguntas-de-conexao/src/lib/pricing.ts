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

const PRICING_REGION_COOKIE = "pdc-pricing-region";
const PRICING_REGION_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;
const pricingRequests = new Map<string, Promise<Pricing>>();

function parseRegion(value: string | null | undefined): PricingRegion | null {
  const normalized = value?.trim().toUpperCase();
  return normalized === "BR" || normalized === "PT" ? normalized : null;
}

function readRegionCookie(): PricingRegion | null {
  if (typeof document === "undefined") return null;
  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${PRICING_REGION_COOKIE}=`));
  return parseRegion(cookie?.split("=")[1]);
}

function persistRegion(region: PricingRegion): void {
  if (typeof document === "undefined") return;
  document.cookie = `${PRICING_REGION_COOKIE}=${region}; path=/; max-age=${PRICING_REGION_COOKIE_MAX_AGE}; samesite=lax`;
}

export function getPreferredPricingRegion(): PricingRegion | null {
  if (typeof window === "undefined") return null;
  const queryRegion = parseRegion(
    new URLSearchParams(window.location.search).get("regiao"),
  );
  if (queryRegion) {
    persistRegion(queryRegion);
    return queryRegion;
  }
  return readRegionCookie();
}

export function getPricingRegionQuery(): string {
  const region = getPreferredPricingRegion();
  return region ? `?regiao=${region}` : "";
}

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
  const regionQuery = getPricingRegionQuery();
  const requestKey = regionQuery || "automatic";
  const existingRequest = pricingRequests.get(requestKey);
  if (existingRequest) return existingRequest;

  const request = fetch(`${apiBaseUrl}/api/pricing${regionQuery}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("pricing request failed");
        const data: unknown = await response.json();
        if (!isPricing(data)) throw new Error("invalid pricing response");
        return data;
      })
      .catch(() => FALLBACK_PRICING);
  pricingRequests.set(requestKey, request);
  return request;
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