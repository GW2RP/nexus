/** Les plans d'un lieu : ce que le formulaire et la validation en partagent.
 *
 *  `src/server/**` ne s'importe jamais depuis un composant client, et le schéma
 *  Zod vit là-bas : les bornes communes aux deux côtés tiennent donc ici.
 *
 *  Un point se range en pourcentage de l'image, pas en pixels du fichier : le
 *  plan se rend à la largeur de la colonne, donc un pixel du fichier ne désigne
 *  aucun endroit à l'écran. */

export const PLANS_MAX = 6;
export const POINTS_PAR_PLAN_MAX = 30;

/** Le pas d'une flèche sur un point saisi au clavier, et le pas fin avec Maj —
 *  comme les sommets d'un tracé sur la carte, qui se déplacent d'une cellule ou
 *  d'un dixième. */
export const PAS_CLAVIER = 1;
export const PAS_CLAVIER_FIN = 0.1;

/** Une coordonnée de plan : bornée à l'image, au dixième de pourcent. Au-delà,
 *  le point sort du cadre et ne désigne plus rien. */
export function clampPourcentage(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value * 10) / 10));
}
