import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PasswordChangeForm } from "@/components/forms/password-change-form";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { buildMetadata } from "@/lib/seo";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = buildMetadata({
  title: "Changer de mot de passe",
  description: "Changer le mot de passe de son compte sur le hub GW2RP Nexus.",
  path: "/mon-compte/mot-de-passe",
  noIndex: true,
});

/** Un compte suspendu garde sa porte : il peut toujours changer son mot de
 *  passe, la suspension ne retire que le droit de publier. */
export default async function PasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?suite=/mon-compte/mot-de-passe");

  return (
    <div className="mx-auto max-w-[560px] px-gutter-mobile py-12 md:px-gutter-app xl:px-gutter-desktop">
      <PageHeader eyebrow="MON COMPTE" title="Changer de mot de passe" />
      <Card accent className="p-7">
        <PasswordChangeForm />
      </Card>
    </div>
  );
}
