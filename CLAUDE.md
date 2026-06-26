# CLAUDE.md

Guidance for Claude Code when working in this repo. See `README.md` for the full
human-facing setup and deploy guide.

## What this is

A boilerplate for internal Bootlegger dashboards deployed on Railway. It ships
working auth, an access-control gate, and a Settings UI so the only thing to
build is the actual dashboard.

**Stack:** Next.js (App Router) · better-auth · Drizzle ORM · SQLite (libSQL) ·
Tailwind · shadcn/ui · Resend · Railway. Package manager is **npm**.

## Gotchas (read before debugging)

- **`ALLOWED_DOMAINS` and `INITIAL_ADMIN_EMAILS` only apply after a re-seed.**
  These env vars are written into the DB by `npm run db:seed`. Editing `.env` alone
  does nothing — the access gate reads the database, not the environment. After
  changing either, run `npm run db:seed` (idempotent; never overwrites existing
  rows). On Railway it runs automatically each deploy. Day-to-day, add users and
  domains via the **Settings UI**, not by re-seeding.
- **A `{"success":true}` from the sign-in endpoint does NOT mean an email was
  sent.** Responses are intentionally identical for allowed and non-allowed
  emails (anti-enumeration). The real signal is the server log line
  `[auth] sign-in code emailed to … (resend id …)`. No line = the gate blocked
  it (domain not allowed or no enabled invite).
- **No `RESEND_API_KEY`?** Sign-in codes print to the server log instead of
  emailing — fine for local dev.
- **`.env` changes need a dev-server restart** (Next loads env at boot).

## Access model

Two checks must BOTH pass to sign in (see `src/lib/access.ts`):
1. email domain is in `allowed_domain`, and
2. email has an enabled row in `invited_user`.

Enforced server-side in two places: the `sendVerificationOTP` callback (won't
email a code to anyone not allowed) and the `databaseHooks.user.create.before`
hook (won't create an account), both in `src/lib/auth.ts`. Roles are `admin`
(can manage Settings) and `member`.

## Conventions

- **New signed-in pages** go under `src/app/(app)/` — they're auth-guarded by the
  group layout. **Admin-only pages** go under `src/app/(app)/settings/`.
- **Auth in server components:** use `requireUser()` / `requireAdmin()` from
  `src/lib/session.ts`. Never trust the client for authz.
- **Mutations** are server actions (`"use server"`) that call `requireUser`/
  `requireAdmin` first, then `revalidatePath`.
- **DB:** import `db` from `src/db`. Add tables in `src/db/schema.ts`, then
  `npm run db:generate` (creates a migration) and `npm run db:migrate`. Migrations in
  `drizzle/` are committed.
- **UI:** shadcn/ui in `src/components/ui`. Add more with
  `npx shadcn@latest add <name>`. Use the `cn()` helper for class names.
- The edge guard is `src/proxy.ts` (Next 16's `proxy`, formerly `middleware`).

## Project layout

```
src/
  app/
    (app)/              # signed-in area (protected by the group layout)
      dashboard/        # the dashboard — the user's starting point
      settings/         # admin-only: users + domains
    sign-in/            # email-code sign-in flow
    api/auth/[...all]/  # better-auth handler
  components/ui/        # shadcn/ui components
  db/                   # Drizzle schema + client
  lib/
    auth.ts             # better-auth config + access gate
    access.ts           # domain allowlist + invite checks
    email.ts            # Resend (with console fallback)
    session.ts          # requireUser / requireAdmin helpers
  proxy.ts              # edge guard that redirects to /sign-in
scripts/                # migrate + seed (run on deploy via `npm run release`)
drizzle/                # generated SQL migrations (committed)
```

Every environment variable is documented in `.env.example` — treat it as the
canonical list. `EMAIL_FROM` must be on a domain verified in the Resend account
that owns `RESEND_API_KEY`.

## Microsoft SSO (dormant until enabled)

The "Continue with Microsoft" button is built but hidden until credentials exist.
To enable it, set `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, and
`MICROSOFT_TENANT_ID` (or leave as `common`) from a Microsoft Entra ID app
registration, then redeploy. Set the Entra redirect URI to
`https://<your-domain>/api/auth/callback/microsoft`. The same invite + domain
gate applies to Microsoft sign-ins.

## Deploying to Railway

Use the **`/deploy`** command — it encodes the exact, tested sequence. It prefers
the Railway MCP (pre-wired in `.mcp.json`) and falls back to the Railway CLI.

Invariants any deploy must satisfy (the command handles these — don't reinvent them):
- One **app service** + one **volume mounted at `/data`**. SQLite needs no separate
  database service.
- `DATABASE_URL=file:/data/app.db` (points at the volume).
- **Order matters:** generate the public domain first, then set `BETTER_AUTH_URL` to
  exactly `https://<that-domain>` — auth breaks if they don't match.
- Set all env vars (and an auto-generated `BETTER_AUTH_SECRET`) so the first boot's
  `npm run release` seeds the first admin onto the volume.
- Secrets live only in Railway's variables — never write them into the repo.

`/deploy` connects the **GitHub repo** as the service source when an `origin`
remote exists, so after the one-time setup **updates ship via `git push`** (Railway
auto-deploys) and `/deploy` isn't needed again. Repos with no GitHub remote — or the
CLI engine — fall back to local-upload, where updating means re-running `/deploy`.

Setup prerequisites (one-time, in `README.md`): install the Railway CLI,
`railway login`, then approve the `railway` MCP from `.mcp.json` (or `railway mcp
install --agent claude-code`). GitHub-connected deploys also need Railway's GitHub
app authorised once (the command detects this and guides the user).

## Don't

- Commit `.env` or the `data/` SQLite files (both gitignored).
- Hardcode secrets — read from `process.env` at call-time.
- Move the access checks to the client.

## Commands

First local run: `npm install && npm run db:migrate && npm run db:seed && npm run dev`
(set `INITIAL_ADMIN_EMAILS` + `ALLOWED_DOMAINS` in `.env` before seeding).

`npm run dev` · `npm run build` · `npm run typecheck` · `npm run db:generate` ·
`npm run db:migrate` · `npm run db:seed` · `npm run db:studio`

Run `npm run typecheck` after non-trivial changes.
