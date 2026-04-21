import { pgTable, text, jsonb, timestamp, integer } from "drizzle-orm/pg-core";

export const sharedStateTable = pgTable("shared_state", {
  key:        text("key").primaryKey(),
  value:      jsonb("value").notNull().default({}),
  updatedBy:  integer("updated_by"),
  updatedAt:  timestamp("updated_at").notNull().defaultNow(),
});

export type SharedState = typeof sharedStateTable.$inferSelect;
export type InsertSharedState = typeof sharedStateTable.$inferInsert;
