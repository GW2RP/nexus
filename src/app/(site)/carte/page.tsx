import type { Metadata } from "next";

import { MapExplorer } from "@/components/map/map-explorer";
import { canContribute } from "@/lib/permissions";
import { buildMetadata } from "@/lib/seo";
import { getCurrentUser } from "@/lib/session";
import { listEvents } from "@/server/queries/events";
import { listPlacesForMap } from "@/server/queries/places";
import { getCurrentWeather, getWeatherCells, listTerrainZones } from "@/server/queries/weather";

export const metadata: Metadata = buildMetadata({
  title: "La carte de Tyrie",
  description:
    "Les lieux et les évènements du hub, épinglés sur les cartes de Guild Wars 2. L'overlay météo évolue au fil des saisons tyriennes.",
  path: "/carte",
  keywords: ["carte Guild Wars 2 RP", "lieux RP Tyrie", "météo tyrienne"],
});

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ lieu?: string; evenement?: string }>;
}) {
  const { lieu } = await searchParams;
  const user = await getCurrentUser();

  const [places, events, weather, zones, cells] = await Promise.all([
    listPlacesForMap(),
    listEvents({ viewerId: user?.id ?? null, limit: 60 }),
    getCurrentWeather(),
    listTerrainZones(),
    getWeatherCells(),
  ]);

  return (
    <>
      <h1 className="sr-only">La carte de Tyrie</h1>
      <MapExplorer
        places={places}
        events={events}
        weather={weather}
        zones={zones}
        cells={cells}
        initialPlaceSlug={lieu}
        canPropose={canContribute(user)}
      />
    </>
  );
}
