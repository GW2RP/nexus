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
  PRIVATE_ELEMENTS_MAX,
  PRIVATE_ELEMENTS_PER_AUTHOR_MAX,
  isRichKind,
  isValidColor,
  tipsFromHeads,
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
  canRevealBoardItem,
  canSeeBoard,
  canSeeBoardItem,
  canWriteBoard,
} from "@/lib/permissions";
import type { SessionUser } from "@/lib/session";
import { Board } from "@/models/board";
import { Group } from "@/models/group";
import { Place } from "@/models/place";
import { Report } from "@/models/report";
import {
  boardImagesOf,
  deleteBoards,
  isBoardImageOf,
  loadBoard,
  releaseBoardImages,
  type LoadedBoard,
  type RawArrow,
  type RawElement,
} from "@/server/boards";
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

    await deleteBoards({ _id: loaded.doc._id });
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

type Geometry = { x: number; y: number; w: number; h: number };

/** Ramène une géométrie dans le panneau : un élément ne sort pas du cadre et
 *  garde une taille qu'on peut encore saisir. La position se borne sur la
 *  taille qu'aura l'élément — celle du geste si elle change, la sienne sinon —
 *  et un élément qui grandit contre le bord y est repoussé. */
function boundGeometry(patch: Partial<Geometry>, current: Geometry) {
  const w = round(clamp(patch.w ?? current.w, ELEMENT_MIN, ELEMENT_MAX));
  const h = round(clamp(patch.h ?? current.h, ELEMENT_MIN, ELEMENT_MAX));
  const x = round(clamp(patch.x ?? current.x, 0, BOARD_WIDTH - w));
  const y = round(clamp(patch.y ?? current.y, 0, BOARD_HEIGHT - h));
  const bounded: Partial<Geometry> = {};
  if (patch.w !== undefined) bounded.w = w;
  if (patch.h !== undefined) bounded.h = h;
  if (patch.x !== undefined || x !== current.x) bounded.x = x;
  if (patch.y !== undefined || y !== current.y) bounded.y = y;
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
    throw new Refus(
      kind === "image"
        ? "L'alternative d'une image tient en quelques mots."
        : "La légende d'une forme tient en quelques mots.",
    );
  }
}

/** Seule une image porte une légende sous elle. */
function checkCaption(kind: ElementKind, caption: string | undefined) {
  if (caption && kind !== "image") throw new Refus("Seule une image porte une légende.");
}

/** La corbeille d'un panneau garde ses cinquante derniers éléments. */
const REMOVED_MAX = 50;

const oid = (id: string) => new Types.ObjectId(id);

/** Applique un geste de l'éditeur. Il répond sans rediriger ni revalider : la
 *  page est déjà à jour chez celui qui l'a fait. En cas de refus, il renvoie le
 *  panneau tel qu'il est en base, pour que l'éditeur s'y range. */
export async function boardOperationAction(
  boardId: string,
  operation: BoardOperation,
): Promise<BoardOperationResult> {
  let loaded: LoadedBoard | null = null;
  let viewer: SessionUser | null = null;
  try {
    const user = await requireContributor();
    viewer = user;
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

    /** Un geste qui ne touche qu'une aide de jeu privée n'avance pas la date
     *  du panneau : « modifié le » s'affiche à tous, et la verraient bouger
     *  ceux à qui le MJ prépare la surprise. */
    const isPrivate = (element: RawElement | undefined) => element?.visibility === "prive";
    // Un geste que tout le monde voit avance aussi la révision du panneau :
    // c'est elle que les éditeurs ouverts relisent pour le suivre.
    const write = (quiet: boolean, update: Record<string, unknown>, options: Record<string, unknown> = {}) =>
      Board.updateOne(
        filter,
        (quiet ? update : { ...update, $inc: { revision: 1 } }) as never,
        quiet ? { ...options, timestamps: false } : options,
      );
    const arrowIsQuiet = (arrow: { from: unknown; to: unknown }) =>
      isPrivate(find(elements, String(arrow.from))) || isPrivate(find(elements, String(arrow.to)));

    /** La place qui reste pour un élément de cette visibilité, posé par ce
     *  compte. Partagé, il compte au plafond du panneau ; privé, à celui de
     *  son auteur et à celui de toutes les aides de jeu du panneau. */
    const checkRoom = (visibility: string | undefined) => {
      if (visibility !== "prive") {
        if (elements.filter((one) => !isPrivate(one)).length >= ELEMENTS_MAX) {
          throw new Refus(`Un panneau ne porte pas plus de ${ELEMENTS_MAX} éléments partagés.`);
        }
        return;
      }
      const privates = elements.filter(isPrivate);
      if (privates.filter((one) => one.authorId === user.id).length >= PRIVATE_ELEMENTS_PER_AUTHOR_MAX) {
        throw new Refus(
          `Vous gardez au plus ${PRIVATE_ELEMENTS_PER_AUTHOR_MAX} éléments privés sur ce panneau : partagez-en, ou retirez-en.`,
        );
      }
      if (privates.length >= PRIVATE_ELEMENTS_MAX) {
        throw new Refus(`Ce panneau ne porte pas plus de ${PRIVATE_ELEMENTS_MAX} éléments privés.`);
      }
    };

    /** Ce que ce lecteur voit du panneau : une aide de jeu privée n'existe que
     *  pour son auteur, et un geste qui la viserait reçoit la même réponse
     *  qu'un élément disparu — sans quoi on la découvrirait en devinant. */
    const seen = (element: RawElement | undefined) =>
      element && !element.hidden && canSeeBoardItem(user, element) ? element : undefined;

    /** L'élément visé, s'il existe encore et qu'on a le droit d'y toucher. */
    const target = (id: string) => {
      const element = seen(find(elements, id));
      if (!element) throw new Refus("Cet élément n'est plus sur le panneau.");
      if (!canModifyBoardItem(user, access, element.authorId)) {
        throw new Refus("Seul son auteur, ou l'équipe du lieu, touche à cet élément.");
      }
      return element;
    };
    const targetArrow = (id: string) => {
      const arrow = find(arrows, id);
      if (!arrow || !seen(find(elements, String(arrow.from))) || !seen(find(elements, String(arrow.to)))) {
        throw new Refus("Cette flèche n'est plus sur le panneau.");
      }
      if (!canModifyBoardItem(user, access, arrow.authorId)) {
        throw new Refus("Seul son auteur, ou l'équipe du lieu, touche à cette flèche.");
      }
      return arrow;
    };

    switch (op.type) {
      case "poser": {
        const { id, kind, text, size, stroke, fill, ink, src: rawSrc, caption, visibility, ...geometry } =
          op.element;
        checkRoom(visibility);
        if (find(elements, id) || find(removed, id)) throw new Refus("Cet élément existe déjà.");
        checkColor("stroke", stroke);
        checkColor("fill", fill);
        checkColor("ink", ink);
        checkText(kind, text);
        checkCaption(kind, caption);
        // Une image vient du magasin, et du dossier de panneau de celui qui la
        // pose — ou d'un élément déjà sur ce panneau, quand on la duplique.
        // Une autre adresse ferait de ce panneau la cause du ménage d'une
        // image qui n'est pas la sienne.
        const src = kind === "image" ? (rawSrc ?? "") : "";
        if (kind === "image") {
          const known = boardImagesOf(
            [...elements, ...removed].filter((one) => canSeeBoardItem(user, one)),
          ).includes(src);
          if (!isBoardImageOf(src, user.id) && !known) {
            throw new Refus("Cette image n'a pas été téléversée pour ce panneau.");
          }
        }
        await write(visibility === "prive", {
          $push: {
            elements: {
              _id: oid(id),
              kind,
              ...boundGeometry(geometry, geometry),
              z: (zs.length ? Math.max(...zs) : 0) + 1,
              text,
              size,
              stroke,
              fill,
              ink,
              src,
              caption: kind === "image" ? (caption ?? "") : "",
              visibility: visibility ?? "partage",
              authorId: user.id,
              createdAt: new Date(),
            },
          },
        });
        break;
      }

      case "modifier": {
        const element = target(op.id);
        const { x, y, w, h, stroke, fill, ink, ...rest } = op.patch;
        // Dévoiler une aide de jeu, ou la reprendre, reste le geste de son
        // auteur, même sur un panneau de groupe où chacun range tout.
        if (rest.visibility !== undefined && !canRevealBoardItem(user, element.authorId)) {
          throw new Refus("Seul son auteur partage cet élément ou le rend privé.");
        }
        const revealing = rest.visibility !== undefined && rest.visibility !== (element.visibility ?? "partage");
        if (revealing) {
          checkRoom(rest.visibility);
          // Un élément signalé reste là où la modération le cherche : passé
          // privé, il disparaîtrait de la page que suit le modérateur, et se
          // repartagerait une fois le signalement classé.
          if (
            rest.visibility === "prive" &&
            (await Report.exists({
              targetType: "element-panneau",
              targetId: element._id,
              status: "en-attente",
            } as never))
          ) {
            throw new Refus("Cet élément est signalé : il reste partagé le temps que l'équipe le regarde.");
          }
        }
        checkColor("stroke", stroke);
        checkColor("fill", fill);
        checkColor("ink", ink);
        checkText(element.kind as ElementKind, rest.text);
        checkCaption(element.kind as ElementKind, rest.caption);
        const patch = {
          ...boundGeometry({ x, y, w, h }, element as Geometry),
          ...rest,
          stroke,
          fill,
          ink,
        };
        const set: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(patch)) {
          if (value !== undefined) set[`elements.$[e].${key}`] = value;
        }
        if (Object.keys(set).length === 0) break;
        await write(isPrivate(element) && !revealing, { $set: set }, {
          arrayFilters: [{ "e._id": oid(op.id) }],
        });
        break;
      }

      case "plan": {
        const element = target(op.id);
        const z = op.sens === "avant" ? Math.max(0, ...zs) + 1 : Math.min(0, ...zs) - 1;
        await write(isPrivate(element), { $set: { "elements.$[e].z": z } }, {
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
        // n'archive pas le panneau. Ce qui en sort par le fond ne se rétablira
        // plus, et son image part au magasin.
        const evicted = removed.slice(0, Math.max(0, removed.length + 1 - REMOVED_MAX));
        await write(isPrivate(element), {
          $pull: { elements: { _id: id }, arrows: { $or: [{ from: id }, { to: id }] } },
          $push: {
            removed: { $each: [element], $slice: -REMOVED_MAX },
            removedArrows: { $each: attached, $slice: -100 },
          },
        });
        await releaseBoardImages(boardImagesOf(evicted));
        break;
      }

      case "retablir": {
        const element = find(removed, op.id);
        if (!element || !canSeeBoardItem(user, element)) {
          throw new Refus("Cet élément ne peut plus être rétabli.");
        }
        if (find(elements, op.id)) break;
        if (!canModifyBoardItem(user, access, element.authorId)) {
          throw new Refus("Seul son auteur, ou l'équipe du lieu, rétablit cet élément.");
        }
        checkRoom(element.visibility ?? undefined);
        // Ses flèches reviennent avec lui, quand leur autre bout est encore là.
        const present = new Set(elements.map((one) => String(one._id)).concat(op.id));
        const back = removedArrows.filter(
          (arrow) =>
            (String(arrow.from) === op.id || String(arrow.to) === op.id) &&
            present.has(String(arrow.from)) &&
            present.has(String(arrow.to)) &&
            !find(arrows, String(arrow._id)),
        );
        await write(isPrivate(element), {
          $pull: {
            removed: { _id: oid(op.id) },
            removedArrows: { _id: { $in: back.map((arrow) => arrow._id) } },
          },
          $push: { elements: element, arrows: { $each: back } },
        });
        break;
      }

      case "relier": {
        const { id, from, to, ...style } = op.arrow;
        // Comme les éléments : une flèche qui touche une aide de jeu privée ne
        // prend pas la place des flèches que tout le monde voit.
        const quiet = arrowIsQuiet({ from, to });
        if (arrows.filter((one) => arrowIsQuiet(one) === quiet).length >= ARROWS_MAX) {
          throw new Refus(`Un panneau ne porte pas plus de ${ARROWS_MAX} flèches.`);
        }
        if (from === to) throw new Refus("Une flèche relie deux éléments différents.");
        const ends = [seen(find(elements, from)), seen(find(elements, to))];
        if (ends.some((end) => !end)) {
          throw new Refus("L'un des deux éléments n'est plus sur le panneau.");
        }
        if (find(arrows, id) || find(removedArrows, id)) throw new Refus("Cette flèche existe déjà.");
        checkColor("stroke", style.color);
        await write(quiet, {
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
        });
        break;
      }

      case "modifier-fleche": {
        const arrow = targetArrow(op.id);
        checkColor("stroke", op.patch.color);
        const set: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(op.patch)) {
          if (value !== undefined) set[`arrows.$[a].${key}`] = value;
        }
        if (Object.keys(set).length === 0) break;
        // Une flèche d'avant les bouts séparés les range à sa première
        // modification, et perd l'ancien champ.
        const legacy = arrow.startTip === undefined || arrow.endTip === undefined;
        if (legacy) {
          const tips = tipsFromHeads(arrow.heads);
          set["arrows.$[a].startTip"] ??= arrow.startTip ?? tips.startTip;
          set["arrows.$[a].endTip"] ??= arrow.endTip ?? tips.endTip;
        }
        const update = legacy ? { $set: set, $unset: { "arrows.$[a].heads": "" } } : { $set: set };
        await write(arrowIsQuiet(arrow), update, {
          arrayFilters: [{ "a._id": oid(op.id) }],
        });
        break;
      }

      case "retirer-fleche": {
        const arrow = targetArrow(op.id);
        await write(arrowIsQuiet(arrow), {
          $pull: { arrows: { _id: oid(op.id) } },
          $push: { removedArrows: { $each: [arrow], $slice: -100 } },
        });
        break;
      }

      case "retablir-fleche": {
        const arrow = find(removedArrows, op.id);
        if (!arrow) throw new Refus("Cette flèche ne peut plus être rétablie.");
        if (find(arrows, op.id)) break;
        if (!canModifyBoardItem(user, access, arrow.authorId)) {
          throw new Refus("Seul son auteur, ou l'équipe du lieu, rétablit cette flèche.");
        }
        if (!seen(find(elements, String(arrow.from))) || !seen(find(elements, String(arrow.to)))) {
          throw new Refus("L'un des deux éléments n'est plus sur le panneau.");
        }
        await write(arrowIsQuiet(arrow), {
          $pull: { removedArrows: { _id: oid(op.id) } },
          $push: { arrows: arrow },
        });
        break;
      }
    }

    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Refus || error instanceof Error
        ? error.message
        : "La modification n'a pas été enregistrée.";
    return { ok: false, message, content: await freshContent(loaded, viewer) };
  }
}

/** Le panneau tel qu'il est en base, pour que l'éditeur s'y range après un
 *  refus. */
async function freshContent(
  loaded: LoadedBoard | null,
  viewer: SessionUser | null,
): Promise<BoardContent | undefined> {
  if (!loaded) return undefined;
  const again = await loadBoard(String(loaded.doc._id));
  return again ? serializeContent(again.doc, viewer) : undefined;
}
