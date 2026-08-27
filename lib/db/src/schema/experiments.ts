import { createInsertSchema } from "drizzle-zod";
import {
  integer,
  jsonb,
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
export const EXPERIMENT_OPTIMIZATION_MODES = ["manual", "automatic"] as const;
export const EXPERIMENT_MINIMUM_SAMPLE_SIZE_MODES = [
  "automatic",
  "custom",
] as const;

export const experimentsTable = pgTable("experiments", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  objective: text("objective").notNull(),
  status: text("status").notNull().default("draft"),
  optimizationMode: text("optimization_mode")
    .notNull()
    .default("manual"),
  minimumSampleSizeMode: text("minimum_sample_size_mode")
    .notNull()
    .default("automatic"),
  minimumSampleSize: integer("minimum_sample_size"),
  lastOptimizationAt: timestamp("last_optimization_at", {
    withTimezone: true,
  }),
  nextOptimizationAt: timestamp("next_optimization_at", {
    withTimezone: true,
  }),
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

export const experimentOptimizationHistoryTable = pgTable(
  "experiment_optimization_history",
  {
    id: text("id").primaryKey(),
    experimentId: text("experiment_id")
      .notNull()
      .references(() => experimentsTable.id, { onDelete: "cascade" }),
    evaluatedAt: timestamp("evaluated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    previousWeights: jsonb("previous_weights")
      .$type<Record<string, number>>()
      .notNull(),
    newWeights: jsonb("new_weights")
      .$type<Record<string, number>>()
      .notNull(),
    conversionsByVariant: jsonb("conversions_by_variant")
      .$type<Record<string, number>>()
      .notNull(),
    visitorsByVariant: jsonb("visitors_by_variant")
      .$type<Record<string, number>>()
      .notNull(),
    conversionRatesByVariant: jsonb("conversion_rates_by_variant")
      .$type<Record<string, number>>()
      .notNull(),
    winnerVariantId: text("winner_variant_id").notNull(),
    sampleSize: integer("sample_size").notNull(),
    reason: text("reason").notNull(),
    changeType: text("change_type").notNull().default("automatic"),
  },
  (table) => ({
    experimentEvaluatedAtIdx: uniqueIndex(
      "experiment_optimization_history_experiment_evaluated_idx",
    ).on(table.experimentId, table.evaluatedAt),
  }),
);

export const insertExperimentSchema = createInsertSchema(experimentsTable);
export const insertExperimentVariantSchema = createInsertSchema(
  experimentVariantsTable,
);
export const insertExperimentAssignmentSchema = createInsertSchema(
  experimentAssignmentsTable,
);
export const insertExperimentOptimizationHistorySchema = createInsertSchema(
  experimentOptimizationHistoryTable,
);

export type Experiment = typeof experimentsTable.$inferSelect;
export type NewExperiment = typeof experimentsTable.$inferInsert;
export type ExperimentVariant = typeof experimentVariantsTable.$inferSelect;
export type NewExperimentVariant = typeof experimentVariantsTable.$inferInsert;
export type ExperimentAssignment =
  typeof experimentAssignmentsTable.$inferSelect;
export type NewExperimentAssignment =
  typeof experimentAssignmentsTable.$inferInsert;
export type ExperimentOptimizationHistory =
  typeof experimentOptimizationHistoryTable.$inferSelect;
export type NewExperimentOptimizationHistory =
  typeof experimentOptimizationHistoryTable.$inferInsert;
