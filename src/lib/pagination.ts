/** Au-delà, « Charger la suite » ne s'allonge plus.
 *
 *  Un registre relit ses `page` premières pages d'un coup : `?page=100000`
 *  demanderait alors toute la collection à chaque requête, et rangerait une
 *  entrée de cache par numéro tapé. */
export const PAGE_MAX = 50;

/** Le numéro de page lu dans l'adresse, borné à `[1, PAGE_MAX]`. */
export function lirePage(value: string | string[] | undefined): number {
  const page = Math.trunc(Number(typeof value === "string" ? value : 1)) || 1;
  return Math.min(PAGE_MAX, Math.max(1, page));
}
