import { existsSync } from "node:fs";
import { join } from "node:path";
import { APP_NAME } from "@/lib/config";
import { cn } from "@/lib/utils";

// Drop your logo in /public as one of these and it will be used automatically.
// SVG is preferred (crisp at any size).
const CANDIDATES = [
  "bootlegger-logo.svg",
  "bootlegger-logo.png",
  "logo.svg",
  "logo.png",
];

function findLogo(): string | null {
  const publicDir = join(process.cwd(), "public");
  for (const file of CANDIDATES) {
    if (existsSync(join(publicDir, file))) return `/${file}`;
  }
  return null;
}

/**
 * Renders the brand logo. If a logo image exists in /public it's used;
 * otherwise it falls back to a styled "Bootlegger." wordmark so the app looks
 * branded before you add the asset.
 */
export function Logo({ className }: { className?: string }) {
  const src = findLogo();

  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={APP_NAME}
        className={cn("h-8 w-auto select-none", className)}
      />
    );
  }

  return (
    <span
      className={cn(
        "text-lg font-bold tracking-tight uppercase select-none",
        className,
      )}
    >
      Bootlegger<span className="text-brand">.</span>
    </span>
  );
}
