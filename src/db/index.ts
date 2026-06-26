import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "file:./data/app.db";

// For a local SQLite file, make sure its directory exists before connecting.
if (url.startsWith("file:")) {
  const filePath = url.slice("file:".length);
  try {
    mkdirSync(dirname(filePath), { recursive: true });
  } catch {
    // directory already exists — ignore
  }
}

const client = createClient({ url });

export const db = drizzle(client, { schema });
export { schema };
