import type {
  EventType,
  Gender,
  PlaceType,
  Race,
  Region,
  ReportReason,
  ReportStatus,
  ReportTarget,
  WeatherCondition,
} from "@/lib/domain";

/** Les formes sérialisées que les composants reçoivent : des objets simples,
 *  jamais des documents Mongoose. */

export type AuthorSummary = { id: string; name: string };

export type CharacterSummary = {
  id: string;
  slug: string;
  name: string;
  race: Race;
  gender: Gender;
  age: number | null;
  title: string | null;
  summary: string | null;
  homePlaceLabel: string | null;
  portraitUrl: string | null;
  portraitAlt: string | null;
  authorId: string;
};

export type CharacterDetail = CharacterSummary & {
  tagline: string | null;
  story: string | null;
  appearance: string | null;
  birthplace: string | null;
  birthDate: string | null;
  occupation: string | null;
  status: string | null;
  region: Region | null;
  updatedAt: string;
  createdAt: string;
  author: AuthorSummary | null;
  authorCharacterCount: number;
  haunts: { id: string; slug: string; name: string; note: string | null }[];
};

export type PlaceSummary = {
  id: string;
  slug: string;
  name: string;
  type: PlaceType;
  region: Region;
  district: string | null;
  summary: string | null;
  bannerUrl: string | null;
  bannerAlt: string | null;
  coordinates: { x: number; y: number } | null;
  upcomingEventCount: number;
  authorId: string;
};

export type FloorPoint = {
  number: number;
  label: string;
  description: string | null;
  x: number;
  y: number;
};

export type PlaceDetail = PlaceSummary & {
  description: string | null;
  access: string | null;
  logoUrl: string | null;
  floorPlan: {
    imageUrl: string | null;
    imageAlt: string | null;
    width: number | null;
    height: number | null;
    points: FloorPoint[];
  } | null;
  keeper: { id: string; slug: string; name: string } | null;
  author: AuthorSummary | null;
  createdAt: string;
  updatedAt: string;
};

export type EventSummary = {
  id: string;
  slug: string;
  title: string;
  type: EventType;
  summary: string | null;
  startsAt: string;
  endsAt: string | null;
  region: Region | null;
  locationLabel: string;
  place: { id: string; slug: string; name: string } | null;
  coordinates: { x: number; y: number } | null;
  capacity: number | null;
  registeredCount: number;
  /** L'état du compte qui lit la page, s'il en a un. */
  viewerStatus: "inscrit" | "liste-attente" | null;
  /** Où en est la scène au moment de la requête. Calculé côté serveur pour que
   *  le pin de carte soit le même avant et après l'hydratation. */
  liveStatus: "annonce" | "en-cours" | "passe";
  authorId: string;
  bannerUrl: string | null;
  pinned: boolean;
};

export type EventDetail = EventSummary & {
  description: string | null;
  practicalNotes: string[];
  bannerAlt: string | null;
  organiser: { id: string; slug: string; name: string; race: Race; gender: Gender; age: number | null; title: string | null } | null;
  author: AuthorSummary | null;
  placeDetail: { id: string; slug: string; name: string; district: string | null; summary: string | null; region: Region } | null;
  participants: { id: string; name: string; slug: string; race: Race; gender: Gender }[];
  createdAt: string;
  updatedAt: string;
};

export type RumorSummary = {
  id: string;
  body: string;
  character: { id: string; slug: string; name: string } | null;
  place: { id: string; slug: string; name: string } | null;
  heardAtLabel: string | null;
  region: Region | null;
  echoCount: number;
  viewerHasEchoed: boolean;
  authorId: string;
  createdAt: string;
};

export type WeatherEntry = {
  id: string;
  region: Region;
  condition: WeatherCondition;
  intensity: number;
  startsAt: string;
  endsAt: string;
  note: string | null;
};

export type ReportRow = {
  id: string;
  targetType: ReportTarget;
  targetId: string;
  targetSlug: string | null;
  targetExcerpt: string | null;
  reason: ReportReason;
  comment: string | null;
  status: ReportStatus;
  reporter: AuthorSummary | null;
  /** Les autres signalements qui visent le même contenu. */
  siblingCount: number;
  createdAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
  resolvedBy: AuthorSummary | null;
};
