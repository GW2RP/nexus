"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { useKeptFormValues } from "@/components/forms/keep-values";
import { AccountPicker } from "@/components/forms/account-picker";
import { Button } from "@/components/ui/button";
import { FloorPlansField } from "@/components/forms/floor-plans-field";
import { ImageField } from "@/components/forms/image-field";
import { RichTextField } from "@/components/forms/rich-text-field";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SectionHeading } from "@/components/ui/section-heading";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  PLACE_TYPES,
  PLACE_TYPE_LABELS,
  type PlaceType,
  REGIONS,
  REGION_LABELS,
} from "@/lib/domain";
import { MapPicker } from "@/components/map/map-picker";
import { idleState } from "@/lib/action-state";
import { cn } from "@/lib/utils";
import {
  createPlaceAction,
  listKeeperOptionsAction,
  updatePlaceAction,
} from "@/server/actions/places";
import type { AuthorSummary, PlaceDetail } from "@/server/types";

type KeeperOption = { id: string; name: string; authorId: string };

export function PlaceForm({
  ownerId,
  place,
  keeperOptions,
  canChangeTeam,
  initialCoordinates,
}: {
  /** L'auteur du contenu : les images sont rangées sous lui. */
  ownerId: string;
  place?: PlaceDetail;
  /** Les personnages de l'auteur et de ses co-gérants, au chargement. */
  keeperOptions: KeeperOption[];
  /** La liste des co-gérants appartient à l'auteur du lieu, pas à eux. */
  canChangeTeam: boolean;
  /** Le point cliqué sur la carte, quand le lieu part de là. */
  initialCoordinates?: { x: number; y: number } | null;
}) {
  const [state, formAction] = useActionState(
    place ? updatePlaceAction : createPlaceAction,
    idleState,
  );
  const errors = state.fieldErrors ?? {};
  // Les plans partent en un seul champ : leurs erreurs, elles, portent le chemin
  // du point fautif — « floorPlans.1.points.3.label ». La première remonte au
  // champ plutôt que de rester en bas de page sans rien désigner.
  const planError = Object.entries(errors).find(
    ([path]) => path === "floorPlans" || path.startsWith("floorPlans."),
  )?.[1];

  // React vide un formulaire soumis : cette garde lui laisse ses valeurs.
  const formulaire = useKeptFormValues();

  // Le pin de la carte reprend le glyphe du type choisi et le nom saisi.
  const [type, setType] = useState<PlaceType>(place?.type ?? "taverne");
  const [name, setName] = useState(place?.name ?? "");

  const [managers, setManagers] = useState<AuthorSummary[]>(place?.managers ?? []);
  const [keepers, setKeepers] = useState<string[]>(place?.keepers.map((keeper) => keeper.id) ?? []);
  const [options, setOptions] = useState<KeeperOption[]>(keeperOptions);
  const [optionsFailed, setOptionsFailed] = useState(false);

  // Le comptoir d'un lieu se tient avec les personnages de ceux qui le gèrent :
  // la liste se redemande dès qu'un co-gérant entre ou sort, sinon il faudrait
  // enregistrer une première fois pour voir apparaître les siens.
  const managerKey = managers.map((manager) => manager.id).join(",");
  // `null` : la dernière demande a échoué, et aucune liste de co-gérants ne
  // porte ce nom — la suivante repartira donc, même identique.
  const loadedFor = useRef<string | null>(managerKey);
  useEffect(() => {
    // Le serveur a déjà rendu la liste qui va avec les co-gérants enregistrés :
    // on ne la redemande qu'une fois la liste changée à l'écran.
    if (loadedFor.current === managerKey) return;
    loadedFor.current = managerKey;

    let abandoned = false;
    const owners = [ownerId, ...managerKey.split(",").filter(Boolean)];
    listKeeperOptionsAction(owners)
      .then((found) => {
        if (abandoned) return;
        setOptionsFailed(false);
        setOptions(found);
        // Un personnage dont le joueur vient d'être révoqué ne tient plus le lieu.
        setKeepers((current) => current.filter((id) => found.some((option) => option.id === id)));
      })
      .catch(() => {
        // Session expirée, réseau coupé : la liste à l'écran ne répond plus aux
        // co-gérants affichés. On le dit plutôt que de la laisser mentir, et on
        // rouvre la porte à une nouvelle demande.
        if (abandoned) return;
        loadedFor.current = null;
        setOptionsFailed(true);
      });
    return () => {
      abandoned = true;
    };
  }, [ownerId, managerKey]);

  return (
    <form ref={formulaire} action={formAction} className="flex max-w-[760px] flex-col gap-8">
      {place ? <input type="hidden" name="id" value={place.id} /> : null}
      {managers.map((manager) => (
        <input key={manager.id} type="hidden" name="managerIds[]" value={manager.id} />
      ))}
      {keepers.map((id) => (
        <input key={id} type="hidden" name="keeperCharacterIds[]" value={id} />
      ))}

      <section>
        <SectionHeading title="L'essentiel" compact />
        <div className="flex flex-col gap-4">
          <Field label="Nom du lieu" htmlFor="name" required error={errors.name}>
            <Input
              id="name"
              name="name"
              required
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Taverne du Lion Noir"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type" htmlFor="type" required error={errors.type}>
              <Select
                id="type"
                name="type"
                required
                value={type}
                onChange={(event) => setType(event.target.value as PlaceType)}
              >
                {PLACE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {PLACE_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Région" htmlFor="region" required error={errors.region}>
              <Select id="region" name="region" required defaultValue={place?.region ?? "kryte"}>
                {REGIONS.map((region) => (
                  <option key={region} value={region}>
                    {REGION_LABELS[region]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Quartier" htmlFor="district" error={errors.district}>
              <Input
                id="district"
                name="district"
                maxLength={120}
                defaultValue={place?.district ?? ""}
                placeholder="Quartier du Port, La Lisière de Divinité"
              />
            </Field>

            <Field label="Accès" htmlFor="access" error={errors.access}>
              <Input
                id="access"
                name="access"
                maxLength={120}
                defaultValue={place?.access ?? "Ouvert à tous"}
              />
            </Field>
          </div>

          <Field
            label="Résumé"
            htmlFor="summary"
            hint="Ce que montre le registre : trois lignes au plus."
            error={errors.summary}
          >
            <Textarea
              id="summary"
              name="summary"
              rows={3}
              maxLength={400}
              defaultValue={place?.summary ?? ""}
            />
          </Field>

          <RichTextField
            label="Description"
            name="description"
            folder="lieux"
            ownerId={ownerId}
            rows={8}
            defaultValue={place?.description}
            error={errors.description}
          />
        </div>
      </section>

      <section>
        <SectionHeading title="Qui le tient" compact />
        <div className="flex flex-col gap-6">
          <KeeperPicker
            options={options}
            selected={keepers}
            onToggle={(id) =>
              setKeepers((current) =>
                current.includes(id)
                  ? current.filter((kept) => kept !== id)
                  : [...current, id],
              )
            }
            error={
              errors.keeperCharacterIds ??
              (optionsFailed ? "La liste des personnages n'a pas pu être rafraîchie." : undefined)
            }
          />

          {canChangeTeam ? (
            <AccountPicker
              label="Co-gérants"
              inputId="co-gerant"
              hint="Ils modifieront la fiche avec vous. La liste reste à vous."
              removeLabel={(name) => `Retirer ${name} des co-gérants`}
              selected={managers}
              excludeIds={[ownerId]}
              onAdd={(account) =>
                setManagers((current) =>
                  current.some((manager) => manager.id === account.id)
                    ? current
                    : [...current, account],
                )
              }
              onRemove={(id) =>
                setManagers((current) => current.filter((manager) => manager.id !== id))
              }
              error={errors.managerIds}
            />
          ) : null}
        </div>
      </section>

      <section>
        <SectionHeading title="Emplacement sur la carte" compact />
        <MapPicker
          type={type}
          name={name}
          initial={place?.coordinates ?? initialCoordinates ?? null}
          error={errors.coordinateX ?? errors.coordinateY}
        />
      </section>

      <section>
        <SectionHeading title="Plans du lieu" compact />
        <FloorPlansField ownerId={ownerId} plans={place?.floorPlans} error={planError} />
      </section>

      <section>
        <SectionHeading title="Bannière" compact />
        <ImageField
          label="Bannière du lieu"
          name="bannerUrl"
          altName="bannerAlt"
          folder="lieux"
          ownerId={ownerId}
          aspect="16 / 5"
          hint="Format 16:5, 1600 × 500 px au moins. 5 Mo au plus."
          defaultUrl={place?.bannerUrl}
          defaultAlt={place?.bannerAlt}
          error={errors.bannerUrl}
          altError={errors.bannerAlt}
        />
      </section>

      <FormMessage state={state} />

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton size="lead" pendingLabel="ENREGISTREMENT…">
          {place ? "ENREGISTRER LE LIEU" : "PROPOSER CE LIEU"}
        </SubmitButton>
        <Button asChild variant="link" size="inline">
          <a href={place ? `/lieux/${place.slug}` : "/lieux"}>Annuler</a>
        </Button>
      </div>
    </form>
  );
}

/** « Tenu par » : plusieurs personnages, et une case par personnage plutôt
 *  qu'une liste déroulante — on doit voir d'un coup d'œil qui tient le comptoir. */
function KeeperPicker({
  options,
  selected,
  onToggle,
  error,
}: {
  options: KeeperOption[];
  selected: string[];
  onToggle: (id: string) => void;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>Tenu par</Label>
      {options.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {options.map((option) => {
            const chosen = selected.includes(option.id);
            return (
              <li key={option.id}>
                <Button
                  type="button"
                  variant={chosen ? "outline" : "quiet"}
                  size="sm"
                  aria-pressed={chosen}
                  onClick={() => onToggle(option.id)}
                  className={cn(chosen && "bg-surface-selected")}
                >
                  {option.name.toLocaleUpperCase("fr-FR")}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="caption text-ink-subtle">Aucun personnage à proposer.</p>
      )}
      {error ? (
        <p role="alert" className="caption text-crimson-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
