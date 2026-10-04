import { eq, inArray } from "drizzle-orm";
import { appSettingsTable, db } from "@workspace/db";

const QUIZ_EMAIL_MODE_KEY = "quiz_email_mode";
const LEGACY_QUIZ_EMAIL_REQUIRED_KEY = "quiz_email_required";
const QUIZ_EMAIL_LIVE_SINCE_KEY = "quiz_email_live_since";

export type QuizEmailMode = "required" | "optional";

export type QuizEmailConfig = {
  mode: QuizEmailMode;
  liveSince: string | null;
};

export async function getQuizEmailConfig(): Promise<QuizEmailConfig> {
  const settings = await db
    .select({ key: appSettingsTable.key, value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(
      inArray(appSettingsTable.key, [
        QUIZ_EMAIL_MODE_KEY,
        LEGACY_QUIZ_EMAIL_REQUIRED_KEY,
        QUIZ_EMAIL_LIVE_SINCE_KEY,
      ]),
    );
  const values = new Map(settings.map(({ key, value }) => [key, value]));
  const savedMode = values.get(QUIZ_EMAIL_MODE_KEY);
  const legacyRequired = values.get(LEGACY_QUIZ_EMAIL_REQUIRED_KEY);
  const savedLiveSince = values.get(QUIZ_EMAIL_LIVE_SINCE_KEY);
  const parsedLiveSince = savedLiveSince ? new Date(savedLiveSince) : null;

  return {
    mode:
      savedMode === "optional" || savedMode === "required"
        ? savedMode
        : legacyRequired === "false"
          ? "optional"
          : "required",
    liveSince:
      parsedLiveSince && !Number.isNaN(parsedLiveSince.getTime())
        ? parsedLiveSince.toISOString()
        : null,
  };
}

export async function setQuizEmailMode(
  mode: QuizEmailMode,
): Promise<QuizEmailConfig> {
  await db
    .insert(appSettingsTable)
    .values({
      key: QUIZ_EMAIL_MODE_KEY,
      value: mode,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: appSettingsTable.key,
      set: { value: mode, updatedAt: new Date() },
    });
  return getQuizEmailConfig();
}

export async function ensureQuizEmailLiveSince(): Promise<void> {
  const [existing] = await db
    .select({ key: appSettingsTable.key })
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, QUIZ_EMAIL_LIVE_SINCE_KEY))
    .limit(1);
  if (existing) return;

  await db
    .insert(appSettingsTable)
    .values({
      key: QUIZ_EMAIL_LIVE_SINCE_KEY,
      value: new Date().toISOString(),
      updatedAt: new Date(),
    })
    .onConflictDoNothing({ target: appSettingsTable.key });
}