import { StatusBadge } from "@/components/ui/chip";
import { formatGameTime } from "@/lib/dates";
import { statutAffiche, type PlaceActivity } from "@/lib/place-activity";
import { cn } from "@/lib/utils";

/**
 * Le statut d'un lieu tel que son équipe le déclare : la puce, puis le message
 * entre guillemets — c'est une parole rapportée, donc en italique. `ACTIF` est
 * en carmin comme « EN COURS » sur une scène : il s'y passe quelque chose
 * maintenant. Un lieu qui n'a rien déclaré n'affiche rien, ni un lieu inactif
 * sans message (`statutAffiche`).
 *
 * Le statut arrive déjà jugé (`activiteA`) : ce composant ne lit pas l'heure,
 * donc le rendu serveur et l'hydratation disent la même chose.
 */
export function PlaceActivityStatus({
  activity,
  withSince = false,
  className,
}: {
  activity: PlaceActivity | null;
  /** « depuis 19h40 », sur la fiche. */
  withSince?: boolean;
  className?: string;
}) {
  activity = statutAffiche(activity);
  if (!activity) return null;
  return (
    <p className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", className)}>
      <StatusBadge tone={activity.active ? "crimson" : "neutral"}>
        {activity.active ? "ACTIF" : "INACTIF"}
      </StatusBadge>
      {activity.message ? (
        <span className="body-compact italic text-ink-body">« {activity.message} »</span>
      ) : null}
      {withSince && activity.active && activity.since ? (
        <span className="caption text-ink-muted">
          depuis {formatGameTime(new Date(activity.since))}
        </span>
      ) : null}
    </p>
  );
}
