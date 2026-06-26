"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/settings/users", label: "Users" },
  { href: "/settings/domains", label: "Domains" },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <div className="border-b">
      <nav className="-mb-px flex gap-4">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "border-b-2 px-1 pb-2 text-sm font-medium transition-colors",
                active
                  ? "border-brand text-foreground"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
