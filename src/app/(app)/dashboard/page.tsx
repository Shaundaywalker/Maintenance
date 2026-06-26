import { requireUser } from "@/lib/session";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="border-brand inline-block border-b-2 pb-1 text-2xl font-semibold tracking-tight">
          Dashboard
        </h1>
        <p className="text-muted-foreground mt-2">
          Welcome back{user.name ? `, ${user.name}` : ""}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your blank canvas</CardTitle>
          <CardDescription>
            This is the starting point. Build your dashboard here.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2 text-sm">
          <p>
            Replace this page at{" "}
            <code className="bg-muted rounded px-1 py-0.5">
              src/app/(app)/dashboard/page.tsx
            </code>
            . Auth, the access gate, and Settings are already wired up — you can
            focus on the actual dashboard.
          </p>
          <p>
            Add new pages under{" "}
            <code className="bg-muted rounded px-1 py-0.5">src/app/(app)/</code>{" "}
            and they&apos;ll automatically require a signed-in user.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
