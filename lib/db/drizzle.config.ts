import "./load-env.js";
import { defineConfig } from "drizzle-kit";
import path from "path";
import { fileURLToPath } from "url";

const dbRoot = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(dbRoot, "src/schema").replace(/\\/g, "/"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
