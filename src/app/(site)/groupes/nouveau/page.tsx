import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { GroupForm } from "@/components/forms/group-form";
import { PageHeader } from "@/components/ui/page-header";
import { canContribute } from "@/lib/permissions";
import { buildMetadata } from "@/lib/seo";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = buildMetadata({
  title: "Créer un groupe",
  description: "Fonder un cercle sur le hub GW2RP Nexus.",
  path: "/groupes/nouveau",
  noIndex: true,
});

export default async function NewGroupPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?suite=/groupes/nouveau");
  if (!canContribute(user)) redirect("/groupes");

  return (
    <div className="mx-auto max-w-[1280px] px-gutter-mobile py-10 lg:px-gutter-desktop">
      <PageHeader eyebrow="GROUPES" title="Créer un groupe" />
      <GroupForm ownerId={user.id} />
    </div>
  );
}
