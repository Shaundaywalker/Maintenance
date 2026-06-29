"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * From–to date range control. Writes ?from=&to= to the URL; the (server) page
 * reads them and queries that window. "Yesterday" clears the params back to the
 * default landing view.
 */
export function DateRangePicker({
  from,
  to,
  min,
  max,
}: {
  from: string;
  to: string;
  min?: string;
  max?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);

  function apply() {
    const [lo, hi] = f <= t ? [f, t] : [t, f];
    router.push(`${pathname}?from=${lo}&to=${hi}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-muted-foreground text-xs">From</label>
        <Input
          type="date"
          value={f}
          min={min}
          max={max}
          onChange={(e) => setF(e.target.value)}
          className="h-9 w-[9.5rem]"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-muted-foreground text-xs">To</label>
        <Input
          type="date"
          value={t}
          min={min}
          max={max}
          onChange={(e) => setT(e.target.value)}
          className="h-9 w-[9.5rem]"
        />
      </div>
      <Button size="sm" onClick={apply} disabled={!f || !t}>
        Apply
      </Button>
      <Button size="sm" variant="ghost" onClick={() => router.push(pathname)}>
        Yesterday
      </Button>
    </div>
  );
}
