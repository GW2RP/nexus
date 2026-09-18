import type { Metadata } from "next";
import Link from "next/link";

import { CharacterCard } from "@/components/content/character-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChips } from "@/components/ui/filter-chips";
import { LoadMore } from "@/components/ui/load-more";
import { PageHeader } from "@/components/ui/page-header";
import { SearchToolbar } from "@/components/ui/search-toolbar";
import { RACES, RACE_LABELS, type Race } from "@/lib/domain";
import { canContribute } from "@/lib/permissions";
import { SITE_URL, buildMetadata, jsonLdScript } from "@/lib/seo";
import { getCurrentUser } from "@/lib/session";
import { countCharacters, listCharacters, type CharacterSort } from "@/server/queries/characters";

export const metadata: Metadata = buildMetadata({
  title: "Registre des personnages",
  description:
    "Les fiches de personnages tenues par la communauté : humains, charrs, norns, asuras et sylvaris qui font vivre le jeu de rôle en Tyrie.",
  path: "/personnages",
  keywords: ["personnages RP GW2", "fiche de personnage Guild Wars 2", "registre RP"],
});

const SORT_OPTIONS = [
  { value: "recents", label: "Fiches récentes" },
  { value: "alphabetique", label: "Ordre alphabétique" },
  { value: "anciens", label: "Plus anciens en jeu" },
];

export default async function CharactersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();

  const race = typeof params.race === "string" ? (params.race as Race) : undefined;
  const sort = typeof params.tri === "string" ? (params.tri as CharacterSort) : "recents";
  const page = Number(params.page ?? 1) || 1;

  const [{ items, total, hasMore }, counts] = await Promise.all([
    listCharacters({
      query: typeof params.q === "string" ? params.q : undefined,
      race: RACES.includes(race as Race) ? race : undefined,
      sort: SORT_OPTIONS.some((option) => option.value === sort) ? sort : "recents",
      withPortrait: params.portrait === "1",
      page,
      pageSize: 12 * page,
    }),
    countCharacters(),
  ]);

  const listJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Registre des personnages",
    url: `${SITE_URL}/personnages`,
    inLanguage: "fr-FR",
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: total,
      itemListElement: items.slice(0, 20).map((character, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${SITE_URL}/personnages/${character.slug}`,
        name: character.name,
      })),
    },
  };

  return (
    <div className="mx-auto max-w-[1280px] px-gutter-mobile py-10 lg:px-gutter-desktop">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(listJsonLd)} />

      <PageHeader
        title="Registre des personnages"
        subtitle={
          counts.total > 0
            ? `${counts.total} fiche${counts.total > 1 ? "s" : ""} · ${counts.recent} cette saison`
            : undefined
        }
        action={
          <Button asChild size="lead">
            <Link href={canContribute(user) ? "/personnages/nouveau" : "/connexion"}>
              CRÉER UN PERSONNAGE
            </Link>
          </Button>
        }
      />

      <SearchToolbar
        searchLabel="Rechercher un personnage"
        searchPlaceholder="Nom, titre, guilde…"
        sortOptions={SORT_OPTIONS}
        toggles={[{ name: "portrait", label: "Avec portrait" }]}
      />

      <FilterChips
        name="race"
        legend="Filtrer par race"
        allLabel="TOUTES LES RACES"
        options={RACES.map((value) => ({
          value,
          label: RACE_LABELS[value].neutre.toLocaleUpperCase("fr-FR"),
        }))}
        className="mb-8"
      />

      {items.length > 0 ? (
        <>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {items.map((character) => (
              <li key={character.id} className="flex">
                <CharacterCard character={character} />
              </li>
            ))}
          </ul>
          <LoadMore page={page} hasMore={hasMore} searchParams={params} />
        </>
      ) : (
        <EmptyState
          title="Aucune fiche ne correspond"
          action={
            <Button asChild variant="outline">
              <Link href={canContribute(user) ? "/personnages/nouveau" : "/connexion"}>
                CRÉER UN PERSONNAGE
              </Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
