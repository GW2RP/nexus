"use client";

import { useActionState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { idleState } from "@/lib/action-state";
import { cn } from "@/lib/utils";
import { moveTerrainZoneAction } from "@/server/actions/terrain-zones";

/** La largeur d'un bouton, sans le bouton. */
function Intercalaire({ mot, colonne }: { mot: string; colonne: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(buttonVariants({ variant: "quiet", size: "sm" }), "invisible", colonne)}
    >
      {mot}
    </span>
  );
}

/**
 * Déplace une zone d'un cran dans l'ordre d'application.
 *
 * Les deux boutons vivent dans **un seul formulaire** : c'est le bouton cliqué
 * qui pose son `sens`, donc une seule action et un seul retour d'erreur par
 * ligne. Aux extrémités le bouton n'est pas grisé, il n'est pas rendu — la règle
 * du système est de retirer ce qui n'a pas lieu d'être. Sa **place**, elle,
 * reste : un intercalaire invisible tient la colonne, sans quoi la première et
 * la dernière ligne décaleraient toute leur rangée de boutons. `visibility:
 * hidden` ne se voit pas, ne se tabule pas et ne se lit pas — ce n'est pas une
 * action grisée, c'est un vide de la bonne largeur.
 *
 * Le rang se lit à l'écran dans la pastille ; il se dit aussi, à voix basse,
 * pour qui ne voit pas la liste se renuméroter.
 */
export function TerrainZoneOrder({
  id,
  name,
  position,
  total,
}: {
  id: string;
  name: string;
  /** Le rang affiché, de 1 à `total`. */
  position: number;
  total: number;
}) {
  const [state, formAction] = useActionState(moveTerrainZoneAction, idleState);

  return (
    <form action={formAction} className="flex flex-col items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <div className="grid grid-cols-2 gap-2">
        {position > 1 ? (
          <Button
            type="submit"
            name="sens"
            value="avant"
            variant="quiet"
            size="sm"
            className="col-start-1"
            aria-label={`Monter ${name}`}
          >
            MONTER
          </Button>
        ) : (
          <Intercalaire mot="MONTER" colonne="col-start-1" />
        )}
        {position < total ? (
          <Button
            type="submit"
            name="sens"
            value="apres"
            variant="quiet"
            size="sm"
            className="col-start-2"
            aria-label={`Descendre ${name}`}
          >
            DESCENDRE
          </Button>
        ) : (
          <Intercalaire mot="DESCENDRE" colonne="col-start-2" />
        )}
      </div>
      <p aria-live="polite" className="sr-only">
        {name}, rang {position} sur {total}
      </p>
      <FormMessage state={state} />
    </form>
  );
}
