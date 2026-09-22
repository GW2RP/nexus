"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Model } from "mongoose";

import { collectMarkdownImages, deleteUploadedImages } from "@/lib/blob";
import { plainExcerpt } from "@/lib/boards";
import type { ReportTarget } from "@/lib/domain";
import { canSeeBoard } from "@/lib/permissions";
import { Board } from "@/models/board";
import { Character } from "@/models/character";
import { Event } from "@/models/event";
import { ModerationLog } from "@/models/moderation-log";
import { Place } from "@/models/place";
import { Registration } from "@/models/registration";
import { Report } from "@/models/report";
import { Rumor } from "@/models/rumor";
import { User } from "@/models/user";
import {
  deleteBoardElement,
  loadBoardOfElement,
  setBoardElementHidden,
} from "@/server/boards";
import {
  invalidate,
  TAGS,
  errorState,
  objectIdOrNull,
  parseForm,
  requireAdmin,
  requireContributor,
  successState,
  toActionState,
  type ActionState,
} from "@/server/actions/helpers";
import { reportSchema, resolveReportSchema } from "@/server/actions/schemas";

/** Les contenus qui sont des documents à eux. Un élément de panneau n'en est
 *  pas un : il vit dans son panneau, et se traite à part. */
type DocumentTarget = Exclude<ReportTarget, "element-panneau">;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MODELS: Record<DocumentTarget, Model<any>> = {
  rumeur: Rumor,
  personnage: Character,
  lieu: Place,
  evenement: Event,
};

/** Les images qu'un contenu porte, quel que soit son type : celles de ses champs
 *  d'image, et celles que son auteur a glissées dans ses textes longs. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function imagesOf(document: any): (string | null | undefined)[] {
  return [
    document?.portraitUrl,
    document?.bannerUrl,
    document?.logoUrl,
    document?.floorPlan?.imageUrl,
    ...(document?.floorPlans ?? []).map((plan: { imageUrl?: string }) => plan?.imageUrl),
    ...collectMarkdownImages(document?.description, document?.story, document?.appearance),
  ];
}

/** L'extrait est figé au moment du signalement : le contenu peut changer ensuite,
 *  l'équipe doit voir ce qui a été signalé. */
async function excerptOf(targetType: DocumentTarget, targetId: string): Promise<string | null> {
  const document = await MODELS[targetType].findById(targetId).lean();
  if (!document) return null;
  const raw =
    (document as { body?: string; summary?: string; title?: string; name?: string }).body ??
    (document as { summary?: string }).summary ??
    (document as { title?: string }).title ??
    (document as { name?: string }).name ??
    null;
  return raw ? String(raw).slice(0, 400) : null;
}

export async function createReportAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireContributor();
    const parsed = parseForm(reportSchema, formData);
    if (!parsed.ok) return parsed.state;

    const targetId = objectIdOrNull(parsed.data.targetId);
    if (!targetId) return errorState("Ce contenu n'existe plus.");

    let authorId: string | undefined;
    let excerpt: () => Promise<string | null>;
    let targetSlug = parsed.data.targetSlug;
    if (parsed.data.targetType === "element-panneau") {
      // Un élément se signale depuis son panneau, et seulement par qui le lit :
      // un panneau réservé aux membres ne se découvre pas en devinant ses éléments.
      const found = await loadBoardOfElement(targetId);
      if (!found || found.element.hidden || !canSeeBoard(user, found.access)) {
        return errorState("Ce contenu n'existe plus.");
      }
      authorId = found.element.authorId;
      excerpt = async () => plainExcerpt(found.element.text ?? "", 400) || null;
      // Le chemin se lit en base, pas dans le formulaire : c'est lui que
      // l'équipe suivra.
      targetSlug = `${found.path}?element=${targetId}`;
    } else {
      const targetType = parsed.data.targetType;
      const target = await MODELS[targetType].findById(targetId).lean();
      if (!target) return errorState("Ce contenu n'existe plus.");
      authorId = (target as { authorId?: string }).authorId;
      excerpt = () => excerptOf(targetType, targetId);
    }
    // On ne signale jamais son propre contenu : l'auteur voit « Modifier » à la place.
    if (authorId === user.id) {
      return errorState("C'est votre contenu : modifiez-le plutôt que de le signaler.");
    }

    const already = await Report.findOne({
      targetType: parsed.data.targetType,
      targetId,
      reporterId: user.id,
    });
    if (already) return successState("Vous aviez déjà signalé ce contenu. L'équipe le regarde.");

    await Report.create({
      ...parsed.data,
      targetId,
      targetSlug,
      targetExcerpt: await excerpt(),
      reporterId: user.id,
      status: "en-attente",
    });
  } catch (error) {
    return toActionState(error);
  }

  revalidatePath("/admin/signalements");
  return successState("Merci : l'équipe regarde ce signalement sous 24 h.");
}

/** Trancher un signalement. Toute décision est inscrite au journal avec son auteur,
 *  sa date et son motif. */
export async function resolveReportAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const moderator = await requireAdmin();
    const parsed = parseForm(resolveReportSchema, formData);
    if (!parsed.ok) return parsed.state;

    const reportId = objectIdOrNull(parsed.data.reportId);
    const report = reportId ? await Report.findById(reportId) : null;
    if (!report) return errorState("Ce signalement n'existe plus.");

    const targetType = report.targetType as ReportTarget;

    if (targetType === "element-panneau") {
      await resolveBoardElement(String(report.targetId), parsed.data.decision);
    } else {
      const model = MODELS[targetType];
      const target = await model.findById(report.targetId);

      switch (parsed.data.decision) {
        case "supprimer":
          if (target) {
            // Une suppression de modération emporte l'image, comme celle d'un
            // auteur. « Masquer » et « suspendre » la gardent : le contenu peut
            // être rétabli.
            const images = imagesOf(target);
            const authorId = target.authorId as string;
            // Un évènement supprimé laisserait sinon ses inscriptions derrière lui,
            // comme le fait déjà `deleteEventAction`.
            if (targetType === "evenement") {
              await Registration.deleteMany({ eventId: target._id });
            }
            await target.deleteOne();
            await deleteUploadedImages(images, authorId);
          }
          break;
        case "masquer":
          if (target) {
            target.set({ hidden: true });
            await target.save();
          }
          break;
        case "suspendre": {
          const authorId = target?.authorId as string | undefined;
          if (authorId) {
            // Une suspension court trente jours ; l'administration peut la lever ensuite.
            const until = new Date(Date.now() + 30 * 86_400_000);
            await User.findByIdAndUpdate(authorId, { suspendedUntil: until });
          }
          if (target) {
            target.set({ hidden: true });
            await target.save();
          }
          break;
        }
        case "avertir":
        case "rejeter":
        default:
          break;
      }
      if (targetType === "lieu" && parsed.data.decision === "supprimer") {
        // Le panneau d'un lieu part avec lui.
        await Board.deleteMany({ placeId: report.targetId } as never);
      }
    }

    const status = parsed.data.decision === "rejeter" ? "rejete" : "traite";

    // Les autres signalements du même contenu se referment avec lui.
    await Report.updateMany(
      { targetType, targetId: report.targetId, status: "en-attente" },
      {
        status,
        resolvedBy: moderator.id,
        resolvedAt: new Date(),
        resolutionNote: parsed.data.reason,
      },
    );

    await ModerationLog.create({
      action: parsed.data.decision,
      targetType,
      targetId: report.targetId,
      targetExcerpt: report.targetExcerpt,
      reportId: report._id,
      reason: parsed.data.reason,
      notifyAuthor: parsed.data.notifyAuthor,
      moderatorId: moderator.id,
    });
  } catch (error) {
    return toActionState(error);
  }

  // Une décision de modération peut supprimer ou masquer n'importe quel type de
  // contenu, et le signalement ne dit pas toujours lequel a bougé : on retire
  // les quatre familles plutôt que de deviner.
  invalidate(TAGS.characters, TAGS.places, TAGS.events, TAGS.rumors);
  revalidatePath("/admin/signalements");
  redirect("/admin/signalements");
}

/** La décision sur un élément de panneau. Il n'a pas de document à lui : on le
 *  retire de son panneau, ou on l'y masque. Aucune image à emporter — un
 *  panneau n'en porte pas. */
async function resolveBoardElement(elementId: string, decision: string): Promise<void> {
  const found = await loadBoardOfElement(elementId);
  if (!found) return;
  switch (decision) {
    case "supprimer":
      await deleteBoardElement(elementId);
      break;
    case "masquer":
      await setBoardElementHidden(elementId, true);
      break;
    case "suspendre": {
      const until = new Date(Date.now() + 30 * 86_400_000);
      await User.findByIdAndUpdate(found.element.authorId, { suspendedUntil: until });
      await setBoardElementHidden(elementId, true);
      break;
    }
    default:
      break;
  }
  revalidatePath(found.path);
}
