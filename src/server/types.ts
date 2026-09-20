import type {
  EventType,
  Gender,
  PlaceType,
  Race,
  Region,
  ReportReason,
  ReportStatus,
  ReportTarget,
  Terrain,
  WeatherCondition,
} from "@/lib/domain";
import type { Phenomene } from "@/lib/weather/phenomena";

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
  /** Les personnages qui le tiennent, dans l'ordre où l'auteur les a rangés. */
  keepers: { id: string; slug: string; name: string }[];
  /** Les comptes qui le modifient avec son auteur. */
  managers: AuthorSummary[];
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
  /** Le personnage qui la dit, quand elle en a un. */
  character: { id: string; slug: string; name: string } | null;
  /** Le compte qui l'a colportée : c'est lui qu'on cite quand il n'y a pas de source. */
  author: AuthorSummary | null;
  place: { id: string; slug: string; name: string } | null;
  heardAtLabel: string | null;
  region: Region | null;
  /** Le point sur la carte, quand la rumeur en porte un. */
  coordinates: { x: number; y: number } | null;
  echoCount: number;
  viewerHasEchoed: boolean;
  authorId: string;
  createdAt: string;
};

/** Un bulletin, lu sur la simulation. Les grandeurs sont déjà arrondies :
 *  rien de ce qui arrive au composant ne demande de calcul. */
export type WeatherEntry = {
  id: string;
  /** Le numéro du pas. La date tyrienne se lit sur son jour civil parisien,
   *  jamais sur `startsAt` : la tranche de nuit commence à 22 h ou 23 h UTC la
   *  veille, et la date sauterait d'un jour une fois sur quatre. */
  stepIndex: number;
  region: Region;
  condition: WeatherCondition;
  /** En degrés. */
  temperature: number;
  /** De 0 à 100. */
  humidite: number;
  /** En hectopascals. */
  pression: number;
  /** En kilomètres à l'heure. */
  vent: number;
  /** De 0 à 100 : à 100, on voit jusqu'à l'horizon. */
  visibilite: number;
  /** De 0 à 100. */
  precipitation: number;
  startsAt: string;
  endsAt: string;
};

/** Une cellule de la grille, pour le calque de la carte. */
/**
 * Une tache de ciel, prête à dessiner.
 *
 * La carte ne montre plus la maille : elle montre la zone. Le premier anneau la
 * cerne, les suivants la percent — une averse peut avoir son œil clair.
 */
export type WeatherArea = {
  id: string;
  phenomene: Phenomene;
  /** En pixels de continent. Le premier anneau cerne, les autres percent. */
  anneaux: { x: number; y: number }[][];
  /** Où poser le symbole : sur une cellule de la tache, jamais dans un trou. */
  centre: { x: number; y: number };
  /** Combien de cellules la composent. L'opacité s'y accroche. */
  cellules: number;
  /** La précipitation moyenne de la tache, de 0 à 100. */
  precipitation: number;
};

/** Le temps qu'il fait en un point précis, sondé depuis la carte. */
export type WeatherProbe = {
  x: number;
  y: number;
  region: Region | null;
  terrain: Terrain;
  condition: WeatherCondition;
  phenomenes: Phenomene[];
  temperature: number;
  humidite: number;
  pression: number;
  vent: number;
  visibilite: number;
  precipitation: number;
  stepIndex: number;
};

/** Le tracé d'une zone, pour le calque de la carte et l'administration. */
export type TerrainZoneOutline = {
  id: string;
  name: string;
  terrain: Terrain;
  region: Region | null;
  altitude: number;
  points: { x: number; y: number }[];
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
