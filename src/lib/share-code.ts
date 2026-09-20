/**
 * Le code d'un lien de partage.
 *
 * Il **est** l'adresse : `gw2rp.eu/invitation/K7M2-QW9D`. Rien d'autre n'est à
 * taper, et le slug de la scène n'apparaît nulle part — une annonce privée ne
 * se devine pas en essayant des noms.
 *
 * L'alphabet écarte ce qui se confond à l'œil comme à l'oral : ni 0 ni O, ni 1
 * ni I ni L. Un code se dicte dans une taverne.
 */

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LONGUEUR = 8;

/** Le plus grand multiple de l'alphabet qui tient dans un octet. Au-delà, on
 *  retire l'octet plutôt que de le replier : un modulo nu rendrait les
 *  premières lettres plus fréquentes que les dernières. */
const PLAFOND = Math.floor(256 / ALPHABET.length) * ALPHABET.length;

/** Un code neuf, tiré du générateur cryptographique — jamais de `Math.random()` :
 *  c'est la seule chose qui garde une annonce privée hors de portée. */
export function nouveauCodeDePartage(): string {
  let code = "";
  while (code.length < LONGUEUR) {
    const octets = new Uint8Array(LONGUEUR);
    crypto.getRandomValues(octets);
    for (const octet of octets) {
      if (octet >= PLAFOND) continue;
      code += ALPHABET[octet % ALPHABET.length];
      if (code.length === LONGUEUR) break;
    }
  }
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** Le code tel qu'il est rangé, à partir de ce qui a été tapé ou collé.
 *  Les minuscules, les espaces et le tiret manquant sont admis ; une lettre
 *  hors alphabet ne l'est pas, et le code est alors refusé plutôt que corrigé. */
export function normaliserCodeDePartage(saisie: string): string | null {
  const brut = saisie
    .trim()
    .toLocaleUpperCase("fr-FR")
    .replace(/[^A-Z0-9]/g, "");
  if (brut.length !== LONGUEUR) return null;
  for (const lettre of brut) {
    if (!ALPHABET.includes(lettre)) return null;
  }
  return `${brut.slice(0, 4)}-${brut.slice(4)}`;
}
