import type { Metadata } from "next";
import Link from "next/link";

import { RumorItem } from "@/components/content/rumor-item";
import { RumorForm } from "@/components/forms/rumor-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChips } from "@/components/ui/filter-chips";
import { LoadMore } from "@/components/ui/load-more";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeading } from "@/components/ui/section-heading";
import { REGIONS, REGION_LABELS, type Region } from "@/lib/domain";
import { canContribute, canReportContent } from "@/lib/permissions";
import { buildMetadata } from "@/lib/seo";
import { getCurrentUser } from "@/lib/session";
import { listCharactersOf } from "@/server/queries/characters";
import { listPlaceOptions } from "@/server/queries/places";
import { listRumors, listTopRumors, type RumorSort } from "@/server/queries/rumors";

export const metadata: Metadata = buildMetadata({
  title: "Tableau des rumeurs",
  description:
    "Ce qui se dit dans les tavernes et sur les quais de Tyrie. Vrai, faux, ou pas encore décidé — les rumeurs sont dites par des personnages, jamais par des joueurs.",
  path: "/rumeurs",
  keywords: ["rumeurs RP Guild Wars 2", "tableau des rumeurs GW2", "RP Tyrie"],
});

export const revalidate = 120;

export default async function RumorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();

  const region = typeof params.region === "string" ? (params.region as Region) : undefined;
  const sort = params.tri === "reprises" ? "reprises" : "recentes";
  const page = Number(params.page ?? 1) || 1;

  const [{ items, hasMore }, top, characters, places] = await Promise.all([
    listRumors({
      region: REGIONS.includes(region as Region) ? region : undefined,
      sort: sort as RumorSort,
      page,
      pageSize: 10 * page,
      viewerId: user?.id ?? null,
    }),
    listTopRumors(3),
    user ? listCharactersOf(user.id) : Promise.resolve([]),
    listPlaceOptions(),
  ]);

  const sortQuery = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && key !== "tri" && key !== "page") sortQuery.set(key, value);
  }

  return (
    <div className="mx-auto max-w-[1280px] px-gutter-mobile py-10 lg:px-gutter-desktop">
      <PageHeader
        title="Tableau des rumeurs"
        subtitle="Ce qui se dit dans les tavernes et sur les quais. Vrai, faux, ou pas encore décidé."
      />

      <div className="mb-8 flex flex-wrap items-center gap-6">
        <FilterChips
          name="region"
          legend="Filtrer par région"
          allLabel="TOUTE LA TYRIE"
          options={REGIONS.map((value) => ({
            value,
            label: REGION_LABELS[value].toLocaleUpperCase("fr-FR"),
          }))}
        />
        <nav aria-label="Trier les rumeurs" className="flex items-center gap-4 text-[17px]">
          <SortLink
            href={sortQuery.toString() ? `/rumeurs?${sortQuery}` : "/rumeurs"}
            active={sort === "recentes"}
          >
            Les plus récentes
          </SortLink>
          <SortLink
            href={`/rumeurs?${new URLSearchParams({
              ...Object.fromEntries(sortQuery),
              tri: "reprises",
            })}`}
            active={sort === "reprises"}
          >
            Les plus reprises
          </SortLink>
        </nav>
      </div>

      <div className="flex flex-col gap-12 lg:flex-row lg:gap-14">
        <div className="min-w-0 flex-1">
          {items.length > 0 ? (
            <>
              <ul>
                {items.map((rumor) => (
                  <RumorItem
                    key={rumor.id}
                    rumor={rumor}
                    canEcho={canContribute(user)}
                    canReport={canReportContent(user, rumor.authorId)}
                  />
                ))}
              </ul>
              <LoadMore
                page={page}
                hasMore={hasMore}
                searchParams={params}
                label="CHARGER LES RUMEURS PLUS ANCIENNES"
              />
            </>
          ) : (
            <EmptyState
              title="Le tableau est vide"
              description="Rien ne se dit encore. Une rumeur est dite par un personnage, pas par un joueur : elle peut être fausse, et c'est le but."
            />
          )}
        </div>

        <aside className="lg:w-[340px] lg:shrink-0">
          <Card accent className="mb-8 gap-4 p-6">
            <h2 className="font-display text-[18px] font-semibold tracking-[1px]">
              CE QUE VOUS AVEZ ENTENDU DIRE
            </h2>
            {user ? (
              canContribute(user) ? (
                <RumorForm characters={characters} places={places} />
              ) : (
                <p className="text-[17px] leading-[1.5] text-ink-body">
                  Votre compte est suspendu : vous ne pouvez plus colporter de rumeur.
                </p>
              )
            ) : (
              <>
                <p className="text-[17px] leading-[1.5] text-ink-body">
                  Colporter une rumeur demande un compte et un personnage au registre.
                </p>
                <Button asChild variant="outline">
                  <Link href="/connexion?suite=/rumeurs">SE CONNECTER</Link>
                </Button>
              </>
            )}
          </Card>

          {top.length > 0 ? (
            <section className="mb-8" aria-labelledby="plus-reprises">
              <SectionHeading id="plus-reprises" title="Les plus reprises" compact />
              <ol className="flex flex-col">
                {top.map((rumor, index) => (
                  <li
                    key={rumor.id}
                    className="flex items-start gap-3 border-b border-hairline py-3 last:border-b-0"
                  >
                    <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-gold font-display text-[13px] font-bold text-gold-ink">
                      {index + 1}
                    </span>
                    <span>
                      <span className="block text-[17px] italic leading-[1.45] text-ink-body">
                        {rumor.body.length > 90 ? `${rumor.body.slice(0, 90)}…` : rumor.body}
                      </span>
                      <span className="block text-[15px] text-ink-muted">
                        {rumor.echoCount} reprise{rumor.echoCount > 1 ? "s" : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <section aria-labelledby="comment-ca-marche">
            <SectionHeading id="comment-ca-marche" title="Comment ça marche" compact />
            <ul className="flex flex-col gap-3 text-[17px] leading-[1.5] text-ink-body">
              <li>
                Une rumeur est dite par un personnage, pas par un joueur : elle peut être
                fausse, et c'est le but.
              </li>
              <li>
                La reprendre la fait monter dans les plus reprises — et elle circulera
                davantage en jeu.
              </li>
              <li>
                Viser un joueur plutôt qu'un personnage, c'est le drapeau : l'équipe regarde
                sous 24 h.
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

function SortLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={
        active
          ? "text-ink underline decoration-gold decoration-2 underline-offset-8"
          : "text-ink-muted hover:text-ink"
      }
    >
      {children}
    </Link>
  );
}
