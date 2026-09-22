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

export const ELEMENT_KINDS = ["note", "texte", "carre", "rond", "triangle"] as const;
export type ElementKind = (typeof ELEMENT_KINDS)[number];

export const ELEMENT_KIND_LABELS: Record<ElementKind, string> = {
  note: "Note",
  texte: "Bloc de texte",
  carre: "Carré",
  rond: "Rond",
  triangle: "Triangle",
};

/** Les notes et les blocs de texte portent du markdown ; les formes, une légende
 *  en texte brut. */
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

export const ARROW_HEADS = ["fin", "deux", "aucune"] as const;
export type ArrowHeads = (typeof ARROW_HEADS)[number];
export const ARROW_HEAD_LABELS: Record<ArrowHeads, string> = {
  fin: "Pointe à l'arrivée",
  deux: "Pointe aux deux bouts",
  aucune: "Sans pointe",
};

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
};

export const ARROW_DEFAULTS = {
  color: "encre",
  heads: "fin" as ArrowHeads,
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
  authorId: string;
  authorName: string | null;
  createdAt: string;
};

export type BoardArrow = {
  id: string;
  from: string;
  to: string;
  color: string;
  heads: ArrowHeads;
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
  Pick<BoardElement, "x" | "y" | "w" | "h" | "text" | "size" | "stroke" | "fill" | "ink">
>;
export type ArrowPatch = Partial<Pick<BoardArrow, "color" | "heads" | "dash" | "width" | "label">>;

/** Une opération sur un panneau. L'éditeur les applique chez lui tout de suite,
 *  puis les envoie une à une : deux membres qui travaillent ensemble ne
 *  s'écrasent pas, chacun ne touche que l'élément qu'il déplace.
 *
 *  Retirer n'est pas effacer : l'élément part à la corbeille du panneau, d'où
 *  « annuler » le rétablit avec son auteur. */
export type BoardOperation =
  | {
      type: "poser";
      element: Pick<BoardElement, "id" | "kind" | "x" | "y" | "w" | "h" | "text" | "size" | "stroke" | "fill" | "ink">;
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
export function elementName(element: Pick<BoardElement, "kind" | "text">): string {
  const text = isRichKind(element.kind) ? plainExcerpt(element.text, 60) : element.text.trim();
  return text || ELEMENT_KIND_LABELS[element.kind];
}

type Box = Pick<BoardElement, "kind" | "x" | "y" | "w" | "h">;

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

export type ArrowGeometry = {
  start: { x: number; y: number };
  end: { x: number; y: number };
  /** Le trait lui-même, raccourci sous chaque pointe. */
  lineStart: { x: number; y: number };
  lineEnd: { x: number; y: number };
  headStart: string | null;
  headEnd: string | null;
  middle: { x: number; y: number };
};

/** Le tracé d'une flèche entre deux éléments : elle suit leurs contours, donc
 *  elle suit aussi les éléments quand on les déplace ou les redimensionne. */
export function arrowGeometry(from: Box, to: Box, arrow: Pick<BoardArrow, "heads" | "width">): ArrowGeometry {
  const dx = to.x + to.w / 2 - (from.x + from.w / 2);
  const dy = to.y + to.h / 2 - (from.y + from.h / 2);
  const start = exitPoint(from, dx, dy, 10);
  const end = exitPoint(to, -dx, -dy, 10);
  const length = Math.hypot(end.x - start.x, end.y - start.y) || 1;
  const ux = (end.x - start.x) / length;
  const uy = (end.y - start.y) / length;
  const size = 9 + ARROW_WIDTH_PX[arrow.width] * 2;

  function head(tip: { x: number; y: number }, vx: number, vy: number) {
    const bx = tip.x - vx * size;
    const by = tip.y - vy * size;
    const half = size / 2;
    return {
      base: { x: bx, y: by },
      points: `${tip.x},${tip.y} ${bx - vy * half},${by + vx * half} ${bx + vy * half},${by - vx * half}`,
    };
  }

  const withEnd = arrow.heads !== "aucune";
  const withStart = arrow.heads === "deux";
  const endHead = head(end, ux, uy);
  const startHead = head(start, -ux, -uy);
  return {
    start,
    end,
    lineStart: withStart ? startHead.base : start,
    lineEnd: withEnd ? endHead.base : end,
    headStart: withStart ? startHead.points : null,
    headEnd: withEnd ? endHead.points : null,
    middle: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
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
