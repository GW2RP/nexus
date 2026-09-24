import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** La pagination d'un tableau : page précédente, page suivante, et où l'on en
 *  est. Là où un registre se déroule (`LoadMore`), un tableau d'administration
 *  se feuillette — on y cherche une ligne, pas une suite.
 *
 *  Tout vit dans l'URL : une page se partage, et les autres paramètres
 *  (recherche, tri) la suivent. */
export function Pagination({
  page,
  pageCount,
  searchParams,
  className,
}: {
  page: number;
  pageCount: number;
  searchParams: Record<string, string | string[] | undefined>;
  className?: string;
}) {
  if (pageCount <= 1) return null;

  function href(target: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (key === "page" || value === undefined) continue;
      for (const one of Array.isArray(value) ? value : [value]) params.append(key, one);
    }
    if (target > 1) params.set("page", String(target));
    const query = params.toString();
    return query ? `?${query}` : "?";
  }

  const lien = buttonVariants({ variant: "outline", size: "sm" });

  return (
    <nav
      aria-label="Pagination"
      className={cn("mt-6 flex flex-wrap items-center justify-between gap-4", className)}
    >
      {page > 1 ? (
        <Link href={href(page - 1)} className={lien} rel="prev">
          PAGE PRÉCÉDENTE
        </Link>
      ) : (
        <span />
      )}
      <p className="meta text-ink-muted">
        Page {page} sur {pageCount}
      </p>
      {page < pageCount ? (
        <Link href={href(page + 1)} className={lien} rel="next">
          PAGE SUIVANTE
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
