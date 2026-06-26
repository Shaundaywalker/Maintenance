import { asc } from "drizzle-orm";
import { requireAdmin } from "@/lib/session";
import { db } from "@/db";
import { allowedDomain } from "@/db/schema";
import { emailDomain } from "@/lib/access";
import { DomainsManager } from "./domains-manager";

export default async function DomainsPage() {
  const me = await requireAdmin();
  const domains = await db
    .select()
    .from(allowedDomain)
    .orderBy(asc(allowedDomain.domain));

  return (
    <DomainsManager
      domains={domains.map((d) => d.domain)}
      currentDomain={emailDomain(me.email)}
    />
  );
}
