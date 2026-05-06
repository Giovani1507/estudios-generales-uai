import { pgTable, serial, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

export const docentesExternosTable = pgTable("docentes_externos", {
  id:          serial("id").primaryKey(),
  username:    text("username").notNull().unique(),
  name:        text("name").notNull(),
  career:      text("career"),
  faculty:     text("faculty"),
  sections:    integer("sections"),
  rawData:     jsonb("raw_data"),
  syncedAt:    timestamp("synced_at").notNull().defaultNow(),
  updatedAt:   timestamp("updated_at").notNull().defaultNow(),
});

export type DocenteExterno = typeof docentesExternosTable.$inferSelect;
export type InsertDocenteExterno = typeof docentesExternosTable.$inferInsert;
