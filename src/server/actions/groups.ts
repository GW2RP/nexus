"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  collectMarkdownImages,
  deleteOrphanedImages,
  deleteUploadedImages,
} from "@/lib/blob";
import { canManageGroup } from "@/lib/permissions";
import { uniqueSlug } from "@/lib/slug";
import { Board } from "@/models/board";
import { Event } from "@/models/event";
import { Group } from "@/models/group";
import {
  invalidate,
  TAGS,
  errorState,
  objectIdOrNull,
  parseForm,
  requireContributor,
  successState,
  toActionState,
  type ActionState,
} from "@/server/actions/helpers";
import { groupSchema } from "@/server/actions/schemas";

async function slugTaken(candidate: string) {
  return Boolean(await Group.exists({ slug: candidate }));
}

/** Les chemins qu'une écriture de groupe périme. L'agenda en dépend aussi :
 *  entrer dans un cercle ouvre ses scènes privées à celui qui entre. */
function refreshGroupPaths(slug?: string) {
  invalidate(TAGS.groups, TAGS.events);
  if (slug) revalidatePath(`/groupes/${slug}`);
  revalidatePath("/groupes");
  revalidatePath("/evenements");
}

export async function createGroupAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let slug: string;
  try {
    const user = await requireContributor();
    const parsed = parseForm(groupSchema, formData);
    if (!parsed.ok) return parsed.state;

    const { memberIds, ...rest } = parsed.data;
    slug = await uniqueSlug(parsed.data.name, slugTaken);
    await Group.create({
      ...rest,
      slug,
      authorId: user.id,
      // Le meneur est membre de droit : le compter deux fois fausserait le total.
      memberIds: [...new Set(memberIds)].filter((id) => id !== user.id),
    });
  } catch (error) {
    return toActionState(error);
  }

  refreshGroupPaths();
  redirect(`/groupes/${slug}`);
}

export async function updateGroupAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let slug: string;
  try {
    const user = await requireContributor();
    const id = objectIdOrNull(formData.get("id"));
    const existing = id ? await Group.findById(id) : null;
    if (!existing) return errorState("Ce groupe n'existe plus.");
    if (!canManageGroup(user, { authorId: existing.authorId })) {
      return errorState("Ce groupe est mené par quelqu'un d'autre.");
    }

    const parsed = parseForm(groupSchema, formData);
    if (!parsed.ok) return parsed.state;

    const previousImages = [existing.bannerUrl, ...collectMarkdownImages(existing.description)];

    const { memberIds, ...rest } = parsed.data;
    existing.set({
      ...rest,
      memberIds: [...new Set(memberIds)].filter((memberId) => memberId !== existing.authorId),
    });
    await existing.save();
    slug = existing.slug;

    await deleteOrphanedImages(
      previousImages,
      [existing.bannerUrl, ...collectMarkdownImages(existing.description)],
      existing.authorId,
    );
  } catch (error) {
    return toActionState(error);
  }

  refreshGroupPaths(slug);
  redirect(`/groupes/${slug}`);
}

export async function deleteGroupAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireContributor();
    const id = objectIdOrNull(formData.get("id"));
    const existing = id ? await Group.findById(id) : null;
    if (!existing) return errorState("Ce groupe n'existe plus.");
    if (!canManageGroup(user, { authorId: existing.authorId })) {
      return errorState("Ce groupe est mené par quelqu'un d'autre.");
    }

    const images = [existing.bannerUrl, ...collectMarkdownImages(existing.description)];
    // Les scènes qui lui étaient associées ne disparaissent pas : elles restent
    // privées, et leurs invités nommés continuent de les voir. Les laisser
    // pointer un groupe dissous les rendrait invisibles pour tout le monde.
    await Event.updateMany({ groupId: existing._id } as never, { $unset: { groupId: "" } });
    // Ses panneaux, eux, n'existent que par lui : ils partent avec.
    await Board.deleteMany({ groupId: existing._id } as never);
    await existing.deleteOne();
    await deleteUploadedImages(images, existing.authorId);
  } catch (error) {
    return toActionState(error);
  }

  refreshGroupPaths();
  redirect("/groupes");
}

/** Ajouter un membre au cercle, ou l'en retirer. C'est au meneur, et à lui
 *  seul : un membre qui pourrait en adjoindre d'autres rendrait la liste
 *  incontrôlable pour celui qui a fondé le groupe. */
export async function toggleGroupMemberAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireContributor();
    const id = objectIdOrNull(formData.get("groupId"));
    const memberId = objectIdOrNull(formData.get("userId"));
    const retirer = formData.get("retirer") === "1";

    const group = id ? await Group.findById(id) : null;
    if (!group) return errorState("Ce groupe n'existe plus.");
    if (!canManageGroup(user, { authorId: group.authorId })) {
      return errorState("Ce groupe est mené par quelqu'un d'autre.");
    }
    if (!memberId) return errorState("Ce compte n'existe pas.");
    if (memberId === group.authorId) {
      return errorState("Le meneur est membre de droit : il ne s'ajoute ni ne se retire.");
    }

    const membres = new Set(group.memberIds ?? []);
    if (retirer) membres.delete(memberId);
    else if (membres.size >= 100) return errorState("Un groupe ne compte pas plus de cent membres.");
    else membres.add(memberId);

    group.memberIds = [...membres];
    await group.save();

    refreshGroupPaths(group.slug);
    return successState(retirer ? "Ce membre quitte le cercle." : "Ce membre rejoint le cercle.");
  } catch (error) {
    return toActionState(error);
  }
}

/** Quitter un groupe de soi-même. Le meneur, lui, le dissout — il n'en sort pas. */
export async function leaveGroupAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireContributor();
    const id = objectIdOrNull(formData.get("groupId"));
    const group = id ? await Group.findById(id) : null;
    if (!group) return errorState("Ce groupe n'existe plus.");
    if (group.authorId === user.id) {
      return errorState("Vous menez ce groupe : dissolvez-le plutôt que d'en sortir.");
    }
    if (!(group.memberIds ?? []).includes(user.id)) {
      return errorState("Vous n'êtes pas membre de ce groupe.");
    }

    group.memberIds = (group.memberIds ?? []).filter((memberId) => memberId !== user.id);
    await group.save();
  } catch (error) {
    return toActionState(error);
  }

  refreshGroupPaths();
  redirect("/groupes");
}
