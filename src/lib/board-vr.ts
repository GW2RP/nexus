/** L'exploration d'un panneau en VR : ce qui se calcule sans la scène. Le
 *  panneau y devient un tableau de détective — chaque élément épinglé sur du
 *  liège, chaque flèche une cordelette tendue d'une épingle à l'autre.
 *
 *  C'est une lecture : on peut décrocher une note et la reposer ailleurs, mais
 *  rien ne part au serveur. Le panneau est le même pour tous, et un geste fait
 *  dans un casque n'a pas à déplacer la note de quelqu'un d'autre. */

import { stripInlineMarkdown } from "@/lib/boards";

/** L'adresse de l'exploration, à côté de celle du panneau. */
export function vrPathOf(boardPath: string): string {
  return `${boardPath}/vr`;
}

/** Ce qu'un pixel du panneau mesure au plus dans la scène, en mètres : une note
 *  de 220 px y fait 24 cm. Un panneau plus grand se réduit pour tenir dans le
 *  cadre ; un petit ne grossit pas au-delà. */
export const METRES_PAR_PIXEL_MAX = 0.0011;

/** Le cadre que le tableau occupe au plus, en mètres. */
export const TABLEAU_LARGEUR_MAX = 2.4;
export const TABLEAU_HAUTEUR_MAX = 1.5;

/** Le centre du tableau, en mètres, depuis le sol sous le joueur : à hauteur
 *  d'yeux, à un pas devant lui. */
export const TABLEAU_HAUTEUR = 1.45;
export const TABLEAU_DISTANCE = 1.25;

/** L'échelle de la scène pour un cadre de panneau donné. */
export function metresParPixel(bounds: { w: number; h: number }): number {
  return Math.min(TABLEAU_LARGEUR_MAX / bounds.w, TABLEAU_HAUTEUR_MAX / bounds.h, METRES_PAR_PIXEL_MAX);
}

/** L'inclinaison d'un élément épinglé, en radians : quelques degrés, toujours
 *  les mêmes pour le même élément — un tableau qui se remettrait d'aplomb à
 *  chaque visite ne serait plus celui qu'on a vu. */
export function inclinaisonDe(id: string): number {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  const unit = ((hash >>> 0) % 1000) / 999;
  return (unit * 2 - 1) * (3 * Math.PI) / 180;
}

/** Le creux d'une cordelette, en mètres : elle pend d'autant plus qu'elle est
 *  longue, sans jamais tomber à plat. */
export function creuxDe(longueur: number): number {
  return Math.min(0.012 + longueur * 0.06, 0.12);
}

export type BlocTexte = {
  kind: "titre" | "paragraphe" | "puce" | "citation";
  /** Ce qui s'écrit devant la ligne : la puce ou le numéro. */
  marque: string;
  text: string;
};

/** Le texte d'une note ramené à des lignes qu'une toile sait écrire : titres,
 *  paragraphes, puces et citations, sans leur syntaxe en ligne. Le gras et
 *  l'italique s'y perdent ; ce qu'ils soulignent, non. Une ligne vide ne fait
 *  qu'écarter les blocs. */
export function blocsDuTexte(text: string): BlocTexte[] {
  const blocs: BlocTexte[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const titre = /^#{1,6}\s+(.*)$/.exec(line);
    const puce = /^[-*+]\s+(.*)$/.exec(line);
    const numero = /^(\d+)[.)]\s+(.*)$/.exec(line);
    const citation = /^>\s?(.*)$/.exec(line);
    if (titre) blocs.push({ kind: "titre", marque: "", text: stripInlineMarkdown(titre[1]) });
    else if (puce) blocs.push({ kind: "puce", marque: "•", text: stripInlineMarkdown(puce[1]) });
    else if (numero) blocs.push({ kind: "puce", marque: `${numero[1]}.`, text: stripInlineMarkdown(numero[2]) });
    else if (citation) blocs.push({ kind: "citation", marque: "", text: stripInlineMarkdown(citation[1]) });
    else blocs.push({ kind: "paragraphe", marque: "", text: stripInlineMarkdown(line) });
  }
  return blocs;
}
