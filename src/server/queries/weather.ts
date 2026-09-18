import "server-only";

import type { Region, WeatherCondition } from "@/lib/domain";
import { Weather } from "@/models/weather";
import { connectToDatabase, toIso } from "@/server/queries/shared";
import type { WeatherEntry } from "@/server/types";

function toEntry(doc: { _id: unknown } & Record<string, unknown>): WeatherEntry {
  return {
    id: String(doc._id),
    region: doc.region as Region,
    condition: doc.condition as WeatherCondition,
    intensity: typeof doc.intensity === "number" ? doc.intensity : 50,
    startsAt: toIso(doc.startsAt),
    endsAt: toIso(doc.endsAt),
    note: (doc.note as string | undefined) ?? null,
  };
}

/** La météo en cours, une entrée par région au plus. */
export async function getCurrentWeather(): Promise<WeatherEntry[]> {
  await connectToDatabase();
  const now = new Date();
  const docs = await Weather.find({ startsAt: { $lte: now }, endsAt: { $gte: now } })
    .sort({ startsAt: -1 })
    .lean();

  const byRegion = new Map<string, WeatherEntry>();
  for (const doc of docs) {
    const entry = toEntry(doc as { _id: unknown } & Record<string, unknown>);
    if (!byRegion.has(entry.region)) byRegion.set(entry.region, entry);
  }
  return [...byRegion.values()];
}

/** La frise de saison : ce qui est annoncé pour les semaines à venir. */
export async function getUpcomingWeather(limit = 12): Promise<WeatherEntry[]> {
  await connectToDatabase();
  const docs = await Weather.find({ endsAt: { $gte: new Date() } })
    .sort({ startsAt: 1 })
    .limit(limit)
    .lean();
  return docs.map((doc) => toEntry(doc as { _id: unknown } & Record<string, unknown>));
}

export async function getWeatherForRegion(region: Region): Promise<WeatherEntry | null> {
  await connectToDatabase();
  const now = new Date();
  const doc = await Weather.findOne({ region, startsAt: { $lte: now }, endsAt: { $gte: now } })
    .sort({ startsAt: -1 })
    .lean();
  return doc ? toEntry(doc as { _id: unknown } & Record<string, unknown>) : null;
}
