/**
 * L'empaquetage des champs de la grille.
 *
 * Un tableau BSON de 560 nombres coûte environ 7 Ko : sept champs par pas, quatre
 * pas par jour, et l'historique devient vite encombrant pour rien. Toutes nos
 * grandeurs tiennent dans un entier signé de 16 bits, soit 1 120 octets par
 * champ — quatre fois moins, et un seul encodage à se tromper.
 *
 * La température voyage en dixièmes de degré ; tout le reste est déjà entier.
 */

export const PACK_SCALE_TEMPERATURE = 10;

export function packInt16(values: number[]): Buffer {
  const buffer = Buffer.allocUnsafe(values.length * 2);
  for (let i = 0; i < values.length; i += 1) {
    const value = Math.round(values[i]);
    buffer.writeInt16LE(Math.min(Math.max(value, -32_768), 32_767), i * 2);
  }
  return buffer;
}

/**
 * Ramène à un `Buffer` ce que la base rend vraiment.
 *
 * Une lecture en `.lean()` court-circuite le cast de Mongoose : le champ arrive
 * sous la forme du `Binary` du pilote MongoDB, dont `length` est une **méthode**
 * et non un nombre. `Buffer.from(binary)` produit alors un tampon vide au lieu
 * d'échouer, et toute la grille se relit en zéros — soit un ciel dégagé partout,
 * parfaitement crédible et complètement faux.
 */
function toBuffer(input: unknown): Buffer {
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) {
    return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  }
  const binary = input as { buffer?: unknown } | null;
  if (binary && binary.buffer !== undefined) return toBuffer(binary.buffer);
  throw new Error("Champ de grille illisible : ni Buffer, ni Uint8Array, ni Binary.");
}

/** Un tampon trop court est une erreur, pas une grille calme : sans quoi le bug
 *  se déguise en beau temps et personne ne le voit. */
export function unpackInt16(buffer: unknown, length: number): number[] {
  const view = toBuffer(buffer);
  if (view.length < length * 2) {
    throw new Error(
      `Champ de grille tronqué : ${view.length} octets pour ${length * 2} attendus.`,
    );
  }
  const values = new Array<number>(length);
  for (let i = 0; i < length; i += 1) {
    values[i] = view.readInt16LE(i * 2);
  }
  return values;
}

export function packScaled(values: number[], scale: number): Buffer {
  return packInt16(values.map((value) => value * scale));
}

export function unpackScaled(buffer: unknown, length: number, scale: number): number[] {
  return unpackInt16(buffer, length).map((value) => value / scale);
}
