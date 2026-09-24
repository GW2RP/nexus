import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** « Charger la suite » : un lien vers la page suivante, pour que la pagination
 *  reste dans l'URL et partageable.
 *
 *  Une page qui porte plusieurs listes donne à chacune son paramètre (`param`)
 *  et son ancre (`anchor`) : la suite de l'une ne remet pas l'autre à zéro, et
 *  le lecteur retrouve la liste où il l'avait laissée plutôt que le haut de la
 *  page. */
export function LoadMore({
  page,
  hasMore,
  searchParams,
  label = "CHARGER LA SUITE",
  param = "page",
  anchor,
  className,
}: {
  page: number;
  hasMore: boolean;
  searchParams: Record<string, string | string[] | undefined>;
  label?: string;
  param?: string;
  anchor?: string;
  className?: string;
}) {
  if (!hasMore) return null;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === param || value === undefined) continue;
    // Un paramètre répété (`?type=a&type=b`) arrive en tableau : il repart tel quel.
    for (const one of Array.isArray(value) ? value : [value]) params.append(key, one);
  }
  params.set(param, String(page + 1));

  return (
    <div className={cn("mt-8 flex justify-center", className)}>
      <Link
        href={`?${params.toString()}${anchor ? `#${anchor}` : ""}`}
        className={buttonVariants({ variant: "outline" })}
      >
        {label}
      </Link>
    </div>
  );
}
