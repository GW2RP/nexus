import { Badge } from "@/components/ui/badge";
import { EventGlyph, PlaceGlyph } from "@/components/type-glyph";
import {
  EVENT_TYPE_LABELS,
  PLACE_TYPE_LABELS,
  RACE_LABELS,
  type EventType,
  type Gender,
  type PlaceType,
  type Race,
} from "@/lib/domain";
import { cn } from "@/lib/utils";

/** Les puces de type. Le libellé s'écrit en capitales dans le contenu —
 *  pas avec `text-transform` — pour que le lecteur d'écran lise ce qui est écrit. */

export function EventTypeChip({
  type,
  onImage = false,
  className,
}: {
  type: EventType;
  onImage?: boolean;
  className?: string;
}) {
  return (
    <Badge variant={onImage ? "onImage" : "default"} className={className}>
      <EventGlyph type={type} size={13} />
      {EVENT_TYPE_LABELS[type].toLocaleUpperCase("fr-FR")}
    </Badge>
  );
}

export function PlaceTypeChip({
  type,
  onImage = false,
  className,
}: {
  type: PlaceType;
  onImage?: boolean;
  className?: string;
}) {
  return (
    <Badge variant={onImage ? "onImage" : "default"} className={className}>
      <PlaceGlyph type={type} size={13} />
      {PLACE_TYPE_LABELS[type].toLocaleUpperCase("fr-FR")}
    </Badge>
  );
}

export function RaceChip({
  race,
  gender = "neutre",
  className,
}: {
  race: Race;
  gender?: Gender;
  className?: string;
}) {
  return (
    <Badge className={cn("tracking-[1.6px]", className)}>
      {RACE_LABELS[race][gender].toLocaleUpperCase("fr-FR")}
    </Badge>
  );
}

/** Une pastille d'état : inscrit, complet, en attente. Rien d'autre n'est vert. */
export function StatusBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "success" | "neutral" | "crimson";
  className?: string;
}) {
  return (
    <Badge variant={tone} className={cn("tracking-[1.6px]", className)}>
      {children}
    </Badge>
  );
}
