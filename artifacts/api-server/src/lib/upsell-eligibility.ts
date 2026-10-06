import { eq } from "drizzle-orm";
import {
  appSettingsTable,
  db,
  type Session,
} from "@workspace/db";

export const UPSELL_LAUNCH_SETTING_KEY = "upsell_launch_at";

export async function ensureUpsellLaunchAt(): Promise<Date> {
  const now = new Date();
  const [inserted] = await db
    .insert(appSettingsTable)
    .values({
      key: UPSELL_LAUNCH_SETTING_KEY,
      value: now.toISOString(),
      updatedAt: now,
    })
    .onConflictDoNothing()
    .returning({ value: appSettingsTable.value });

  if (inserted?.value) return new Date(inserted.value);

  const [existing] = await db
    .select({ value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, UPSELL_LAUNCH_SETTING_KEY))
    .limit(1);
  const launchAt = existing?.value ? new Date(existing.value) : null;
  if (!launchAt || Number.isNaN(launchAt.getTime())) {
    throw new Error("Invalid upsell launch timestamp");
  }
  return launchAt;
}

export async function getUpsellLaunchAt(): Promise<Date | null> {
  const [setting] = await db
    .select({ value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, UPSELL_LAUNCH_SETTING_KEY))
    .limit(1);
  if (!setting?.value) return null;

  const launchAt = new Date(setting.value);
  return Number.isNaN(launchAt.getTime()) ? null : launchAt;
}

export function isUpsellEligibleSession(
  session: Pick<Session, "accessGranted" | "currency" | "createdAt">,
  launchAt: Date | null,
): boolean {
  return Boolean(
    launchAt &&
      session.accessGranted &&
      session.currency?.toLowerCase() === "brl" &&
      session.createdAt >= launchAt,
  );
}

export async function shouldDelayAccessEmail(
  session: Pick<
    Session,
    "accessGranted" | "currency" | "createdAt" | "buyerEmail"
  >,
): Promise<boolean> {
  if (!session.buyerEmail) return false;
  return isUpsellEligibleSession(session, await getUpsellLaunchAt());
}
