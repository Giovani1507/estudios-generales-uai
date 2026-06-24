import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".env"),
});
