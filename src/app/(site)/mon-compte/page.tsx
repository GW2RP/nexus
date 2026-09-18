import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CharacterRow } from "@/components/content/character-card";
import { EventRow } from "@/components/content/event-row";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeading } from "@/components/ui/section-heading";
import { ROLE_LABELS } from "@/lib/domain";
import { isSuspended } from "@/lib/permissions";
import { buildMetadata } from "@/lib/seo";
import { getCurrentUser } from "@/lib/session";
import { formatLongDate } from "@/lib/dates";
import { listCharactersOf } from "@/server/queries/characters";
import { listEvents } from "@/server/queries/events";
import { listPlaces } from "@/server/queries/places";

export const metadata: Metadata = buildMetadata({
  title: "Mon compte",
  description: "Vos personnages, vos lieux et vos inscriptions sur le hub GW2RP Nexus.",
  path: "/mon-compte",
  noIndex: true,
});

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?suite=/mon-compte");

  const [characters, places, registrations, authored] = await Promise.all([
    listCharactersOf(user.id),
    listPlaces({ authorId: user.id, pageSize: 24 }),
    listEvents({ registeredFor: user.id, viewerId: user.id, limit: 20 }),
    listEvents({ authorId: user.id, viewerId: user.id, includePast: true, limit: 20 }),
  ]);

  return (
    <div className="mx-auto max-w-[1280px] px-gutter-mobile py-10 lg:px-gutter-desktop">
      <PageHeader
        eyebrow={ROLE_LABELS[user.role].toLocaleUpperCase("fr-FR")}
        title={user.name}
        subtitle={user.email}
        action={
          <SignOutButton className="inline-flex min-h-tap items-center border border-gold px-5 py-4 font-display text-[12px] font-semibold uppercase tracking-[1.6px] text-gold-ink hover:bg-surface-selected" />
        }
      />

      {isSuspended(user) ? (
        <Card accent className="mb-10 gap-2 p-6">
          <p className="font-display text-[18px] font-semibold tracking-[1px] text-crimson-ink">
            COMPTE SUSPENDU
          </p>
          <p className="text-[18px] leading-[1.55] text-ink-body">
            Votre compte est suspendu jusqu'au {formatLongDate(user.suspendedUntil!)}. Vous
            pouvez lire le hub, mais plus y publier ni vous inscrire. Écrivez à l'équipe si
            vous pensez que c'est une erreur.
          </p>
        </Card>
      ) : null}

      <div className="flex flex-col gap-12 lg:flex-row lg:gap-14">
        <div className="min-w-0 flex-1">
          <section className="mb-10" aria-labelledby="mes-personnages">
            <SectionHeading
              id="mes-personnages"
              title="Mes personnages"
              href="/personnages/nouveau"
              linkLabel="Créer une fiche"
            />
            {characters.length > 0 ? (
              <ul>
                {characters.map((character) => (
                  <CharacterRow key={character.id} character={character} />
                ))}
              </ul>
            ) : (
              <EmptyState
                title="Aucune fiche à votre nom"
                action={
                  <Button asChild variant="outline">
                    <Link href="/personnages/nouveau">CRÉER UN PERSONNAGE</Link>
                  </Button>
                }
              />
            )}
          </section>

          <section className="mb-10" aria-labelledby="mes-inscriptions">
            <SectionHeading id="mes-inscriptions" title="Mes inscriptions" />
            {registrations.length > 0 ? (
              <ul>
                {registrations.map((event) => (
                  <EventRow key={event.id} event={event} />
                ))}
              </ul>
            ) : (
              <EmptyState
                title="Aucune scène à venir"
                action={
                  <Button asChild variant="outline">
                    <Link href="/evenements">VOIR L'AGENDA</Link>
                  </Button>
                }
              />
            )}
          </section>

          <section aria-labelledby="mes-annonces">
            <SectionHeading
              id="mes-annonces"
              title="Mes annonces"
              href="/evenements/nouveau"
              linkLabel="Proposer un évènement"
            />
            {authored.length > 0 ? (
              <ul>
                {authored.map((event) => (
                  <EventRow key={event.id} event={event} />
                ))}
              </ul>
            ) : (
              <EmptyState title="Vous n'avez rien annoncé" />
            )}
          </section>
        </div>

        <aside className="lg:w-[320px] lg:shrink-0">
          <section className="mb-8" aria-labelledby="mes-lieux">
            <SectionHeading
              id="mes-lieux"
              title="Mes lieux"
              href="/lieux/nouveau"
              linkLabel="Proposer un lieu"
              compact
            />
            {places.items.length > 0 ? (
              <ul className="flex flex-col">
                {places.items.map((place) => (
                  <li key={place.id} className="border-b border-hairline py-3 last:border-b-0">
                    <Link
                      href={`/lieux/${place.slug}`}
                      className="font-display text-[18px] text-ink hover:underline"
                    >
                      {place.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[17px] text-ink-muted">Aucun lieu posé à votre nom.</p>
            )}
          </section>

          <section aria-labelledby="mon-role">
            <SectionHeading id="mon-role" title="Mon rôle" compact />
            <p className="text-[18px] text-ink">{ROLE_LABELS[user.role]}</p>
            <p className="mt-2 text-[16px] leading-[1.45] text-ink-muted">
              {user.role === "membre"
                ? "Vous créez et modifiez votre contenu, vous vous inscrivez aux scènes et vous signalez ce qui pose problème."
                : user.role === "conteur"
                  ? "En plus d'un membre : vous posez la météo d'une région et vous épinglez un évènement sur la carte."
                  : "En plus d'un conteur : vous tenez la file des signalements et le journal de modération."}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
