import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BoardCard } from "@/components/board/board-card";
import { NewBoardDialog } from "@/components/board/board-dialogs";
import { DeleteContent } from "@/components/content/delete-content";
import { EventRow } from "@/components/content/event-row";
import { GroupMembers } from "@/components/content/group-members";
import { GroupIcon, LockIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FramedMedia } from "@/components/ui/framed-media";
import { RichText } from "@/components/ui/rich-text";
import { SectionHeading } from "@/components/ui/section-heading";
import { GROUP_VISIBILITY_LABELS } from "@/lib/domain";
import { formatLongDate } from "@/lib/dates";
import { canManageGroup, isGroupMember } from "@/lib/permissions";
import { breadcrumbJsonLd, buildMetadata, jsonLdScript } from "@/lib/seo";
import { getCurrentUser } from "@/lib/session";
import { deleteGroupAction } from "@/server/actions/groups";
import { listGroupBoards } from "@/server/queries/boards";
import { listEvents } from "@/server/queries/events";
import { getGroupBySlug } from "@/server/queries/groups";

type Props = { params: Promise<{ slug: string }> };

/** Cette fiche se lit différemment selon le compte — un groupe privé n'existe
 *  pas pour qui n'en est pas. Elle est donc rendue à chaque requête. */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const user = await getCurrentUser();
  const group = await getGroupBySlug(slug, user);
  if (!group) {
    return buildMetadata({
      title: "Groupe introuvable",
      description: "Ce cercle n'est pas ouvert.",
      path: `/groupes/${slug}`,
      noIndex: true,
    });
  }

  return buildMetadata({
    title: group.name,
    description: group.summary ?? `Un cercle de ${group.memberCount} membres sur GW2RP Nexus.`,
    path: `/groupes/${group.slug}`,
    image: group.bannerUrl,
    imageAlt: group.bannerAlt ?? `Bannière de ${group.name}`,
    // Un groupe privé ne se donne pas aux moteurs : son adresse est déjà
    // introuvable pour qui n'en est pas, son titre n'a rien à faire ailleurs.
    noIndex: group.visibility === "prive",
  });
}

export default async function GroupPage({ params }: Props) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const group = await getGroupBySlug(slug, user);
  if (!group) notFound();

  const manages = canManageGroup(user, { authorId: group.authorId });
  const member = isGroupMember(user, {
    visibility: group.visibility,
    authorId: group.authorId,
    memberIds: group.members.map((one) => one.id),
  });

  // Les scènes du cercle : celles que le lecteur a le droit de voir. Un
  // visiteur d'un groupe public y verra donc les scènes publiques seulement.
  // Et ses panneaux : ceux que le lecteur peut lire. Un visiteur n'y voit que
  // les panneaux publics.
  const [events, boards] = await Promise.all([
    listEvents({ groupId: group.id, viewer: user, limit: 10 }),
    listGroupBoards(
      {
        id: group.id,
        slug: group.slug,
        visibility: group.visibility,
        authorId: group.authorId,
        memberIds: group.members.map((one) => one.id),
      },
      user,
    ),
  ]);

  return (
    <div className="mx-auto max-w-[1280px] px-gutter-mobile py-10 md:px-gutter-app xl:px-gutter-desktop">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(
          breadcrumbJsonLd([
            { name: "Groupes", path: "/groupes" },
            { name: group.name, path: `/groupes/${group.slug}` },
          ]),
        )}
      />

      <Breadcrumb items={[{ label: "Groupes", href: "/groupes" }, { label: group.name }]} />

      <FramedMedia
        src={group.bannerUrl}
        alt={group.bannerAlt ?? `Bannière de ${group.name}`}
        placeholder="BANNIÈRE DU GROUPE"
        dimensions={group.bannerUrl ? undefined : "1600 × 500"}
        aspect="16 / 5"
      >
        <Badge variant="onImage" className="absolute left-4 top-4">
          {group.visibility === "prive" ? <LockIcon size={12} /> : <GroupIcon size={12} />}
          {GROUP_VISIBILITY_LABELS[group.visibility].toLocaleUpperCase("fr-FR")}
        </Badge>
      </FramedMedia>

      <div className="mt-10 flex flex-col gap-12 lg:flex-row lg:gap-14">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[32px] font-bold leading-[1.1] sm:text-[40px]">
            {group.name}
          </h1>
          <p className="mt-3 text-[18px] leading-[1.55] text-ink-muted">
            Groupe {GROUP_VISIBILITY_LABELS[group.visibility].toLocaleLowerCase("fr-FR")} ·{" "}
            {group.memberCount} membre{group.memberCount > 1 ? "s" : ""}
            {group.author ? ` · mené par ${group.author.name}` : ""} · fondé le{" "}
            {formatLongDate(new Date(group.createdAt))}
          </p>

          {group.description ? <RichText text={group.description} className="mt-7" /> : null}

          {boards.length > 0 || manages ? (
            <section className="mt-10" aria-labelledby="panneaux">
              <SectionHeading
                id="panneaux"
                title={`Panneaux d'affichage · ${boards.length}`}
              />
              {boards.length > 0 ? (
                <ul className="grid gap-6 sm:grid-cols-2">
                  {boards.map((board) => (
                    <li key={board.id}>
                      <BoardCard board={board} />
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="Aucun panneau" />
              )}
              {manages ? (
                <div className="mt-5">
                  <NewBoardDialog groupId={group.id} groupName={group.name} />
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="mt-10" aria-labelledby="membres">
            <SectionHeading id="membres" title={`Membres · ${group.memberCount}`} />
            <GroupMembers
              groupId={group.id}
              leader={group.author}
              members={group.members}
              canManage={manages}
            />
          </section>

          <section className="mt-10" aria-labelledby="scenes-du-groupe">
            <SectionHeading
              id="scenes-du-groupe"
              title="Scènes du groupe"
              href="/evenements"
              linkLabel="Voir l'agenda complet →"
            />
            {events.length > 0 ? (
              <ul>
                {events.map((event) => (
                  <EventRow key={event.id} event={event} />
                ))}
              </ul>
            ) : (
              <EmptyState title="Aucune scène annoncée" />
            )}
          </section>
        </div>

        <aside className="lg:w-[340px] lg:shrink-0">
          <Card accent className="mb-6 gap-4 p-6">
            <p className="font-display text-[12px] font-medium tracking-[3.5px] text-gold-eyebrow">
              EN BREF
            </p>
            <dl className="flex flex-col">
              <Fact
                label="Visibilité"
                value={GROUP_VISIBILITY_LABELS[group.visibility]}
              />
              <Fact label="Membres" value={String(group.memberCount)} />
              <Fact
                label="Scènes à venir"
                value={String(group.upcomingEventCount)}
              />
              <Fact label="Panneaux" value={boards.length > 0 ? String(boards.length) : null} />
              <Fact label="Meneur" value={group.author?.name ?? null} />
            </dl>
          </Card>

          {member && group.visibility === "prive" ? (
            <p className="mb-6 body-compact text-ink-body">
              Les scènes privées associées à ce cercle sont à votre agenda, avec leur inscription
              ouverte. Le reste du hub n&apos;en voit rien.
            </p>
          ) : null}

          {manages ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild variant="outline">
                <Link href={`/groupes/${group.slug}/modifier`}>MODIFIER LE GROUPE</Link>
              </Button>
              <DeleteContent
                id={group.id}
                action={deleteGroupAction}
                title={group.name}
                question="Dissoudre ce cercle ?"
                consequence="Le groupe disparaît avec sa bannière et sa liste de membres. Les scènes qui lui étaient associées restent privées : leurs invités nommés continuent de les voir, les autres membres du cercle non. C'est irréversible."
                excerpt={group.summary}
                verb="DISSOUDRE LE GROUPE"
              />
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hairline py-3 last:border-b-0">
      <dt className="text-[16px] text-ink-muted">{label}</dt>
      <dd className="text-right text-[17px] text-ink">{value}</dd>
    </div>
  );
}
