import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { AdminPasswordForm } from "@/components/forms/admin-password-form";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { buildMetadata } from "@/lib/seo";
import { getCurrentUser } from "@/lib/session";
import { getUserName } from "@/server/queries/users";

export const metadata: Metadata = buildMetadata({
  title: "Mot de passe d'un compte",
  description: "Poser un nouveau mot de passe sur un compte du hub.",
  path: "/admin/utilisateurs",
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default async function UserPasswordPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, viewer] = await Promise.all([params, getCurrentUser()]);
  // Le sien se change avec l'ancien, depuis son compte.
  if (viewer?.id === id) redirect("/mon-compte/mot-de-passe");
  const name = await getUserName(id);
  if (!name) notFound();

  return (
    <div className="mx-auto max-w-[560px]">
      <PageHeader eyebrow="MOT DE PASSE" title={name} />
      <Card accent className="p-7">
        <AdminPasswordForm userId={id} />
      </Card>
    </div>
  );
}
