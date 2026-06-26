"use server";

import { auth } from "@/lib/auth";
import { normalizeEmail } from "@/lib/access";

function isValidEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

/**
 * Step 1 of sign-in. Triggers a one-time code. Whether a code is actually
 * emailed is decided by the allowlist gate inside better-auth's
 * `sendVerificationOTP` callback (see src/lib/auth.ts), so the response here is
 * identical whether or not the email has access — this avoids revealing who is
 * invited. The caller always advances to the code-entry step.
 */
export async function requestSignInCode(
  emailInput: string,
): Promise<{ ok: boolean; error?: string }> {
  const email = normalizeEmail(emailInput);

  if (!isValidEmail(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  try {
    await auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } });
  } catch (err) {
    // Never leak internal errors or account existence to the client.
    console.error("[sign-in] failed to send verification code:", err);
  }

  return { ok: true };
}
