import Link from "next/link";

import { cn } from "@/lib/utils";

/** Deux ou trois vues du même contenu, dans un cadre unique bordé `gold`.
 *  La bascule conserve les filtres : chaque segment est un lien qui garde l'URL. */
export function SegmentedControl({
  label,
  segments,
  className,
}: {
  label: string;
  segments: { href: string; label: string; active: boolean }[];
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn("inline-flex border border-gold", className)}>
      {segments.map((segment, index) => (
        <Link
          key={segment.href}
          href={segment.href}
          aria-current={segment.active ? "page" : undefined}
          className={cn(
            "inline-flex min-h-tap items-center px-5 py-3 font-display text-[12px] font-semibold uppercase tracking-[1.6px]",
            index > 0 && "border-l border-rule",
            segment.active
              ? "bg-gold-ink text-on-crimson"
              : "bg-transparent text-gold-ink hover:bg-surface-selected",
          )}
        >
          {segment.label}
        </Link>
      ))}
    </nav>
  );
}
