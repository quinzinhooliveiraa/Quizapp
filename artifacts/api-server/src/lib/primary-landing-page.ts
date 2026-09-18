import { eq, inArray } from "drizzle-orm";
import { appSettingsTable, db } from "@workspace/db";
import {
  DEFAULT_PRIMARY_LANDING_PAGE_ID,
  LANDING_PAGES,
  isLandingPageId,
  type LandingPageId,
} from "@workspace/landing-pages";

export const PRIMARY_LANDING_PAGE_SETTING_KEY = "primary_landing_page";
const VISIBILITY_SETTING_PREFIX = "landing_page_visible:";
export { DEFAULT_PRIMARY_LANDING_PAGE_ID };
export type PrimaryLandingPageId = LandingPageId;

export type LandingPageVisibility = {
  landingPage: PrimaryLandingPageId;
  visible: boolean;
};

function visibilitySettingKey(id: PrimaryLandingPageId) {
  return `${VISIBILITY_SETTING_PREFIX}${id}`;
}

export function isPrimaryLandingPageId(
  value: string | null | undefined,
): value is PrimaryLandingPageId {
  return isLandingPageId(value);
}

export async function getPrimaryLandingPageId(): Promise<{
  id: PrimaryLandingPageId;
  usedFallback: boolean;
}> {
  const [setting] = await db
    .select({ value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, PRIMARY_LANDING_PAGE_SETTING_KEY))
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

export async function getLandingPageVisibility(): Promise<LandingPageVisibility[]> {
  const keys = LANDING_PAGES.map((landing) => visibilitySettingKey(landing.id));
  const settings = await db
    .select({ key: appSettingsTable.key, value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(inArray(appSettingsTable.key, keys));
  const values = new Map(settings.map((setting) => [setting.key, setting.value]));

  return LANDING_PAGES.map((landing) => ({
    landingPage: landing.id,
    visible: values.get(visibilitySettingKey(landing.id)) !== "false",
  }));
}

export async function getPrimaryLandingPageConfiguration() {
  const [primary, landingPages] = await Promise.all([
    getPrimaryLandingPageId(),
    getLandingPageVisibility(),
  ]);

  return { ...primary, landingPages };
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

export async function setLandingPageVisibility(
  id: PrimaryLandingPageId,
  visible: boolean,
) {
  const primary = await getPrimaryLandingPageId();
  if (!visible && primary.id === id) {
    throw new Error("A landing page principal não pode ser ocultada.");
  }

  await db
    .insert(appSettingsTable)
    .values({
      key: visibilitySettingKey(id),
      value: visible ? "true" : "false",
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: appSettingsTable.key,
      set: {
        value: visible ? "true" : "false",
        updatedAt: new Date(),
      },
    });

  return { landingPage: id, visible };
}