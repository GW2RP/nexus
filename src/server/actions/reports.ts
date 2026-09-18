"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Model } from "mongoose";

import { deleteUploadedImages } from "@/lib/blob";
import type { ReportTarget } from "@/lib/domain";
import { Character } from "@/models/character";
import { Event } from "@/models/event";
import { ModerationLog } from "@/models/moderation-log";
import { Place } from "@/models/place";
import { Registration } from "@/models/registration";
import { Report } from "@/models/report";
import { Rumor } from "@/models/rumor";
import { User } from "@/models/user";
import {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MODELS: Record<ReportTarget, Model<any>> = {
  rumeur: Rumor,
  personnage: Character,
  lieu: Place,
  evenement: Event,
};

/** Les images qu'un contenu porte, quel que soit son type. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function imagesOf(document: any): (string | null | undefined)[] {
  return [document?.portraitUrl, document?.bannerUrl, document?.logoUrl, document?.floorPlan?.imageUrl];
}

/** L'extrait est figé au moment du signalement : le contenu peut changer ensuite,
 *  l'équipe doit voir ce qui a été signalé. */
async function excerptOf(targetType: ReportTarget, targetId: string): Promise<string | null> {
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

    const target = await MODELS[parsed.data.targetType].findById(targetId).lean();
    if (!target) return errorState("Ce contenu n'existe plus.");
    // On ne signale jamais son propre contenu : l'auteur voit « Modifier » à la place.
    if ((target as { authorId?: string }).authorId === user.id) {
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
      targetExcerpt: await excerptOf(parsed.data.targetType, targetId),
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

  revalidatePath("/admin/signalements");
  redirect("/admin/signalements");
}
