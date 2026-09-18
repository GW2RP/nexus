import Link from "next/link";

import { PinIcon } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { RaceChip } from "@/components/ui/chip";
import { FramedMedia, RoundPortrait } from "@/components/ui/framed-media";
import { raceLabel } from "@/lib/domain";
import type { CharacterSummary } from "@/server/types";

/** La carte du registre : portrait 4:3 en tête, bordé en bas, puis le bloc de texte. */
export function CharacterCard({ character }: { character: CharacterSummary }) {
  return (
    <Card className="overflow-hidden">
      <FramedMedia
        src={character.portraitUrl}
        alt={character.portraitAlt ?? `Portrait de ${character.name}`}
        placeholder="PORTRAIT"
        dimensions={character.portraitUrl ? undefined : "1200 × 900"}
        aspect="4 / 3"
        className="border-0 border-b border-rule p-0"
        innerClassName="border-0"
      />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="font-display text-[21px] font-semibold leading-[1.25]">
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
          <p className="text-[17px] leading-[1.5] text-ink-body">{character.summary}</p>
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
