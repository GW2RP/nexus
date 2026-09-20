import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { GroupForm } from "@/components/forms/group-form";
import { PageHeader } from "@/components/ui/page-header";
import { canManageGroup } from "@/lib/permissions";
import { buildMetadata } from "@/lib/seo";
import { getCurrentUser } from "@/lib/session";
import { getGroupBySlug } from "@/server/queries/groups";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildMetadata({
    title: "Modifier le groupe",
    description: "Modifier un cercle du hub.",
    path: `/groupes/${slug}/modifier`,
    noIndex: true,
  });
}

export default async function EditGroupPage({ params }: Props) {
  const { slug } = await params;
  // La session se lit avant le groupe : un cercle privé est introuvable pour
  // qui n'en est pas, son meneur compris s'il n'est pas reconnu.
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?suite=/groupes/${slug}/modifier`);

  const group = await getGroupBySlug(slug, user);
  if (!group) notFound();
  if (!canManageGroup(user, { authorId: group.authorId })) redirect(`/groupes/${slug}`);

  return (
    <div className="mx-auto max-w-[1280px] px-gutter-mobile py-10 lg:px-gutter-desktop">
      <PageHeader eyebrow="GROUPES" title={`Modifier ${group.name}`} />
      <GroupForm ownerId={group.authorId} group={group} />
    </div>
  );
}
