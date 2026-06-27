import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/session";
import { db } from "@/db";
import { invitedUser, user as userTable } from "@/db/schema";
import { AddUserDialog } from "./add-user-dialog";
import { CreateLoginDialog } from "./create-login-dialog";
import { UsersTable, type UserRow } from "./users-table";

export default async function UsersPage() {
  const me = await requireAdmin();

  const invites = await db
    .select()
    .from(invitedUser)
    .orderBy(desc(invitedUser.createdAt));
  const users = await db.select({ email: userTable.email }).from(userTable);
  const activeEmails = new Set(users.map((u) => u.email));

  const rows: UserRow[] = invites.map((invite) => ({
    email: invite.email,
    role: invite.role === "admin" ? "admin" : "member",
    enabled: invite.enabled,
    hasLoggedIn: activeEmails.has(invite.email),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {rows.length} {rows.length === 1 ? "person" : "people"} with access
        </p>
        <div className="flex items-center gap-2">
          <CreateLoginDialog />
          <AddUserDialog />
        </div>
      </div>
      <UsersTable rows={rows} currentEmail={me.email} />
    </div>
  );
}
