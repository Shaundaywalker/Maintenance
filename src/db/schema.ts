import { sqliteTable, text, integer, real, primaryKey } from "drizzle-orm/sqlite-core";

/**
 * better-auth core tables.
 *
 * The JS property names (id, emailVerified, createdAt, ...) must match the
 * field names better-auth expects; the string args are the snake_case column
 * names in SQLite. This is the canonical better-auth + Drizzle SQLite schema,
 * plus the extra columns added by the `admin` plugin (role / banned / ...).
 */
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  // admin plugin
  role: text("role"),
  banned: integer("banned", { mode: "boolean" }),
  banReason: text("ban_reason"),
  banExpires: integer("ban_expires", { mode: "timestamp" }),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  // admin plugin
  impersonatedBy: text("impersonated_by"),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

/**
 * Application access-control tables (not managed by better-auth).
 */

// Email domains permitted to sign in (e.g. "bootlegger.co.za").
export const allowedDomain = sqliteTable("allowed_domain", {
  id: text("id").primaryKey(),
  domain: text("domain").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

// The invite list: only emails here (and enabled) can complete sign-in.
// A row may exist before the person has ever logged in — the matching `user`
// row is created by better-auth on their first successful sign-in.
export const invitedUser = sqliteTable("invited_user", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("member"),
  enabled: integer("enabled", { mode: "boolean" })
    .$defaultFn(() => true)
    .notNull(),
  invitedByEmail: text("invited_by_email"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

export type InvitedUser = typeof invitedUser.$inferSelect;
export type AllowedDomain = typeof allowedDomain.$inferSelect;
export type User = typeof user.$inferSelect;

/**
 * GAAP store-operations metrics.
 *
 * One row per store-node per calendar date — a daily rollup synced from the
 * GAAP Legacy API (see `src/lib/gaap`). Line-item detail is aggregated at sync
 * time into these daily figures so the dashboard reads a few hundred small rows
 * instead of hundreds of thousands of sales lines.
 *
 * `turnover` is the raw API value (includes tips, excludes tax). `turnoverExcl`
 * is the corrected "Turnover Excl" figure (tips + non-banking removed) — see the
 * §3.4 correction in the GAAP reference. Breakdowns are JSON maps of
 * label -> rand value, keyed by sales channel and by department.
 */
export const gaapDailyMetrics = sqliteTable(
  "gaap_daily_metrics",
  {
    node: text("node").notNull(),
    date: text("date").notNull(), // YYYY-MM-DD
    storeName: text("store_name"),
    turnover: real("turnover").notNull().default(0),
    turnoverExcl: real("turnover_excl").notNull().default(0),
    costOfSales: real("cost_of_sales").notNull().default(0),
    grossProfit: real("gross_profit").notNull().default(0),
    voids: real("voids").notNull().default(0),
    wastage: real("wastage").notNull().default(0),
    shrinkage: real("shrinkage").notNull().default(0),
    transactionCount: integer("transaction_count").notNull().default(0),
    avgSpend: real("avg_spend").notNull().default(0),
    channelBreakdown: text("channel_breakdown"), // JSON: { "Eat in": 123.4, ... }
    departmentBreakdown: text("department_breakdown"), // JSON: { "Coffee": 99.9, ... }
    syncedAt: integer("synced_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.node, t.date] })],
);

export type GaapDailyMetrics = typeof gaapDailyMetrics.$inferSelect;
