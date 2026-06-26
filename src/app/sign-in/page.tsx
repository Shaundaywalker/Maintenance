import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { APP_NAME } from "@/lib/config";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { SignInForm } from "./sign-in-form";
import { Logo } from "@/components/logo";

export default async function SignInPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  const microsoftEnabled = Boolean(
    process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET,
  );

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-black p-4">
      <Logo className="h-14 text-2xl text-white" />
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardDescription>Sign in to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <SignInForm appName={APP_NAME} microsoftEnabled={microsoftEnabled} />
        </CardContent>
      </Card>
    </main>
  );
}
