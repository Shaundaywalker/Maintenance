// Idempotently seeds the access lists from environment variables:
//   ALLOWED_DOMAINS       -> allowed_domain rows
//   INITIAL_ADMIN_EMAILS  -> invited_user rows (role=admin), plus their domains
//
// Uses INSERT OR IGNORE, so existing rows are never overwritten — safe to run
// on every deploy. Run automatically on deploy (see `release`) and locally via
// `npm run db:seed`.
import { createClient } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

const url = process.env.DATABASE_URL ?? "file:./data/app.db";

if (url.startsWith("file:")) {
  try {
    mkdirSync(dirname(url.slice("file:".length)), { recursive: true });
  } catch {
    // directory already exists
  }
}

const client = createClient({ url });
const now = Math.floor(Date.now() / 1000);

function parseList(value) {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

const domains = new Set(parseList(process.env.ALLOWED_DOMAINS));
const admins = parseList(process.env.INITIAL_ADMIN_EMAILS);

// Make sure each seeded admin's domain is also allowed.
for (const email of admins) {
  const domain = email.split("@")[1];
  if (domain) domains.add(domain);
}

let addedDomains = 0;
for (const domain of domains) {
  const res = await client.execute({
    sql: "INSERT OR IGNORE INTO allowed_domain (id, domain, created_at) VALUES (?, ?, ?)",
    args: [randomUUID(), domain, now],
  });
  addedDomains += res.rowsAffected;
}

let addedAdmins = 0;
for (const email of admins) {
  const res = await client.execute({
    sql: "INSERT OR IGNORE INTO invited_user (id, email, role, enabled, invited_by_email, created_at) VALUES (?, ?, 'admin', 1, ?, ?)",
    args: [randomUUID(), email, "system-seed", now],
  });
  addedAdmins += res.rowsAffected;
}

console.log(
  `[db] seed complete: +${addedDomains} domain(s), +${addedAdmins} admin(s) (existing rows left untouched)`,
);

client.close();
