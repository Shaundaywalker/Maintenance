import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP, admin } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { APIError } from "better-auth/api";
import { db, schema } from "@/db";
import { isEmailAllowed, getInviteRole } from "@/lib/access";
import { sendOtpEmail } from "@/lib/email";

// Microsoft SSO stays dormant until both credentials are provided. Fill them
// in (env vars) to light up the "Continue with Microsoft" button — no code change.
const microsoftConfigured = Boolean(
  process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET,
);

export const auth = betterAuth({
  // BETTER_AUTH_SECRET and BETTER_AUTH_URL are read from the environment.
  database: drizzleAdapter(db, { provider: "sqlite", schema }),

  // Email + password sign-in. Admins create a login with a generated password
  // (Settings → Create login) and share it — useful when email delivery is down.
  // The same invite + domain gate applies via the user.create.before hook below.
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },

  socialProviders: microsoftConfigured
    ? {
        microsoft: {
          clientId: process.env.MICROSOFT_CLIENT_ID!,
          clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
          tenantId: process.env.MICROSOFT_TENANT_ID || "common",
        },
      }
    : undefined,

  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 60 * 10, // 10 minutes
      allowedAttempts: 3,
      storeOTP: "hashed",
      async sendVerificationOTP({ email, otp, type }) {
        // Authoritative send gate: never email a code to anyone who isn't on
        // an allowed domain with an enabled invite — regardless of how the send
        // was triggered (our UI or a direct call to the public API endpoint).
        if (type === "sign-in" && !(await isEmailAllowed(email))) {
          return;
        }
        await sendOtpEmail(email, otp);
      },
    }),
    admin({ defaultRole: "member", adminRoles: ["admin"] }),
    // nextCookies() must be the LAST plugin so it can set cookies on responses
    // produced from server actions.
    nextCookies(),
  ],

  databaseHooks: {
    user: {
      create: {
        // Final gate: even if a sign-in attempt reaches user creation, reject
        // anyone who isn't on an allowed domain with an enabled invite, and
        // stamp the role from their invite.
        before: async (newUser) => {
          const allowed = await isEmailAllowed(newUser.email);
          if (!allowed) {
            throw new APIError("FORBIDDEN", {
              message: "This account is not allowed to sign in.",
            });
          }
          const role = await getInviteRole(newUser.email);
          // Email-code sign-ups have no name; fall back to the email's local part.
          const name = newUser.name || newUser.email.split("@")[0];
          return { data: { ...newUser, role, name } };
        },
      },
    },
  },
});
