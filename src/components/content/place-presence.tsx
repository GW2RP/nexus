"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState } from "@/lib/action-state";
import { formatGameTime } from "@/lib/dates";
import type { PresenceDeclaree, Present } from "@/lib/place-presence";
import { declarePresenceAction, leavePresenceAction } from "@/server/actions/places";

/**
 * « En ce moment » : qui se tient au lieu, et « J'y suis » pour s'y
 * déclarer. Les noms sont ceux des personnages — le jeu de rôle est public,
 * et c'est ce qui donne envie de rejoindre —, liés à leur fiche quand ils en
 * ont une.
 *
 * Depuis le site, une déclaration vit deux heures, et se renouvelle du même
 * bouton. L'application bureau, elle, la propose quand le personnage passe à
 * côté du lieu, et la tient tant qu'il y reste.
 */
export function PlacePresence({
  placeId,
  presents,
  mine,
  characters,
  signedIn,
}: {
  placeId: string;
  presents: Present[];
  /** La présence du lecteur, où qu'elle soit. */
  mine: PresenceDeclaree | null;
  /** Les personnages du lecteur, pour choisir qui s'y tient. */
  characters: { id: string; name: string }[];
  signedIn: boolean;
}) {
  const [declared, declare] = useActionState(declarePresenceAction, idleState);
  const [left, leave] = useActionState(leavePresenceAction, idleState);
  const here = mine?.lieu.id === placeId ? mine : null;
  // Renouveler, c'est redéclarer le même personnage : seule une déclaration
  // du site sous une fiche du compte se renouvelle d'ici. Celle de l'overlay
  // se tient depuis le jeu.
  const renewId =
    here?.source === "site" && here.personnage?.slug
      ? characters.find((character) => character.name === here.personnage?.name)?.id
      : undefined;

  return (
    <section aria-labelledby="en-ce-moment" className="mb-8 flex flex-col gap-4">
      <h2 id="en-ce-moment" className="eyebrow text-gold-eyebrow">
        {presents.length > 0
          ? `EN CE MOMENT · ${presents.length} PRÉSENT${presents.length > 1 ? "S" : ""}`
          : "EN CE MOMENT"}
      </h2>

      {presents.length > 0 ? (
        <ul className="flex flex-col">
          {presents.map((present, index) => (
            <li
              key={`${present.name}-${index}`}
              className="flex items-baseline justify-between gap-4 border-b border-hairline py-2 last:border-b-0"
            >
              {present.slug ? (
                <Link
                  href={`/personnages/${present.slug}`}
                  className="body-compact text-crimson-ink underline-offset-4 hover:underline"
                >
                  {present.name}
                </Link>
              ) : (
                <span className="body-compact text-ink">{present.name}</span>
              )}
              <span className="caption text-ink-muted">
                depuis {formatGameTime(new Date(present.since))}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="meta text-ink-muted">Personne pour l&apos;instant</p>
      )}

      {!signedIn ? null : here ? (
        <div className="flex flex-col gap-3">
          <p className="caption text-ink-muted">
            Vous y êtes jusqu&apos;à {formatGameTime(new Date(here.until))}
            {here.personnage ? `, sous ${here.personnage.name}` : ""}.
          </p>
          <div className="flex flex-wrap gap-3">
            {renewId ? (
              <form action={declare}>
                <input type="hidden" name="id" value={placeId} />
                <input type="hidden" name="characterId" value={renewId} />
                <SubmitButton variant="outline" size="sm" pendingLabel="EN COURS…">
                  RESTER 2 H DE PLUS
                </SubmitButton>
              </form>
            ) : null}
            <form action={leave}>
              <SubmitButton variant="quiet" size="sm" pendingLabel="EN COURS…">
                QUITTER LE LIEU
              </SubmitButton>
            </form>
          </div>
        </div>
      ) : characters.length === 0 ? (
        <Button asChild variant="outline" size="sm" className="self-start">
          <Link href="/personnages/nouveau">CRÉER UN PERSONNAGE</Link>
        </Button>
      ) : (
        <form action={declare} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={placeId} />
          <Field
            label="Personnage"
            htmlFor="presence-personnage"
            error={declared.fieldErrors?.characterId}
          >
            <Select id="presence-personnage" name="characterId" defaultValue={characters[0]?.id}>
              {characters.map((character) => (
                <option key={character.id} value={character.id}>
                  {character.name}
                </option>
              ))}
            </Select>
          </Field>
          {mine ? (
            <p className="caption text-ink-muted">Vous quitterez {mine.lieu.name}.</p>
          ) : null}
          <SubmitButton variant="outline" pendingLabel="EN COURS…">
            J&apos;Y SUIS
          </SubmitButton>
        </form>
      )}

      {declared.status === "error" && !declared.fieldErrors ? <FormMessage state={declared} /> : null}
      {left.status === "error" ? <FormMessage state={left} /> : null}
    </section>
  );
}
