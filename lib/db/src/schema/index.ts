import { createInsertSchema } from "drizzle-zod";
import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const sessionsTable = pgTable("sessions", {
  id: text("id").primaryKey(),
  buyerName: text("buyer_name").notNull(),
  buyerEmail: text("buyer_email"),
  packageId: text("package_id").notNull(),
  packageName: text("package_name").notNull(),
  inviteLimit: integer("invite_limit").notNull(),
  invitesUsed: integer("invites_used").notNull().default(0),
  accessGranted: boolean("access_granted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const invitesTable = pgTable("invites", {
  token: text("token").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessionsTable.id, { onDelete: "cascade" }),
  guestName: text("guest_name").notNull(),
  inviteUrl: text("invite_url").notNull(),
  isUsed: boolean("is_used").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const processedEventsTable = pgTable("processed_events", {
  id: text("id").primaryKey(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSessionSchema = createInsertSchema(sessionsTable);
export const insertInviteSchema = createInsertSchema(invitesTable);

export type Session = typeof sessionsTable.$inferSelect;
export type NewSession = typeof sessionsTable.$inferInsert;
export type Invite = typeof invitesTable.$inferSelect;
export type NewInvite = typeof invitesTable.$inferInsert;