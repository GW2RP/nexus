import Link from "next/link";

import { GroupIcon, LockIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Card, CardFooter } from "@/components/ui/card";
import { GROUP_VISIBILITY_LABELS } from "@/lib/domain";
import type { GroupSummary } from "@/server/types";

/** La carte d'un cercle. Le titre est le lien : la carte entière ne l'est pas,
 *  elle porte déjà son pied. */
export function GroupCard({ group }: { group: GroupSummary }) {
  return (
    <Card className="w-full gap-3 p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>
          {group.visibility === "prive" ? <LockIcon size={12} /> : <GroupIcon size={12} />}
          {GROUP_VISIBILITY_LABELS[group.visibility].toLocaleUpperCase("fr-FR")}
        </Badge>
        {group.viewerIsMember ? <Badge variant="neutral">MEMBRE</Badge> : null}
      </div>

      <h3 className="card-title">
        <Link href={`/groupes/${group.slug}`} className="hover:underline">
          {group.name}
        </Link>
      </h3>

      {group.summary ? <p className="body-compact text-ink-body">{group.summary}</p> : null}

      <CardFooter>
        <span className="text-[16px] text-ink-muted">
          {group.memberCount} membre{group.memberCount > 1 ? "s" : ""}
          {group.upcomingEventCount > 0
            ? ` · ${group.upcomingEventCount} scène${group.upcomingEventCount > 1 ? "s" : ""}`
            : ""}
        </span>
        <Link
          href={`/groupes/${group.slug}`}
          className="text-[16px] text-crimson-ink underline-offset-4 hover:underline"
        >
          Voir →
        </Link>
      </CardFooter>
    </Card>
  );
}
