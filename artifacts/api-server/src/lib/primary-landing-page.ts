import { and, eq } from "drizzle-orm";
import { appSettingsTable, db } from "@workspace/db";

export const PRIMARY_LANDING_PAGE_SETTING_KEY = "primary_landing_page";
export const DEFAULT_PRIMARY_LANDING_PAGE_ID = "v2";
export const PRIMARY_LANDING_PAGE_IDS = ["v1", "v2", "lp3"] as const;

export type PrimaryLandingPageId = (typeof PRIMARY_LANDING_PAGE_IDS)[number];

export function isPrimaryLandingPageId(
  value: string | null | undefined,
): value is PrimaryLandingPageId {
  return Boolean(value && PRIMARY_LANDING_PAGE_IDS.includes(value as PrimaryLandingPageId));
}

export async function getPrimaryLandingPageId(): Promise<{
  id: PrimaryLandingPageId;
  usedFallback: boolean;
}> {
  const [setting] = await db
    .select({ value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(and(eq(appSettingsTable.key, PRIMARY_LANDING_PAGE_SETTING_KEY)))
    .limit(1);

  if (!isPrimaryLandingPageId(setting?.value)) {
    return {
      id: DEFAULT_PRIMARY_LANDING_PAGE_ID,
      usedFallback: true,
    };
  }

  return {
    id: setting.value,
    usedFallback: false,
  };
}

export async function setPrimaryLandingPageId(id: PrimaryLandingPageId) {
  const [setting] = await db
    .insert(appSettingsTable)
    .values({
      key: PRIMARY_LANDING_PAGE_SETTING_KEY,
      value: id,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: appSettingsTable.key,
      set: {
        value: id,
        updatedAt: new Date(),
      },
    })
    .returning({ value: appSettingsTable.value });

  return setting?.value ?? id;
}