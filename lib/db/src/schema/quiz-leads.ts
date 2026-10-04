import { createInsertSchema } from "drizzle-zod";
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const quizLeadsTable = pgTable(
  "quiz_leads",
  {
    id: text("id").primaryKey(),
    visitorKey: text("visitor_key").notNull(),
    lpId: text("lp_id").notNull(),
    diagnosisLabel: text("diagnosis_label").notNull(),
    email: text("email").notNull(),
    region: text("region").notNull(),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmContent: text("utm_content"),
    utmTerm: text("utm_term"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    offerSeenAt: timestamp("offer_seen_at", { withTimezone: true }),
    abandonEmail1At: timestamp("abandon_email_1_at", { withTimezone: true }),
    abandonEmail2At: timestamp("abandon_email_2_at", { withTimezone: true }),
    abandonEmail3At: timestamp("abandon_email_3_at", { withTimezone: true }),
    abandonEmail4At: timestamp("abandon_email_4_at", { withTimezone: true }),
    abandonEmail5At: timestamp("abandon_email_5_at", { withTimezone: true }),
    suppressedAt: timestamp("suppressed_at", { withTimezone: true }),
  },
  (table) => ({
    visitorKeyIdx: index("quiz_leads_visitor_key_idx").on(table.visitorKey),
    emailIdx: index("quiz_leads_email_idx").on(table.email),
  }),
);

export const emailOptOutsTable = pgTable("email_opt_outs", {
  email: text("email").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertQuizLeadSchema = createInsertSchema(quizLeadsTable);
export const insertEmailOptOutSchema = createInsertSchema(emailOptOutsTable);

export type QuizLead = typeof quizLeadsTable.$inferSelect;
export type NewQuizLead = typeof quizLeadsTable.$inferInsert;
export type EmailOptOut = typeof emailOptOutsTable.$inferSelect;
export type NewEmailOptOut = typeof emailOptOutsTable.$inferInsert;