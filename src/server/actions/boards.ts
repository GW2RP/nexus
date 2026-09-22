"use server";

import { Types } from "mongoose";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  ARROW_DEFAULTS,
  ARROWS_MAX,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  BOARDS_PER_GROUP_MAX,
  ELEMENT_MAX,
  ELEMENT_MIN,
  ELEMENTS_MAX,
  LEGEND_MAX,
  isRichKind,
  isValidColor,
  type BoardContent,
  type BoardOperation,
  type BoardOperationResult,
  type ElementKind,
  type Palette,
} from "@/lib/boards";
import {
  canEditPlace,
  canManageBoard,
  canManageGroup,
  canModifyBoardItem,
  canSeeBoard,
  canWriteBoard,
} from "@/lib/permissions";
import { getCurrentUser } from "@/lib/session";
import { Board } from "@/models/board";
import { Group } from "@/models/group";
import { Place } from "@/models/place";
import { loadBoard, type LoadedBoard, type RawArrow, type RawElement } from "@/server/boards";
import {
  errorState,
  objectIdOrNull,
  parseForm,
  requireContributor,
  successState,
  toActionState,
  type ActionState,
} from "@/server/actions/helpers";
import { boardOperationSchema, boardSchema } from "@/server/actions/schemas";
import { groupBoardPath, placeBoardPath, serializeContent } from "@/server/queries/boards";

/** Les écritures d'un panneau ne retirent aucune étiquette : ses lectures ne
 *  passent pas par le cache (voir `queries/boards.ts`). Seules celles qui
 *  changent ce que la fiche du groupe ou du lieu affiche — un panneau ouvert,
 *  renommé, fermé — revalident son chemin. */

function refreshOwner(loaded: Pick<LoadedBoard, "path" | "ownerPath">) {
  revalidatePath(loaded.ownerPath);
  revalidatePath(loaded.path);
}

/* --- Ouvrir, régler, fermer --------------------------------------------- */

export async function createGroupBoardAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let path: string;
  try {
    const user = await requireContributor();
    const groupId = objectIdOrNull(formData.get("groupId"));
    const group = groupId
      ? await Group.findOne({ _id: groupId, hidden: { $ne: true } } as never)
      : null;
    if (!group) return errorState("Ce groupe n'existe plus.");
    if (!canManageGroup(user, { authorId: group.authorId })) {
      return errorState("Seul le meneur du groupe ouvre un panneau.");
    }

    const parsed = parseForm(boardSchema, formData);
    if (!parsed.ok) return parsed.state;

    const count = await Board.countDocuments({ groupId: group._id } as never);
    if (count >= BOARDS_PER_GROUP_MAX) {
      return errorState(`Un groupe ne porte pas plus de ${BOARDS_PER_GROUP_MAX} panneaux.`);
    }

    const board = await Board.create({
      ...parsed.data,
      ownerType: "groupe",
      groupId: group._id,
      authorId: user.id,
    });
    path = groupBoardPath(group.slug, String(board._id));
    revalidatePath(`/groupes/${group.slug}`);
  } catch (error) {
    return toActionState(error);
  }

  redirect(path);
}

/** Ouvrir le panneau d'un lieu. Il n'en porte qu'un, public, et c'est l'équipe
 *  du lieu qui l'ouvre — ou qui le ferme. */
export async function openPlaceBoardAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let path: string;
  try {
    const user = await requireContributor();
    const placeId = objectIdOrNull(formData.get("placeId"));
    const place = placeId
      ? await Place.findOne({ _id: placeId, hidden: { $ne: true } } as never)
      : null;
    if (!place) return errorState("Ce lieu n'existe plus.");
    if (!canEditPlace(user, { authorId: place.authorId, managerIds: place.managerIds ?? [] })) {
      return errorState("Seule l'équipe du lieu ouvre son panneau.");
    }

    path = placeBoardPath(place.slug);
    const existing = await Board.exists({ placeId: place._id } as never);
    if (!existing) {
      await Board.create({
        ownerType: "lieu",
        placeId: place._id,
        name: "Panneau d'affichage",
        visibility: "public",
        authorId: user.id,
      });
    }
    revalidatePath(`/lieux/${place.slug}`);
  } catch (error) {
    return toActionState(error);
  }

  redirect(path);
}

/** Renommer un panneau de groupe, ou changer qui le lit. */
export async function updateBoardAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireContributor();
    const loaded = await loadBoard(objectIdOrNull(formData.get("id")));
    if (!loaded) return errorState("Ce panneau n'existe plus.");
    if (loaded.access.ownerType !== "groupe") {
      return errorState("Le panneau d'un lieu est public et porte le nom du lieu.");
    }
    if (!canManageBoard(user, loaded.access)) {
      return errorState("Seul le meneur du groupe règle ses panneaux.");
    }

    const parsed = parseForm(boardSchema, formData);
    if (!parsed.ok) return parsed.state;

    await Board.updateOne({ _id: loaded.doc._id } as never, { $set: parsed.data });
    refreshOwner(loaded);
    return successState("Le panneau est enregistré.");
  } catch (error) {
    return toActionState(error);
  }
}

/** Fermer un panneau : il disparaît avec tout ce qu'on y avait posé. */
export async function deleteBoardAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ownerPath: string;
  try {
    const user = await requireContributor();
    const loaded = await loadBoard(objectIdOrNull(formData.get("id")));
    if (!loaded) return errorState("Ce panneau n'existe plus.");
    if (!canManageBoard(user, loaded.access)) {
      return errorState(
        loaded.access.ownerType === "lieu"
          ? "Seule l'équipe du lieu ferme son panneau."
          : "Seul le meneur du groupe ferme ses panneaux.",
      );
    }

    await Board.deleteOne({ _id: loaded.doc._id } as never);
    refreshOwner(loaded);
    ownerPath = loaded.ownerPath;
  } catch (error) {
    return toActionState(error);
  }

  redirect(ownerPath);
}

/* --- Les gestes de l'éditeur --------------------------------------------- */

const round = (value: number) => Math.round(value);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Ramène une géométrie dans le panneau : un élément ne sort pas du cadre et
 *  garde une taille qu'on peut encore saisir. */
function boundGeometry(patch: { x?: number; y?: number; w?: number; h?: number }) {
  const bounded: Record<string, number> = {};
  if (patch.w !== undefined) bounded.w = round(clamp(patch.w, ELEMENT_MIN, ELEMENT_MAX));
  if (patch.h !== undefined) bounded.h = round(clamp(patch.h, ELEMENT_MIN, ELEMENT_MAX));
  if (patch.x !== undefined) bounded.x = round(clamp(patch.x, 0, BOARD_WIDTH));
  if (patch.y !== undefined) bounded.y = round(clamp(patch.y, 0, BOARD_HEIGHT));
  return bounded;
}

class Refus extends Error {}

function checkColor(palette: Palette, value: string | undefined) {
  if (value !== undefined && !isValidColor(palette, value)) {
    throw new Refus("Cette couleur n'est pas lisible.");
  }
}

function checkText(kind: ElementKind, text: string | undefined) {
  if (text !== undefined && !isRichKind(kind) && text.length > LEGEND_MAX) {
    throw new Refus("La légende d'une forme tient en quelques mots.");
  }
}

const oid = (id: string) => new Types.ObjectId(id);

/** Applique un geste de l'éditeur. Il répond sans rediriger ni revalider : la
 *  page est déjà à jour chez celui qui l'a fait. En cas de refus, il renvoie le
 *  panneau tel qu'il est en base, pour que l'éditeur s'y range. */
export async function boardOperationAction(
  boardId: string,
  operation: BoardOperation,
): Promise<BoardOperationResult> {
  let loaded: LoadedBoard | null = null;
  try {
    const user = await requireContributor();
    loaded = await loadBoard(objectIdOrNull(boardId));
    if (!loaded || !canSeeBoard(user, loaded.access)) {
      return { ok: false, message: "Ce panneau n'existe plus." };
    }
    if (!canWriteBoard(user, loaded.access)) {
      return { ok: false, message: "Vous ne pouvez pas écrire sur ce panneau." };
    }

    const parsed = boardOperationSchema.safeParse(operation);
    if (!parsed.success) {
      throw new Refus(parsed.error.issues[0]?.message ?? "Ce geste n'a pas pu être lu.");
    }
    const op = parsed.data;
    const { doc, access } = loaded;
    const elements = (doc.elements ?? []) as RawElement[];
    const arrows = (doc.arrows ?? []) as RawArrow[];
    const removed = (doc.removed ?? []) as RawElement[];
    const removedArrows = (doc.removedArrows ?? []) as RawArrow[];
    const find = <T extends { _id: unknown }>(list: T[], id: string) =>
      list.find((one) => String(one._id) === id);
    const zs = elements.map((one) => one.z ?? 0);
    const filter = { _id: doc._id } as never;

    /** L'élément visé, s'il existe encore et qu'on a le droit d'y toucher. */
    const target = (id: string) => {
      const element = find(elements, id);
      if (!element || element.hidden) throw new Refus("Cet élément n'est plus sur le panneau.");
      if (!canModifyBoardItem(user, access, element.authorId)) {
        throw new Refus("Seul son auteur, ou l'équipe du lieu, touche à cet élément.");
      }
      return element;
    };
    const targetArrow = (id: string) => {
      const arrow = find(arrows, id);
      if (!arrow) throw new Refus("Cette flèche n'est plus sur le panneau.");
      if (!canModifyBoardItem(user, access, arrow.authorId)) {
        throw new Refus("Seul son auteur, ou l'équipe du lieu, touche à cette flèche.");
      }
      return arrow;
    };

    switch (op.type) {
      case "poser": {
        const { id, kind, text, size, stroke, fill, ink, ...geometry } = op.element;
        if (elements.length >= ELEMENTS_MAX) {
          throw new Refus(`Un panneau ne porte pas plus de ${ELEMENTS_MAX} éléments.`);
        }
        if (find(elements, id) || find(removed, id)) throw new Refus("Cet élément existe déjà.");
        checkColor("stroke", stroke);
        checkColor("fill", fill);
        checkColor("ink", ink);
        checkText(kind, text);
        await Board.updateOne(filter, {
          $push: {
            elements: {
              _id: oid(id),
              kind,
              ...boundGeometry(geometry),
              z: (zs.length ? Math.max(...zs) : 0) + 1,
              text,
              size,
              stroke,
              fill,
              ink,
              authorId: user.id,
              createdAt: new Date(),
            },
          },
        } as never);
        break;
      }

      case "modifier": {
        const element = target(op.id);
        const { x, y, w, h, stroke, fill, ink, ...rest } = op.patch;
        checkColor("stroke", stroke);
        checkColor("fill", fill);
        checkColor("ink", ink);
        checkText(element.kind as ElementKind, rest.text);
        const patch = { ...boundGeometry({ x, y, w, h }), ...rest, stroke, fill, ink };
        const set: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(patch)) {
          if (value !== undefined) set[`elements.$[e].${key}`] = value;
        }
        if (Object.keys(set).length === 0) break;
        await Board.updateOne(filter, { $set: set } as never, {
          arrayFilters: [{ "e._id": oid(op.id) }],
        });
        break;
      }

      case "plan": {
        target(op.id);
        const z = op.sens === "avant" ? Math.max(0, ...zs) + 1 : Math.min(0, ...zs) - 1;
        await Board.updateOne(filter, { $set: { "elements.$[e].z": z } } as never, {
          arrayFilters: [{ "e._id": oid(op.id) }],
        });
        break;
      }

      case "retirer": {
        const element = target(op.id);
        const id = oid(op.id);
        const attached = arrows.filter(
          (arrow) => String(arrow.from) === op.id || String(arrow.to) === op.id,
        );
        // La corbeille est bornée : on rétablit un geste malheureux, on
        // n'archive pas le panneau.
        await Board.updateOne(filter, {
          $pull: { elements: { _id: id }, arrows: { $or: [{ from: id }, { to: id }] } },
          $push: {
            removed: { $each: [element], $slice: -50 },
            removedArrows: { $each: attached, $slice: -100 },
          },
        } as never);
        break;
      }

      case "retablir": {
        const element = find(removed, op.id);
        if (!element) throw new Refus("Cet élément ne peut plus être rétabli.");
        if (find(elements, op.id)) break;
        if (!canModifyBoardItem(user, access, element.authorId)) {
          throw new Refus("Seul son auteur, ou l'équipe du lieu, rétablit cet élément.");
        }
        if (elements.length >= ELEMENTS_MAX) {
          throw new Refus(`Un panneau ne porte pas plus de ${ELEMENTS_MAX} éléments.`);
        }
        // Ses flèches reviennent avec lui, quand leur autre bout est encore là.
        const present = new Set(elements.map((one) => String(one._id)).concat(op.id));
        const back = removedArrows.filter(
          (arrow) =>
            (String(arrow.from) === op.id || String(arrow.to) === op.id) &&
            present.has(String(arrow.from)) &&
            present.has(String(arrow.to)) &&
            !find(arrows, String(arrow._id)),
        );
        await Board.updateOne(filter, {
          $pull: {
            removed: { _id: oid(op.id) },
            removedArrows: { _id: { $in: back.map((arrow) => arrow._id) } },
          },
          $push: { elements: element, arrows: { $each: back } },
        } as never);
        break;
      }

      case "relier": {
        const { id, from, to, ...style } = op.arrow;
        if (arrows.length >= ARROWS_MAX) {
          throw new Refus(`Un panneau ne porte pas plus de ${ARROWS_MAX} flèches.`);
        }
        if (from === to) throw new Refus("Une flèche relie deux éléments différents.");
        const ends = [find(elements, from), find(elements, to)];
        if (ends.some((end) => !end || end.hidden)) {
          throw new Refus("L'un des deux éléments n'est plus sur le panneau.");
        }
        if (find(arrows, id) || find(removedArrows, id)) throw new Refus("Cette flèche existe déjà.");
        checkColor("stroke", style.color);
        await Board.updateOne(filter, {
          $push: {
            arrows: {
              ...ARROW_DEFAULTS,
              ...style,
              _id: oid(id),
              from: oid(from),
              to: oid(to),
              authorId: user.id,
              createdAt: new Date(),
            },
          },
        } as never);
        break;
      }

      case "modifier-fleche": {
        targetArrow(op.id);
        checkColor("stroke", op.patch.color);
        const set: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(op.patch)) {
          if (value !== undefined) set[`arrows.$[a].${key}`] = value;
        }
        if (Object.keys(set).length === 0) break;
        await Board.updateOne(filter, { $set: set } as never, {
          arrayFilters: [{ "a._id": oid(op.id) }],
        });
        break;
      }

      case "retirer-fleche": {
        const arrow = targetArrow(op.id);
        await Board.updateOne(filter, {
          $pull: { arrows: { _id: oid(op.id) } },
          $push: { removedArrows: { $each: [arrow], $slice: -100 } },
        } as never);
        break;
      }

      case "retablir-fleche": {
        const arrow = find(removedArrows, op.id);
        if (!arrow) throw new Refus("Cette flèche ne peut plus être rétablie.");
        if (find(arrows, op.id)) break;
        if (!canModifyBoardItem(user, access, arrow.authorId)) {
          throw new Refus("Seul son auteur, ou l'équipe du lieu, rétablit cette flèche.");
        }
        if (!find(elements, String(arrow.from)) || !find(elements, String(arrow.to))) {
          throw new Refus("L'un des deux éléments n'est plus sur le panneau.");
        }
        await Board.updateOne(filter, {
          $pull: { removedArrows: { _id: oid(op.id) } },
          $push: { arrows: arrow },
        } as never);
        break;
      }
    }

    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Refus || error instanceof Error
        ? error.message
        : "La modification n'a pas été enregistrée.";
    return { ok: false, message, content: await freshContent(loaded) };
  }
}

/** Le panneau tel qu'il est en base, pour que l'éditeur s'y range après un
 *  refus — ou quand on revient sur l'onglet après l'avoir quitté. */
async function freshContent(loaded: LoadedBoard | null): Promise<BoardContent | undefined> {
  if (!loaded) return undefined;
  const again = await loadBoard(String(loaded.doc._id));
  return again ? serializeContent(again.doc) : undefined;
}

export async function readBoardContentAction(boardId: string): Promise<BoardContent | null> {
  const user = await getCurrentUser();
  const loaded = await loadBoard(objectIdOrNull(boardId));
  if (!loaded || !canSeeBoard(user, loaded.access)) return null;
  return serializeContent(loaded.doc);
}
