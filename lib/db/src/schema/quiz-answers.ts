import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const quizAnswersTable = pgTable(
  "quiz_answers",
  {
    id: text("id").primaryKey(),
    visitorKey: text("visitor_key").notNull(),
    quizId: text("quiz_id").notNull(),
    lpId: text("lp_id").notNull(),
    screenId: text("screen_id").notNull(),
    answerKey: text("answer_key").notNull(),
    answerValue: text("answer_value").notNull(),
    step: integer("step").notNull(),
    experimentId: text("experiment_id"),
    experimentVariantId: text("experiment_variant_id"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmContent: text("utm_content"),
    utmTerm: text("utm_term"),
    internal: boolean("internal").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    visitorQuizCreatedIdx: index("quiz_answers_visitor_created_idx").on(
      table.visitorKey,
      table.quizId,
      table.createdAt,
    ),
    questionAnswerIdx: index("quiz_answers_question_answer_idx").on(
      table.quizId,
      table.screenId,
      table.answerKey,
      table.answerValue,
    ),
    campaignIdx: index("quiz_answers_campaign_idx").on(
      table.utmSource,
      table.utmCampaign,
      table.createdAt,
    ),
  }),
);

export const insertQuizAnswerSchema = createInsertSchema(quizAnswersTable);
export type QuizAnswer = typeof quizAnswersTable.$inferSelect;
export type NewQuizAnswer = typeof quizAnswersTable.$inferInsert;