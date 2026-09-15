import { and, eq, gt } from "drizzle-orm";
import { db, offerWindowsTable } from "@workspace/db";
import type { Pricing, PricingRegion } from "./pricing";

export type OfferPricing = {
  region: PricingRegion;
  full: Pricing;
  offer: Pricing;
};

const CANONICAL_PRICING: Record<
  PricingRegion,
  {
    fullCents: number;
    fullDisplay: string;
    fullUnitNote: string;
    offerCents: number;
    offerDisplay: string;
    offerUnitNote: string;
  }
> = {
  BR: {
    fullCents: 5000,
    fullDisplay: "R$ 50",
    fullUnitNote: "dá 11 centavos por noite",
    offerCents: 3000,
    offerDisplay: "R$ 30",
    offerUnitNote: "dá 7 centavos por noite",
  },
  PT: {
    fullCents: 1500,
    fullDisplay: "15 €",
    fullUnitNote: "dá 3 cêntimos por noite",
    offerCents: 1000,
    offerDisplay: "10 €",
    offerUnitNote: "dá 2 cêntimos por noite",
  },
};

function makePricing(
  region: PricingRegion,
  amountCents: number,
  display: string,
  unitNote: string,
): Pricing {
  const isBrazil = region === "BR";
  return {
    region,
    currency: isBrazil ? "brl" : "eur",
    amountCents,
    display,
    symbol: isBrazil ? "R$" : "€",
    amount: isBrazil ? display.replace("R$ ", "") : display.replace(" €", ""),
    symbolPosition: isBrazil ? "before" : "after",
    unitNote,
    pixAvailable: isBrazil,
  };
}

export function getOfferPricing(region: PricingRegion): OfferPricing {
  const values = CANONICAL_PRICING[region];
  return {
    region,
    full: makePricing(
      region,
      values.fullCents,
      values.fullDisplay,
      values.fullUnitNote,
    ),
    offer: makePricing(
      region,
      values.offerCents,
      values.offerDisplay,
      values.offerUnitNote,
    ),
  };
}

export async function getOfferWindow(visitorKey: string) {
  return db
    .select()
    .from(offerWindowsTable)
    .where(
      and(
        eq(offerWindowsTable.visitorKey, visitorKey),
        gt(offerWindowsTable.deadline, new Date()),
      ),
    )
    .limit(1)
    .then(([window]) => window ?? null);
}

export async function getOrCreateOfferWindow(
  visitorKey: string,
  region: PricingRegion,
) {
  const existing = await db
    .select()
    .from(offerWindowsTable)
    .where(eq(offerWindowsTable.visitorKey, visitorKey))
    .limit(1)
    .then(([window]) => window ?? null);
  if (existing) return existing;

  const [created] = await db
    .insert(offerWindowsTable)
    .values({
      visitorKey,
      region,
      deadline: new Date(Date.now() + 5 * 60 * 1000),
    })
    .onConflictDoNothing()
    .returning();

  if (created) return created;
  return db
    .select()
    .from(offerWindowsTable)
    .where(eq(offerWindowsTable.visitorKey, visitorKey))
    .limit(1)
    .then(([window]) => window ?? null);
}