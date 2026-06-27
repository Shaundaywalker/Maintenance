"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  invitedUser,
  allowedDomain,
  user as userTable,
  session as sessionTable,
} from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { emailDomain, isDomainAllowed, normalizeEmail } from "@/lib/access";
import { sendInviteEmail } from "@/lib/email";

export type ActionResult = { ok: boolean; error?: string; warning?: string };

function isValidEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^@/, "")
    .replace(/\/.*$/, "");
}

function isValidDomain(domain: string): boolean {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(
    domain,
  );
}

/** Delete any live sessions for a user so access changes take effect at once. */
async function killSessions(email: string) {
  const u = await db.query.user.findFirst({
    where: eq(userTable.email, email),
  });
  if (u) {
    await db.delete(sessionTable).where(eq(sessionTable.userId, u.id));
  }
}

// --- Users -----------------------------------------------------------------

export async function addUser(
  emailInput: string,
  role: "admin" | "member",
): Promise<ActionResult> {
  await requireAdmin();
  const email = normalizeEmail(emailInput);

  if (!isValidEmail(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (!(await isDomainAllowed(email))) {
    return {
      ok: false,
      error: `@${emailDomain(email)} isn't an allowed domain yet — add it under Domains first.`,
    };
  }
  const existing = await db.query.invitedUser.findFirst({
    where: eq(invitedUser.email, email),
  });
  if (existing) {
    return { ok: false, error: "That email is already on the list." };
  }

  const admin = await requireAdmin();
  await db.insert(invitedUser).values({
    id: randomUUID(),
    email,
    role,
    enabled: true,
    invitedByEmail: admin.email,
  });

  revalidatePath("/settings/users");

  // Email the invite. The user is added regardless; surface a warning if the
  // email couldn't be sent so the admin knows to share the link manually.
  try {
    const sent = await sendInviteEmail(email, { invitedBy: admin.email });
    if (!sent) {
      return { ok: true, warning: "User added, but email isn't configured — share the sign-in link manually." };
    }
  } catch (err) {
    console.error("[settings] invite email failed:", err);
    return {
      ok: true,
      warning: "User added, but the invite email failed to send (check email settings).",
    };
  }

  return { ok: true };
}

export async function setUserRole(
  email: string,
  role: "admin" | "member",
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (normalizeEmail(email) === normalizeEmail(admin.email)) {
    return { ok: false, error: "You can't change your own role." };
  }
  await db
    .update(invitedUser)
    .set({ role })
    .where(eq(invitedUser.email, normalizeEmail(email)));
  await db
    .update(userTable)
    .set({ role })
    .where(eq(userTable.email, normalizeEmail(email)));

  revalidatePath("/settings/users");
  return { ok: true };
}

export async function setUserEnabled(
  email: string,
  enabled: boolean,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const target = normalizeEmail(email);
  if (target === normalizeEmail(admin.email)) {
    return { ok: false, error: "You can't disable your own account." };
  }
  await db
    .update(invitedUser)
    .set({ enabled })
    .where(eq(invitedUser.email, target));
  if (!enabled) {
    await killSessions(target);
  }

  revalidatePath("/settings/users");
  return { ok: true };
}

export async function removeUser(email: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const target = normalizeEmail(email);
  if (target === normalizeEmail(admin.email)) {
    return { ok: false, error: "You can't remove your own account." };
  }
  await db.delete(invitedUser).where(eq(invitedUser.email, target));
  // Deleting the user cascades to their sessions and accounts (FK on delete).
  await db.delete(userTable).where(eq(userTable.email, target));

  revalidatePath("/settings/users");
  return { ok: true };
}

// --- Domains ---------------------------------------------------------------

export async function addDomain(domainInput: string): Promise<ActionResult> {
  await requireAdmin();
  const domain = normalizeDomain(domainInput);

  if (!isValidDomain(domain)) {
    return { ok: false, error: "Enter a valid domain, e.g. bootlegger.co.za" };
  }
  const existing = await db.query.allowedDomain.findFirst({
    where: eq(allowedDomain.domain, domain),
  });
  if (existing) {
    return { ok: false, error: "That domain is already allowed." };
  }

  await db.insert(allowedDomain).values({ id: randomUUID(), domain });

  revalidatePath("/settings/domains");
  return { ok: true };
}

export async function removeDomain(domain: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const target = normalizeDomain(domain);
  if (target === emailDomain(admin.email)) {
    return {
      ok: false,
      error: "You can't remove your own email's domain.",
    };
  }
  await db.delete(allowedDomain).where(eq(allowedDomain.domain, target));

  revalidatePath("/settings/domains");
  return { ok: true };
}
