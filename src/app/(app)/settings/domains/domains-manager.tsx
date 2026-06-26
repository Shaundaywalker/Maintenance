"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";

import { addDomain, removeDomain } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DomainsManager({
  domains,
  currentDomain,
}: {
  domains: string[];
  currentDomain: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await addDomain(value);
      if (!res.ok) {
        toast.error(res.error ?? "Couldn't add the domain.");
        return;
      }
      toast.success(`Added ${value.trim().toLowerCase()}`);
      setValue("");
      router.refresh();
    });
  }

  function onRemove(domain: string) {
    startTransition(async () => {
      const res = await removeDomain(domain);
      if (!res.ok) {
        toast.error(res.error ?? "Couldn't remove the domain.");
        return;
      }
      toast.success(`Removed ${domain}`);
      router.refresh();
    });
  }

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Only people with an email at one of these domains can sign in — and they
        still need an invite under Users.
      </p>

      <form onSubmit={onAdd} className="flex gap-2">
        <Input
          placeholder="bootlegger.co.za"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button type="submit" disabled={pending || !value}>
          <Plus />
          Add
        </Button>
      </form>

      <div className="divide-y rounded-lg border">
        {domains.length === 0 ? (
          <p className="text-muted-foreground p-4 text-sm">
            No domains yet. Add one above before inviting users.
          </p>
        ) : (
          domains.map((domain) => (
            <div
              key={domain}
              className="flex items-center justify-between px-4 py-2.5"
            >
              <span className="text-sm font-medium">{domain}</span>
              <Button
                variant="ghost"
                size="icon"
                disabled={pending || domain === currentDomain}
                onClick={() => onRemove(domain)}
                aria-label={`Remove ${domain}`}
                title={
                  domain === currentDomain
                    ? "You can't remove your own domain"
                    : undefined
                }
              >
                <X />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
