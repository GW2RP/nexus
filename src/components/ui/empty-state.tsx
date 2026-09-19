import { cn } from "@/lib/utils";

/** L'état vide d'une liste. Il dit ce qui manque et ce qu'on peut y faire —
 *  jamais un simple « aucun résultat ». */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 border border-rule bg-surface-inset px-6 py-8",
        className,
      )}
    >
      <p className="panel-title">
        {title}
      </p>
      {description ? (
        <p className="max-w-[60ch] body-compact text-ink-body">{description}</p>
      ) : null}
      {action}
    </div>
  );
}
