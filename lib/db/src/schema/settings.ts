import { createInsertSchema } from "drizzle-zod";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const appSettingsTable = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertAppSettingSchema = createInsertSchema(appSettingsTable);

export type AppSetting = typeof appSettingsTable.$inferSelect;
export type NewAppSetting = typeof appSettingsTable.$inferInsert;