import {
  AdventureIcon,
  BannerIcon,
  CloudIcon,
  EstateIcon,
  HouseIcon,
  MistIcon,
  RainIcon,
  RuinIcon,
  ScalesIcon,
  SnowIcon,
  StormIcon,
  SunIcon,
  TavernIcon,
  TentIcon,
  TradeIcon,
  WindIcon,
} from "@/components/icons";
import type { EventType, PlaceType, WeatherCondition } from "@/lib/domain";
import type { Phenomene } from "@/lib/weather/phenomena";

/** La correspondance type → glyphe. Elle vit ici et nulle part ailleurs :
 *  le pin de carte, la puce et la ligne de liste lisent la même table. */

type GlyphProps = { size?: number; className?: string };
type Glyph = (props: GlyphProps) => React.ReactElement;

const EVENT_GLYPHS: Record<EventType, Glyph> = {
  taverne: TavernIcon,
  aventure: AdventureIcon,
  commerce: TradeIcon,
  ceremonie: BannerIcon,
  intrigue: ScalesIcon,
};

const PLACE_GLYPHS: Record<PlaceType, Glyph> = {
  taverne: TavernIcon,
  guilde: BannerIcon,
  ruine: RuinIcon,
  commerce: TradeIcon,
  domaine: EstateIcon,
  maison: HouseIcon,
  campement: TentIcon,
};

const WEATHER_GLYPHS: Record<WeatherCondition, Glyph> = {
  degage: SunIcon,
  nuages: CloudIcon,
  "pluie-fine": RainIcon,
  orage: StormIcon,
  brume: MistIcon,
  neige: SnowIcon,
};

export function EventGlyph({ type, ...props }: GlyphProps & { type: EventType }) {
  const Component = EVENT_GLYPHS[type] ?? TavernIcon;
  return <Component {...props} />;
}

export function PlaceGlyph({ type, ...props }: GlyphProps & { type: PlaceType }) {
  const Component = PLACE_GLYPHS[type] ?? TavernIcon;
  return <Component {...props} />;
}

export function WeatherGlyph({
  condition,
  ...props
}: GlyphProps & { condition: WeatherCondition }) {
  const Component = WEATHER_GLYPHS[condition] ?? CloudIcon;
  return <Component {...props} />;
}

/** Les phénomènes réutilisent les glyphes du ciel, et en ajoutent deux : le
 *  vent et la chaleur ne sont pas des conditions, ils se cumulent aux autres. */
const PHENOMENE_GLYPHS: Record<Phenomene, Glyph> = {
  orage: StormIcon,
  neige: SnowIcon,
  pluie: RainIcon,
  brume: MistIcon,
  vent: WindIcon,
  chaleur: SunIcon,
};

export function PhenomeneGlyph({
  phenomene,
  ...props
}: GlyphProps & { phenomene: Phenomene }) {
  const Component = PHENOMENE_GLYPHS[phenomene] ?? CloudIcon;
  return <Component {...props} />;
}

