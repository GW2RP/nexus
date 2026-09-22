"use client";

import { useRef, useState } from "react";

import {
  ACCEPTED_IMAGE_TYPES,
  uploadFailureMessage,
  uploadImage,
} from "@/components/forms/upload-image";
import { CloseIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import {
  PAS_CLAVIER,
  PAS_CLAVIER_FIN,
  PLANS_MAX,
  POINTS_PAR_PLAN_MAX,
  clampPourcentage,
} from "@/lib/floor-plans";
import type { FloorPlan } from "@/server/types";

type PointBrouillon = { label: string; description: string; x: number; y: number };

type PlanBrouillon = {
  /** Une clé de rendu, propre au formulaire : deux plans peuvent porter le même
   *  nom, et leur rang change dès qu'on en déplace un. Elle n'est pas postée. */
  key: string;
  title: string;
  imageUrl: string;
  imageAlt: string;
  width: number | null;
  height: number | null;
  points: PointBrouillon[];
};

/** Un point posé au clavier n'a pas de curseur pour dire où : il se pose au
 *  milieu du plan, d'où les flèches le mènent où il faut. */
const MILIEU = { x: 50, y: 50 };

function toBrouillon(plan: FloorPlan, rang: number): PlanBrouillon {
  return {
    key: `plan-${rang}`,
    title: plan.title,
    imageUrl: plan.imageUrl ?? "",
    imageAlt: plan.imageAlt ?? "",
    width: plan.width,
    height: plan.height,
    points: plan.points.map((point) => ({
      label: point.label,
      description: point.description ?? "",
      x: point.x,
      y: point.y,
    })),
  };
}

/** Le point cliqué, en pourcentage de l'image — c'est ainsi qu'il est rangé :
 *  le plan se rend à la largeur de la colonne, jamais à sa taille d'origine. */
function positionDans(surface: HTMLElement, clientX: number, clientY: number) {
  const cadre = surface.getBoundingClientRect();
  if (cadre.width === 0 || cadre.height === 0) return null;
  return {
    x: clampPourcentage(((clientX - cadre.left) / cadre.width) * 100),
    y: clampPourcentage(((clientY - cadre.top) / cadre.height) * 100),
  };
}

/** Déplace un élément d'un cran dans une liste, et renvoie la liste déplacée. */
function decale<T>(liste: T[], rang: number, sens: -1 | 1): T[] {
  const cible = rang + sens;
  if (cible < 0 || cible >= liste.length) return liste;
  const suite = [...liste];
  [suite[rang], suite[cible]] = [suite[cible], suite[rang]];
  return suite;
}

/** Les plans d'un lieu : on en téléverse plusieurs — le rez-de-chaussée,
 *  l'étage, la cave — et on pose sur chacun des points numérotés qui portent
 *  leur légende.
 *
 *  Tout part dans un seul champ caché, en JSON, comme le tracé d'une zone : ni
 *  le nombre de plans ni celui de leurs points n'est connu à l'avance, et deux
 *  champs par point ne se nomment pas.
 *
 *  Le nom du plan, l'alternative de son image et la légende d'un point sont
 *  `required` sans porter de `name` : ils ne sont pas postés — le JSON les
 *  emporte — mais le navigateur refuse quand même d'envoyer le formulaire tant
 *  qu'ils manquent, et il le dit sur le champ plutôt qu'en haut de page après
 *  un aller-retour. */
export function FloorPlansField({
  ownerId,
  plans: initial,
  error,
}: {
  /** L'auteur du contenu : les images sont rangées sous lui. */
  ownerId: string;
  plans?: FloorPlan[];
  error?: string;
}) {
  const [plans, setPlans] = useState<PlanBrouillon[]>(() => (initial ?? []).map(toBrouillon));

  function modifier(rang: number, changement: Partial<PlanBrouillon>) {
    setPlans((current) =>
      current.map((plan, index) => (index === rang ? { ...plan, ...changement } : plan)),
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <input
        type="hidden"
        name="floorPlans"
        value={JSON.stringify(
          plans.map((plan) => ({
            title: plan.title,
            imageUrl: plan.imageUrl,
            imageAlt: plan.imageAlt,
            width: plan.width,
            height: plan.height,
            points: plan.points,
          })),
        )}
      />

      {plans.map((plan, rang) => (
        <PlanEditor
          key={plan.key}
          ownerId={ownerId}
          plan={plan}
          rang={rang}
          total={plans.length}
          onChange={(changement) => modifier(rang, changement)}
          onMove={(sens) => setPlans((current) => decale(current, rang, sens))}
          onRemove={() => setPlans((current) => current.filter((_, index) => index !== rang))}
        />
      ))}

      <div className="flex flex-wrap items-center gap-3">
        {plans.length < PLANS_MAX ? (
          <UploadImage
            ownerId={ownerId}
            id="plan-fichier"
            label="AJOUTER UN PLAN"
            onUploaded={(imageUrl) =>
              setPlans((current) => [
                ...current,
                {
                  key: `plan-${crypto.randomUUID()}`,
                  title: "",
                  imageUrl,
                  imageAlt: "",
                  width: null,
                  height: null,
                  points: [],
                },
              ])
            }
          />
        ) : null}
        <p className="caption text-ink-subtle">
          {plans.length} plan{plans.length > 1 ? "s" : ""} sur {PLANS_MAX}. 5 Mo au plus.
        </p>
      </div>

      {error ? (
        <p role="alert" className="caption text-crimson-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Le bouton qui téléverse une image et rend son adresse. Il sert deux fois :
 *  pour ajouter un plan, et pour donner la sienne à un plan qui n'en a pas
 *  encore — ou la remplacer sans perdre les points déjà posés. */
function UploadImage({
  ownerId,
  id,
  label,
  onUploaded,
}: {
  ownerId: string;
  id: string;
  label: string;
  onUploaded: (imageUrl: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const fichier = useRef<HTMLInputElement>(null);

  async function televerser(file: File) {
    setFailure(null);
    setBusy(true);
    try {
      onUploaded(await uploadImage(file, "lieux", ownerId));
    } catch (uploadError) {
      setFailure(uploadFailureMessage(uploadError));
    } finally {
      setBusy(false);
      // Sans cela, re-choisir le même fichier après un échec ne déclenche rien.
      if (fichier.current) fichier.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        ref={fichier}
        id={id}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void televerser(file);
        }}
        className="sr-only"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fichier.current?.click()}
        disabled={busy}
      >
        {busy ? "TÉLÉVERSEMENT…" : label}
      </Button>
      {failure ? (
        <p role="alert" className="caption text-crimson-ink">
          {failure}
        </p>
      ) : null}
    </div>
  );
}

/** Un plan et ses points : l'image se clique pour en poser un, et un point posé
 *  se glisse — ou se déplace aux flèches une fois au clavier, d'un pourcent, et
 *  d'un dixième avec Maj. */
function PlanEditor({
  ownerId,
  plan,
  rang,
  total,
  onChange,
  onMove,
  onRemove,
}: {
  ownerId: string;
  plan: PlanBrouillon;
  rang: number;
  total: number;
  onChange: (changement: Partial<PlanBrouillon>) => void;
  onMove: (sens: -1 | 1) => void;
  onRemove: () => void;
}) {
  // Le point qu'on est en train de glisser. La capture du pointeur porte le clic
  // de fin sur le point lui-même : la surface ne le voit pas, et le relâchement
  // ne pose donc pas un point de plus là où l'on vient de déposer celui-ci.
  const glissement = useRef<number | null>(null);
  const surface = useRef<HTMLDivElement>(null);

  const nomId = `${plan.key}-nom`;
  const altId = `${plan.key}-alternative`;
  const legendeId = (index: number) => `${plan.key}-point-${index}-legende`;
  const detailId = (index: number) => `${plan.key}-point-${index}-detail`;

  function changerPoint(index: number, changement: Partial<PointBrouillon>) {
    onChange({
      points: plan.points.map((point, rangDuPoint) =>
        rangDuPoint === index ? { ...point, ...changement } : point,
      ),
    });
  }

  function poser(position: { x: number; y: number }) {
    if (plan.points.length >= POINTS_PAR_PLAN_MAX) return;
    onChange({ points: [...plan.points, { label: "", description: "", ...position }] });
    // Un point sans légende ne dit rien : on ouvre la sienne aussitôt posé.
    requestAnimationFrame(() => document.getElementById(legendeId(plan.points.length))?.focus());
  }

  return (
    <div className="border border-rule p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="meta text-ink-muted">
          Plan {rang + 1} sur {total}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {rang > 0 ? (
            <Button
              type="button"
              variant="quiet"
              size="sm"
              onClick={() => onMove(-1)}
              aria-label={`Monter le plan ${rang + 1}`}
            >
              MONTER
            </Button>
          ) : null}
          {rang < total - 1 ? (
            <Button
              type="button"
              variant="quiet"
              size="sm"
              onClick={() => onMove(1)}
              aria-label={`Descendre le plan ${rang + 1}`}
            >
              DESCENDRE
            </Button>
          ) : null}
          <button
            type="button"
            onClick={onRemove}
            className="meta inline-flex min-h-tap items-center gap-2 px-2 text-ink-muted hover:text-ink"
          >
            <CloseIcon size={14} />
            Retirer le plan
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Field label="Nom du plan" htmlFor={nomId} required>
          <Input
            id={nomId}
            required
            maxLength={80}
            value={plan.title}
            onChange={(event) => onChange({ title: event.target.value })}
            placeholder="Rez-de-chaussée"
          />
        </Field>

        <div className="framed">
          <div ref={surface} className="relative w-full">
            <button
              type="button"
              onClick={(event) => {
                // La mesure se prend sur la surface, et non sur le bouton :
                // c'est elle qui porte les points, donc c'est dans son cadre
                // qu'un pourcentage désigne quelque chose.
                if (!surface.current) return;
                // `detail` à zéro : le clic vient du clavier, et n'a donc aucun
                // endroit à lui. Le point se pose alors au milieu.
                const position =
                  event.detail === 0
                    ? MILIEU
                    : positionDans(surface.current, event.clientX, event.clientY);
                if (position) poser(position);
              }}
              aria-label={`Poser un point sur le plan ${rang + 1}`}
              className="block w-full cursor-crosshair"
            >
              {plan.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={plan.imageUrl}
                  alt={plan.imageAlt}
                  onLoad={(event) => {
                    // Les dimensions du fichier viennent de l'image elle-même :
                    // le cadre les reprend pour rapport, et les points ne
                    // sautent plus à son chargement.
                    const image = event.currentTarget;
                    if (plan.width === null && image.naturalWidth > 0) {
                      onChange({ width: image.naturalWidth, height: image.naturalHeight });
                    }
                  }}
                  style={
                    plan.width && plan.height
                      ? { aspectRatio: `${plan.width} / ${plan.height}` }
                      : undefined
                  }
                  className="block w-full border border-rule"
                />
              ) : (
                <span
                  className="hatch flex w-full items-center justify-center border border-rule px-4 text-center font-display text-[11px] font-medium tracking-[1.4px] text-gold-eyebrow"
                  style={{ aspectRatio: "16 / 11" }}
                >
                  [ PLAN TÉLÉVERSÉ · 1600 × 1100 ]
                </span>
              )}
            </button>

            {plan.points.map((point, index) => (
              <button
                key={index}
                type="button"
                onClick={() => document.getElementById(legendeId(index))?.focus()}
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  glissement.current = index;
                }}
                onPointerMove={(event) => {
                  if (glissement.current !== index || !surface.current) return;
                  const position = positionDans(surface.current, event.clientX, event.clientY);
                  if (position) changerPoint(index, position);
                }}
                // `lostpointercapture` et non `pointerup` : la capture se rend
                // d'elle-même au relâchement, mais aussi quand elle se perd —
                // geste annulé par le système, onglet quitté. Sur `pointerup`
                // seul, le point serait resté saisi, et le survol suivant
                // l'aurait traîné sans qu'aucun bouton soit enfoncé.
                onLostPointerCapture={() => {
                  if (glissement.current === index) glissement.current = null;
                }}
                onKeyDown={(event) => {
                  const pas = event.shiftKey ? PAS_CLAVIER_FIN : PAS_CLAVIER;
                  const deplacements: Record<string, { x: number; y: number }> = {
                    ArrowLeft: { x: -pas, y: 0 },
                    ArrowRight: { x: pas, y: 0 },
                    ArrowUp: { x: 0, y: -pas },
                    ArrowDown: { x: 0, y: pas },
                  };
                  const deplacement = deplacements[event.key];
                  if (!deplacement) return;
                  event.preventDefault();
                  changerPoint(index, {
                    x: clampPourcentage(point.x + deplacement.x),
                    y: clampPourcentage(point.y + deplacement.y),
                  });
                }}
                aria-label={`Point ${index + 1}, ${point.label || "sans légende"} — à ${Math.round(point.x)} % de la gauche et ${Math.round(point.y)} % du haut. Les flèches le déplacent.`}
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
                className="absolute inline-flex size-8 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-full border-2 border-gold bg-surface font-display text-[15px] font-bold text-gold-ink"
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>

        <p aria-live="polite" className="caption text-ink-subtle">
          {plan.points.length === 0
            ? "Cliquez sur le plan pour poser un premier point."
            : `${plan.points.length} point${plan.points.length > 1 ? "s" : ""} posé${plan.points.length > 1 ? "s" : ""}. Glissez-en un pour le déplacer, ou déplacez-le aux flèches une fois au clavier.`}
        </p>

        <UploadImage
          ownerId={ownerId}
          id={`${plan.key}-fichier`}
          label={plan.imageUrl ? "REMPLACER L'IMAGE" : "TÉLÉVERSER L'IMAGE"}
          // Les points restent : c'est le fond qui change, pas ce qu'il porte.
          // Les dimensions, elles, sont celles de l'ancien fichier — la nouvelle
          // image les redonnera en arrivant.
          onUploaded={(imageUrl) => onChange({ imageUrl, width: null, height: null })}
        />

        {plan.imageUrl ? (
          <Field
            label="Alternative textuelle"
            htmlFor={altId}
            required
            hint="Ce que voit quelqu'un qui n'a pas l'image."
          >
            <Input
              id={altId}
              required
              maxLength={240}
              value={plan.imageAlt}
              onChange={(event) => onChange({ imageAlt: event.target.value })}
            />
          </Field>
        ) : null}

        {plan.points.length > 0 ? (
          <ul className="flex flex-col gap-4">
            {plan.points.map((point, index) => (
              <li key={index} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-2 inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-gold font-display text-[13px] font-bold text-gold-ink"
                >
                  {index + 1}
                </span>
                <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                  <Field label={`Légende du point ${index + 1}`} htmlFor={legendeId(index)} required>
                    <Input
                      id={legendeId(index)}
                      required
                      maxLength={80}
                      value={point.label}
                      onChange={(event) => changerPoint(index, { label: event.target.value })}
                      placeholder="Le comptoir"
                    />
                  </Field>
                  <Field label={`Détail du point ${index + 1}`} htmlFor={detailId(index)}>
                    <Input
                      id={detailId(index)}
                      maxLength={400}
                      value={point.description}
                      onChange={(event) => changerPoint(index, { description: event.target.value })}
                    />
                  </Field>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      points: plan.points.filter((_, rangDuPoint) => rangDuPoint !== index),
                    })
                  }
                  aria-label={`Retirer le point ${index + 1}`}
                  className="mt-2 inline-flex size-tap shrink-0 items-center justify-center text-ink-muted hover:text-ink"
                >
                  <CloseIcon size={14} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
