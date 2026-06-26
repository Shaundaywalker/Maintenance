"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { requestSignInCode } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Step = "email" | "code";

export function SignInForm({
  appName,
  microsoftEnabled,
}: {
  appName: string;
  microsoftEnabled: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function onRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await requestSignInCode(email);
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error ?? "Something went wrong. Try again.");
      return;
    }
    setStep("code");
    toast.message("If your account has access, a code is on its way.");
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await authClient.signIn.emailOtp({ email, otp: code });
    setLoading(false);
    if (error) {
      toast.error("That code didn't work. Check it and try again.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function onMicrosoft() {
    await authClient.signIn.social({
      provider: "microsoft",
      callbackURL: "/dashboard",
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {step === "email" ? (
        <form onSubmit={onRequestCode} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@bootlegger.co.za"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <Button type="submit" disabled={loading || !email}>
            {loading && <Loader2 className="animate-spin" />}
            Email me a sign-in code
          </Button>
        </form>
      ) : (
        <form onSubmit={onVerify} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="code">Enter the 6-digit code</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="••••••"
              className="text-center text-lg tracking-[0.5em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              required
              autoFocus
            />
            <p className="text-muted-foreground text-sm">
              Sent to {email}.{" "}
              <button
                type="button"
                className="underline underline-offset-2"
                onClick={() => {
                  setStep("email");
                  setCode("");
                }}
              >
                Use a different email
              </button>
            </p>
          </div>
          <Button type="submit" disabled={loading || code.length < 6}>
            {loading && <Loader2 className="animate-spin" />}
            Verify &amp; sign in
          </Button>
        </form>
      )}

      {microsoftEnabled && step === "email" && (
        <>
          <div className="flex items-center gap-3">
            <div className="bg-border h-px flex-1" />
            <span className="text-muted-foreground text-xs">or</span>
            <div className="bg-border h-px flex-1" />
          </div>
          <Button type="button" variant="outline" onClick={onMicrosoft}>
            Continue with Microsoft
          </Button>
        </>
      )}

      <p className="text-muted-foreground text-center text-xs">
        Access to {appName} is invite-only and restricted to approved domains.
      </p>
    </div>
  );
}
