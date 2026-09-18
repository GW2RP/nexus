import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** « Charger la suite » : un lien vers la page suivante, pour que la pagination
 *  reste dans l'URL et partageable. */
export function LoadMore({
  page,
  hasMore,
  searchParams,
  label = "CHARGER LA SUITE",
  className,
}: {
  page: number;
  hasMore: boolean;
  searchParams: Record<string, string | string[] | undefined>;
  label?: string;
  className?: string;
}) {
  if (!hasMore) return null;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string" && key !== "page") params.set(key, value);
  }
  params.set("page", String(page + 1));

  return (
    <div className={cn("mt-8 flex justify-center", className)}>
      <Link href={`?${params.toString()}`} className={buttonVariants({ variant: "outline" })}>
        {label}
      </Link>
    </div>
  );
}
