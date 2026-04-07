import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const sessionsTable = pgTable("sessions", {
  token:     text("token").primaryKey(),
  userId:    integer("user_id").notNull(),
  username:  text("username").notNull(),
  fullName:  text("full_name").notNull(),
  email:     text("email").notNull(),
  role:      text("role").notNull(),
  isActive:  text("is_active").notNull().default("true"),
  cargo:     text("cargo"),
  avatarUrl: text("avatar_url"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
