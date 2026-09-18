import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/env";
import { listCharacterSlugs } from "@/server/queries/characters";
import { listEventSlugs } from "@/server/queries/events";
import { listPlaceSlugs } from "@/server/queries/places";

export const revalidate = 3600;

const STATIC_ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/carte", priority: 0.9, changeFrequency: "daily" },
  { path: "/evenements", priority: 0.9, changeFrequency: "daily" },
  { path: "/personnages", priority: 0.8, changeFrequency: "daily" },
  { path: "/lieux", priority: 0.8, changeFrequency: "daily" },
  { path: "/rumeurs", priority: 0.8, changeFrequency: "hourly" },
  { path: "/meteo", priority: 0.6, changeFrequency: "daily" },
  { path: "/inscription", priority: 0.4, changeFrequency: "yearly" },
  { path: "/regles", priority: 0.4, changeFrequency: "monthly" },
  { path: "/a-propos", priority: 0.4, changeFrequency: "monthly" },
  { path: "/signaler", priority: 0.3, changeFrequency: "monthly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const base: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  // Si la base n'est pas joignable, le plan de site reste valide avec ses seules
  // pages fixes plutôt que d'échouer.
  try {
    const [characters, places, events] = await Promise.all([
      listCharacterSlugs(),
      listPlaceSlugs(),
      listEventSlugs(),
    ]);

    return [
      ...base,
      ...characters.map(({ slug, updatedAt }) => ({
        url: `${SITE_URL}/personnages/${slug}`,
        lastModified: new Date(updatedAt),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
      ...places.map(({ slug, updatedAt }) => ({
        url: `${SITE_URL}/lieux/${slug}`,
        lastModified: new Date(updatedAt),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
      ...events.map(({ slug, updatedAt }) => ({
        url: `${SITE_URL}/evenements/${slug}`,
        lastModified: new Date(updatedAt),
        changeFrequency: "daily" as const,
        priority: 0.6,
      })),
    ];
  } catch {
    return base;
  }
}
