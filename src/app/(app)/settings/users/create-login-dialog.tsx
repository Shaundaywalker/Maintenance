"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, Copy, Check } from "lucide-react";

import { createLogin } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Created {
  email: string;
  password: string;
  url: string;
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-muted-foreground text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <code className="bg-muted flex-1 truncate rounded px-2 py-1.5 text-sm">{value}</code>
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

export function CreateLoginDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [created, setCreated] = useState<Created | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setEmail("");
    setRole("member");
    setCreated(null);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createLogin(email, role);
      if (!res.ok || !res.password) {
        toast.error(res.error ?? "Couldn't create the login.");
        return;
      }
      setCreated({ email: res.email!, password: res.password, url: res.url ?? "" });
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <KeyRound />
          Create login
        </Button>
      </DialogTrigger>
      <DialogContent>
        {!created ? (
          <form onSubmit={onSubmit}>
            <DialogHeader>
              <DialogTitle>Create a login</DialogTitle>
              <DialogDescription>
                Generates a password for this person so they can sign in with their
                email — no email delivery needed. Share the link + password with
                them. Their domain must be on the allowed list.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="cl-email">Email</Label>
                <Input
                  id="cl-email"
                  type="email"
                  placeholder="person@bootlegger.co.za"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cl-role">Role</Label>
                <select
                  id="cl-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as "admin" | "member")}
                  className="border-input focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                >
                  <option value="member">Member — can view the dashboard</option>
                  <option value="admin">Admin — can also manage users</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending || !email}>
                Generate login
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Login created</DialogTitle>
              <DialogDescription>
                Copy these now — the password isn&apos;t shown again. Share them with{" "}
                {created.email}.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 py-4">
              {created.url ? <CopyRow label="Sign-in link" value={created.url} /> : null}
              <CopyRow label="Email" value={created.email} />
              <CopyRow label="Password" value={created.password} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={reset}>
                Create another
              </Button>
              <Button type="button" onClick={() => setOpen(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
