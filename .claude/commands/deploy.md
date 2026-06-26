---
description: Set up this app on Railway (GitHub-connected, /data volume, env vars, public URL)
argument-hint: "[app name]"
---

You are deploying this Next.js + SQLite app to Railway for the user. Be careful:
**confirm with the user before creating any cloud resources.** Keep them informed
at each step and never print or commit secrets.

The preferred outcome is a **GitHub-connected** service, so that after this
one-time setup the user ships updates simply by `git push` (Railway auto-deploys).
A local-upload fallback exists for repos with no GitHub remote.

The optional argument is the app name: `$ARGUMENTS`

## 0. Pick an engine and check auth

- If the Railway **MCP** tools (`mcp__railway-mcp-server__*` or similar) are
  available, use them — preferred (the MCP can connect a GitHub repo).
- Otherwise, if the **CLI** is installed (`railway --version` works), use it
  (local-upload only — see step 3B).
- If neither is available, STOP and point the user to the "Connect Railway" setup
  in `README.md` (install the CLI, run `railway login`), then re-run `/deploy`.

Check authentication (MCP `whoami`, or `railway whoami`). If it fails, tell the
user to run `railway login` (opens a browser) and stop until they confirm.

## 1. Gather inputs

Find the GitHub repo: run `git remote get-url origin` and reduce it to `owner/repo`.
If there's no GitHub remote, you'll use the local-upload fallback (3B).

Read defaults from `.env` if present. Confirm or collect:
- **App name** — for the Railway project/service/subdomain. Default: `$ARGUMENTS`,
  else `APP_NAME`, else the repo folder name.
- **INITIAL_ADMIN_EMAILS** — first admin(s), comma-separated. Required.
- **ALLOWED_DOMAINS** — allowed email domains, comma-separated. Required.
- **RESEND_API_KEY** + **EMAIL_FROM** — to email sign-in codes. If skipped, warn:
  codes will only appear in the Railway logs (fine for a test, not real use).
- **Microsoft SSO** (optional) — only if the user supplies `MICROSOFT_CLIENT_ID`
  and `MICROSOFT_CLIENT_SECRET`.

Generate `BETTER_AUTH_SECRET`: `openssl rand -base64 32` (fallback:
`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`).
Keep it only in Railway's variables — never write it to a file.

## 2. Already set up? Don't re-provision.

If this directory is already linked to a Railway project (MCP status, or
`railway status`):
- If the service is **GitHub-connected**, tell the user updates ship automatically
  on `git push` — they don't need `/deploy` again. Offer to trigger a redeploy only
  if they ask.
- If it's a **local-upload** service, re-deploy the current code (MCP `deploy` with
  `path: "."`, or `railway up`).
Then stop. Do not create duplicate projects.

## 3A. Provision — GitHub-connected (preferred; MCP, when a GitHub remote exists)

Do these in order:
1. `create_project` (app name) → note `project_id`, `environment_id`.
2. `create_service` with `source_repo: "owner/repo"` (no separate deploy step —
   connecting the repo starts the first build from the latest commit on the
   default branch). Note `service_id`.
   - **If this fails because Railway can't access the repo:** Railway's GitHub app
     isn't authorised yet. Tell the user to open the Railway dashboard once →
     **New → Deploy from GitHub repo** (or **Account → connect GitHub**), authorise
     access to this repo, then re-run `/deploy`. This is a one-time click.
3. `create_volume` with `mount_path: "/data"` on the service.
4. `generate_domain` for the service → note the domain. Public URL = `https://<domain>`.
5. `set_variables` with (this triggers a redeploy with the volume + vars present —
   the very first build, before vars existed, may have failed; that's expected and
   this step fixes it):
   - `DATABASE_URL` = `file:/data/app.db`
   - `BETTER_AUTH_SECRET` = the generated secret
   - `BETTER_AUTH_URL` = `https://<domain>` (must match exactly)
   - `APP_NAME`, `ALLOWED_DOMAINS`, `INITIAL_ADMIN_EMAILS`
   - `RESEND_API_KEY`, `EMAIL_FROM` (if provided)
   - `MICROSOFT_*` (if provided)

**Result:** from now on, `git push` to the default branch auto-deploys. `/deploy`
was a one-time setup.

## 3B. Provision — local upload (fallback: no GitHub remote, or CLI engine)

**MCP:** `create_project` → `create_service` (empty, no source) → `create_volume`
(`/data`) → `generate_domain` → `set_variables` (as in 3A, with `skip_deploys: true`)
→ `deploy` with `path: "."` (uploads local code; build runs migrate + seed).

**CLI:** the first deploy boots before vars exist (it may log one error — expected,
the redeploy fixes it):
1. `railway up --new --name "<app name>" -y --detach`
2. `railway volume add --mount-path /data`
3. `railway domain` → capture the URL.
4. `railway variables --set "KEY=VALUE" ...` for every variable, including
   `BETTER_AUTH_URL=https://<domain>` and `DATABASE_URL=file:/data/app.db`.
5. `railway up --detach` (redeploy with the volume + vars present).

**Result:** updates ship by re-running `/deploy`. Mention they can switch to
push-to-deploy later by connecting the repo in Railway → service → **Settings → Source**.

## 4. Verify and report

- Wait for the deploy to finish (MCP `get_logs`, the CLI stream, or `railway logs`).
- Confirm the build succeeded and the logs show `[db] migrations applied` and
  `[db] seed complete`.
- Give the user the **public URL** and tell them to sign in as one of the
  `INITIAL_ADMIN_EMAILS`. The 6-digit code arrives by email — or, if no Resend key,
  it's in the Railway logs.
- Tell them how to update from now on:
  - **GitHub-connected:** commit and `git push` — Railway redeploys automatically.
  - **Local upload:** re-run `/deploy`.

Confirm before creating resources, and keep secrets out of the repo.
