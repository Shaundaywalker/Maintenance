import { eq } from "drizzle-orm";
import { db } from "@/db";
import { allowedDomain, invitedUser } from "@/db/schema";

/** Lower-cased domain part of an email, or "" if malformed. */
export function emailDomain(email: string): string {
  return email.trim().toLowerCase().split("@")[1] ?? "";
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function isDomainAllowed(email: string): Promise<boolean> {
  const domain = emailDomain(email);
  if (!domain) return false;
  const row = await db.query.allowedDomain.findFirst({
    where: eq(allowedDomain.domain, domain),
  });
  return Boolean(row);
}

export async function getInvite(email: string) {
  return db.query.invitedUser.findFirst({
    where: eq(invitedUser.email, normalizeEmail(email)),
  });
}

/**
 * The single source of truth for "can this email sign in?":
 *  - its domain is on the allowlist, AND
 *  - it has an enabled invite.
 * Used both before sending a code and again when better-auth creates the user.
 */
export async function isEmailAllowed(email: string): Promise<boolean> {
  const [domainOk, invite] = await Promise.all([isDomainAllowed(email), getInvite(email)]);
  return domainOk && Boolean(invite) && invite!.enabled;
}

export async function getInviteRole(email: string): Promise<string> {
  const invite = await getInvite(email);
  return invite?.role ?? "member";
}
