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
    fullCents: 4790,
    fullDisplay: "R$ 47,90",
    fullUnitNote: "dá 11 centavos por noite",
    offerCents: 2990,
    offerDisplay: "R$ 29,90",
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

export async function startOfferWindow(
  visitorKey: string,
  region: PricingRegion,
) {
  const now = new Date();
  const existing = await db
    .select()
    .from(offerWindowsTable)
    .where(eq(offerWindowsTable.visitorKey, visitorKey))
    .limit(1)
    .then(([window]) => window ?? null);
  // A visitor gets one window. A reload or a second visit to the offer must
  // not silently restart an expired countdown.
  if (existing) return existing;

  const [created] = await db
    .insert(offerWindowsTable)
    .values({
      visitorKey,
      region,
      deadline: new Date(now.getTime() + 10 * 60 * 1000),
    })
    .onConflictDoNothing()
    .returning();

  if (created) return created;
  return getOfferWindow(visitorKey);
}