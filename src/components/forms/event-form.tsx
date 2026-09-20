"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { AccountPicker } from "@/components/forms/account-picker";
import { Button } from "@/components/ui/button";
import { ChoiceRow } from "@/components/ui/choice-row";
import { ImageField } from "@/components/forms/image-field";
import { RichTextField } from "@/components/forms/rich-text-field";
import { MapPicker } from "@/components/map/map-picker";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SectionHeading } from "@/components/ui/section-heading";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  type EventType,
  type EventVisibility,
  MONTHLY_MODES,
  type MonthlyMode,
  RECURRENCES,
  RECURRENCE_LABELS,
  type Recurrence,
  REGIONS,
  REGION_LABELS,
} from "@/lib/domain";
import {
  formatGameTime,
  formatLongDate,
  fromGameInput,
  GAME_TIME_ZONE,
  toGameInput,
} from "@/lib/dates";
import { choixMensuels, OCCURRENCES_PAR_LOT, prochainesSeances } from "@/lib/recurrence";
import { formatTyrianDate } from "@/lib/tyrian-calendar";
import { idleState } from "@/lib/action-state";
import { createEventAction, updateEventAction } from "@/server/actions/events";
import type { AuthorSummary, CharacterSummary, EventDetail } from "@/server/types";

/** Les champs `datetime-local` veulent « AAAA-MM-JJTHH:MM », à l'heure du
 *  serveur de jeu : c'est celle que le formulaire annonce. */
function toLocalInput(iso?: string | null): string {
  if (!iso) return "";
  return toGameInput(new Date(iso));
}

export function EventForm({
  ownerId,
  event,
  places,
  characters,
  groups,
  invited = [],
  initialCoordinates,
}: {
  /** L\'auteur du contenu : les images sont rangées sous lui. */
  ownerId: string;
  event?: EventDetail;
  places: { id: string; name: string; region: string }[];
  characters: CharacterSummary[];
  /** Les cercles que ce compte mène : on n'annonce pas chez les autres. */
  groups: { id: string; name: string; memberCount: number }[];
  /** Les comptes déjà invités, à la modification. */
  invited?: AuthorSummary[];
  /** Le point cliqué sur la carte, quand la scène part de là. */
  initialCoordinates?: { x: number; y: number } | null;
}) {
  const [state, formAction] = useActionState(
    event ? updateEventAction : createEventAction,
    idleState,
  );
  const errors = state.fieldErrors ?? {};

  // Un évènement tenu dans un lieu du registre en hérite le point : la carte ne
  // s'ouvre que pour une scène qui se tient ailleurs, sinon deux emplacements
  // se contrediraient à l'écran. Le pin reprend le glyphe du type et le titre.
  const [placeId, setPlaceId] = useState(event?.place?.id ?? "");
  const [type, setType] = useState<EventType>(event?.type ?? "taverne");
  const [title, setTitle] = useState(event?.title ?? "");

  // Qui voit la scène, et la série qu'elle ouvre. Les deux se décident à
  // l'écran, et l'aperçu des séances se recalcule à chaque frappe : une série
  // se choisit en voyant ce qu'elle promet, pas en le devinant.
  const [visibility, setVisibility] = useState<EventVisibility>(event?.visibility ?? "publique");
  const [guests, setGuests] = useState<AuthorSummary[]>(invited);
  const [startsAt, setStartsAt] = useState(toLocalInput(event?.startsAt));
  const [recurrence, setRecurrence] = useState<Recurrence>(
    event?.seriesDetail?.recurrence ?? "aucune",
  );
  const [monthlyMode, setMonthlyMode] = useState<MonthlyMode>(
    event?.seriesDetail?.monthlyMode ?? "quantieme",
  );
  const [seriesEnd, setSeriesEnd] = useState<"sans-fin" | "compte" | "date">("sans-fin");

  const premiere = fromGameInput(startsAt);
  // Une série déjà écrite ne se refait pas depuis l'annonce : elle se gère sur
  // sa page. Proposer ici « chaque semaine » à une scène qui l'est déjà
  // laisserait croire qu'on peut changer la règle en enregistrant.
  const serieExistante = Boolean(event?.seriesDetail);

  return (
    <form action={formAction} className="flex max-w-[760px] flex-col gap-8">
      {event ? <input type="hidden" name="id" value={event.id} /> : null}
      {visibility === "privee"
        ? guests.map((guest) => (
            <input key={guest.id} type="hidden" name="invitedUserIds[]" value={guest.id} />
          ))
        : null}

      <section>
        <SectionHeading title="L'annonce" compact />
        <div className="flex flex-col gap-4">
          <Field label="Titre" htmlFor="title" required error={errors.title}>
            <Input
              id="title"
              name="title"
              required
              maxLength={140}
              value={title}
              onChange={(field) => setTitle(field.target.value)}
              placeholder="Veillée au Lion Noir"
            />
          </Field>

          <Field label="Type" htmlFor="type" required error={errors.type}>
            <Select
              id="type"
              name="type"
              required
              value={type}
              onChange={(field) => setType(field.target.value as EventType)}
            >
              {EVENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {EVENT_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Accroche"
            htmlFor="summary"
            hint="Trois lignes au plus : c'est ce que montre l'agenda."
            error={errors.summary}
          >
            <Textarea
              id="summary"
              name="summary"
              rows={3}
              maxLength={300}
              defaultValue={event?.summary ?? ""}
            />
          </Field>

          <RichTextField
            label="Description"
            name="description"
            folder="evenements"
            ownerId={ownerId}
            rows={8}
            defaultValue={event?.description}
            error={errors.description}
          />

          <Field
            label="Ce qu'il faut savoir"
            htmlFor="practicalNotes"
            hint="Une consigne par ligne : ambiance, canal en jeu, règles de la scène."
            error={errors.practicalNotes}
          >
            <Textarea
              id="practicalNotes"
              name="practicalNotes"
              rows={5}
              defaultValue={event?.practicalNotes.join("\n") ?? ""}
            />
          </Field>
        </div>
      </section>

      <section>
        <SectionHeading title="Quand et où" compact />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Début"
            htmlFor="startsAt"
            required
            hint={`Heure du serveur de jeu (${GAME_TIME_ZONE}).`}
            error={errors.startsAt}
          >
            <Input
              id="startsAt"
              name="startsAt"
              type="datetime-local"
              required
              value={startsAt}
              onChange={(field) => setStartsAt(field.target.value)}
            />
          </Field>

          <Field label="Fin" htmlFor="endsAt" error={errors.endsAt}>
            <Input
              id="endsAt"
              name="endsAt"
              type="datetime-local"
              defaultValue={toLocalInput(event?.endsAt)}
            />
          </Field>

          <Field
            label="Lieu du registre"
            htmlFor="placeId"
            hint="La région et le point sur la carte en découlent."
            error={errors.placeId}
          >
            <Select
              id="placeId"
              name="placeId"
              value={placeId}
              onChange={(field) => setPlaceId(field.target.value)}
            >
              <option value="">Point libre sur la carte</option>
              {places.map((place) => (
                <option key={place.id} value={place.id}>
                  {place.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Point libre"
            htmlFor="freeLocationLabel"
            hint="Si la scène ne se tient pas dans un lieu du registre."
            error={errors.freeLocationLabel}
          >
            <Input
              id="freeLocationLabel"
              name="freeLocationLabel"
              maxLength={160}
              defaultValue={event?.place ? "" : (event?.locationLabel ?? "")}
              placeholder="Champs de Gendarran, près du pont"
            />
          </Field>

          <Field label="Région" htmlFor="region" error={errors.region}>
            <Select id="region" name="region" defaultValue={event?.region ?? ""}>
              <option value="">Sans région précise</option>
              {REGIONS.map((region) => (
                <option key={region} value={region}>
                  {REGION_LABELS[region]}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Places"
            htmlFor="capacity"
            hint="Laissez vide si la scène n'a pas de limite."
            error={errors.capacity}
          >
            <Input
              id="capacity"
              name="capacity"
              type="number"
              min={0}
              max={999}
              defaultValue={event?.capacity ?? ""}
            />
          </Field>
        </div>

        {placeId ? null : (
          <div className="mt-6">
            <MapPicker
              kind="evenement"
              type={type}
              name={title}
              initial={event?.coordinates ?? initialCoordinates ?? null}
              error={errors.coordinateX ?? errors.coordinateY}
            />
          </div>
        )}
      </section>

      <section>
        <SectionHeading title="Qui peut voir cette scène" compact />
        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-3 border-0 p-0">
            <legend className="sr-only">Visibilité de la scène</legend>
            <ChoiceRow
              name="visibility"
              value="publique"
              checked={visibility === "publique"}
              onSelect={() => setVisibility("publique")}
              title="Publique"
              hint="À l'agenda, sur la carte, ouverte à tous."
            />
            <ChoiceRow
              name="visibility"
              value="privee"
              checked={visibility === "privee"}
              onSelect={() => setVisibility("privee")}
              title="Privée"
              hint="Hors agenda. Un lien de partage, les comptes que vous nommez, et le cercle que vous lui associez."
            />
          </fieldset>

          {visibility === "privee" ? (
            <>
              <AccountPicker
                label="Inviter par pseudo"
                inputId="invite"
                placeholder="Pseudo du membre"
                selected={guests}
                excludeIds={[ownerId]}
                removeLabel={(name) => `Retirer ${name} des invités`}
                onAdd={(account) =>
                  setGuests((current) =>
                    current.some((guest) => guest.id === account.id) ? current : [...current, account],
                  )
                }
                onRemove={(id) => setGuests((current) => current.filter((guest) => guest.id !== id))}
                error={errors.invitedUserIds}
              />

              {groups.length > 0 ? (
                <Field
                  label="Groupe associé"
                  htmlFor="groupId"
                  hint="Ses membres verront la scène à leur agenda et pourront la rejoindre."
                  error={errors.groupId}
                >
                  <Select id="groupId" name="groupId" defaultValue={event?.group?.id ?? ""}>
                    <option value="">Aucun groupe</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name} — {group.memberCount} membre{group.memberCount > 1 ? "s" : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <p className="caption text-ink-subtle">
                  Vous ne menez aucun cercle. <Link href="/groupes/nouveau" className="text-crimson-ink underline underline-offset-4">Créer un groupe</Link> pour ouvrir une scène à plusieurs d&apos;un coup.
                </p>
              )}

              {event?.shareCode ? null : (
                <p className="caption text-ink-subtle">
                  Le lien de partage et son code sont créés à l&apos;enregistrement : ils vous attendent sur l&apos;annonce.
                </p>
              )}
            </>
          ) : null}
        </div>
      </section>

      <section>
        <SectionHeading title="Récurrence" compact />
        {serieExistante ? (
          <p className="body-compact text-ink-body">
            Cette séance fait partie d&apos;une série. La cadence, la pause et les séances se
            règlent sur{" "}
            <a
              href={`/evenements/${event?.slug}/seances`}
              className="text-crimson-ink underline underline-offset-4"
            >
              la page des séances
            </a>
            . Ce formulaire ne modifie que cette séance-ci.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <fieldset className="flex flex-col gap-3 border-0 p-0">
              <legend className="sr-only">Cadence de la série</legend>
              {RECURRENCES.map((value) => (
                <ChoiceRow
                  key={value}
                  name="recurrence"
                  value={value}
                  checked={recurrence === value}
                  onSelect={() => setRecurrence(value)}
                  title={RECURRENCE_LABELS[value]}
                  hint={
                    value === "aucune" || !premiere
                      ? undefined
                      : value === "hebdomadaire"
                        ? choixHebdomadaire(premiere)
                        : undefined
                  }
                >
                  {value === "mensuelle" && recurrence === "mensuelle" && premiere ? (
                    <span className="mt-2 flex flex-col gap-2">
                      {MONTHLY_MODES.map((mode) => (
                        <label key={mode} className="flex cursor-pointer items-center gap-3">
                          <input
                            type="radio"
                            name="monthlyMode"
                            value={mode}
                            checked={monthlyMode === mode}
                            onChange={() => setMonthlyMode(mode)}
                            className="size-[18px] shrink-0 rounded-none accent-[var(--crimson)]"
                          />
                          <span className="text-[17px] text-ink">
                            {choixMensuels(premiere)[mode]}
                          </span>
                        </label>
                      ))}
                    </span>
                  ) : null}
                </ChoiceRow>
              ))}
            </fieldset>

            {recurrence === "aucune" ? null : (
              <>
                <fieldset className="flex flex-col gap-3 border-0 p-0">
                  <legend className="meta mb-1 text-ink-muted">Fin de la série</legend>
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="radio"
                      name="seriesEnd"
                      value="sans-fin"
                      checked={seriesEnd === "sans-fin"}
                      onChange={() => setSeriesEnd("sans-fin")}
                      className="size-[18px] shrink-0 rounded-none accent-[var(--crimson)]"
                    />
                    <span className="text-[17px] text-ink">
                      Sans fin — vous la mettrez en pause quand il faudra
                    </span>
                  </label>
                  <label className="flex cursor-pointer flex-wrap items-center gap-3">
                    <input
                      type="radio"
                      name="seriesEnd"
                      value="compte"
                      checked={seriesEnd === "compte"}
                      onChange={() => setSeriesEnd("compte")}
                      className="size-[18px] shrink-0 rounded-none accent-[var(--crimson)]"
                    />
                    <span className="text-[17px] text-ink">Après</span>
                    <Input
                      name="seriesCount"
                      type="number"
                      min={2}
                      max={60}
                      defaultValue={12}
                      aria-label="Nombre de séances"
                      className="w-[92px] text-center"
                    />
                    <span className="text-[17px] text-ink">séances</span>
                  </label>
                  <label className="flex cursor-pointer flex-wrap items-center gap-3">
                    <input
                      type="radio"
                      name="seriesEnd"
                      value="date"
                      checked={seriesEnd === "date"}
                      onChange={() => setSeriesEnd("date")}
                      className="size-[18px] shrink-0 rounded-none accent-[var(--crimson)]"
                    />
                    <span className="text-[17px] text-ink">Jusqu&apos;au</span>
                    <Input
                      name="seriesUntil"
                      type="date"
                      aria-label="Dernier jour de la série"
                      className="w-[200px]"
                    />
                  </label>
                  {errors.seriesUntil ?? errors.seriesCount ? (
                    <p role="alert" className="caption text-crimson-ink">
                      {errors.seriesUntil ?? errors.seriesCount}
                    </p>
                  ) : null}
                </fieldset>

                <SeriesPreview
                  premiere={premiere}
                  recurrence={recurrence}
                  monthlyMode={monthlyMode}
                />
              </>
            )}
          </div>
        )}
      </section>

      <section>
        <SectionHeading title="Organisation et bannière" compact />
        <div className="flex flex-col gap-4">
          {characters.length > 0 ? (
            <Field
              label="Organisé par"
              htmlFor="organiserCharacterId"
              error={errors.organiserCharacterId}
            >
              <Select
                id="organiserCharacterId"
                name="organiserCharacterId"
                defaultValue={event?.organiser?.id ?? ""}
              >
                <option value="">Sans personnage organisateur</option>
                {characters.map((character) => (
                  <option key={character.id} value={character.id}>
                    {character.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          <ImageField
            label="Bannière de l'évènement"
            name="bannerUrl"
            altName="bannerAlt"
            folder="evenements"
            ownerId={ownerId}
            aspect="16 / 5"
            hint="Format 16:5, 1600 × 500 px au moins. 5 Mo au plus."
            defaultUrl={event?.bannerUrl}
            defaultAlt={event?.bannerAlt}
            error={errors.bannerUrl}
            altError={errors.bannerAlt}
          />
        </div>
      </section>

      <FormMessage state={state} />

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton size="lead" pendingLabel="ENREGISTREMENT…">
          {event ? "ENREGISTRER L'ANNONCE" : "PROPOSER CET ÉVÈNEMENT"}
        </SubmitButton>
        <Button asChild variant="link" size="inline">
          <a href={event ? `/evenements/${event.slug}` : "/evenements"}>Annuler</a>
        </Button>
      </div>
    </form>
  );
}

/** « Tous les samedis à 21h00 » : ce qu'une cadence hebdomadaire promet. */
function choixHebdomadaire(premiere: Date): string {
  const jour = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    timeZone: GAME_TIME_ZONE,
  }).format(premiere);
  return `Tous les ${jour}s à ${formatGameTime(premiere)}.`;
}

/** Ce que la règle promet, avant d'enregistrer quoi que ce soit. Une série se
 *  choisit en voyant ses dates : « le troisième samedi » et « le 17 » ne se
 *  distinguent pas autrement. */
function SeriesPreview({
  premiere,
  recurrence,
  monthlyMode,
}: {
  premiere: Date | null;
  recurrence: Recurrence;
  monthlyMode: MonthlyMode;
}) {
  if (!premiere) {
    return (
      <p className="caption text-ink-subtle">
        Donnez la date de début : les séances s&apos;en déduisent.
      </p>
    );
  }

  const suivantes = prochainesSeances(
    premiere,
    { recurrence: recurrence as "hebdomadaire" | "mensuelle", monthlyMode, until: null },
    5,
  );

  return (
    <div className="border border-rule bg-surface p-5">
      <p className="panel-title mb-3">Les prochaines séances</p>
      <div className="mb-1 h-px bg-hairline" />
      <ul>
        {[premiere, ...suivantes].map((date) => (
          <li
            key={date.toISOString()}
            className="flex items-baseline justify-between gap-4 border-b border-hairline py-3 last:border-b-0"
          >
            <span className="text-[17px] text-ink">{formatLongDate(date)}</span>
            <span className="caption text-right text-ink-muted">
              {formatTyrianDate(date)} · {formatGameTime(date)}
            </span>
          </li>
        ))}
      </ul>
      <p className="caption mt-3 text-ink-subtle">
        {`Les ${OCCURRENCES_PAR_LOT} premières séances sont écrites d'un coup ; la série se prolonge depuis sa page.`}
      </p>
    </div>
  );
}
