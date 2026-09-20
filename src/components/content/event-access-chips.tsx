import { GroupIcon, LockIcon, RepeatIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { RECURRENCE_LABELS } from "@/lib/domain";
import type { EventSummary } from "@/server/types";

/** Ce que la puce de type ne dit pas : si la scène se tient en ce moment, qui
 *  la voit, de quel cercle elle relève, et si elle revient.
 *
 *  Les capitales s'écrivent dans le contenu : `toLocaleUpperCase` sur le texte
 *  rendu, jamais un `text-transform` que le lecteur d'écran ne verrait pas. */
export function EventAccessChips({
  event,
  onImage = false,
}: {
  event: Pick<EventSummary, "visibility" | "group" | "series" | "cancelled" | "liveStatus">;
  onImage?: boolean;
}) {
  const variant = onImage ? ("onImage" as const) : ("default" as const);

  return (
    <>
      {/* Une scène commencée se dit en premier : c'est ce qu'on cherche à
          l'heure où on la cherche. Le rouge est celui du pin de carte d'une
          scène en cours — la même chose se dit de la même couleur. */}
      {event.liveStatus === "en-cours" && !event.cancelled ? (
        <Badge variant="crimson">EN COURS</Badge>
      ) : null}

      {event.visibility === "privee" ? (
        <Badge variant={variant}>
          <LockIcon size={12} />
          SUR INVITATION
        </Badge>
      ) : null}

      {event.group ? (
        <Badge variant={variant}>
          <GroupIcon size={12} />
          {event.group.name.toLocaleUpperCase("fr-FR")}
        </Badge>
      ) : null}

      {event.series ? (
        <Badge variant={variant}>
          <RepeatIcon size={12} />
          {RECURRENCE_LABELS[event.series.recurrence].toLocaleUpperCase("fr-FR")}
        </Badge>
      ) : null}

      {event.cancelled ? <Badge variant="neutral">RETIRÉE</Badge> : null}
      {!event.cancelled && event.series?.paused ? (
        <Badge variant="neutral">SÉRIE EN PAUSE</Badge>
      ) : null}
    </>
  );
}
