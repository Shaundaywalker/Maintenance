// Applies committed Drizzle migrations to the SQLite database.
// Run automatically on deploy (see `release` script) and locally via `npm run db:migrate`.
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const url = process.env.DATABASE_URL ?? "file:./data/app.db";

if (url.startsWith("file:")) {
  try {
    mkdirSync(dirname(url.slice("file:".length)), { recursive: true });
  } catch {
    // directory already exists
  }
}

const client = createClient({ url });
const db = drizzle(client);

await migrate(db, { migrationsFolder: "./drizzle" });
console.log("[db] migrations applied");

client.close();
