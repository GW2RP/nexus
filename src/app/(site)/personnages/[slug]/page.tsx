import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EventRow } from "@/components/content/event-row";
import { RumorItem } from "@/components/content/rumor-item";
import { ReportDialog } from "@/components/report-dialog";
import { DeleteContent } from "@/components/content/delete-content";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { RaceChip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { FramedMedia } from "@/components/ui/framed-media";
import { RichText } from "@/components/ui/rich-text";
import { SectionHeading } from "@/components/ui/section-heading";
import { REGION_LABELS, raceLabel } from "@/lib/domain";
import {
  canContribute,
  canEditContent,
  canReportContent,
  isContentAuthor,
} from "@/lib/permissions";
import { SITE_URL, breadcrumbJsonLd, buildMetadata, jsonLdScript } from "@/lib/seo";
import { getCurrentUser } from "@/lib/session";
import { deleteCharacterAction } from "@/server/actions/characters";
import { formatTyrianDate } from "@/lib/tyrian-calendar";
import { getCharacterBySlug } from "@/server/queries/characters";
import { listEvents } from "@/server/queries/events";
import { listRumors } from "@/server/queries/rumors";

type Props = { params: Promise<{ slug: string }> };

/** Ces fiches se lisent différemment selon la personne connectée — bouton de
 *  modification, drapeau de signalement, état d'inscription. Elles sont donc
 *  rendues à chaque requête. Déclarer en plus `generateStaticParams` mettait la
 *  route en contradiction avec elle-même : Next tentait de générer une page
 *  statique pour un slug inconnu, et la lecture de la session y échouait avec
 *  `DYNAMIC_SERVER_USAGE`. */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const character = await getCharacterBySlug(slug);
  if (!character) {
    return buildMetadata({
      title: "Fiche introuvable",
      description: "Cette fiche de personnage n'est plus au registre.",
      path: `/personnages/${slug}`,
      noIndex: true,
    });
  }

  const facts = [
    raceLabel(character.race, character.gender),
    character.age !== null ? `${character.age} ans` : null,
    character.homePlaceLabel,
  ].filter(Boolean);

  return buildMetadata({
    title: character.name,
    description:
      character.summary ??
      character.tagline ??
      `${character.name}, ${facts.join(" · ")} — une fiche du registre des personnages du hub GW2RP Nexus.`,
    path: `/personnages/${character.slug}`,
    image: character.portraitUrl,
    imageAlt: character.portraitAlt ?? `Portrait de ${character.name}`,
    type: "profile",
    publishedTime: character.createdAt,
    modifiedTime: character.updatedAt,
    authors: character.author ? [character.author.name] : undefined,
    keywords: [character.name, raceLabel(character.race), "personnage Guild Wars 2 RP"],
  });
}

export default async function CharacterPage({ params }: Props) {
  const { slug } = await params;
  const [character, user] = await Promise.all([getCharacterBySlug(slug), getCurrentUser()]);
  if (!character) notFound();

  const [rumors, events] = await Promise.all([
    listRumors({ characterId: character.id, pageSize: 3, viewerId: user?.id ?? null }),
    listEvents({ participantCharacterId: character.id, limit: 4, viewer: user }),
  ]);

  const canEdit = canEditContent(user, character.authorId);
  // L'administration modifie toutes les fiches ; celle-ci n'est pas la sienne
  // pour autant, et le bouton ne doit pas le lui faire croire.
  const isAuthor = isContentAuthor(user, character.authorId);

  const personJsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: character.name,
    url: `${SITE_URL}/personnages/${character.slug}`,
    description: character.summary ?? character.tagline ?? undefined,
    image: character.portraitUrl ?? undefined,
    jobTitle: character.occupation ?? undefined,
    homeLocation: character.homePlaceLabel
      ? { "@type": "Place", name: character.homePlaceLabel }
      : undefined,
  };

  return (
    <div className="mx-auto max-w-[1280px] px-gutter-mobile py-10 md:px-gutter-app xl:px-gutter-desktop">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(personJsonLd)} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(
          breadcrumbJsonLd([
            { name: "Registre des personnages", path: "/personnages" },
            { name: character.name, path: `/personnages/${character.slug}` },
          ]),
        )}
      />

      <Breadcrumb
        items={[
          { label: "Registre des personnages", href: "/personnages" },
          { label: character.name },
        ]}
      />

      <div className="flex flex-col gap-10 lg:flex-row lg:gap-14">
        <div className="lg:w-[320px] lg:shrink-0">
          <FramedMedia
            src={character.portraitUrl}
            alt={character.portraitAlt ?? `Portrait de ${character.name}`}
            placeholder="PORTRAIT"
            dimensions={character.portraitUrl ? undefined : "900 × 1200"}
            aspect="3 / 4"
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="mb-3 font-display text-[12px] font-medium tracking-[3.5px] text-gold-eyebrow">
            {[raceLabel(character.race, character.gender), character.title]
              .filter(Boolean)
              .join(" · ")
              .toLocaleUpperCase("fr-FR")}
          </p>
          <h1 className="font-display text-[32px] font-bold leading-[1.1] sm:text-[40px]">
            {character.name}
          </h1>

          {character.tagline ? (
            <p className="mt-4 text-[21px] italic leading-[1.55] text-ink-body">
              {character.tagline}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <RaceChip race={character.race} gender={character.gender} />
            {character.age !== null ? (
              <span className="inline-flex items-center border border-chip-edge bg-chip px-[10px] py-[7px] font-display text-[11px] font-medium tracking-[1.4px] text-gold-ink">
                {character.age} ANS
              </span>
            ) : null}
            {character.homePlaceLabel ? (
              <span className="inline-flex items-center border border-chip-edge bg-chip px-[10px] py-[7px] font-display text-[11px] font-medium tracking-[1.4px] text-gold-ink">
                {character.homePlaceLabel.toLocaleUpperCase("fr-FR")}
              </span>
            ) : null}
          </div>

          {character.summary ? (
            <p className="mt-6 max-w-[70ch] body text-ink-body">
              {character.summary}
            </p>
          ) : null}

          <div className="mt-7 flex flex-wrap items-center gap-3">
            {canEdit ? (
              <>
                <Button asChild variant="outline">
                  <Link href={`/personnages/${character.slug}/modifier`}>
                    {isAuthor ? "MODIFIER MA FICHE" : "MODIFIER LA FICHE"}
                  </Link>
                </Button>
                <DeleteContent
                  id={character.id}
                  action={deleteCharacterAction}
                  title={character.name}
                  question="Supprimer cette fiche ?"
                  consequence="La fiche quitte le registre, avec son portrait. Les rumeurs qu'elle disait restent au tableau, sans source. C'est irréversible."
                  excerpt={character.summary}
                  verb="SUPPRIMER LA FICHE"
                />
              </>
            ) : null}
            {canReportContent(user, character.authorId) ? (
              <ReportDialog
                targetType="personnage"
                targetId={character.id}
                targetSlug={character.slug}
                label={`Signaler la fiche de ${character.name}`}
                withLabel
              />
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-12 flex flex-col gap-12 lg:flex-row lg:gap-14">
        <div className="min-w-0 flex-1">
          {character.story ? (
            <section className="mb-10" aria-labelledby="histoire">
              <SectionHeading id="histoire" title="Histoire" />
              <RichText text={character.story} />
            </section>
          ) : null}

          {character.appearance ? (
            <section className="mb-10" aria-labelledby="allure">
              <SectionHeading id="allure" title="Allure et manières" />
              <RichText text={character.appearance} />
            </section>
          ) : null}

          <section className="mb-10" aria-labelledby="ce-quon-raconte">
            <SectionHeading
              id="ce-quon-raconte"
              title="Ce qu'on raconte"
              href="/rumeurs"
              linkLabel="Tableau des rumeurs"
            />
            {rumors.items.length > 0 ? (
              <ul>
                {rumors.items.map((rumor) => (
                  <RumorItem
                    key={rumor.id}
                    rumor={rumor}
                    canEcho={canContribute(user)}
                    canReport={canReportContent(user, rumor.authorId)}
                    compact
                  />
                ))}
              </ul>
            ) : (
              <EmptyState
                title="On ne dit rien encore"
              />
            )}
          </section>

          <section aria-labelledby="sur-lagenda">
            <SectionHeading
              id="sur-lagenda"
              title="Sur l'agenda"
              href="/evenements"
              linkLabel="Tout l'agenda"
            />
            {events.length > 0 ? (
              <ul>
                {events.map((event) => (
                  <EventRow key={event.id} event={event} />
                ))}
              </ul>
            ) : (
              <EmptyState title="Aucune scène à venir" />
            )}
          </section>
        </div>

        <aside className="lg:w-[320px] lg:shrink-0">
          <section className="mb-8" aria-labelledby="etat-civil">
            <SectionHeading id="etat-civil" title="État civil" compact />
            <dl className="flex flex-col">
              <Fact label="Race" value={raceLabel(character.race, character.gender)} />
              <Fact label="Naissance" value={character.birthDate} />
              <Fact
                label="Âge"
                value={character.age !== null ? `${character.age} ans` : null}
              />
              <Fact label="Origine" value={character.birthplace} />
              <Fact label="Métier" value={character.occupation} />
              <Fact label="Statut" value={character.status} />
              <Fact
                label="Région"
                value={character.region ? REGION_LABELS[character.region] : null}
              />
              <Fact
                label="Fiche mise à jour"
                value={formatTyrianDate(new Date(character.updatedAt))}
              />
            </dl>
          </section>

          {character.haunts.length > 0 ? (
            <section className="mb-8" aria-labelledby="lieux-frequentes">
              <SectionHeading id="lieux-frequentes" title="Lieux fréquentés" compact />
              <ul className="flex flex-col">
                {character.haunts.map((haunt) => (
                  <li key={haunt.id} className="border-b border-hairline py-3 last:border-b-0">
                    <Link
                      href={`/lieux/${haunt.slug}`}
                      className="font-display text-[18px] text-ink hover:underline"
                    >
                      {haunt.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="joue-par">
            <SectionHeading id="joue-par" title="Joué par" compact />
            <p className="text-[18px] text-ink">{character.author?.name ?? "[ PSEUDO DU JOUEUR ]"}</p>
            <p className="mt-1 text-[16px] text-ink-muted">
              {character.authorCharacterCount} personnage
              {character.authorCharacterCount > 1 ? "s" : ""} au registre
            </p>
          </section>
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
