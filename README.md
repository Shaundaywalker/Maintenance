# Bootlegger Dashboard

A ready-made, secure starting point for building internal Bootlegger dashboards.
It already handles the hard parts - logging in, keeping access locked to your
team, and publishing to the web - so you can focus on the dashboard itself.

You build on it by **talking to Claude Code** (the assistant you're using right
now). You describe what you want in plain English, and it writes and runs the
code. This guide covers the handful of things only *you* need to do.

> **New to all this?** You don't need to know how to code. When a step mentions
> "the terminal" (the window where commands run), you can simply ask Claude Code
> to do it - paste the command into the chat and ask it to run it for you.

## What it does out of the box

- 🔐 **Safe sign-in** - people log in with a one-time code sent to their email.
  No passwords to manage or lose.
- 👥 **Your team only** - only people you've invited, using an approved company
  email (like `@bootlegger.co.za`), can get in.
- ⚙️ **A Settings page** - add or remove people and approved email domains with a
  few clicks. No code, no waiting.
- 📊 **A blank dashboard** - ready for you to build whatever you need.
- 🚀 **One-command publishing** - put it live on the web with a single command.

## Two free accounts you'll need

Both have free plans that are plenty to start with (you can sign up with GitHub):

1. **[Resend](https://resend.com)** - sends the login-code emails.
2. **[Railway](https://railway.app)** - puts your dashboard online.

You'll set these up as you go below.

## 1. Run it on your computer

The simplest way is to ask Claude Code:

> "Set this project up and start it, and make me the first admin - my email is
> you@bootlegger.co.za."

It installs everything, starts the app at **http://localhost:3000**, and makes you
the admin. Open that link and sign in with your email.

> While you're testing *before* email is set up, your login code is printed in the
> terminal (look for a line like `sign-in code for you@…: 123456`) instead of being
> emailed. That lets you sign in straight away.

<details>
<summary>Prefer to run it yourself in the terminal?</summary>

**You only need one thing installed: Node.js.** It comes bundled with `npm`, the
tool that downloads everything else this project needs. Get the **LTS** version -
it must be version 22 or newer.

**On a Mac:**

1. Go to [nodejs.org](https://nodejs.org) and download the **LTS** installer.
2. Open the downloaded `.pkg` file and click through it (the defaults are fine).
3. Open the terminal: press `Cmd`+`Space`, type "Terminal", press Enter.

**On Windows:**

1. Go to [nodejs.org](https://nodejs.org) and download the **LTS** installer.
2. Open the downloaded `.msi` file and click through it (the defaults are fine).
3. Open the terminal: press the Start button, type "PowerShell", press Enter.

To check it worked, type `node --version` and press Enter - you should see a
number like `v22.x.x` or higher.

**Then, in the terminal from this project's folder, run these one at a time:**

```bash
npm install
cp .env.example .env     # then open .env and set INITIAL_ADMIN_EMAILS to your email
npm run db:migrate
npm run db:seed
npm run dev
```

> On Windows PowerShell, use `copy .env.example .env` instead of the `cp` line.

When it's running, open **http://localhost:3000** in your browser.
</details>

## 2. Turn on login emails (Resend)

So codes actually land in people's inboxes:

1. Create a free account at [resend.com](https://resend.com).
2. Add a domain you own and verify it. Resend gives you a few **DNS records** to
   add - if that's unfamiliar, **ask Claude Code to walk you through it**.
3. Copy your **API key**.
4. Give the key to Claude Code and ask it to set up email.

> You only verify a domain **once** - every dashboard you build can reuse it. You
> can also test with any domain you control and switch to the real one later.

## 3. Add and remove people

Once you're signed in as an admin, open **Settings** in the app:

- **Users** - invite someone by email, make them an admin or a member, or remove them.
- **Domains** - choose which email domains are allowed.

It's all point-and-click, and changes take effect immediately - no code, no redeploy.

## 4. Publish it to the web (Railway)

**First time only** (about five minutes, once per computer). Open the terminal -
on a Mac press `Cmd`+`Space`, type "Terminal", and press Enter; on Windows open
"PowerShell" - then:

1. Create a free account at [railway.app](https://railway.app).
2. Install Railway's tool and log in (or paste these into Claude Code and ask it
   to run them):
   ```bash
   npm install -g @railway/cli
   railway login
   ```
   `railway login` opens your browser - click to approve.
3. Back in Claude Code, it will ask to enable a tool called **railway** - click approve.

**Then publish** - in Claude Code, type:

```
/deploy
```

Answer a few short questions (your admin email, allowed domains, Resend key) and it
does the rest: sets everything up, puts it online, and gives you a **public link**
to share with your team.

**To update later**, just save and push your changes to GitHub - Railway
republishes automatically, so you never run `/deploy` again. (Not sure how? Ask
Claude Code: "commit and push my changes.")

## 5. Build your dashboard

This is the part you actually wanted - and it's all done by chatting with Claude
Code. For example:

> "Add a page that shows this month's sales as a chart."
>
> "Make a table of our store locations that admins can edit."

Claude Code already knows how this project is organised and the rules it must
follow, so you can focus on *what* you want, not *how* it's built.

## Stuck?

Ask Claude Code - it can read this entire project and help with almost anything.
A few prompts to get going:

- "Start the app and show me how to log in."
- "Help me set up Resend so emails send."
- "Deploy this to Railway."

---

<sub>Built with Next.js, better-auth, Drizzle, SQLite, Tailwind, and shadcn/ui;
deployed on Railway. Technical notes for the coding agent live in `CLAUDE.md`.</sub>
