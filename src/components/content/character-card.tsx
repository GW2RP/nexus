import Link from "next/link";

import { PinIcon } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { RaceChip } from "@/components/ui/chip";
import { FramedMedia, RoundPortrait } from "@/components/ui/framed-media";
import { raceLabel } from "@/lib/domain";
import type { CharacterSummary } from "@/server/types";

/** La carte du registre : portrait 3:4 en tête, bordé en bas, puis le bloc de texte.
 *
 *  Le cadrage est celui que le formulaire demande — 3:4, 900 × 1200 — donc le
 *  portrait téléversé tient entier dans la carte. En 4:3, le recadrage en
 *  `cover` coupait le haut et le bas de chaque portrait.
 *
 *  La carte prend toute la largeur de sa case : sans `w-full`, une carte au texte
 *  court se rétrécit à son contenu, et son portrait — large à 100 % — rapetisse
 *  avec elle. Les portraits d'une même rangée n'avaient alors plus la même
 *  taille. `shrink-0` tient l'autre bout : le portrait ne se fait pas écraser
 *  par un texte plus haut que la carte.
 *
 *  Le portrait mène à la fiche, comme le nom : c'est ce qu'on vise d'abord. */
export function CharacterCard({ character }: { character: CharacterSummary }) {
  return (
    <Card className="w-full overflow-hidden">
      <Link
        href={`/personnages/${character.slug}`}
        // Le nom, juste en dessous, mène à la même page : ce second lien sort de
        // la tabulation pour ne pas doubler chaque carte d'un arrêt de plus. Il
        // reste annoncé, lui, par l'alternative du portrait — c'est elle que son
        // auteur a écrite.
        tabIndex={-1}
        className="block shrink-0"
      >
        <FramedMedia
          src={character.portraitUrl}
          alt={character.portraitAlt ?? `Portrait de ${character.name}`}
          placeholder="PORTRAIT"
          dimensions={character.portraitUrl ? undefined : "900 × 1200"}
          aspect="3 / 4"
          className="border-0 border-b border-rule p-0"
          innerClassName="border-0"
        />
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="card-title">
            <Link href={`/personnages/${character.slug}`} className="hover:underline">
              {character.name}
            </Link>
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RaceChip race={character.race} gender={character.gender} />
          {character.age !== null ? (
            <span className="text-[16px] text-ink-muted">{character.age} ans</span>
          ) : null}
        </div>
        {character.summary ? (
          <p className="body-compact text-ink-body">{character.summary}</p>
        ) : null}
        {character.homePlaceLabel ? (
          <p className="mt-auto flex items-center gap-2 pt-2 text-[16px] text-ink-muted">
            <PinIcon size={13} />
            {character.homePlaceLabel}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

/** La ligne compacte du registre — colonne latérale de l'accueil, participants. */
export function CharacterRow({ character }: { character: CharacterSummary }) {
  const facts = [
    raceLabel(character.race, character.gender),
    character.age !== null ? `${character.age} ans` : null,
    character.homePlaceLabel,
  ].filter(Boolean);

  return (
    <li className="flex items-center gap-[14px] border-b border-hairline py-4 last:border-b-0">
      <RoundPortrait
        src={character.portraitUrl}
        alt={character.portraitAlt ?? ""}
        size={52}
      />
      <span className="min-w-0">
        <Link
          href={`/personnages/${character.slug}`}
          className="block font-display text-[18px] text-ink hover:underline"
        >
          {character.name}
        </Link>
        <span className="block text-[16px] text-ink-muted">{facts.join(" · ")}</span>
      </span>
    </li>
  );
}
