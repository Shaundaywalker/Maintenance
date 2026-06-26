"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";

import {
  setUserRole,
  setUserEnabled,
  removeUser,
  type ActionResult,
} from "../actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type UserRow = {
  email: string;
  role: "admin" | "member";
  enabled: boolean;
  hasLoggedIn: boolean;
};

export function UsersTable({
  rows,
  currentEmail,
}: {
  rows: UserRow[];
  currentEmail: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<ActionResult>, success: string) {
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        toast.error(res.error ?? "Something went wrong.");
        return;
      }
      toast.success(success);
      router.refresh();
    });
  }

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border p-6 text-center text-sm">
        No users yet. Add the first one above.
      </p>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const isSelf = row.email === currentEmail;
            return (
              <TableRow key={row.email}>
                <TableCell className="font-medium">
                  {row.email}
                  {isSelf && (
                    <span className="text-muted-foreground"> (you)</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={row.role === "admin" ? "default" : "secondary"}>
                    {row.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  {!row.enabled ? (
                    <Badge variant="destructive">Disabled</Badge>
                  ) : row.hasLoggedIn ? (
                    <Badge variant="outline">Active</Badge>
                  ) : (
                    <Badge variant="outline">Invited</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isSelf || pending}
                        aria-label="User actions"
                      >
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {row.role === "member" ? (
                        <DropdownMenuItem
                          onClick={() =>
                            run(
                              () => setUserRole(row.email, "admin"),
                              "Made admin",
                            )
                          }
                        >
                          Make admin
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() =>
                            run(
                              () => setUserRole(row.email, "member"),
                              "Made member",
                            )
                          }
                        >
                          Make member
                        </DropdownMenuItem>
                      )}
                      {row.enabled ? (
                        <DropdownMenuItem
                          onClick={() =>
                            run(
                              () => setUserEnabled(row.email, false),
                              "Access disabled",
                            )
                          }
                        >
                          Disable access
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() =>
                            run(
                              () => setUserEnabled(row.email, true),
                              "Access enabled",
                            )
                          }
                        >
                          Enable access
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() =>
                          run(() => removeUser(row.email), "User removed")
                        }
                      >
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
