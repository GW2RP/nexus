/** Les panneaux d'affichage : ce qui se partage entre le serveur, qui valide, et
 *  l'éditeur, qui dessine. Rien ici ne touche la base.
 *
 *  Un panneau est un plan libre sur lequel on pose des éléments — notes, blocs
 *  de texte, formes — et des flèches qui les relient. Les coordonnées sont des
 *  pixels du panneau, pas de l'écran : l'éditeur zoome et se déplace, le
 *  panneau, lui, ne bouge pas. */

export const BOARD_VISIBILITIES = ["public", "membres"] as const;
export type BoardVisibility = (typeof BOARD_VISIBILITIES)[number];

export const BOARD_VISIBILITY_LABELS: Record<BoardVisibility, string> = {
  public: "Public",
  membres: "Membres du groupe",
};

/** À qui le panneau appartient : un groupe en porte plusieurs, un lieu un seul. */
export const BOARD_OWNERS = ["groupe", "lieu"] as const;
export type BoardOwner = (typeof BOARD_OWNERS)[number];

export const ELEMENT_KINDS = ["note", "texte", "carre", "rond", "triangle", "image"] as const;
export type ElementKind = (typeof ELEMENT_KINDS)[number];

export const ELEMENT_KIND_LABELS: Record<ElementKind, string> = {
  note: "Note",
  texte: "Bloc de texte",
  carre: "Carré",
  rond: "Rond",
  triangle: "Triangle",
  image: "Image",
};

/** Les notes et les blocs de texte portent du markdown ; les formes, une légende
 *  en texte brut ; une image, son alternative. */
export function isRichKind(kind: ElementKind): boolean {
  return kind === "note" || kind === "texte";
}

/** L'étendue du panneau. Assez pour une campagne, pas assez pour s'y perdre. */
export const BOARD_WIDTH = 4000;
export const BOARD_HEIGHT = 3000;
export const ELEMENT_MIN = 40;
export const ELEMENT_MAX = 2000;
export const ELEMENTS_MAX = 300;
export const ARROWS_MAX = 300;
export const TEXT_MAX = 5000;
export const LEGEND_MAX = 200;
export const ARROW_LABEL_MAX = 80;
export const BOARD_NAME_MAX = 80;
export const BOARDS_PER_GROUP_MAX = 20;

/** Le pas de la grille : ce qu'une flèche du clavier fait parcourir à un
 *  élément. `Maj` en fait parcourir le dixième, comme pour un sommet de tracé. */
export const GRID = 20;

/** Les tailles de texte proposées : l'échelle de `tokens.css` — caption,
 *  body-compact, body, quote, section-title, page-title, hero. Un panneau peut
 *  porter des textes longs, mais il ne s'invente pas de taille pour autant. */
export const TEXT_SIZES = [15, 17, 19, 21, 27, 40, 52] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

/** La taille d'un titre dans un texte : le cran au-dessus de celle du texte. */
export function headingSize(size: number): number {
  return TEXT_SIZES.find((step) => step > size) ?? size;
}

/** Les couleurs se donnent par nom de teinte du système, ou librement en
 *  hexadécimal. Une teinte nommée suit le thème ; une couleur libre, non. */
export type Palette = "stroke" | "fill" | "ink";

export type Swatch = { id: string; label: string; token: string | null };

export const PALETTES: Record<Palette, Swatch[]> = {
  stroke: [
    { id: "encre", label: "Encre", token: "--ink" },
    { id: "or", label: "Or", token: "--gold" },
    { id: "carmin", label: "Carmin", token: "--crimson" },
  ],
  fill: [
    { id: "aucun", label: "Aucun fond", token: null },
    { id: "velin", label: "Vélin", token: "--surface" },
    { id: "ocre", label: "Ocre", token: "--chip-bg" },
  ],
  ink: [
    { id: "encre", label: "Encre", token: "--ink" },
    { id: "or", label: "Or", token: "--gold-ink" },
    { id: "carmin", label: "Carmin", token: "--crimson-ink" },
  ],
};

export const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value);
}

export function isValidColor(palette: Palette, value: string): boolean {
  return isHexColor(value) || PALETTES[palette].some((swatch) => swatch.id === value);
}

/** La valeur CSS d'une couleur rangée : sa variable de thème, ou l'hexadécimal
 *  choisi. `transparent` pour « aucun fond ». */
export function colorCss(palette: Palette, value: string): string {
  if (isHexColor(value)) return value;
  const swatch = PALETTES[palette].find((one) => one.id === value) ?? PALETTES[palette][0];
  return swatch.token ? `var(${swatch.token})` : "transparent";
}

/** La forme posée à un bout de flèche. Chaque bout a la sienne : une flèche
 *  peut partir d'un rond et arriver sur une pointe. */
export const ARROW_TIPS = ["aucune", "fleche", "rond", "carre"] as const;
export type ArrowTip = (typeof ARROW_TIPS)[number];
export const ARROW_TIP_LABELS: Record<ArrowTip, string> = {
  aucune: "Aucune",
  fleche: "Flèche",
  rond: "Rond",
  carre: "Carré",
};

/** Le chemin du trait d'un élément à l'autre : droit, en courbe, ou en
 *  créneau — un Z d'angles droits. */
export const ARROW_ROUTES = ["droit", "courbe", "creneau"] as const;
export type ArrowRoute = (typeof ARROW_ROUTES)[number];
export const ARROW_ROUTE_LABELS: Record<ArrowRoute, string> = {
  droit: "Droit",
  courbe: "Courbe",
  creneau: "Créneau",
};

/** L'ancien champ `heads`, qui disait d'un mot les deux bouts : encore lu,
 *  jamais écrit — la première modification de la flèche le range en
 *  `startTip` / `endTip` et l'efface. */
export const LEGACY_ARROW_HEADS = ["fin", "deux", "aucune"] as const;
export type LegacyArrowHeads = (typeof LEGACY_ARROW_HEADS)[number];
export function tipsFromHeads(heads: unknown): { startTip: ArrowTip; endTip: ArrowTip } {
  if (heads === "deux") return { startTip: "fleche", endTip: "fleche" };
  if (heads === "aucune") return { startTip: "aucune", endTip: "aucune" };
  return { startTip: "aucune", endTip: "fleche" };
}

export const ARROW_DASHES = ["plein", "tirets"] as const;
export type ArrowDash = (typeof ARROW_DASHES)[number];
export const ARROW_DASH_LABELS: Record<ArrowDash, string> = { plein: "Plein", tirets: "Tirets" };

export const ARROW_WIDTHS = ["fin", "moyen", "epais"] as const;
export type ArrowWidth = (typeof ARROW_WIDTHS)[number];
export const ARROW_WIDTH_LABELS: Record<ArrowWidth, string> = {
  fin: "Fin",
  moyen: "Moyen",
  epais: "Épais",
};
export const ARROW_WIDTH_PX: Record<ArrowWidth, number> = { fin: 1.5, moyen: 2.5, epais: 4 };

/** Ce qu'un élément fraîchement posé porte, selon son outil. */
export const ELEMENT_DEFAULTS: Record<
  ElementKind,
  { w: number; h: number; text: string; size: TextSize; stroke: string; fill: string; ink: string }
> = {
  note: { w: 220, h: 180, text: "", size: 17, stroke: "or", fill: "velin", ink: "encre" },
  texte: { w: 280, h: 80, text: "", size: 19, stroke: "encre", fill: "aucun", ink: "encre" },
  carre: { w: 180, h: 100, text: "", size: 17, stroke: "encre", fill: "aucun", ink: "encre" },
  rond: { w: 140, h: 140, text: "", size: 17, stroke: "encre", fill: "aucun", ink: "encre" },
  triangle: { w: 160, h: 140, text: "", size: 17, stroke: "encre", fill: "aucun", ink: "encre" },
  image: { w: 320, h: 240, text: "", size: 17, stroke: "encre", fill: "aucun", ink: "encre" },
};

/** Le dossier du magasin où se rangent les images d'un panneau, sous celui
 *  qui les téléverse. */
export const BOARD_IMAGE_FOLDER = "panneaux";

/** Le côté le plus long d'une image fraîchement posée, en pixels du panneau :
 *  elle arrive à sa proportion d'origine, réduite pour tenir à l'écran. */
export const IMAGE_SIDE = 360;

/** La taille d'une image posée : sa proportion d'origine, le grand côté ramené
 *  à `IMAGE_SIDE`, et aucun côté sous le minimum d'un élément. */
export function imageSize(naturalWidth: number, naturalHeight: number): { w: number; h: number } {
  if (!(naturalWidth > 0 && naturalHeight > 0)) return { w: IMAGE_SIDE, h: IMAGE_SIDE };
  const scale = IMAGE_SIDE / Math.max(naturalWidth, naturalHeight);
  return {
    w: Math.max(ELEMENT_MIN, Math.round(naturalWidth * scale)),
    h: Math.max(ELEMENT_MIN, Math.round(naturalHeight * scale)),
  };
}

export const ARROW_DEFAULTS = {
  color: "encre",
  startTip: "aucune" as ArrowTip,
  endTip: "fleche" as ArrowTip,
  route: "droit" as ArrowRoute,
  dash: "plein" as ArrowDash,
  width: "fin" as ArrowWidth,
  label: "",
};

/** Un élément tel que l'éditeur et la lecture le manipulent. */
export type BoardElement = {
  id: string;
  kind: ElementKind;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  text: string;
  size: number;
  stroke: string;
  fill: string;
  ink: string;
  /** L'adresse de l'image, pour un élément « image » ; vide pour les autres.
   *  Elle ne change pas : une autre image est un autre élément. */
  src: string;
  /** La légende d'une image, affichée sous elle ; vide pour les autres. Elle
   *  ne remplace pas l'alternative : l'une dit ce qu'on voit, l'autre ce qu'on
   *  en dit. */
  caption: string;
  authorId: string;
  authorName: string | null;
  createdAt: string;
};

export type BoardArrow = {
  id: string;
  from: string;
  to: string;
  color: string;
  startTip: ArrowTip;
  endTip: ArrowTip;
  route: ArrowRoute;
  dash: ArrowDash;
  width: ArrowWidth;
  label: string;
  authorId: string;
  authorName: string | null;
  createdAt: string;
};

export type BoardContent = { elements: BoardElement[]; arrows: BoardArrow[] };

/** Ce qu'une modification d'élément peut toucher. */
export type ElementPatch = Partial<
  Pick<BoardElement, "x" | "y" | "w" | "h" | "text" | "size" | "stroke" | "fill" | "ink" | "caption">
>;
export type ArrowPatch = Partial<Pick<BoardArrow, "color" | "startTip" | "endTip" | "route" | "dash" | "width" | "label">>;

/** Une opération sur un panneau. L'éditeur les applique chez lui tout de suite,
 *  puis les envoie une à une : deux membres qui travaillent ensemble ne
 *  s'écrasent pas, chacun ne touche que l'élément qu'il déplace.
 *
 *  Retirer n'est pas effacer : l'élément part à la corbeille du panneau, d'où
 *  « annuler » le rétablit avec son auteur. */
export type BoardOperation =
  | {
      type: "poser";
      element: Pick<BoardElement, "id" | "kind" | "x" | "y" | "w" | "h" | "text" | "size" | "stroke" | "fill" | "ink"> & {
        src?: string;
        caption?: string;
      };
    }
  | { type: "modifier"; id: string; patch: ElementPatch }
  | { type: "plan"; id: string; sens: "avant" | "arriere" }
  | { type: "retirer"; id: string }
  | { type: "retablir"; id: string }
  | { type: "relier"; arrow: Pick<BoardArrow, "id" | "from" | "to"> & ArrowPatch }
  | { type: "modifier-fleche"; id: string; patch: ArrowPatch }
  | { type: "retirer-fleche"; id: string }
  | { type: "retablir-fleche"; id: string };

export type BoardOperationResult =
  | { ok: true }
  | { ok: false; message: string; content?: BoardContent };

/** Un identifiant de 24 caractères hexadécimaux, créé par l'éditeur : l'élément
 *  existe à l'écran avant que le serveur l'ait reçu, et garde le même nom
 *  ensuite. Le serveur le vérifie comme n'importe quel ObjectId. */
export function newItemId(): string {
  const seconds = Math.floor(Date.now() / 1000).toString(16).padStart(8, "0");
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return seconds + Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** La première ligne lisible d'un texte, sans sa syntaxe : le nom d'un élément
 *  pour le lecteur d'écran, l'extrait d'un signalement. */
export function plainExcerpt(text: string, max = 120): string {
  const line =
    text
      .split("\n")
      .map((one) => one.trim())
      .find((one) => one.length > 0) ?? "";
  const bare = line
    .replace(/^(#{1,6}\s+|[-*+]\s+|\d+[.)]\s+|>\s?)/, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|\*|_|~~|`)/g, "")
    .replace(/\\([\\`*_{}[\]()#+\-.!>~])/g, "$1");
  return bare.length > max ? `${bare.slice(0, max - 1)}…` : bare;
}

/** Le nom qu'un élément donne de lui-même : sa première ligne, ou son type. */
export function elementName(element: Pick<BoardElement, "kind" | "text"> & { caption?: string }): string {
  if (element.kind === "image" && element.caption?.trim()) return element.caption.trim();
  const text = isRichKind(element.kind) ? plainExcerpt(element.text, 60) : element.text.trim();
  return text || ELEMENT_KIND_LABELS[element.kind];
}

type Box = Pick<BoardElement, "kind" | "x" | "y" | "w" | "h">;
type Point = { x: number; y: number };

/** L'écart laissé entre le contour d'un élément et le bout d'une flèche. */
const ARROW_GAP = 10;

/** Le point où un trait parti du centre d'un élément, dans la direction
 *  (dx, dy), sort de son contour — plus un écart, pour que la pointe ne touche
 *  pas le trait. Un rond est une ellipse ; le reste, son rectangle. */
function exitPoint(box: Box, dx: number, dy: number, gap: number) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const length = Math.hypot(dx, dy) || 1;
  let t: number;
  if (box.kind === "rond") {
    t = 1 / Math.sqrt((dx / (box.w / 2)) ** 2 + (dy / (box.h / 2)) ** 2);
  } else {
    const tx = dx ? box.w / 2 / Math.abs(dx) : Infinity;
    const ty = dy ? box.h / 2 / Math.abs(dy) : Infinity;
    t = Math.min(tx, ty);
  }
  t += gap / length;
  return { x: cx + dx * t, y: cy + dy * t };
}

/** Le milieu du côté d'un élément tourné vers (sx, sy) — un seul des deux est
 *  non nul —, plus l'écart. Un triangle n'a pas de côté vertical : à mi-hauteur,
 *  ses flancs sont rentrés d'un quart de sa largeur. */
function sidePoint(box: Box, sx: number, sy: number, gap: number): Point {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  if (sx) {
    const inset = box.kind === "triangle" ? box.w / 4 : 0;
    return { x: cx + sx * (box.w / 2 - inset + gap), y: cy };
  }
  return { x: cx, y: cy + sy * (box.h / 2 + gap) };
}

/** L'axe qu'un tracé courbe ou en créneau suit en quittant ses éléments : celui
 *  où ils sont le plus écartés. S'ils se chevauchent sur les deux, celui où leurs
 *  centres le sont. */
function routeAxis(from: Box, to: Box): "x" | "y" {
  const gapX = Math.max(to.x - (from.x + from.w), from.x - (to.x + to.w));
  const gapY = Math.max(to.y - (from.y + from.h), from.y - (to.y + to.h));
  if (gapX > 0 || gapY > 0) return gapX >= gapY ? "x" : "y";
  const dx = to.x + to.w / 2 - (from.x + from.w / 2);
  const dy = to.y + to.h / 2 - (from.y + from.h / 2);
  return Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
}

/** Le dessin d'une pointe, en chemin SVG : posée sur `tip`, tournée vers la
 *  direction (vx, vy), et longue de `size`. Le trait s'arrête à sa base. */
function tipPath(kind: ArrowTip, tip: Point, vx: number, vy: number, size: number): string | null {
  const half = size / 2;
  const bx = tip.x - vx * size;
  const by = tip.y - vy * size;
  switch (kind) {
    case "fleche":
      return `M${tip.x},${tip.y}L${bx - vy * half},${by + vx * half}L${bx + vy * half},${by - vx * half}Z`;
    case "rond": {
      const cx = tip.x - vx * half;
      const cy = tip.y - vy * half;
      return `M${cx - half},${cy}a${half},${half} 0 1 0 ${size},0a${half},${half} 0 1 0 ${-size},0Z`;
    }
    case "carre": {
      const corners = [
        [tip.x - vy * half, tip.y + vx * half],
        [tip.x + vy * half, tip.y - vx * half],
        [bx + vy * half, by - vx * half],
        [bx - vy * half, by + vx * half],
      ];
      return `M${corners.map(([x, y]) => `${x},${y}`).join("L")}Z`;
    }
    default:
      return null;
  }
}

export type ArrowGeometry = {
  start: Point;
  end: Point;
  /** Le chemin entier, d'un bout à l'autre : la surbrillance et la zone de clic. */
  path: string;
  /** Le trait lui-même, raccourci sous chaque pointe. */
  line: string;
  headStart: string | null;
  headEnd: string | null;
  middle: Point;
};

/** Le tracé d'une flèche entre deux éléments : elle suit leurs contours, donc
 *  elle suit aussi les éléments quand on les déplace ou les redimensionne.
 *
 *  Droite, elle va de centre à centre. Courbe ou en créneau, elle quitte le
 *  milieu d'un côté et arrive au milieu d'un autre, perpendiculaire aux deux :
 *  ses pointes tombent alors d'aplomb sur l'élément qu'elles désignent. */
export function arrowGeometry(
  from: Box,
  to: Box,
  arrow: Pick<BoardArrow, "startTip" | "endTip" | "route" | "width">,
): ArrowGeometry {
  const size = 9 + ARROW_WIDTH_PX[arrow.width] * 2;
  // La longueur dont chaque bout recule sous sa pointe.
  const backStart = arrow.startTip === "aucune" ? 0 : size;
  const backEnd = arrow.endTip === "aucune" ? 0 : size;

  let start: Point;
  let end: Point;
  /** La direction du trait en quittant le départ, et en arrivant au bout. */
  let outStart: Point;
  let inEnd: Point;
  let build: (a: Point, b: Point) => string;
  let middle: Point;

  if (arrow.route === "droit") {
    const dx = to.x + to.w / 2 - (from.x + from.w / 2);
    const dy = to.y + to.h / 2 - (from.y + from.h / 2);
    start = exitPoint(from, dx, dy, ARROW_GAP);
    end = exitPoint(to, -dx, -dy, ARROW_GAP);
    const length = Math.hypot(end.x - start.x, end.y - start.y) || 1;
    outStart = { x: (end.x - start.x) / length, y: (end.y - start.y) / length };
    inEnd = outStart;
    build = (a, b) => `M${a.x},${a.y}L${b.x},${b.y}`;
    middle = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  } else {
    const axis = routeAxis(from, to);
    const delta =
      axis === "x" ? to.x + to.w / 2 - (from.x + from.w / 2) : to.y + to.h / 2 - (from.y + from.h / 2);
    const sign = delta < 0 ? -1 : 1;
    const unit = axis === "x" ? { x: sign, y: 0 } : { x: 0, y: sign };
    start = sidePoint(from, unit.x, unit.y, ARROW_GAP);
    end = sidePoint(to, -unit.x, -unit.y, ARROW_GAP);
    outStart = unit;
    inEnd = unit;
    if (arrow.route === "courbe") {
      // Les poignées tirent dans l'axe, d'au moins 40 px : sans quoi deux
      // éléments proches se relieraient d'un trait presque droit.
      const reach = Math.max(Math.abs(axis === "x" ? end.x - start.x : end.y - start.y) / 2, 40);
      const c1 = { x: start.x + unit.x * reach, y: start.y + unit.y * reach };
      const c2 = { x: end.x - unit.x * reach, y: end.y - unit.y * reach };
      build = (a, b) => `M${a.x},${a.y}C${c1.x},${c1.y} ${c2.x},${c2.y} ${b.x},${b.y}`;
      // Le point de la courbe à mi-parcours (t = ½).
      middle = {
        x: (start.x + 3 * c1.x + 3 * c2.x + end.x) / 8,
        y: (start.y + 3 * c1.y + 3 * c2.y + end.y) / 8,
      };
    } else {
      // Le créneau tourne à mi-chemin des deux bouts.
      const knee = axis === "x" ? (start.x + end.x) / 2 : (start.y + end.y) / 2;
      build = (a, b) =>
        axis === "x"
          ? `M${a.x},${a.y}H${knee}V${b.y}H${b.x}`
          : `M${a.x},${a.y}V${knee}H${b.x}V${b.y}`;
      middle = axis === "x" ? { x: knee, y: (start.y + end.y) / 2 } : { x: (start.x + end.x) / 2, y: knee };
    }
  }

  const lineStart = { x: start.x + outStart.x * backStart, y: start.y + outStart.y * backStart };
  const lineEnd = { x: end.x - inEnd.x * backEnd, y: end.y - inEnd.y * backEnd };
  return {
    start,
    end,
    path: build(start, end),
    line: build(lineStart, lineEnd),
    headStart: tipPath(arrow.startTip, start, -outStart.x, -outStart.y, size),
    headEnd: tipPath(arrow.endTip, end, inEnd.x, inEnd.y, size),
    middle,
  };
}

/** Le rectangle qui contient tous les éléments, avec une marge : le cadre
 *  qu'un aperçu montre, et celui sur lequel l'éditeur s'ouvre. */
export function contentBounds(elements: Pick<BoardElement, "x" | "y" | "w" | "h">[], margin = 40) {
  if (elements.length === 0) return null;
  const left = Math.min(...elements.map((one) => one.x)) - margin;
  const top = Math.min(...elements.map((one) => one.y)) - margin;
  const right = Math.max(...elements.map((one) => one.x + one.w)) + margin;
  const bottom = Math.max(...elements.map((one) => one.y + one.h)) + margin;
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/** Le thème qu'appelle un fond choisi librement : clair s'il se lit mieux avec
 *  de l'encre noire, sombre sinon. Une couleur libre ne suit pas le thème de la
 *  page ; l'élément prend donc celui de son fond, et ses teintes nommées — son
 *  encre, son trait — se lisent dans ce thème-là. Sans cela, un fond vert pâle
 *  garderait son vert au thème sombre, et l'encre, passée au clair, y
 *  disparaîtrait. */
export function themeForFill(fill: string): "light" | "dark" | undefined {
  if (!isHexColor(fill)) return undefined;
  return contrastRatio(fill, "#000000") >= contrastRatio(fill, "#ffffff") ? "light" : "dark";
}

/** Le rapport de contraste WCAG entre deux couleurs hexadécimales. */
export function contrastRatio(a: string, b: string): number {
  function luminance(hex: string) {
    const channels = [1, 3, 5].map((index) => {
      const value = parseInt(hex.slice(index, index + 2), 16) / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  }
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
