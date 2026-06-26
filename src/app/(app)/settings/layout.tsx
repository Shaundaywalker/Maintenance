import { requireAdmin } from "@/lib/session";
import { SettingsNav } from "@/components/settings-nav";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Only admins reach Settings; non-admins are redirected to the dashboard.
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="border-brand inline-block border-b-2 pb-1 text-2xl font-semibold tracking-tight">
          Settings
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage who can access this dashboard.
        </p>
      </div>
      <SettingsNav />
      <div>{children}</div>
    </div>
  );
}
