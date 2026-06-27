import { Resend } from "resend";

/**
 * Deliver a one-time sign-in code.
 *
 * Env is read at call-time (not module load) so that changing RESEND_API_KEY /
 * EMAIL_FROM — e.g. swapping from your Resend account to Bootlegger's — takes
 * effect on the next send without a rebuild.
 *
 * If RESEND_API_KEY is not set (e.g. local dev before Resend is wired up), the
 * code is printed to the server logs instead of emailed so you can still sign in.
 */
export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Dashboard <onboarding@resend.dev>";
  const appName = process.env.APP_NAME ?? "Dashboard";

  if (!apiKey) {
    console.info(
      `\n──────────────────────────────────────────\n[auth] ${appName} sign-in code for ${to}: ${otp}\n      (set RESEND_API_KEY to email this instead)\n──────────────────────────────────────────\n`,
    );
    return;
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to,
    subject: `Your ${appName} sign-in code`,
    text: `Your ${appName} sign-in code is ${otp}\n\nIt expires in 10 minutes. If you didn't request this, you can ignore this email.`,
    html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
      <h2 style="margin:0 0 8px;font-size:18px">${appName}</h2>
      <p style="margin:0 0 16px;color:#444">Use this code to sign in:</p>
      <div style="font-size:32px;font-weight:700;letter-spacing:6px;background:#f4f4f5;border-radius:8px;padding:16px;text-align:center">${otp}</div>
      <p style="margin:16px 0 0;color:#888;font-size:13px">This code expires in 10 minutes. If you didn't request it, you can ignore this email.</p>
    </div>`,
  });

  if (error) {
    console.error("[auth] Resend send failed:", error);
    throw new Error(`Failed to send sign-in code: ${error.message}`);
  }

  console.info(`[auth] sign-in code emailed to ${to} (resend id ${data?.id})`);
}

/**
 * Email a newly-invited person a "you've been granted access" note with a link
 * to sign in. They still get a one-time code when they sign in — this just tells
 * them the dashboard exists and which email to use.
 *
 * Returns true if emailed, false if email isn't configured (logs to console).
 * Throws only on an actual Resend send error so the caller can surface it.
 */
export async function sendInviteEmail(
  to: string,
  opts: { invitedBy?: string | null } = {},
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Dashboard <onboarding@resend.dev>";
  const appName = process.env.APP_NAME ?? "Dashboard";
  const url = process.env.BETTER_AUTH_URL ?? "";
  const inviter = opts.invitedBy ? ` by ${opts.invitedBy}` : "";

  if (!apiKey) {
    console.info(
      `\n──────────────────────────────────────────\n[invite] ${to} was granted access to ${appName}${inviter}.\n        Sign-in URL: ${url}\n        (set RESEND_API_KEY to email this instead)\n──────────────────────────────────────────\n`,
    );
    return false;
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to,
    subject: `You've been added to ${appName}`,
    text: `You've been given access to ${appName}${inviter}.\n\nSign in here: ${url}\nUse this email address (${to}) — you'll get a one-time code to log in.`,
    html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
      <h2 style="margin:0 0 8px;font-size:18px">${appName}</h2>
      <p style="margin:0 0 16px;color:#444">You've been given access to ${appName}${inviter}.</p>
      <p style="margin:0 0 16px">
        <a href="${url}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">Open the dashboard</a>
      </p>
      <p style="margin:16px 0 0;color:#888;font-size:13px">Sign in with <b>${to}</b> — you'll receive a one-time code to log in. If you weren't expecting this, you can ignore this email.</p>
    </div>`,
  });

  if (error) {
    console.error("[invite] Resend send failed:", error);
    throw new Error(`Failed to send invite: ${error.message}`);
  }
  console.info(`[invite] invite emailed to ${to} (resend id ${data?.id})`);
  return true;
}
