import Link from "next/link";

import { cn } from "@/lib/utils";

/** Titre de section, filet, et lien de repli à droite.
 *  Le lien mène toujours à la vue complète de ce que la section montre en extrait ;
 *  s'il n'y a pas de vue complète, il n'y a pas de lien. */
export function SectionHeading({
  title,
  href,
  linkLabel,
  as: Heading = "h2",
  compact = false,
  id,
  className,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  as?: "h2" | "h3";
  compact?: boolean;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-5", className)}>
      <div className="mb-3 flex items-end justify-between gap-4">
        <Heading
          id={id}
          className={cn(
            "font-display font-semibold",
            compact
              ? "text-[18px] leading-[1.3] tracking-[1px]"
              : "text-[22px] leading-[1.2] sm:text-[27px]",
          )}
        >
          {title}
        </Heading>
        {href && linkLabel ? (
          <Link
            href={href}
            className="shrink-0 text-[16px] text-crimson-ink underline-offset-4 hover:underline sm:text-[17px]"
          >
            {linkLabel} →
          </Link>
        ) : null}
      </div>
      <div className={cn(compact ? "h-px bg-hairline" : "h-0.5 bg-rule")} />
    </div>
  );
}
