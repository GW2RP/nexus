/**
 * Le contour d'un groupe de cellules.
 *
 * La carte ne dessine plus une grille de carrés : elle dessine **une zone** par
 * phénomène et par tache contiguë, avec son symbole au milieu. Une grille dit
 * « voici ma maille » ; un contour dit « il pleut là », ce qui est la seule
 * chose que le lecteur ait à savoir.
 *
 * Le tracé se fait au bord : on garde les côtés de cellule qui séparent la tache
 * de l'extérieur, on jette ceux qui séparent deux cellules de la même tache, et
 * on recoud le reste en anneaux fermés. Une tache peut être percée — un œil de
 * ciel clair au milieu d'une averse — donc un contour rend plusieurs anneaux :
 * le premier cerne la zone, les suivants sont ses trous.
 *
 * Ce fichier ne touche ni la base ni Leaflet : il se rejoue en ligne de commande.
 */

import {
  CELL_SIZE,
  GRID_COLS,
  cellColumn,
  cellRow,
  neighbourIndex,
  type Point,
} from "@/lib/weather/grid";

export type Anneau = Point[];

export type Contour = {
  /** Le premier anneau cerne la zone, les suivants la percent. */
  anneaux: Anneau[];
  /** Où poser le symbole : le centre d'une cellule de la tache, jamais d'un trou. */
  centre: Point;
  cellules: number;
};

const cle = (p: Point) => `${p.x}|${p.y}`;

/** Les quatre côtés d'une cellule, orientés pour que l'intérieur reste à droite.
 *  L'orientation est ce qui distinguera plus bas un contour d'un trou. */
function cotes(index: number): { du: Point; vers: Point; voisin: [number, number] }[] {
  const x0 = cellColumn(index) * CELL_SIZE;
  const y0 = cellRow(index) * CELL_SIZE;
  const x1 = x0 + CELL_SIZE;
  const y1 = y0 + CELL_SIZE;
  return [
    { du: { x: x0, y: y0 }, vers: { x: x1, y: y0 }, voisin: [0, -1] },
    { du: { x: x1, y: y0 }, vers: { x: x1, y: y1 }, voisin: [1, 0] },
    { du: { x: x1, y: y1 }, vers: { x: x0, y: y1 }, voisin: [0, 1] },
    { du: { x: x0, y: y1 }, vers: { x: x0, y: y0 }, voisin: [-1, 0] },
  ];
}

/** Aire signée. Positive ou négative selon le sens de parcours : c'est elle qui
 *  dit si l'anneau cerne de la matière ou un trou. */
function aireSignee(anneau: Anneau): number {
  let somme = 0;
  for (let i = 0, j = anneau.length - 1; i < anneau.length; j = i++) {
    somme += (anneau[j].x - anneau[i].x) * (anneau[j].y + anneau[i].y);
  }
  return somme / 2;
}

/** Trois points alignés n'en valent qu'un : on retire le point du milieu. */
function simplifier(anneau: Anneau): Anneau {
  const garde: Anneau = [];
  for (let i = 0; i < anneau.length; i += 1) {
    const avant = anneau[(i - 1 + anneau.length) % anneau.length];
    const ici = anneau[i];
    const apres = anneau[(i + 1) % anneau.length];
    const colineaire =
      (ici.x - avant.x) * (apres.y - ici.y) === (ici.y - avant.y) * (apres.x - ici.x);
    if (!colineaire) garde.push(ici);
  }
  return garde.length >= 3 ? garde : anneau;
}

function dansAnneau(p: Point, anneau: Anneau): boolean {
  let dedans = false;
  for (let i = 0, j = anneau.length - 1; i < anneau.length; j = i++) {
    const { x: xi, y: yi } = anneau[i];
    const { x: xj, y: yj } = anneau[j];
    if (yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) {
      dedans = !dedans;
    }
  }
  return dedans;
}

/** Les taches contiguës d'un ensemble de cellules — voisinage à quatre côtés,
 *  celui-là même dont les contours se recousent proprement. */
export function taches(cellules: Iterable<number>): number[][] {
  const reste = new Set(cellules);
  const trouvees: number[][] = [];
  while (reste.size > 0) {
    const depart: number = reste.values().next().value as number;
    reste.delete(depart);
    const tache = [depart];
    const pile = [depart];
    while (pile.length > 0) {
      const index = pile.pop() as number;
      for (const [dx, dy] of [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ] as const) {
        const voisin = neighbourIndex(index, dx, dy);
        if (voisin === null || !reste.has(voisin)) continue;
        reste.delete(voisin);
        tache.push(voisin);
        pile.push(voisin);
      }
    }
    trouvees.push(tache);
  }
  return trouvees;
}

/** Le contour d'une tache : son bord, ses trous, et où poser son symbole. */
export function contourDe(tache: number[]): Contour {
  const dedans = new Set(tache);

  // Les côtés qui donnent sur l'extérieur, indexés par leur point de départ.
  const sortants = new Map<string, Point[]>();
  for (const index of tache) {
    for (const cote of cotes(index)) {
      const voisin = neighbourIndex(index, cote.voisin[0], cote.voisin[1]);
      if (voisin !== null && dedans.has(voisin)) continue;
      const liste = sortants.get(cle(cote.du));
      if (liste) liste.push(cote.vers);
      else sortants.set(cle(cote.du), [cote.vers]);
    }
  }

  // On recoud : de proche en proche jusqu'à retomber sur le point de départ.
  const anneaux: Anneau[] = [];
  while (sortants.size > 0) {
    const premier = sortants.keys().next().value as string;
    const [x0, y0] = premier.split("|").map(Number);
    let ici: Point = { x: x0, y: y0 };
    const anneau: Anneau = [];
    for (;;) {
      const suites = sortants.get(cle(ici));
      if (!suites || suites.length === 0) break;
      // Deux sorties possibles là où deux taches se touchent par un coin : on
      // prend la plus à droite, ce qui referme la tache courante sans sauter
      // dans sa voisine.
      const precedent = anneau.length > 0 ? anneau[anneau.length - 1] : null;
      let choisi = 0;
      if (suites.length > 1 && precedent) {
        const vx = ici.x - precedent.x;
        const vy = ici.y - precedent.y;
        let meilleur = -Infinity;
        suites.forEach((s, i) => {
          const wx = s.x - ici.x;
          const wy = s.y - ici.y;
          // Produit vectoriel : négatif à droite dans un repère à y descendant.
          const tourne = -(vx * wy - vy * wx);
          if (tourne > meilleur) {
            meilleur = tourne;
            choisi = i;
          }
        });
      }
      const suivant = suites.splice(choisi, 1)[0];
      if (suites.length === 0) sortants.delete(cle(ici));
      anneau.push(ici);
      ici = suivant;
      if (ici.x === x0 && ici.y === y0) break;
    }
    if (anneau.length >= 3) anneaux.push(simplifier(anneau));
  }

  // Le plus grand anneau cerne la zone ; ceux qu'il contient sont ses trous.
  anneaux.sort((a, b) => Math.abs(aireSignee(b)) - Math.abs(aireSignee(a)));
  const cerne = anneaux[0] ? [anneaux[0]] : [];
  for (const anneau of anneaux.slice(1)) {
    if (dansAnneau(anneau[0], anneaux[0])) cerne.push(anneau);
  }

  return { anneaux: cerne, centre: coeurDe(tache), cellules: tache.length };
}

/** Le centre d'une cellule de la tache, la plus proche de son centre de gravité :
 *  le symbole tombe ainsi toujours sur de la matière, jamais dans un trou. */
export function coeurDe(tache: number[]): Point {
  let sx = 0;
  let sy = 0;
  for (const index of tache) {
    sx += cellColumn(index);
    sy += cellRow(index);
  }
  const cx = sx / tache.length;
  const cy = sy / tache.length;

  let meilleur = tache[0];
  let distance = Infinity;
  for (const index of tache) {
    const d = (cellColumn(index) - cx) ** 2 + (cellRow(index) - cy) ** 2;
    if (d < distance) {
      distance = d;
      meilleur = index;
    }
  }
  return {
    x: (meilleur % GRID_COLS) * CELL_SIZE + CELL_SIZE / 2,
    y: Math.floor(meilleur / GRID_COLS) * CELL_SIZE + CELL_SIZE / 2,
  };
}
