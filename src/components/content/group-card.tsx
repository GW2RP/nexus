import Link from "next/link";

import { GroupIcon, LockIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Card, CardFooter } from "@/components/ui/card";
import { FramedMedia } from "@/components/ui/framed-media";
import { GROUP_VISIBILITY_LABELS } from "@/lib/domain";
import type { GroupSummary } from "@/server/types";

/** La carte d'un cercle. Comme celle d'un lieu : le bandeau en tête, à son
 *  format, puis le bloc de texte. Le titre est le lien — la carte entière ne
 *  l'est pas, elle porte déjà son pied. */
export function GroupCard({ group }: { group: GroupSummary }) {
  return (
    <Card className="w-full overflow-hidden">
      <FramedMedia
        src={group.bannerUrl}
        alt={group.bannerAlt ?? `Bannière de ${group.name}`}
        placeholder="BANNIÈRE DU GROUPE"
        dimensions={group.bannerUrl ? undefined : "1600 × 500"}
        aspect="3 / 1"
        className="shrink-0 border-0 border-b border-rule p-0"
        innerClassName="border-0"
      >
        <Badge variant="onImage" className="absolute left-4 top-4">
          {group.visibility === "prive" ? <LockIcon size={12} /> : <GroupIcon size={12} />}
          {GROUP_VISIBILITY_LABELS[group.visibility].toLocaleUpperCase("fr-FR")}
        </Badge>
        {group.viewerIsMember ? (
          <Badge variant="onImage" className="absolute right-4 top-4">
            MEMBRE
          </Badge>
        ) : null}
      </FramedMedia>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="card-title">
          <Link href={`/groupes/${group.slug}`} className="hover:underline">
            {group.name}
          </Link>
        </h3>

        {group.summary ? <p className="body-compact text-ink-body">{group.summary}</p> : null}

        <CardFooter>
          <span className="meta text-ink-muted">
            {group.memberCount} membre{group.memberCount > 1 ? "s" : ""}
            {group.upcomingEventCount > 0
              ? ` · ${group.upcomingEventCount} scène${group.upcomingEventCount > 1 ? "s" : ""}`
              : ""}
          </span>
          <Link
            href={`/groupes/${group.slug}`}
            className="meta text-crimson-ink underline-offset-4 hover:underline"
          >
            Voir →
          </Link>
        </CardFooter>
      </div>
    </Card>
  );
}
