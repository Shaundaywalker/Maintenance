"use client";

import { createAuthClient } from "better-auth/react";
import { emailOTPClient, adminClient } from "better-auth/client/plugins";

// Same-origin: the client infers the base URL from the browser location.
export const authClient = createAuthClient({
  plugins: [emailOTPClient(), adminClient()],
});

export const { signIn, signOut, useSession } = authClient;
