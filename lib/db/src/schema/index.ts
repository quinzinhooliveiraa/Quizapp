import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const sessionsTable = pgTable("sessions", {
  id: text("id").primaryKey(),
  buyerName: text("buyer_name").notNull(),
  buyerEmail: text("buyer_email"),
  packageId: text("package_id").notNull(),
  packageName: text("package_name").notNull(),
  sourceLp: text("source_lp"),
  inviteLimit: integer("invite_limit").notNull(),
  invitesUsed: integer("invites_used").notNull().default(0),
  accessGranted: boolean("access_granted").notNull().default(false),
  onboardingComplete: boolean("onboarding_complete").notNull().default(false),
  relationshipType: text("relationship_type"),
  partnerPronoun: text("partner_pronoun"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const invitesTable = pgTable("invites", {
  token: text("token").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessionsTable.id, { onDelete: "cascade" }),
  guestName: text("guest_name").notNull(),
  guestEmail: text("guest_email"),
  isUsed: boolean("is_used").notNull().default(false),
  usedAt: timestamp("used_at", { withTimezone: true }),
  onboardingComplete: boolean("onboarding_complete").notNull().default(false),
  relationshipType: text("relationship_type"),
  partnerPronoun: text("partner_pronoun"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const processedEventsTable = pgTable("processed_events", {
  id: text("id").primaryKey(),
  processedAt: timestamp("processed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const authCodesTable = pgTable("auth_codes", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const savedMomentsTable = pgTable("saved_moments", {
  id: text("id").primaryKey(),
  ownerSessionId: text("owner_session_id"),
  ownerGuestToken: text("owner_guest_token"),
  questionId: text("question_id").notNull(),
  themeId: text("theme_id").notNull(),
  fromPlayerName: text("from_player_name").notNull(),
  answerText: text("answer_text").notNull(),
  roomCode: text("room_code"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const suggestionsTable = pgTable("suggestions", {
  id: text("id").primaryKey(),
  email: text("email"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const reviewsTable = pgTable("reviews", {
  id: text("id").primaryKey(),
  displayName: text("display_name"),
  email: text("email"),
  rating: integer("rating").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const pageEventsTable = pgTable("page_events", {
  id: text("id").primaryKey(),
  lpId: text("lp_id").notNull(),
  visitorKey: text("visitor_key").notNull(),
  eventType: text("event_type").notNull(),
  timeOnPageMs: integer("time_on_page_ms"),
  lastSection: text("last_section"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertSessionSchema = createInsertSchema(sessionsTable);
export const insertInviteSchema = createInsertSchema(invitesTable);
export const insertAuthCodeSchema = createInsertSchema(authCodesTable);
export const insertSavedMomentSchema = createInsertSchema(savedMomentsTable);
export const insertSuggestionSchema = createInsertSchema(suggestionsTable);
export const insertReviewSchema = createInsertSchema(reviewsTable);
export const insertPageEventSchema = createInsertSchema(pageEventsTable);

export type Session = typeof sessionsTable.$inferSelect;
export type NewSession = typeof sessionsTable.$inferInsert;
export type Invite = typeof invitesTable.$inferSelect;
export type NewInvite = typeof invitesTable.$inferInsert;
export type AuthCode = typeof authCodesTable.$inferSelect;
export type NewAuthCode = typeof authCodesTable.$inferInsert;
export type SavedMoment = typeof savedMomentsTable.$inferSelect;
export type NewSavedMoment = typeof savedMomentsTable.$inferInsert;
export type Suggestion = typeof suggestionsTable.$inferSelect;
export type NewSuggestion = typeof suggestionsTable.$inferInsert;
export type Review = typeof reviewsTable.$inferSelect;
export type NewReview = typeof reviewsTable.$inferInsert;
export type PageEvent = typeof pageEventsTable.$inferSelect;
export type NewPageEvent = typeof pageEventsTable.$inferInsert;
