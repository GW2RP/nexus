import { cn } from "@/lib/utils";

/** L'en-tête d'une page de contenu : un seul `page-title` par page,
 *  une ligne de faits en dessous, et l'action principale à droite. */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-8 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end",
        className,
      )}
    >
      <div>
        {eyebrow ? (
          <p className="mb-3 font-display text-[12px] font-medium tracking-[3.5px] text-gold-eyebrow">
            {/* Les capitales s'écrivent, elles ne se posent pas en CSS : le
                lecteur d'écran doit lire ce que l'œil lit. */}
            {eyebrow.toLocaleUpperCase("fr-FR")}
          </p>
        ) : null}
        <h1 className="font-display text-[32px] font-bold leading-[1.1] sm:text-[40px]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-3 max-w-[70ch] text-[18px] leading-[1.55] text-ink-body sm:text-[20px]">
            {subtitle}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
