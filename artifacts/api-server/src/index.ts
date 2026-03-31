import app from "./app";
import { seedDefaultUsers } from "./lib/seed.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Ensure default users exist in both dev and production on every startup
await seedDefaultUsers();

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
