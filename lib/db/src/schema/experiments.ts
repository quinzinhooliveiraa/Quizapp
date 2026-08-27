import { createInsertSchema } from "drizzle-zod";
import {
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const EXPERIMENT_STATUSES = [
  "draft",
  "active",
  "paused",
  "completed",
] as const;

export const EXPERIMENT_VARIANT_STATUSES = ["active", "paused"] as const;

export const experimentsTable = pgTable("experiments", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  objective: text("objective").notNull(),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  slugUnique: uniqueIndex("experiments_slug_unique_idx").on(table.slug),
}));

export const experimentVariantsTable = pgTable("experiment_variants", {
  id: text("id").primaryKey(),
  experimentId: text("experiment_id")
    .notNull()
    .references(() => experimentsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  path: text("path").notNull(),
  weight: integer("weight").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const experimentAssignmentsTable = pgTable(
  "experiment_assignments",
  {
    id: text("id").primaryKey(),
    experimentId: text("experiment_id")
      .notNull()
      .references(() => experimentsTable.id, { onDelete: "cascade" }),
    experimentVariantId: text("experiment_variant_id")
      .notNull()
      .references(() => experimentVariantsTable.id, { onDelete: "cascade" }),
    visitorKey: text("visitor_key").notNull(),
    landingPage: text("landing_page").notNull(),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    experimentVisitorUnique: uniqueIndex(
      "experiment_assignments_experiment_visitor_idx",
    ).on(table.experimentId, table.visitorKey),
  }),
);

export const insertExperimentSchema = createInsertSchema(experimentsTable);
export const insertExperimentVariantSchema = createInsertSchema(
  experimentVariantsTable,
);
export const insertExperimentAssignmentSchema = createInsertSchema(
  experimentAssignmentsTable,
);

export type Experiment = typeof experimentsTable.$inferSelect;
export type NewExperiment = typeof experimentsTable.$inferInsert;
export type ExperimentVariant = typeof experimentVariantsTable.$inferSelect;
export type NewExperimentVariant = typeof experimentVariantsTable.$inferInsert;
export type ExperimentAssignment =
  typeof experimentAssignmentsTable.$inferSelect;
export type NewExperimentAssignment =
  typeof experimentAssignmentsTable.$inferInsert;
