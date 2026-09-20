"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { PhenomeneGlyph, PlaceGlyph, WeatherGlyph } from "@/components/type-glyph";
import { MapCanvas } from "@/components/map/map-canvas";
import type { MapArea, MapPin, MapShape } from "@/components/map/tyria-map";
import { SearchIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/field";
import {
  PLACE_TYPES,
  PLACE_TYPE_LABELS,
  REGION_LABELS,
  TERRAIN_LABELS,
  WEATHER_LABELS,
  type PlaceType,
} from "@/lib/domain";
import {
  PHENOMENES,
  PHENOMENE_LABELS,
  PHENOMENE_TONES,
  type Phenomene,
} from "@/lib/weather/phenomena";
import { TERRAIN_TONES } from "@/lib/weather/tones";
import { cn } from "@/lib/utils";
import type {
  EventSummary,
  PlaceSummary,
  TerrainZoneOutline,
  WeatherArea,
  WeatherProbe,
} from "@/server/types";

/** Un point sur la carte. */
type Point = { x: number; y: number };

export function MapExplorer({
  places,
  events,
  zones,
  areas,
  initialPlaceSlug,
  canPropose,
}: {
  places: PlaceSummary[];
  events: EventSummary[];
  zones: TerrainZoneOutline[];
  areas: WeatherArea[];
  initialPlaceSlug?: string;
  canPropose: boolean;
}) {
  const [tab, setTab] = useState<"lieux" | "evenements">("lieux");
  // Deux calques indépendants, chacun affiché ou caché : les regarder ensemble
  // est justement ce qui montre pourquoi il pleut là et pas ailleurs.
  const [voirMeteo, setVoirMeteo] = useState(true);
  const [voirTerrains, setVoirTerrains] = useState(false);
  // Le point cliqué. Il est posé avant la réponse du serveur : la croix apparaît
  // sous le doigt, et le relevé la rejoint. Plus d'interrupteur à armer — un
  // clic sur la carte a toujours voulu dire « qu'est-ce qu'il y a là ? ».
  const [point, setPoint] = useState<Point | null>(null);
  const [releve, setReleve] = useState<WeatherProbe | null>(null);
  const [sondeEnCours, setSondeEnCours] = useState(false);
  const [sondeEnPanne, setSondeEnPanne] = useState(false);
  const [typeFilter, setTypeFilter] = useState<PlaceType | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    () => places.find((place) => place.slug === initialPlaceSlug)?.id ?? null,
  );

  const visiblePlaces = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return places.filter((place) => {
      if (typeFilter && place.type !== typeFilter) return false;
      if (!needle) return true;
      return (
        place.name.toLowerCase().includes(needle) ||
        (place.district ?? "").toLowerCase().includes(needle)
      );
    });
  }, [places, typeFilter, query]);

  const shapes = useMemo<MapShape[]>(
    () =>
      voirTerrains
        ? zones.map((zone) => ({
            id: zone.id,
            points: zone.points,
            tone: TERRAIN_TONES[zone.terrain],
          }))
        : [],
    [voirTerrains, zones],
  );

  // Une tache par phénomène, recousue côté serveur. L'opacité suit la pluie
  // moyenne de la tache : une averse se voit plus qu'une bruine.
  const peintes = useMemo<MapArea[]>(
    () =>
      voirMeteo
        ? areas.map((area) => ({
            id: area.id,
            anneaux: area.anneaux,
            tone: PHENOMENE_TONES[area.phenomene],
            fill: 0.14 + (area.precipitation / 100) * 0.26,
            phenomene: area.phenomene,
            libelle: PHENOMENE_LABELS[area.phenomene],
            centre: area.centre,
          }))
        : [],
    [voirMeteo, areas],
  );

  /** Ce qu'il y a réellement à l'écran, donc les phénomènes **dessinés** : une
   *  légende ne nomme jamais une teinte qui n'apparaît nulle part. Le cumul —
   *  un orage venté, une chaleur sous un ciel clair — reste lisible sur
   *  `/meteo`, qui donne des nombres plutôt que des couleurs. */
  const presents = useMemo<Phenomene[]>(() => {
    const vus = new Set(peintes.map((area) => area.phenomene as Phenomene));
    return PHENOMENES.filter((value) => vus.has(value));
  }, [peintes]);

  /** Relève le temps au point cliqué. La grille entière ne peut pas voyager
   *  jusqu'ici, donc on demande le point au serveur. */
  async function releverLePoint(clique: Point) {
    setPoint(clique);
    setReleve(null);
    setSondeEnCours(true);
    setSondeEnPanne(false);
    try {
      const reponse = await fetch(`/api/meteo/point?x=${clique.x}&y=${clique.y}`);
      if (!reponse.ok) throw new Error(String(reponse.status));
      setReleve((await reponse.json()) as WeatherProbe);
    } catch {
      // Le relevé précédent s'efface : mieux vaut rien qu'un temps d'ailleurs.
      setReleve(null);
      setSondeEnPanne(true);
    } finally {
      setSondeEnCours(false);
    }
  }

  function fermerLePoint() {
    setPoint(null);
    setReleve(null);
    setSondeEnPanne(false);
  }

  /** Un pin choisi et un point posé se disputeraient le même coin de l'écran :
   *  choisir l'un retire l'autre. */
  function choisir(id: string | null) {
    setSelectedId(id);
    if (id) fermerLePoint();
  }

  const pins = useMemo<MapPin[]>(() => {
    const placePins: MapPin[] = visiblePlaces
      .filter((place) => place.coordinates)
      .map((place) => ({
        id: place.id,
        kind: "lieu",
        type: place.type,
        name: place.name,
        meta: [PLACE_TYPE_LABELS[place.type], place.district, REGION_LABELS[place.region]]
          .filter(Boolean)
          .join(" · "),
        href: `/lieux/${place.slug}`,
        x: place.coordinates!.x,
        y: place.coordinates!.y,
        state: "lieu",
      }));

    // L'état vient du serveur : « en cours » ne doit pas changer à l'hydratation.
    const eventPins: MapPin[] = events
      .filter((event) => event.coordinates)
      .map((event) => ({
        id: `evenement-${event.id}`,
        kind: "evenement" as const,
        type: event.type,
        name: event.title,
        meta: event.locationLabel,
        href: `/evenements/${event.slug}`,
        x: event.coordinates!.x,
        y: event.coordinates!.y,
        state: event.liveStatus === "en-cours" ? ("en-cours" as const) : ("annonce" as const),
      }));

    return [...placePins, ...eventPins];
  }, [visiblePlaces, events]);

  const selectedPlace = places.find((place) => place.id === selectedId) ?? null;
  const selectedEvent =
    events.find((event) => `evenement-${event.id}` === selectedId) ?? null;

  const panneauDuPoint = point ? (
    <PointReleve
      point={point}
      releve={releve}
      enCours={sondeEnCours}
      enPanne={sondeEnPanne}
      canPropose={canPropose}
      onClose={fermerLePoint}
    />
  ) : null;

  return (
    <div className="flex flex-col lg:h-[calc(100dvh-82px)] lg:min-h-[560px] lg:flex-row-reverse">
      <div className="flex flex-col lg:min-h-0 lg:flex-1">
        <div className="relative h-[50dvh] min-h-[280px] lg:h-auto lg:flex-1">
          <MapCanvas
            pins={pins}
            shapes={shapes}
            areas={peintes}
            probe={point}
            selectedId={selectedId}
            onSelect={choisir}
            onPick={releverLePoint}
            className="size-full bg-map-land"
          />

          <div className="absolute right-3 top-3 z-[500] flex flex-col items-end gap-2 lg:right-4 lg:top-4">
            <div className="flex border-2 border-rule bg-surface">
              {(
                [
                  ["MÉTÉO", voirMeteo, setVoirMeteo],
                  ["TERRAINS", voirTerrains, setVoirTerrains],
                ] as const
              ).map(([label, actif, basculer]) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={actif}
                  onClick={() => basculer((valeur) => !valeur)}
                  className={cn(
                    // Les bascules doivent tenir sur une ligne de 320 px sans
                    // manger la carte : on serre les flancs sur téléphone.
                    "min-h-tap px-2 text-[14px] tracking-[1px] sm:px-3",
                    actif ? "bg-surface-selected text-ink" : "text-ink-muted",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {voirMeteo && presents.length > 0 ? (
              <ul className="pointer-events-none hidden flex-col gap-1 border-2 border-rule bg-surface px-3 py-2 lg:flex">
                {presents.map((value) => (
                  <LigneDeLegende key={value} phenomene={value} />
                ))}
              </ul>
            ) : null}
          </div>

          {selectedPlace ? (
            <DetailPanel
              title={selectedPlace.name}
              meta={[
                PLACE_TYPE_LABELS[selectedPlace.type],
                selectedPlace.district,
                REGION_LABELS[selectedPlace.region],
              ]
                .filter(Boolean)
                .join(" · ")}
              note={
                selectedPlace.upcomingEventCount > 0
                  ? `${selectedPlace.upcomingEventCount} évènement${
                      selectedPlace.upcomingEventCount > 1 ? "s" : ""
                    } à venir`
                  : null
              }
              href={`/lieux/${selectedPlace.slug}`}
              onClose={() => setSelectedId(null)}
            />
          ) : selectedEvent ? (
            <DetailPanel
              title={selectedEvent.title}
              meta={selectedEvent.locationLabel}
              note={`${selectedEvent.registeredCount} inscrit${
                selectedEvent.registeredCount > 1 ? "s" : ""
              }`}
              href={`/evenements/${selectedEvent.slug}`}
              onClose={() => setSelectedId(null)}
            />
          ) : null}

          {/* Sur grand écran le relevé se pose dans le coin ; sous `lg` il
              descend dans la bande, comme la légende. */}
          {panneauDuPoint ? (
            <div className="pointer-events-none absolute left-4 top-4 z-[600] hidden w-[320px] lg:block">
              {panneauDuPoint}
            </div>
          ) : null}
        </div>

        {/* Sous la carte plutôt que par-dessus : à 390 px, un panneau en
            surimpression masquait les deux tiers de la carte. La légende tient
            sur une ligne qui se replie, le relevé sur un cartouche pleine
            largeur — rien n'est retiré, tout descend. */}
        {panneauDuPoint || (voirMeteo && presents.length > 0) ? (
          <div className="flex shrink-0 flex-col gap-2 border-t-2 border-rule bg-surface py-3 lg:hidden">
            {voirMeteo && presents.length > 0 ? (
              <ul className="flex flex-wrap gap-x-4 gap-y-1 px-gutter-app">
                {presents.map((value) => (
                  <LigneDeLegende key={value} phenomene={value} />
                ))}
              </ul>
            ) : null}

            {panneauDuPoint ? <div className="px-gutter-app">{panneauDuPoint}</div> : null}
          </div>
        ) : null}
      </div>

      {/* La liste vient après la carte **dans le DOM**, pas seulement à
          l'écran : `order` déplace l'affichage sans toucher à l'ordre de
          lecture ni de tabulation, et un lecteur d'écran aurait annoncé la
          liste d'abord. Le conteneur s'inverse à partir de `lg` pour la
          ramener à gauche.

          Elle se déroule avec la page sur un téléphone : c'est elle qui
          poussait la carte à mille pixels du haut, et la borner en hauteur
          n'aurait fait que la réduire à une ligne et demie — son en-tête en
          prend déjà cent quatre-vingts. */}
      <aside className="flex w-full min-h-0 shrink-0 flex-col border-t-2 border-rule bg-surface lg:h-full lg:w-[380px] lg:border-t-0 lg:border-r-2">
        <div className="flex border-b border-rule">
          <TabButton active={tab === "lieux"} onClick={() => setTab("lieux")}>
            LIEUX · {places.length}
          </TabButton>
          <TabButton active={tab === "evenements"} onClick={() => setTab("evenements")}>
            ÉVÈNEMENTS · {events.length}
          </TabButton>
        </div>

        {/* La recherche et les filtres tiennent en deux lignes : empilés en
            grille, les huit types de lieu prenaient trois rangs et repoussaient
            la liste hors de l'écran. Ils défilent maintenant à l'horizontale,
            et c'est la liste qui occupe la colonne. */}
        <div className="flex flex-col gap-2 border-b border-rule py-2">
          <div className="mx-gutter-app flex items-center gap-2 border border-rule bg-surface-inset px-3">
            <SearchIcon size={16} className="text-ink-muted" />
            <Label htmlFor="recherche-carte" hidden>
              Rechercher sur la carte
            </Label>
            <input
              id="recherche-carte"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Taverne, guilde, ruine…"
              className="min-h-tap w-full bg-transparent text-[17px] text-ink placeholder:text-ink-subtle focus-visible:outline-none"
            />
          </div>

          {tab === "lieux" ? (
            <fieldset className="flex gap-2 overflow-x-auto border-0 px-gutter-app pb-1">
              <legend className="sr-only">Filtrer par type de lieu</legend>
              <FilterButton active={!typeFilter} onClick={() => setTypeFilter(null)}>
                TOUS
              </FilterButton>
              {PLACE_TYPES.map((type) => (
                <FilterButton
                  key={type}
                  active={typeFilter === type}
                  onClick={() => setTypeFilter(type)}
                >
                  {PLACE_TYPE_LABELS[type].toLocaleUpperCase("fr-FR")}
                </FilterButton>
              ))}
            </fieldset>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto">
          {tab === "lieux" ? (
            visiblePlaces.length > 0 ? (
              <ul>
                {visiblePlaces.map((place) => (
                  <li key={place.id}>
                    <button
                      type="button"
                      onClick={() => choisir(place.id)}
                      aria-pressed={selectedId === place.id}
                      className={cn(
                        "flex w-full items-center gap-3 border-b border-hairline px-gutter-app py-4 text-left",
                        selectedId === place.id
                          ? "bg-surface-selected"
                          : "hover:bg-surface-selected",
                      )}
                    >
                      <span className="inline-flex size-[34px] shrink-0 items-center justify-center rounded-full border border-gold bg-surface text-gold-ink">
                        <PlaceGlyph type={place.type} size={15} />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-display text-[18px] text-ink">
                          {place.name}
                        </span>
                        <span className="block text-[16px] text-ink-muted">
                          {[PLACE_TYPE_LABELS[place.type], place.district]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                        {place.upcomingEventCount > 0 ? (
                          <span className="block text-[15px] text-crimson-ink">
                            {place.upcomingEventCount} évènement
                            {place.upcomingEventCount > 1 ? "s" : ""} à venir
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-gutter-app py-8 text-[17px] text-ink-muted">
                Aucun lieu ne répond à ce filtre. Retirez-en un, ou proposez le vôtre.
              </p>
            )
          ) : events.length > 0 ? (
            <ul>
              {events.map((event) => (
                <li key={event.id}>
                  <button
                    type="button"
                    onClick={() => choisir(`evenement-${event.id}`)}
                    aria-pressed={selectedId === `evenement-${event.id}`}
                    className={cn(
                      "flex w-full flex-col gap-1 border-b border-hairline px-gutter-app py-4 text-left",
                      selectedId === `evenement-${event.id}`
                        ? "bg-surface-selected"
                        : "hover:bg-surface-selected",
                    )}
                  >
                    <span className="font-display text-[18px] text-ink">{event.title}</span>
                    <span className="text-[16px] text-ink-muted">{event.locationLabel}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-gutter-app py-8 text-[17px] text-ink-muted">
              Aucun évènement n'est annoncé sur la carte pour l'instant.
            </p>
          )}
        </div>

        {/* Un pied de colonne sur une ligne : le bouton pleine largeur et le
            lien qui le suivait prenaient à eux deux la hauteur de trois lieux. */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-rule px-gutter-app py-2">
          <p className="text-[15px] text-ink-muted">
            {tab === "lieux"
              ? `${visiblePlaces.length} sur ${places.length} lieux`
              : `${events.length} évènement${events.length > 1 ? "s" : ""}`}
          </p>
          <div className="flex items-center gap-3">
            <Link
              href="/meteo"
              className="text-[15px] text-ink-muted underline-offset-4 hover:text-ink hover:underline"
            >
              La météo
            </Link>
            <Button asChild variant="outline" size="sm">
              <Link
                href={proposerHref(
                  tab === "lieux" ? "/lieux/nouveau" : "/evenements/nouveau",
                  canPropose,
                )}
              >
                {tab === "lieux" ? "PROPOSER UN LIEU" : "PROPOSER UNE SCÈNE"}
              </Link>
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}

/** Où mène une proposition : la page qui la reçoit, ou la connexion qui y ramène
 *  — avec le point, sinon il faudrait le repointer après s'être connecté. */
function proposerHref(chemin: string, canPropose: boolean): string {
  return canPropose ? chemin : `/connexion?suite=${encodeURIComponent(chemin)}`;
}

function LigneDeLegende({ phenomene }: { phenomene: Phenomene }) {
  return (
    <li className="flex items-center gap-2 text-[15px] text-ink-body">
      <PhenomeneGlyph
        phenomene={phenomene}
        size={16}
        className={`gw2rp-legende gw2rp-legende--${PHENOMENE_TONES[phenomene]}`}
      />
      {PHENOMENE_LABELS[phenomene]}
    </li>
  );
}

/**
 * Le point cliqué : le temps qu'il y fait, et ce qu'on peut y poser.
 *
 * Le relevé vient de `/api/meteo/point` — la grille entière ne peut pas voyager
 * jusqu'au navigateur, un relevé si. Tant qu'il n'est pas là, le cartouche ne
 * montre aucun chiffre : pas de tiret qui ferait croire à une mesure. Une
 * cellule hors région garde ses grandeurs — le ciel existe aussi au large.
 *
 * Les trois propositions partent avec les coordonnées : le formulaire s'ouvre
 * avec son point déjà posé, plutôt que de faire repointer la carte. La rumeur
 * n'a pas de point à elle ; elle emporte la région du relevé, qui est ce que le
 * tableau des rumeurs sait retenir d'un endroit.
 */
function PointReleve({
  point,
  releve,
  enCours,
  enPanne,
  canPropose,
  onClose,
}: {
  point: Point;
  releve: WeatherProbe | null;
  enCours: boolean;
  enPanne: boolean;
  canPropose: boolean;
  onClose: () => void;
}) {
  const coordonnees = `x=${point.x}&y=${point.y}`;
  const rumeur = releve?.region ? `/rumeurs?ou=${releve.region}#colporter` : "/rumeurs#colporter";

  return (
    <div className="pointer-events-auto w-full border-2 border-crimson-edge bg-surface p-3">
      <div aria-live="polite">
        {enPanne ? (
          <p className="text-[15px] text-crimson-ink">Le relevé n&apos;a pas abouti.</p>
        ) : enCours || !releve ? (
          <p className="text-[15px] text-ink-muted">Relevé…</p>
        ) : (
          <>
            <p className="flex items-center gap-2 text-[15px] text-ink-body">
              <WeatherGlyph condition={releve.condition} size={18} className="text-rain" />
              {WEATHER_LABELS[releve.condition]}
              {releve.region ? ` · ${REGION_LABELS[releve.region]}` : " · hors région"}
            </p>
            <p className="mt-1 text-[15px] text-ink-muted">
              {TERRAIN_LABELS[releve.terrain]} · {releve.temperature} °C · {releve.humidite} %
              {" · "}
              {releve.vent} km/h · {releve.pression} hPa
            </p>
            {releve.phenomenes.length > 0 ? (
              <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                {releve.phenomenes.map((value) => (
                  <LigneDeLegende key={value} phenomene={value} />
                ))}
              </ul>
            ) : null}
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-hairline pt-3">
        <Button asChild variant="outline" size="sm">
          <Link href={proposerHref(`/lieux/nouveau?${coordonnees}`, canPropose)}>UN LIEU</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={proposerHref(`/evenements/nouveau?${coordonnees}`, canPropose)}>
            UNE SCÈNE
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={rumeur}>UNE RUMEUR</Link>
        </Button>
        <Button type="button" variant="quiet" size="sm" onClick={onClose}>
          FERMER
        </Button>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex-1 border-r border-rule px-4 py-4 font-display text-[12px] font-semibold tracking-[1.6px] last:border-r-0",
        active ? "bg-gold-ink text-on-crimson" : "text-gold-ink hover:bg-surface-selected",
      )}
    >
      {children}
    </button>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-tap shrink-0 items-center whitespace-nowrap border px-3 py-[11px] font-display text-[11px] font-medium tracking-[1.4px]",
        active
          ? "border-gold-ink bg-gold-ink text-on-crimson"
          : "border-chip-edge text-gold-ink hover:bg-surface-selected",
      )}
    >
      {children}
    </button>
  );
}

/** L'infobulle du pin choisi : cartouche bordé 2 px `gold`, titre, méta, actions. */
function DetailPanel({
  title,
  meta,
  note,
  href,
  onClose,
}: {
  title: string;
  meta: string;
  note: string | null;
  href: string;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-x-4 bottom-4 z-[600] w-auto border-2 border-gold bg-surface p-5 sm:left-4 sm:w-[318px]">
      <h2 className="card-title">{title}</h2>
      <p className="mt-1 text-[16px] text-ink-muted">{meta}</p>
      {note ? <p className="mt-1 text-[16px] text-crimson-ink">{note}</p> : null}
      <div className="mt-4 flex gap-3">
        <Button asChild size="sm">
          <Link href={href}>VOIR LA FICHE</Link>
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          FERMER
        </Button>
      </div>
    </div>
  );
}
