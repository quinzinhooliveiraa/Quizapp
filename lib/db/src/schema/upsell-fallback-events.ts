import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const upsellFallbackEventsTable = pgTable(
  "upsell_fallback_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: text("session_id"),
    reason: text("reason").notNull(),
    userAgent: text("user_agent").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    sessionReasonCreatedAtIdx: index(
      "upsell_fallback_events_session_reason_created_at_idx",
    ).on(table.sessionId, table.reason, table.createdAt),
    createdAtIdx: index("upsell_fallback_events_created_at_idx").on(
      table.createdAt,
    ),
  }),
);
